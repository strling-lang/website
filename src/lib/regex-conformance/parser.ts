import {
  CHECKPOINT_INDEX_SCHEMA,
  COMPATIBILITY_PROJECTION_SCHEMA,
  COVERAGE_CHECKPOINT_SCHEMA,
  CheckpointValidationError,
  EVIDENCE_MANIFEST_SCHEMA,
  LAB_PROJECTION_SCHEMA,
  type CheckpointIndexEntryV1,
  type CheckpointIndexV1,
  type CheckpointValidationIssue,
  type CompatibilityFindingProjection,
  type CompatibilityProjectionV1,
  type CompatibilityState,
  type CoverageCheckpointV1,
  type EvidenceManifestV1,
  type FileIdentity,
  type LabOptionDefinition,
  type LabProfileProjection,
  type LabProjectionV1,
  type ProfileDimensionValue,
  type ProfileReleaseIdentity,
  type RawCheckpointBundle,
  type SemanticSnapshotIdentity,
  type ValidatedCheckpoint,
  type ValidatedCheckpointBundle,
} from './contracts.ts';
import { isSha256Digest, sha256Json } from './digest.ts';

type JsonObject = Record<string, unknown>;

const compatibilityStates = new Set<CompatibilityState>([
  'supported',
  'unsupported',
  'conditional',
  'not-applicable',
  'not-tested',
  'unknown-insufficient-evidence',
]);

const objectAt = (value: unknown): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
const stringAt = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;
const nullableStringAt = (value: unknown): string | null | undefined =>
  value === null ? null : typeof value === 'string' ? value : undefined;
const integerAt = (value: unknown): number | null =>
  Number.isInteger(value) && (value as number) > 0 ? (value as number) : null;
const stringArrayAt = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => stringAt(item) !== null)
    ? [...value]
    : null;
const scalarRecordAt = (
  value: unknown,
): Record<string, boolean | string | number | null> | null => {
  const record = objectAt(value);
  if (
    !record ||
    !Object.values(record).every(
      (item) =>
        item === null || ['boolean', 'string', 'number'].includes(typeof item),
    )
  ) {
    return null;
  }
  return record as Record<string, boolean | string | number | null>;
};

function issue(
  issues: CheckpointValidationIssue[],
  code: CheckpointValidationIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function parseSemanticSnapshot(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): SemanticSnapshotIdentity | null {
  const record = objectAt(value);
  const snapshotId = stringAt(record?.snapshotId);
  const digest = record?.digest;
  if (!record || !snapshotId || !isSha256Digest(digest)) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'Semantic snapshot requires a non-empty snapshotId and sha256 digest.',
    );
    return null;
  }
  return { snapshotId, digest };
}

function parseFileIdentity(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): FileIdentity | null {
  const record = objectAt(value);
  const fileId = stringAt(record?.fileId);
  const filePath = stringAt(record?.path);
  const digest = record?.digest;
  if (!record || !fileId || !filePath || !isSha256Digest(digest)) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'File identity requires fileId, path, and sha256 digest.',
    );
    return null;
  }
  return { fileId, path: filePath, digest };
}

function requireSchema(
  record: JsonObject | null,
  expected: string,
  path: string,
  issues: CheckpointValidationIssue[],
): boolean {
  if (record?.schemaVersion !== expected) {
    issue(
      issues,
      'UNSUPPORTED_SCHEMA_VERSION',
      `${path}.schemaVersion`,
      `Expected ${expected}; received ${String(record?.schemaVersion)}.`,
    );
    return false;
  }
  return true;
}

