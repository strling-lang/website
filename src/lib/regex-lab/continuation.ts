import type { LabExecutionRequest, LabExecutionResult } from './contracts.ts';
import { isScalarText, limits } from './interactive.ts';
import { coordinateMap } from './offsets.ts';

export interface ScanAnchor {
  ordinal: number;
  start: number;
  end: number;
}

const contract = {
  schema: 'strling-lab-continuation-v1',
  operation: 'scan',
  provider: 'interactive-browser-v1',
  providerVersion: '1.0.0',
  unit: 'utf8-bytes',
  progression: 'pcre2-global-v1',
  state: 'complete',
  matchLimit: limits.matches,
  outputLimit: limits.output,
} as const;

export interface ScanContinuation {
  schema: typeof contract.schema;
  operation: typeof contract.operation;
  provider: typeof contract.provider;
  providerVersion: typeof contract.providerVersion;
  unit: typeof contract.unit;
  progression: typeof contract.progression;
  state: typeof contract.state;
  matchLimit: number;
  outputLimit: number;
  profileReleaseId: string;
  runtimeVersion: string;
  build: string;
  sourceDigest: string;
  patternDigest: string;
  subjectDigest: string;
  optionsDigest: string;
  provenanceDigest: string;
  after: ScanAnchor;
}

export interface ScanProvenance {
  format: string;
  source: string;
  profile?: string;
  compiler?: string;
}

const digestPattern = /^[a-f0-9]{64}$/;
const profilePattern = /^interactive:pcre2(?:42|43)?@1$/;
const versionPattern = /^10\.(?:42|43|49)(?: [\w-]+)?$/;

async function digest(text: string) {
  const bytes = new TextEncoder().encode(text);
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

function isAnchor(value: unknown): value is ScanAnchor {
  if (!value || typeof value !== 'object') return false;
  const { ordinal, start, end } = value as ScanAnchor;
  return (
    Number.isSafeInteger(ordinal) &&
    ordinal >= 1 &&
    ordinal < limits.matches &&
    Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= limits.input * 3
  );
}

export function readContinuation(value: unknown): ScanContinuation | undefined {
  if (value === undefined) return;
  if (value === null || typeof value !== 'object')
    throw new Error('Invalid saved scan continuation.');
  const entry = value as ScanContinuation;
  const {
    profileReleaseId,
    runtimeVersion,
    build,
    sourceDigest,
    patternDigest,
    subjectDigest,
    optionsDigest,
    provenanceDigest,
    after,
  } = entry;
  if (
    !Object.entries(contract).every(
      ([key, expected]) => entry[key as keyof typeof contract] === expected,
    ) ||
    typeof profileReleaseId !== 'string' ||
    !profilePattern.test(profileReleaseId) ||
    typeof runtimeVersion !== 'string' ||
    !versionPattern.test(runtimeVersion) ||
    ![
      build,
      sourceDigest,
      patternDigest,
      subjectDigest,
      optionsDigest,
      provenanceDigest,
    ].every(
      (field) => typeof field === 'string' && digestPattern.test(field),
    ) ||
    !isAnchor(after)
  )
    throw new Error('Invalid saved scan continuation.');
  return {
    ...contract,
    profileReleaseId,
    runtimeVersion,
    build,
    sourceDigest,
    patternDigest,
    subjectDigest,
    optionsDigest,
    provenanceDigest,
    after: { ordinal: after.ordinal, start: after.start, end: after.end },
  };
}

async function binding(
  request: LabExecutionRequest,
  provenance: ScanProvenance,
) {
  if (
    ![request.pattern, request.input, provenance.source].every(isScalarText)
  ) {
    throw new Error(
      'Continuation requires well-formed UTF-8 source and subject.',
    );
  }
  const options = Object.keys(request.options)
    .sort()
    .map((key) => [key, request.options[key]]);
  const [
    patternDigest,
    subjectDigest,
    sourceDigest,
    optionsDigest,
    provenanceDigest,
  ] = await Promise.all([
    digest(request.pattern),
    digest(request.input),
    digest(provenance.source),
    digest(JSON.stringify(options)),
    digest(
      JSON.stringify([
        provenance.format,
        provenance.profile,
        provenance.compiler,
      ]),
    ),
  ]);
  return {
    patternDigest,
    subjectDigest,
    sourceDigest,
    optionsDigest,
    provenanceDigest,
  };
}

export async function createContinuation(
  request: LabExecutionRequest,
  result: LabExecutionResult,
  provenance: ScanProvenance,
  ordinal: number,
) {
  if (
    result.status !== 'matched' ||
    result.requestId !== request.requestId ||
    request.operationId !== 'scan' ||
    result.provider?.providerId !== contract.provider ||
    result.observation?.indexUnit !== contract.unit ||
    result.observation?.providerVersion !== contract.providerVersion ||
    result.engineNativeMetadata?.resumedFrom !== undefined
  )
    return;
  const match = result.matches[ordinal - 1];
  if (
    !match ||
    ordinal >= result.matches.length ||
    match.span.start >= match.span.end
  )
    return;
  return readContinuation({
    ...contract,
    profileReleaseId: result.profileReleaseId,
    runtimeVersion: result.observation.runtimeVersion,
    build: result.engineNativeMetadata?.providerBuild,
    ...(await binding(request, provenance)),
    after: { ordinal, start: match.span.start, end: match.span.end },
  });
}

export async function verifyContinuation(
  continuation: ScanContinuation,
  request: LabExecutionRequest,
  provenance: ScanProvenance,
) {
  if (
    request.operationId !== continuation.operation ||
    request.runtime.profileReleaseId !== continuation.profileReleaseId
  ) {
    throw new Error(
      'The runtime profile or operation differs from the saved scan.',
    );
  }
  const current = await binding(request, provenance);
  if (
    Object.entries(current).some(
      ([key, value]) => continuation[key as keyof typeof current] !== value,
    )
  ) {
    throw new Error(
      'Source, subject, options, or compiler provenance differs from the saved scan.',
    );
  }
  const positions = coordinateMap(request.input, continuation.unit);
  if (
    !positions.has(continuation.after.start) ||
    !positions.has(continuation.after.end)
  ) {
    throw new Error('The saved cursor is outside a UTF-8 boundary.');
  }
}
