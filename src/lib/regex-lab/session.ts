import type { JsonObject } from '@strling-lang/strling';
import {
  compilerIdentity,
  semanticExample,
  targets,
  type Compilation,
  type Target,
} from './compiler.ts';
import type { LabExecutionResult } from './contracts.ts';
import { readContinuation, type ScanContinuation } from './continuation.ts';
import { timingSchema } from './timing.ts';
import {
  defaultOptions,
  limits,
  operations,
  runtimes,
  type Operation,
  type RunOptions,
  type Runtime,
} from './interactive.ts';

export const sessionSchema = 'strling-lab-session-v2';
const archiveSchema = 'strling-lab-archive-v1';
const storageKey = 'strling.labs.archive.v1';
export const maxSessionFileBytes = 2_000_000;
const maxArchiveUnits = 2_000_000;
const shareLimit = 12_000;
export const maxDatasets = 16;
export const maxTests = 32;
export const defaultSampleName = 'Sample 1';

export type Authoring = 'regex' | 'semantic' | 'simply';
export type LabMode = 'regex' | 'strling';
export type SourceDrafts = Partial<Record<Exclude<Authoring, 'regex'>, string>>;

export interface Dataset {
  name: string;
  text: string;
}

export type Expected =
  | { kind: 'boolean'; value: boolean }
  | {
      kind: 'matches';
      count: number;
      captures?: {
        match: number;
        key: string | number;
        value: string | null;
      }[];
    }
  | { kind: 'replacement'; value: string }
  | { kind: 'split'; value: (string | null)[] }
  | {
      kind: 'error';
      value: Exclude<
        LabExecutionResult['status'],
        'matched' | 'no-match' | 'completed'
      >;
    };

export interface LabTest {
  id: string;
  name: string;
  group: string;
  text: string;
  run: RunOptions;
  expected: Expected;
}

export interface SourceOrigin {
  compiler: typeof compilerIdentity;
  format: Exclude<Authoring, 'regex'>;
  profile: JsonObject;
  artifact: JsonObject;
  source?: string;
}

export interface Recording {
  capturedAt: string;
  result?: LabExecutionResult;
  compilation?: Compilation;
  investigation?: {
    trace?: JsonObject;
    comparison?: JsonObject;
    timing?: JsonObject;
  };
}

export interface Session {
  schema: typeof sessionSchema;
  id: string;
  name: string;
  format: Authoring;
  source: string;
  runtime: Runtime;
  target: Target;
  run: RunOptions;
  datasets: Dataset[];
  selected: number;
  tests: LabTest[];
  drafts?: SourceDrafts;
  origin?: SourceOrigin;
  recorded?: Recording;
  continuation?: ScanContinuation;
}

export interface Revision {
  id: string;
  savedAt: string;
  session: Session;
}

export interface SavedSession {
  id: string;
  revisions: Revision[];
}

export function initialSession(mode: LabMode): Session {
  return {
    schema: sessionSchema,
    id: crypto.randomUUID(),
    name: defaultSampleName,
    format: mode === 'regex' ? 'regex' : 'semantic',
    source: mode === 'regex' ? '(?<word>[A-Za-z]+)-(\\d+)' : semanticExample,
    runtime: 'javascript',
    target: 'ecmascript',
    run: { ...defaultOptions },
    datasets: [
      {
        name: defaultSampleName,
        text:
          mode === 'regex'
            ? 'alpha-1 beta-2\ngamma-3'
            : 'hello, world\nhello again',
      },
    ],
    selected: 0,
    tests: [],
  };
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Fields)
    : {};
const isString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;
const isInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

function readOptions(value: unknown): RunOptions {
  const { flags, operation, replacement, replacementSyntax, pcreNewline } =
    fields(value);
  if (
    !isString(flags, 16) ||
    typeof operation !== 'string' ||
    !Object.hasOwn(operations, operation) ||
    !isString(replacement, limits.replacement) ||
    (replacementSyntax !== 'native' && replacementSyntax !== 'literal') ||
    (pcreNewline !== undefined && pcreNewline !== 'any')
  ) {
    throw new Error('Invalid operation configuration.');
  }
  return {
    flags,
    operation: operation as Operation,
    replacement,
    replacementSyntax,
    pcreNewline,
  };
}