function parseIndex(
  value: unknown,
  issues: CheckpointValidationIssue[],
): CheckpointIndexV1 | null {
  const record = objectAt(value);
  requireSchema(record, CHECKPOINT_INDEX_SCHEMA, 'index', issues);
  const sourceSemanticSnapshot = parseSemanticSnapshot(
    record?.sourceSemanticSnapshot,
    'index.sourceSemanticSnapshot',
    issues,
  );
  if (!Array.isArray(record?.checkpoints)) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      'index.checkpoints',
      'Checkpoint index must contain a checkpoints array.',
    );
    return null;
  }

  const checkpoints: CheckpointIndexEntryV1[] = [];
  for (const [position, candidate] of record.checkpoints.entries()) {
    const path = `index.checkpoints[${position}]`;
    const item = objectAt(candidate);
    const file = parseFileIdentity(item, path, issues);
    const sequence = integerAt(item?.sequence);
    const checkpointId = stringAt(item?.checkpointId);
    const previousCheckpointId = nullableStringAt(item?.previousCheckpointId);
    if (
      !file ||
      !sequence ||
      !checkpointId ||
      previousCheckpointId === undefined
    ) {
      issue(
        issues,
        'MALFORMED_DOCUMENT',
        path,
        'Checkpoint index entry is incomplete.',
      );
      continue;
    }
    checkpoints.push({
      ...file,
      sequence,
      checkpointId,
      previousCheckpointId,
    });
  }

  return sourceSemanticSnapshot
    ? {
        schemaVersion: CHECKPOINT_INDEX_SCHEMA,
        sourceSemanticSnapshot,
        checkpoints,
      }
    : null;
}

function parseDimension(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): ProfileDimensionValue | null {
  const record = objectAt(value);
  const dimensionId = stringAt(record?.dimensionId);
  const question = stringAt(record?.question);
  const valueId = stringAt(record?.valueId);
  const valueLabel = stringAt(record?.valueLabel);
  const order = integerAt(record?.order);
  if (!dimensionId || !question || !valueId || !valueLabel || !order) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'Profile dimension is incomplete.',
    );
    return null;
  }
  return { dimensionId, question, valueId, valueLabel, order };
}

function parseProfile(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): ProfileReleaseIdentity | null {
  const record = objectAt(value);
  const profileId = stringAt(record?.profileId);
  const releaseId = stringAt(record?.releaseId);
  const profileReleaseId = stringAt(record?.profileReleaseId);
  const displayName = stringAt(record?.displayName);
  const technicalLabel = stringAt(record?.technicalLabel);
  const labEligibility = record?.labEligibility;
  const compatibilityPublication = record?.compatibilityPublication;
  const dimensions = Array.isArray(record?.dimensions)
    ? record.dimensions
        .map((dimension, index) =>
          parseDimension(dimension, `${path}.dimensions[${index}]`, issues),
        )
        .filter((dimension): dimension is ProfileDimensionValue => !!dimension)
    : null;
  if (
    !profileId ||
    !releaseId ||
    !profileReleaseId ||
    !displayName ||
    !technicalLabel ||
    !dimensions ||
    dimensions.length === 0 ||
    !['eligible', 'ineligible'].includes(String(labEligibility)) ||
    !['published', 'withheld'].includes(String(compatibilityPublication))
  ) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'Profile identity or product readiness is malformed.',
    );
    return null;
  }
  return {
    profileId,
    releaseId,
    profileReleaseId,
    displayName,
    technicalLabel,
    dimensions,
    labEligibility: labEligibility as ProfileReleaseIdentity['labEligibility'],
    compatibilityPublication:
      compatibilityPublication as ProfileReleaseIdentity['compatibilityPublication'],
  };
}

function parseCheckpoint(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): CoverageCheckpointV1 | null {
  const record = objectAt(value);
  requireSchema(record, COVERAGE_CHECKPOINT_SCHEMA, path, issues);
  const sequence = integerAt(record?.sequence);
  const checkpointId = stringAt(record?.checkpointId);
  const previousCheckpointId = nullableStringAt(record?.previousCheckpointId);
  const sourceSemanticSnapshot = parseSemanticSnapshot(
    record?.sourceSemanticSnapshot,
    `${path}.sourceSemanticSnapshot`,
    issues,
  );
  const profileReleases = Array.isArray(record?.profileReleases)
    ? record.profileReleases
        .map((profile, index) =>
          parseProfile(profile, `${path}.profileReleases[${index}]`, issues),
        )
        .filter((profile): profile is ProfileReleaseIdentity => !!profile)
    : null;
  const projections = objectAt(record?.projections);
  const lab =
    projections?.lab === null
      ? null
      : parseFileIdentity(projections?.lab, `${path}.projections.lab`, issues);
  const compatibility =
    projections?.compatibility === null
      ? null
      : parseFileIdentity(
          projections?.compatibility,
          `${path}.projections.compatibility`,
          issues,
        );
  const evidenceManifest = parseFileIdentity(
    record?.evidenceManifest,
    `${path}.evidenceManifest`,
    issues,
  );
  if (
    !sequence ||
    !checkpointId ||
    previousCheckpointId === undefined ||
    !sourceSemanticSnapshot ||
    !profileReleases ||
    !projections ||
    !evidenceManifest ||
    (projections.lab !== null && !lab) ||
    (projections.compatibility !== null && !compatibility)
  ) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'Coverage checkpoint is incomplete.',
    );
    return null;
  }
  return {
    schemaVersion: COVERAGE_CHECKPOINT_SCHEMA,
    sequence,
    checkpointId,
    previousCheckpointId,
    sourceSemanticSnapshot,
    profileReleases,
    projections: { lab, compatibility },
    evidenceManifest,
  };
}

