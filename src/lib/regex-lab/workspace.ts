import { limits } from './interactive.ts';
import { readSession, type LabMode, type Session } from './session.ts';

const schema = 'strling-lab-workspace-v1';
export const maxWorkingSources = 12;
export const maxWorkspaceUnits = 1_000_000;

export interface WorkingSource {
  id: string;
  label: string;
  session: Session;
  drafts: Partial<Record<'semantic' | 'simply', string>>;
}

export interface Workspace {
  schema: typeof schema;
  mode: LabMode;
  active: string;
  sources: WorkingSource[];
}

export function workingSource(session: Session, label: string): WorkingSource {
  return { id: crypto.randomUUID(), label, session, drafts: {} };
}

export function newWorkspace(mode: LabMode, source: WorkingSource): Workspace {
  return { schema, mode, active: source.id, sources: [source] };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid working storage.');
  return value as Record<string, unknown>;
}

function label(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maximum
  );
}

function readWorkspace(text: string, mode: LabMode): Workspace {
  if (text.length > maxWorkspaceUnits)
    throw new Error('Working storage exceeds its size limit.');
  const data = record(JSON.parse(text));
  if (
    data.schema !== schema ||
    data.mode !== mode ||
    !label(data.active, 64) ||
    !Array.isArray(data.sources) ||
    data.sources.length < 1 ||
    data.sources.length > maxWorkingSources
  )
    throw new Error('Invalid working storage.');
  const sources = data.sources.map((value): WorkingSource => {
    const entry = record(value);
    if (!label(entry.id, 64) || !label(entry.label, 80))
      throw new Error('Invalid working source.');
    const session = readSession(entry.session);
    if ((session.format === 'regex') !== (mode === 'regex'))
      throw new Error('This working source belongs in the other Lab.');
    session.recorded = undefined;
    const drafts: WorkingSource['drafts'] = {};
    const stored = record(entry.drafts);
    for (const format of ['semantic', 'simply'] as const) {
      const draft = stored[format];
      if (draft === undefined) continue;
      if (
        mode === 'regex' ||
        typeof draft !== 'string' ||
        draft.length > limits.pattern
      )
        throw new Error('Invalid source draft.');
      drafts[format] = draft;
    }
    return { id: entry.id, label: entry.label, session, drafts };
  });
  if (
    new Set(sources.map((source) => source.id)).size !== sources.length ||
    !sources.some((source) => source.id === data.active)
  )
    throw new Error('Invalid working source selection.');
  return { schema, mode, active: data.active, sources };
}

type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class WorkspaceStore {
  readonly #key: string;
  #expected: string | null = null;
  #read = false;
  #invalid = false;
  readonly #storage: WorkspaceStorage;
  readonly #mode: LabMode;

  constructor(storage: WorkspaceStorage, mode: LabMode) {
    this.#storage = storage;
    this.#mode = mode;
    this.#key = 'strling.labs.working.v1.' + mode;
  }

  get ready() {
    return this.#read;
  }
  get needsReset() {
    return this.#invalid;
  }

  load(): Workspace | undefined {
    this.#expected = this.#storage.getItem(this.#key);
    this.#read = true;
    this.#invalid = true;
    try {
      const result =
        this.#expected === null
          ? undefined
          : readWorkspace(this.#expected, this.#mode);
      this.#invalid = false;
      return result;
    } catch {
      throw new Error(
        'Saved working storage could not be read. Export your current work before resetting working storage.',
      );
    }
  }

  save(workspace: Workspace) {
    this.#checkExpected();
    if (this.#invalid) throw new Error('Saved working storage needs recovery.');
    const text = JSON.stringify(workspace);
    if (text.length > maxWorkspaceUnits)
      throw new Error(
        'Working storage is full. Export a copy or remove an unused working source or dataset.',
      );
    if (text === this.#expected) return;
    readWorkspace(text, this.#mode);
    try {
      this.#storage.setItem(this.#key, text);
    } catch {
      throw new Error(
        'The browser could not save working data. Your edits are still open. Export a copy or retry when storage is available.',
      );
    }
    this.#expected = text;
  }

  resetUnreadable() {
    this.#checkExpected();
    if (!this.#invalid) return;
    this.#storage.removeItem(this.#key);
    this.#expected = null;
    this.#invalid = false;
  }

  #checkExpected() {
    if (!this.#read || this.#storage.getItem(this.#key) !== this.#expected)
      throw new Error(
        'Working storage changed in another tab. Export these edits before reloading.',
      );
  }
}