const errorStatuses = [
  'compile-rejection',
  'runtime-error',
  'resource-terminated',
  'unsupported-operation',
  'infrastructure-failure',
] as const;

export function readExpected(value: unknown): Expected {
  const expected = fields(value);
  switch (expected.kind) {
    case 'boolean':
      if (typeof expected.value === 'boolean')
        return { kind: 'boolean', value: expected.value };
      break;
    case 'matches':
      if (!isInteger(expected.count, 0, limits.matches)) break;
      if (expected.captures === undefined)
        return { kind: 'matches', count: expected.count };
      if (
        !Array.isArray(expected.captures) ||
        expected.captures.length > limits.captures
      )
        break;
      return {
        kind: 'matches',
        count: expected.count,
        captures: expected.captures.map((capture) => {
          const { match, key, value } = fields(capture);
          if (
            !isInteger(match, 1, limits.matches) ||
            (!isString(key, 128) && !isInteger(key, 1, limits.captures)) ||
            (value !== null && !isString(value, limits.input))
          )
            throw new Error('Invalid expected capture.');
          return { match, key, value };
        }),
      };
    case 'replacement':
      if (isString(expected.value, limits.output))
        return { kind: 'replacement', value: expected.value };
      break;
    case 'split':
      if (
        Array.isArray(expected.value) &&
        expected.value.length <= limits.output &&
        expected.value.every(
          (part) => part === null || isString(part, limits.input),
        )
      ) {
        return { kind: 'split', value: expected.value as (string | null)[] };
      }
      break;
    case 'error':
      if (errorStatuses.some((status) => status === expected.value)) {
        return {
          kind: 'error',
          value: expected.value as Extract<
            Expected,
            { kind: 'error' }
          >['value'],
        };
      }
  }
  throw new Error('Invalid test expectation.');
}

export function readTests(value: unknown): LabTest[] {
  if (!Array.isArray(value) || value.length > maxTests)
    throw new Error('Invalid test collection.');
  const tests = value.map((entry) => {
    const { id, name, group, text, run, expected } = fields(entry);
    if (
      !isString(id, 64) ||
      !id ||
      !isString(name, 80) ||
      !name ||
      !isString(group, 80) ||
      !isString(text, limits.input)
    ) {
      throw new Error('Invalid test case.');
    }
    return {
      id,
      name,
      group,
      text,
      run: readOptions(run),
      expected: readExpected(expected),
    };
  });
  if (new Set(tests.map(({ id }) => id)).size !== tests.length)
    throw new Error('Duplicate test identity.');
  return tests;
}

function readDatasets(value: unknown): Dataset[] {
  if (!Array.isArray(value) || !value.length || value.length > maxDatasets)
    throw new Error('Invalid dataset collection.');
  return value.map((entry) => {
    const { name, text } = fields(entry);
    if (!isString(name, 80) || !name || !isString(text, limits.input))
      throw new Error('Invalid dataset.');
    return { name, text };
  });
}

function readOrigin(value: unknown): SourceOrigin | undefined {
  if (value === undefined) return;
  const { compiler, format, profile, artifact, source } = fields(value);
  const identity = fields(compiler);
  if (
    (format !== 'semantic' && format !== 'simply') ||
    !isString(identity.productVersion, 64) ||
    identity.package !== compilerIdentity.package ||
    !isString(identity.abi, 64) ||
    !isString(identity.protocol, 64) ||
    !isString(fields(profile).profile_id, 128) ||
    !isString(fields(artifact).contract_version, 64) ||
    (source !== undefined && !isString(source, limits.pattern))
  )
    throw new Error('Invalid generated artifact origin.');
  return {
    compiler: {
      package: compilerIdentity.package,
      productVersion: identity.productVersion,
      abi: identity.abi,
      protocol: identity.protocol,
    },
    format,
    profile: profile as JsonObject,
    artifact: artifact as JsonObject,
    source,
  };
}