function parseLabProjection(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): LabProjectionV1 | null {
  const record = objectAt(value);
  requireSchema(record, LAB_PROJECTION_SCHEMA, path, issues);
  const checkpointId = stringAt(record?.checkpointId);
  const sourceSemanticSnapshot = parseSemanticSnapshot(
    record?.sourceSemanticSnapshot,
    `${path}.sourceSemanticSnapshot`,
    issues,
  );
  if (!Array.isArray(record?.profiles)) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      `${path}.profiles`,
      'Lab projection requires profiles.',
    );
    return null;
  }
  const profiles: LabProfileProjection[] = [];
  for (const [index, candidate] of record.profiles.entries()) {
    const profilePath = `${path}.profiles[${index}]`;
    const profile = objectAt(candidate);
    const profileReleaseId = stringAt(profile?.profileReleaseId);
    const nativeIndexUnit = stringAt(profile?.nativeIndexUnit);
    const rawOperations = profile?.operations;
    const operationCount = Array.isArray(rawOperations)
      ? rawOperations.length
      : null;
    const operations = Array.isArray(rawOperations)
      ? rawOperations
          .map((operation) => {
            const item = objectAt(operation);
            const operationId = stringAt(item?.operationId);
            const label = stringAt(item?.label);
            const description = stringAt(item?.description);
            return operationId && label && description
              ? { operationId, label, description }
              : null;
          })
          .filter((operation): operation is NonNullable<typeof operation> =>
            Boolean(operation),
          )
      : null;
    const rawOptions = profile?.options;
    const optionCount = Array.isArray(rawOptions) ? rawOptions.length : null;
    const options = Array.isArray(rawOptions)
      ? rawOptions
          .map((option): LabOptionDefinition | null => {
            const item = objectAt(option);
            const optionId = stringAt(item?.optionId);
            const label = stringAt(item?.label);
            const kind = item?.kind;
            const defaultValue = item?.defaultValue;
            const rawChoices = item?.choices;
            const choiceCount = Array.isArray(rawChoices)
              ? rawChoices.length
              : null;
            const choices = Array.isArray(rawChoices)
              ? rawChoices
                  .map((choice) => {
                    const value = stringAt(objectAt(choice)?.value);
                    const choiceLabel = stringAt(objectAt(choice)?.label);
                    return value && choiceLabel
                      ? { value, label: choiceLabel }
                      : null;
                  })
                  .filter((choice): choice is NonNullable<typeof choice> =>
                    Boolean(choice),
                  )
              : undefined;
            if (
              !optionId ||
              !label ||
              !['boolean', 'choice'].includes(String(kind)) ||
              (kind === 'boolean' && typeof defaultValue !== 'boolean') ||
              (kind === 'choice' && typeof defaultValue !== 'string') ||
              (kind === 'choice' &&
                (!choices ||
                  choices.length === 0 ||
                  choices.length !== choiceCount ||
                  !choices.some((choice) => choice.value === defaultValue)))
            )
              return null;
            return {
              optionId,
              label,
              kind: kind as LabOptionDefinition['kind'],
              defaultValue: defaultValue as boolean | string,
              choices,
            };
          })
          .filter((option): option is LabOptionDefinition => Boolean(option))
      : null;
    if (
      !profileReleaseId ||
      !nativeIndexUnit ||
      !operations ||
      operations.length !== operationCount ||
      !options ||
      options.length !== optionCount ||
      new Set(operations.map((operation) => operation.operationId)).size !==
        operations.length ||
      new Set(options.map((option) => option.optionId)).size !== options.length
    ) {
      issue(
        issues,
        'MALFORMED_DOCUMENT',
        profilePath,
        'Lab profile capabilities are malformed.',
      );
      continue;
    }
    profiles.push({ profileReleaseId, operations, options, nativeIndexUnit });
  }
  if (!checkpointId || !sourceSemanticSnapshot) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'Lab projection identity is incomplete.',
    );
    return null;
  }
  return {
    schemaVersion: LAB_PROJECTION_SCHEMA,
    checkpointId,
    sourceSemanticSnapshot,
    profiles,
  };
}