function readRecording(value: unknown): Recording | undefined {
  if (value === undefined) return;
  const { capturedAt, result, compilation, investigation } = fields(value);
  if (!isString(capturedAt, 64) || !Number.isFinite(Date.parse(capturedAt)))
    throw new Error('Invalid observation date.');
  if (
    result !== undefined &&
    fields(result).schemaVersion !== 'strling-regex-lab-execution-result-v1'
  )
    throw new Error('Invalid recorded execution schema.');
  if (
    compilation !== undefined &&
    !isString(fields(fields(compilation).identity).productVersion, 64)
  )
    throw new Error('Invalid recorded compiler identity.');
  // Records are inert JSON for inspection. Replay always builds a fresh request.
  const { trace, comparison, timing } = fields(investigation);
  if (trace !== undefined && fields(trace).schema !== 'strling-lab-trace-v1')
    throw new Error('Invalid recorded trace schema.');
  if (
    comparison !== undefined &&
    fields(comparison).schema !== 'strling-lab-comparison-v1'
  )
    throw new Error('Invalid recorded comparison schema.');
  const recordedTimingSchema = fields(timing).schema;
  if (
    timing !== undefined &&
    recordedTimingSchema !== 'strling-lab-timing-v1' &&
    recordedTimingSchema !== 'strling-lab-timing-v2' &&
    recordedTimingSchema !== timingSchema
  )
    throw new Error('Invalid recorded timing schema.');
  return {
    capturedAt,
    result: result as Recording['result'],
    compilation: compilation as Recording['compilation'],
    investigation:
      investigation === undefined
        ? undefined
        : {
            trace: trace as JsonObject,
            comparison: comparison as JsonObject,
            timing: timing as JsonObject,
          },
  };
}

function readDrafts(
  value: unknown,
  format: Authoring,
): SourceDrafts | undefined {
  if (value === undefined) return;
  const { semantic, simply } = fields(value);
  if (
    format === 'regex' ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (semantic !== undefined && !isString(semantic, limits.pattern)) ||
    (simply !== undefined && !isString(simply, limits.pattern))
  )
    throw new Error('Invalid session source drafts.');
  if (format === 'semantic')
    return simply === undefined ? undefined : { simply };
  return semantic === undefined ? undefined : { semantic };
}

export function readSession(value: unknown): Session {
  const entry = fields(value);
  if (entry.schema === 'strling-lab-session-v1') {
    const migrated = {
      ...entry,
      schema: sessionSchema,
      datasets: [{ name: 'Imported sample', text: entry.input }],
      selected: 0,
    };
    return readSession(migrated);
  }
  const {
    schema,
    id,
    name,
    format,
    source,
    runtime,
    target,
    run,
    selected,
    origin,
    recorded,
  } = entry;
  if (
    schema !== sessionSchema ||
    !isString(id, 64) ||
    !id ||
    !isString(name, 80) ||
    !name ||
    (format !== 'regex' && format !== 'semantic' && format !== 'simply') ||
    !isString(source, limits.pattern) ||
    typeof runtime !== 'string' ||
    !Object.hasOwn(runtimes, runtime) ||
    typeof target !== 'string' ||
    !Object.hasOwn(targets, target)
  ) {
    throw new Error('Unsupported or malformed Lab session.');
  }
  const datasets = readDatasets(entry.datasets);
  if (!isInteger(selected, 0, datasets.length - 1))
    throw new Error('Invalid active dataset.');
  return {
    schema,
    id,
    name,
    format,
    source,
    runtime: runtime as Runtime,
    target: target as Target,
    run: readOptions(run),
    datasets,
    selected,
    tests: readTests(entry.tests),
    drafts: readDrafts(entry.drafts, format),
    origin: readOrigin(origin),
    recorded: readRecording(recorded),
    continuation: readContinuation(entry.continuation),
  };
}

export function exportSession(session: Session): string {
  const text = JSON.stringify(readSession(session));
  if (new TextEncoder().encode(text).byteLength > maxSessionFileBytes)
    throw new Error('The complete session exceeds the 2 MB file limit.');
  return text;
}

export function importBundle(text: string) {
  if (text.length > maxSessionFileBytes)
    throw new Error('The file exceeds the 2 MB session limit.');
  const parsed = fields(JSON.parse(text));
  const session = readSession(
    parsed.schema === 'strling-lab-bundle-v1' ? parsed.session : parsed,
  );
  const choices = fields(parsed.redaction);
  if (
    parsed.schema === 'strling-lab-bundle-v1' &&
    !(
      choices.continuation === true &&
      choices.samples === true &&
      choices.source !== false &&
      (!session.origin || choices.sourceOrigin === true)
    )
  ) {
    session.continuation = undefined;
  }
  return session;
}

function settingsSession(session: Session) {
  const settings = initialSession(
    session.format === 'regex' ? 'regex' : 'strling',
  );
  settings.format = session.format;
  settings.source = '';
  settings.runtime = session.runtime;
  settings.target = session.target;
  settings.datasets = [{ name: defaultSampleName, text: '' }];
  settings.selected = 0;
  settings.run.operation = session.run.operation;
  settings.run.replacementSyntax = session.run.replacementSyntax;
  settings.run.pcreNewline = session.run.pcreNewline;
  return settings;
}

export function shareFragment(session: Session) {
  // Preserve the legacy link envelope. Its session is already allowlisted.
  const bundle = {
    schema: 'strling-lab-bundle-v1',
    redaction: {
      source: false,
      samples: false,
      tests: false,
      observations: false,
      sourceOrigin: false,
    },
    session: settingsSession(session),
  };
  return '#lab=' + encodeURIComponent(JSON.stringify(bundle));
}

export function importFragment(fragment: string) {
  if (!fragment.startsWith('#lab=')) return;
  if (fragment.length > shareLimit)
    throw new Error('The shared URL exceeds the workbench size limit.');
  return settingsSession(importBundle(decodeURIComponent(fragment.slice(5))));
}

export class SessionArchive {
  readonly #storage: Storage;

  constructor(storage: Storage) {
    this.#storage = storage;
  }

  list() {
    const text = this.#storage.getItem(storageKey);
    if (!text) return [];
    if (text.length > maxArchiveUnits)
      throw new Error('Saved sessions exceed the workbench storage limit.');
    const { schema, sessions } = fields(JSON.parse(text));
    if (
      schema !== archiveSchema ||
      !Array.isArray(sessions) ||
      sessions.length > 12
    )
      throw new Error('Saved sessions have an unsupported format.');
    return sessions.map((entry): SavedSession => {
      const { id, revisions } = fields(entry);
      if (
        !isString(id, 64) ||
        !Array.isArray(revisions) ||
        !revisions.length ||
        revisions.length > 12
      )
        throw new Error('Invalid saved revision list.');
      return {
        id,
        revisions: revisions.map((item) => {
          const { id: revisionId, savedAt, session } = fields(item);
          const content = readSession(session);
          if (
            !isString(revisionId, 64) ||
            !isString(savedAt, 64) ||
            !Number.isFinite(Date.parse(savedAt)) ||
            content.id !== id
          )
            throw new Error('Invalid saved revision.');
          return { id: revisionId, savedAt, session: content };
        }),
      };
    });
  }

  save(session: Session) {
    const all = this.list();
    const existing = all.find((entry) => entry.id === session.id);
    const revisions = existing?.revisions ?? [];
    if (revisions.length >= 12)
      throw new Error(
        'This session has 12 revisions. Delete a revision or duplicate the session.',
      );
    if (!existing && all.length >= 12)
      throw new Error(
        'Local storage has 12 sessions. Delete a saved session to continue.',
      );
    const revision = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      session,
    };
    this.#put([
      { id: session.id, revisions: [revision, ...revisions] },
      ...all.filter((entry) => entry.id !== session.id),
    ]);
  }

  deleteRevision(id: string, revisionId: string) {
    this.#put(
      this.list().flatMap((entry) => {
        if (entry.id !== id) return [entry];
        const revisions = entry.revisions.filter(
          (revision) => revision.id !== revisionId,
        );
        return revisions.length ? [{ ...entry, revisions }] : [];
      }),
    );
  }

  deleteSession(id: string) {
    this.#put(this.list().filter((entry) => entry.id !== id));
  }

  clear() {
    this.#storage.removeItem(storageKey);
  }

  #put(sessions: SavedSession[]) {
    const json = JSON.stringify({ schema: archiveSchema, sessions });
    if (json.length > maxArchiveUnits)
      throw new Error(
        'Local session storage is full. Export and delete older revisions to free space.',
      );
    this.#storage.setItem(storageKey, json);
  }
}