function parseFinding(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): CompatibilityFindingProjection | null {
  const record = objectAt(value);
  const profileReleaseId = stringAt(record?.profileReleaseId);
  const semanticFeatureId = stringAt(record?.semanticFeatureId);
  const state = record?.state;
  const conditions = stringArrayAt(record?.conditions);
  const explanation = nullableStringAt(record?.explanation);
  const scopeRecord =
    record?.testedScope === null ? null : objectAt(record?.testedScope);
  const testedScope = scopeRecord
    ? {
        operationId: stringAt(scopeRecord.operationId),
        mode: nullableStringAt(scopeRecord.mode),
        options: scalarRecordAt(scopeRecord.options),
      }
    : null;
  const evidenceRecord =
    record?.evidence === null ? null : objectAt(record?.evidence);
  const evidence = evidenceRecord
    ? {
        evidenceId: stringAt(evidenceRecord.evidenceId),
        reference: stringAt(evidenceRecord.reference),
        digest: evidenceRecord.digest,
        observationReferences: stringArrayAt(
          evidenceRecord.observationReferences,
        ),
        derivedFindingReferences: stringArrayAt(
          evidenceRecord.derivedFindingReferences,
        ),
      }
    : null;

  const malformed =
    !profileReleaseId ||
    !semanticFeatureId ||
    !compatibilityStates.has(state as CompatibilityState) ||
    !conditions ||
    explanation === undefined ||
    (record?.testedScope !== null &&
      (!testedScope?.operationId ||
        testedScope.mode === undefined ||
        !testedScope.options)) ||
    (record?.evidence !== null &&
      (!evidence?.evidenceId ||
        !evidence.reference ||
        !isSha256Digest(evidence.digest) ||
        !evidence.observationReferences ||
        !evidence.derivedFindingReferences)) ||
    (state === 'conditional' && conditions.length === 0) ||
    (['supported', 'unsupported', 'conditional'].includes(String(state)) &&
      !evidence) ||
    (['not-tested', 'unknown-insufficient-evidence'].includes(String(state)) &&
      !explanation);

  if (malformed) {
    issue(
      issues,
      'MALFORMED_COMPATIBILITY_STATE',
      path,
      'Compatibility finding has an unsupported state or incomplete qualifiers/evidence.',
    );
    return null;
  }
  return {
    profileReleaseId,
    semanticFeatureId,
    state: state as CompatibilityState,
    conditions,
    explanation,
    testedScope: testedScope
      ? {
          operationId: testedScope.operationId as string,
          mode: testedScope.mode as string | null,
          options: testedScope.options as Record<
            string,
            boolean | string | number | null
          >,
        }
      : null,
    evidence: evidence
      ? {
          evidenceId: evidence.evidenceId as string,
          reference: evidence.reference as string,
          digest: evidence.digest as `sha256:${string}`,
          observationReferences: evidence.observationReferences as string[],
          derivedFindingReferences:
            evidence.derivedFindingReferences as string[],
        }
      : null,
  };
}

function parseCompatibilityProjection(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): CompatibilityProjectionV1 | null {
  const record = objectAt(value);
  requireSchema(record, COMPATIBILITY_PROJECTION_SCHEMA, path, issues);
  const checkpointId = stringAt(record?.checkpointId);
  const sourceSemanticSnapshot = parseSemanticSnapshot(
    record?.sourceSemanticSnapshot,
    `${path}.sourceSemanticSnapshot`,
    issues,
  );
  const publishedProfileReleaseIds = stringArrayAt(
    record?.publishedProfileReleaseIds,
  );
  const findings = Array.isArray(record?.findings)
    ? record.findings
        .map((finding, index) =>
          parseFinding(finding, `${path}.findings[${index}]`, issues),
        )
        .filter(
          (finding): finding is CompatibilityFindingProjection => !!finding,
        )
    : null;
  if (
    !checkpointId ||
    !sourceSemanticSnapshot ||
    !publishedProfileReleaseIds ||
    !findings ||
    new Set(publishedProfileReleaseIds).size !==
      publishedProfileReleaseIds.length
  ) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'Compatibility projection identity, publication list, or findings are malformed.',
    );
    return null;
  }
  return {
    schemaVersion: COMPATIBILITY_PROJECTION_SCHEMA,
    checkpointId,
    sourceSemanticSnapshot,
    publishedProfileReleaseIds,
    findings,
  };
}

function parseEvidenceManifest(
  value: unknown,
  path: string,
  issues: CheckpointValidationIssue[],
): EvidenceManifestV1 | null {
  const record = objectAt(value);
  requireSchema(record, EVIDENCE_MANIFEST_SCHEMA, path, issues);
  const checkpointId = stringAt(record?.checkpointId);
  if (!Array.isArray(record?.evidence)) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      `${path}.evidence`,
      'Evidence manifest requires an evidence array.',
    );
    return null;
  }
  const evidence = record.evidence
    .map((candidate) => {
      const item = objectAt(candidate);
      const evidenceId = stringAt(item?.evidenceId);
      const reference = stringAt(item?.reference);
      const digest = item?.digest;
      return evidenceId && reference && isSha256Digest(digest)
        ? { evidenceId, reference, digest }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
  if (
    !checkpointId ||
    evidence.length !== record.evidence.length ||
    new Set(evidence.map((item) => item.evidenceId)).size !== evidence.length
  ) {
    issue(
      issues,
      'MALFORMED_DOCUMENT',
      path,
      'Evidence manifest contains malformed entries.',
    );
    return null;
  }
  return {
    schemaVersion: EVIDENCE_MANIFEST_SCHEMA,
    checkpointId,
    evidence,
  };
}

function sameSnapshot(
  left: SemanticSnapshotIdentity,
  right: SemanticSnapshotIdentity,
): boolean {
  return left.snapshotId === right.snapshotId && left.digest === right.digest;
}

function referencedFile(
  bundle: RawCheckpointBundle,
  identity: FileIdentity,
  issues: CheckpointValidationIssue[],
): unknown | null {
  if (!(identity.path in bundle.files)) {
    issue(
      issues,
      'MISSING_REFERENCED_FILE',
      identity.path,
      `Referenced file ${identity.fileId} is missing.`,
    );
    return null;
  }
  const value = bundle.files[identity.path];
  if (sha256Json(value) !== identity.digest) {
    issue(
      issues,
      'DIGEST_MISMATCH',
      identity.path,
      `Digest does not match ${identity.fileId}.`,
    );
    return null;
  }
  return value;
}

export function validateCheckpointBundle(
  bundle: RawCheckpointBundle,
  expectedSemanticSnapshot: SemanticSnapshotIdentity,
): ValidatedCheckpointBundle {
  const issues: CheckpointValidationIssue[] = [];
  const index = parseIndex(bundle.index, issues);
  if (!index) throw new CheckpointValidationError(issues);

  if (!sameSnapshot(index.sourceSemanticSnapshot, expectedSemanticSnapshot)) {
    issue(
      issues,
      'SEMANTIC_SNAPSHOT_INCOMPATIBLE',
      'index.sourceSemanticSnapshot',
      'Checkpoint index does not target the website semantic snapshot.',
    );
  }

  const seenSequences = new Set<number>();
  const seenCheckpointIds = new Set<string>();
  let previous: CheckpointIndexEntryV1 | null = null;
  for (const [position, entry] of index.checkpoints.entries()) {
    if (
      seenSequences.has(entry.sequence) ||
      seenCheckpointIds.has(entry.checkpointId)
    ) {
      issue(
        issues,
        'DUPLICATE_CHECKPOINT',
        `index.checkpoints[${position}]`,
        `Checkpoint ${entry.checkpointId} or sequence ${entry.sequence} is duplicated.`,
      );
    }
    seenSequences.add(entry.sequence);
    seenCheckpointIds.add(entry.checkpointId);
    if (entry.sequence !== position + 1) {
      issue(
        issues,
        'BROKEN_SEQUENCE',
        `index.checkpoints[${position}].sequence`,
        `Expected sequence ${position + 1}; received ${entry.sequence}.`,
      );
    }
    const expectedPredecessor = previous?.checkpointId ?? null;
    if (entry.previousCheckpointId !== expectedPredecessor) {
      issue(
        issues,
        'SKIPPED_PREDECESSOR',
        `index.checkpoints[${position}].previousCheckpointId`,
        `Expected predecessor ${String(expectedPredecessor)}; received ${String(entry.previousCheckpointId)}.`,
      );
    }
    previous = entry;
  }

  const validated: ValidatedCheckpoint[] = [];
  const knownProfiles = new Map<string, string>();
  for (const [position, entry] of index.checkpoints.entries()) {
    const checkpointRaw = referencedFile(bundle, entry, issues);
    if (!checkpointRaw) continue;
    const checkpoint = parseCheckpoint(checkpointRaw, entry.path, issues);
    if (!checkpoint) continue;
    if (
      checkpoint.sequence !== entry.sequence ||
      checkpoint.checkpointId !== entry.checkpointId
    ) {
      issue(
        issues,
        'BROKEN_SEQUENCE',
        entry.path,
        'Checkpoint identity does not match its index entry.',
      );
    }
    if (checkpoint.previousCheckpointId !== entry.previousCheckpointId) {
      issue(
        issues,
        'SKIPPED_PREDECESSOR',
        entry.path,
        'Checkpoint predecessor does not match its index entry.',
      );
    }
    if (
      !sameSnapshot(checkpoint.sourceSemanticSnapshot, expectedSemanticSnapshot)
    ) {
      issue(
        issues,
        'SEMANTIC_SNAPSHOT_INCOMPATIBLE',
        `${entry.path}.sourceSemanticSnapshot`,
        'Checkpoint semantic snapshot is incompatible.',
      );
    }

    const checkpointProfileIds = new Set<string>();
    const checkpointIdentityPairs = new Set<string>();
    for (const profile of checkpoint.profileReleases) {
      const identity = JSON.stringify(profile);
      const pair = `${profile.profileId}\u0000${profile.releaseId}`;
      if (
        checkpointProfileIds.has(profile.profileReleaseId) ||
        checkpointIdentityPairs.has(pair)
      ) {
        issue(
          issues,
          'DUPLICATE_PROFILE_IDENTITY',
          `${entry.path}.profileReleases`,
          `Profile identity ${profile.profileReleaseId} is duplicated.`,
        );
      }
      checkpointProfileIds.add(profile.profileReleaseId);
      checkpointIdentityPairs.add(pair);
      const prior = knownProfiles.get(profile.profileReleaseId);
      if (prior && prior !== identity) {
        issue(
          issues,
          'CONFLICTING_PROFILE_IDENTITY',
          `${entry.path}.profileReleases`,
          `Profile identity ${profile.profileReleaseId} conflicts with an earlier checkpoint.`,
        );
      }
      knownProfiles.set(profile.profileReleaseId, identity);
    }

    const labRaw = checkpoint.projections.lab
      ? referencedFile(bundle, checkpoint.projections.lab, issues)
      : null;
    const compatibilityRaw = checkpoint.projections.compatibility
      ? referencedFile(bundle, checkpoint.projections.compatibility, issues)
      : null;
    const evidenceRaw = referencedFile(
      bundle,
      checkpoint.evidenceManifest,
      issues,
    );
    const labProjection = checkpoint.projections.lab
      ? labRaw
        ? parseLabProjection(labRaw, checkpoint.projections.lab.path, issues)
        : null
      : null;
    const compatibilityProjection = checkpoint.projections.compatibility
      ? compatibilityRaw
        ? parseCompatibilityProjection(
            compatibilityRaw,
            checkpoint.projections.compatibility.path,
            issues,
          )
        : null
      : null;
    const evidenceManifest = evidenceRaw
      ? parseEvidenceManifest(
          evidenceRaw,
          checkpoint.evidenceManifest.path,
          issues,
        )
      : null;

    for (const projection of [labProjection, compatibilityProjection]) {
      if (
        projection &&
        (!sameSnapshot(
          projection.sourceSemanticSnapshot,
          expectedSemanticSnapshot,
        ) ||
          projection.checkpointId !== checkpoint.checkpointId)
      ) {
        issue(
          issues,
          'SEMANTIC_SNAPSHOT_INCOMPATIBLE',
          entry.path,
          'Projection identity does not match its checkpoint and semantic snapshot.',
        );
      }
    }

    const profilesById = new Map(
      checkpoint.profileReleases.map((profile) => [
        profile.profileReleaseId,
        profile,
      ]),
    );
    for (const profile of labProjection?.profiles ?? []) {
      if (
        profilesById.get(profile.profileReleaseId)?.labEligibility !==
        'eligible'
      ) {
        issue(
          issues,
          'CONFLICTING_PROFILE_IDENTITY',
          checkpoint.projections.lab?.path ?? entry.path,
          `Lab projection references an absent or ineligible profile ${profile.profileReleaseId}.`,
        );
      }
    }
    for (const profileReleaseId of compatibilityProjection?.publishedProfileReleaseIds ??
      []) {
      if (
        profilesById.get(profileReleaseId)?.compatibilityPublication !==
        'published'
      ) {
        issue(
          issues,
          'CONFLICTING_PROFILE_IDENTITY',
          checkpoint.projections.compatibility?.path ?? entry.path,
          `Compatibility projection references an absent or withheld profile ${profileReleaseId}.`,
        );
      }
    }
    const published = new Set(
      compatibilityProjection?.publishedProfileReleaseIds ?? [],
    );
    const findingKeys = new Set<string>();
    const evidenceById = new Map(
      evidenceManifest?.evidence.map((item) => [item.evidenceId, item]) ?? [],
    );
    for (const finding of compatibilityProjection?.findings ?? []) {
      const key = `${finding.profileReleaseId}\u0000${finding.semanticFeatureId}`;
      if (findingKeys.has(key)) {
        issue(
          issues,
          'MALFORMED_COMPATIBILITY_STATE',
          checkpoint.projections.compatibility?.path ?? entry.path,
          `Duplicate compatibility finding for ${key}.`,
        );
      }
      findingKeys.add(key);
      if (!published.has(finding.profileReleaseId)) {
        issue(
          issues,
          'MALFORMED_COMPATIBILITY_STATE',
          checkpoint.projections.compatibility?.path ?? entry.path,
          `Finding references unpublished profile ${finding.profileReleaseId}.`,
        );
      }
      if (finding.evidence) {
        const manifestEvidence = evidenceById.get(finding.evidence.evidenceId);
        if (!manifestEvidence) {
          issue(
            issues,
            'MALFORMED_COMPATIBILITY_STATE',
            checkpoint.projections.compatibility?.path ?? entry.path,
            `Finding references missing evidence ${finding.evidence.evidenceId}.`,
          );
        } else if (
          manifestEvidence.digest !== finding.evidence.digest ||
          manifestEvidence.reference !== finding.evidence.reference
        ) {
          issue(
            issues,
            'DIGEST_MISMATCH',
            checkpoint.projections.compatibility?.path ?? entry.path,
            `Finding evidence ${finding.evidence.evidenceId} does not match its evidence manifest identity.`,
          );
        }
      }
    }
    if (
      evidenceManifest &&
      evidenceManifest.checkpointId !== checkpoint.checkpointId
    ) {
      issue(
        issues,
        'MALFORMED_DOCUMENT',
        checkpoint.evidenceManifest.path,
        'Evidence manifest checkpoint identity does not match.',
      );
    }

    if (evidenceManifest) {
      validated.push({
        sequence: checkpoint.sequence,
        checkpointId: checkpoint.checkpointId,
        previousCheckpointId: checkpoint.previousCheckpointId,
        sourceSemanticSnapshot: checkpoint.sourceSemanticSnapshot,
        checkpointFile: entry,
        profileReleases: checkpoint.profileReleases,
        projectionFiles: checkpoint.projections,
        evidenceManifestFile: checkpoint.evidenceManifest,
        labProjection,
        compatibilityProjection,
        evidenceManifest,
      });
    }

    if (position === index.checkpoints.length - 1) {
      // The index ordering is authoritative; this keeps the validation loop
      // explicit when future schema versions add checkpoint-level rules.
    }
  }

  if (issues.length > 0) throw new CheckpointValidationError(issues);
  return {
    sourceSemanticSnapshot: index.sourceSemanticSnapshot,
    checkpoints: validated,
  };
}
