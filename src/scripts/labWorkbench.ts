import { openSearchPanel } from '@codemirror/search';
import {
  sourceCompileRequest,
  type JsonObject,
  type JsonValue,
} from '@strling-lang/strling';
import { BrowserLabProvider } from '../lib/regex-lab/browser-provider';
import { LabCompiler } from '../lib/regex-lab/compiler-client';
import { LabCompilerTools } from '../lib/regex-lab/compiler-tools-client';
import {
  toolsIdentity,
  type Destination,
  type ToolRequest,
} from '../lib/regex-lab/compiler-tools';
import {
  generatedPattern,
  jsonObject,
  runnableArtifact,
  semanticExample,
  simplyExample,
  targets,
  type Compilation,
  type Target,
} from '../lib/regex-lab/compiler';
import { runtimeExample } from '../lib/regex-lab/codegen';
import type {
  LabExecutionRequest,
  LabExecutionResult,
} from '../lib/regex-lab/contracts';
import {
  createContinuation,
  type ScanProvenance,
} from '../lib/regex-lab/continuation';
import {
  assess,
  compareObservations,
  expectedFrom,
} from '../lib/regex-lab/experiments';
import {
  interactiveIdentity,
  isPcreRuntime,
  limits,
  runRequest,
  isScalarText,
  runtimes,
  type RunOptions,
  type Runtime,
} from '../lib/regex-lab/interactive';
import { coordinateMap, editorRange } from '../lib/regex-lab/offsets';
import {
  bundleSession,
  importBundle,
  importFragment,
  initialSession,
  maxDatasets,
  maxTests,
  readTests,
  SessionArchive,
  shareFragment,
  type LabMode,
  type LabTest,
  type Revision,
  type SavedSession,
  type Session,
} from '../lib/regex-lab/session';
import {
  explainRegex,
  javascriptFlagDescriptions,
  semanticTree,
  sourceSpan,
  type StructureNode,
} from '../lib/regex-lab/structure';
import type { PatternInspection } from '../lib/regex-lab/inspection';
import {
  WorkspaceStore,
  maxWorkingSources,
  newWorkspace,
  workingSource,
  type Workspace,
  type WorkingSource,
} from '../lib/regex-lab/workspace';
import {
  displayTiming,
  displayTimingDifference,
  estimateTimerResolution,
  interruptTiming,
  runTimingExperiment,
  seriesStats,
  timingRepetitions,
  timingSchema,
  type TimingExperiment,
} from '../lib/regex-lab/timing';
import type { TraceObservation } from '../lib/regex-lab/trace';
import { LabEditor } from './labEditor';
import {
  button,
  details,
  download,
  node,
  objectTree,
  raw,
  renderMatches,
  renderStructure,
  resultSummary,
  selectOptions,
  shortError,
} from './labRendering';

const transferKey = 'strling.labs.artifact.v1';
const stopRevealDelayMs = 250;
const assertFile = async (input: HTMLInputElement) => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 2_000_000)
    throw new Error('The import exceeds the 2 MB file limit.');
  return await file.text();
};

class LabWorkbench extends HTMLElement {
  #mode!: LabMode;
  #session!: Session;
  #source!: LabEditor;
  #subject!: LabEditor;
  #provider = new BrowserLabProvider();
  #compiler = new LabCompiler();
  #compilerTools = new LabCompilerTools();
  #timer?: ReturnType<typeof setTimeout>;
  #stopRevealTimer?: ReturnType<typeof setTimeout>;
  #active?: AbortController;
  #events?: AbortController;
  #trust = true;
  #tab = 'results';
  #compilation?: Compilation;
  #result?: LabExecutionResult;
  #lastScan?: { request: LabExecutionRequest; provenance: ScanProvenance };
  #trace?: TraceObservation;
  #step = 0;
  #matches?: ReturnType<typeof renderMatches>;
  #pinned?: string;
  #testId?: string;
  #testOutcomes = new Map<string, string[]>();
  #archive: SavedSession[] = [];
  #comparison?: object;
  #benchmark?: TimingExperiment;
  #sourceMap?: ReadonlyMap<number, number>;
  #hoverTree?: StructureNode | null;
  #sourceDrafts = new Map<Session['format'], string>();
  #workspace!: Workspace;
  #workspaceStore?: WorkspaceStore;
  #workingId?: string;
  #saveTimer?: ReturnType<typeof setTimeout>;
  #workspaceError = '';
  #workspaceDirty = false;
  #workspaceSaved = false;
  #inspection?: { key: string; value: PatternInspection };
  #structureOutput?: object;
  #semanticOutput?: { copy: string; label: string; evidence: JsonObject };

  connectedCallback() {
    if (this.#events) return;
    this.#events = new AbortController();
    this.#mode = this.dataset.mode === 'strling' ? 'strling' : 'regex';
    this.#session = initialSession(this.#mode);
    this.#trust = true;
    let initialMessage: string | undefined;
    const starter = workingSource(
      this.#session,
      this.#mode === 'regex' ? 'Sample pattern' : 'Sample source',
    );
    this.#workspace = newWorkspace(this.#mode, starter);
    this.#workingId = starter.id;
    try {
      this.#workspaceStore = new WorkspaceStore(localStorage, this.#mode);
      const restored = this.#workspaceStore.load();
      if (restored) {
        this.#workspace = restored;
        this.#workspaceSaved = true;
        this.#workingId = restored.active;
        const source = restored.sources.find(
          (item) => item.id === restored.active,
        )!;
        this.#session = structuredClone(source.session);
        this.#sourceDrafts = new Map(
          Object.entries(source.drafts) as [Session['format'], string][],
        );
        this.#trust = false;
        initialMessage =
          'Working copy restored. Select Run or enable Live to execute it.';
      }
    } catch (error) {
      this.#workspaceError = shortError(error);
    }
    let adopted = false;
    try {
      const incoming =
        location.hash === '#lab-transfer'
          ? this.#takeTransfer()
          : this.#takeShareLink();
      if (incoming) {
        this.#validateMode(incoming);
        this.#adoptWorking(incoming);
        this.#session = incoming;
        this.#sourceDrafts.clear();
        adopted = true;
        this.#trust = false;
        initialMessage =
          'Session loaded. Select Run or enable Live to execute it.';
      }
    } catch (error) {
      this.#trust = false;
      initialMessage = shortError(error);
    }

    const signal = this.#events.signal;
    this.#source = new LabEditor(
      this.querySelector('[data-editor="source"]')!,
      'Pattern or STRling source',
      this.#session.source,
      {
        format: this.#session.format,
        limit: limits.pattern,
        onChange: (text) => {
          this.#session.source = text;
          queueMicrotask(() => this.#update());
        },
        onLimit: () =>
          this.#say('The edit would exceed the source size limit.'),
        onHover: (position) => this.#hoverHint(position),
      },
    );
    this.#subject = new LabEditor(
      this.querySelector('[data-editor="subject"]')!,
      'Subject text',
      this.#dataset.text,
      {
        limit: limits.input,
        onChange: (text) => {
          this.#dataset.text = text;
          queueMicrotask(() => this.#update());
        },
        onLimit: () =>
          this.#say('The edit would exceed the subject size limit.'),
        onSelection: (offset) =>
          queueMicrotask(() => this.#selectAt(offset, false)),
      },
    );
    this.#subject.view.dom.addEventListener(
      'click',
      (event) => {
        const mark = (event.target as HTMLElement).closest<HTMLElement>(
          '[data-mark]',
        )?.dataset.mark;
        if (mark) this.#activateRange(mark, false);
      },
      { signal },
    );

    this.addEventListener(
      'click',
      (event) => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
          'button',
        );
        if (
          target?.dataset.action &&
          target.closest<HTMLDetailsElement>('.workbench-menu')
        ) {
          const menu = target.closest<HTMLDetailsElement>('.workbench-menu')!;
          menu.open = false;
          menu.querySelector('summary')?.focus();
        }
        if (target?.dataset.tab) this.#showTab(target.dataset.tab);
        const action = target?.dataset.action;
        if (action) void this.#eventAction(action);
      },
      { signal },
    );
    this.addEventListener(
      'input',
      (event) => {
        const field = (event.target as HTMLElement).dataset.field;
        if (field === 'flags' || field === 'replacement') this.#change(field);
        if (field === 'name') this.#queueWorkspaceSave();
      },
      { signal },
    );
    this.addEventListener(
      'change',
      (event) => {
        const field = (event.target as HTMLElement).dataset.field;
        if (field) void this.#eventChange(field);
      },
      { signal },
    );
    this.addEventListener('keydown', (event) => this.#keydown(event), {
      signal,
    });
    this.querySelector<HTMLFormElement>('[data-form="test"]')!.addEventListener(
      'submit',
      (event) => this.#saveTest(event),
      { signal },
    );
    window.addEventListener('pagehide', () => this.#flushWorkspace(), {
      signal,
    });
    window.addEventListener('storage', () => this.#readArchive(false), {
      signal,
    });
    window.addEventListener(
      'hashchange',
      () => {
        if (!location.hash.startsWith('#lab=')) return;
        try {
          const incoming = this.#takeShareLink();
          if (!incoming) return;
          this.#validateMode(incoming);
          this.#applySession(incoming, false);
          this.#say('Session loaded. Select Run or enable Live to execute it.');
        } catch (error) {
          this.#checked('live').checked = false;
          this.#trust = false;
          this.#cancel();
          this.#say(shortError(error));
        }
      },
      { signal },
    );

    this.#checked('live').checked = this.#trust && this.#mode === 'regex';
    this.#readArchive(false);
    this.#sync();
    this.#update(initialMessage, true, adopted);
  }

  disconnectedCallback() {
    if (this.#workspaceDirty) this.#flushWorkspace();
    this.#events?.abort();
    this.#events = undefined;
    this.#cancel();
    this.#provider.dispose();
    this.#compiler.dispose();
    this.#compilerTools.dispose();
    this.#source?.destroy();
    this.#subject?.destroy();
  }

  get #dataset() {
    return this.#session.datasets[this.#session.selected]!;
  }
  #field<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    name: string,
  ) {
    return this.querySelector<T>('[data-field="' + name + '"]')!;
  }
  #checked(name: string) {
    return this.#field<HTMLInputElement>(name);
  }
  #output(name: string) {
    return this.querySelector<HTMLElement>('[data-output="' + name + '"]')!;
  }
  #action(name: string) {
    return this.querySelector<HTMLButtonElement>(
      '[data-action="' + name + '"]',
    );
  }
  #say(message: string) {
    this.#output('status').textContent = message;
  }

  #takeTransfer() {
    const text = sessionStorage.getItem(transferKey);
    sessionStorage.removeItem(transferKey);
    history.replaceState(null, '', location.pathname + location.search);
    if (!text)
      throw new Error(
        'This artifact transfer has expired. Open the artifact again from STRling Lab.',
      );
    return importBundle(text);
  }

  #takeShareLink() {
    const fragment = location.hash;
    if (!fragment.startsWith('#lab=')) return;
    history.replaceState(
      history.state,
      '',
      location.pathname + location.search,
    );
    return importFragment(fragment);
  }

  #validateMode(session: Session) {
    if ((session.format === 'regex') !== (this.#mode === 'regex'))
      throw new Error('This session belongs in the other Lab.');
  }

  #sync() {
    const session = this.#session;
    const values = {
      format: session.format,
      runtime: session.runtime,
      target: session.target,
      name: session.name,
      ...session.run,
    };
    for (const [key, value] of Object.entries(values)) {
      const field = this.#field(key);
      if (field) field.value = value ?? '';
    }
    selectOptions(
      this.#field('dataset'),
      session.datasets.map(({ name }, index) => [String(index), name]),
      String(session.selected),
    );
    this.#action('remove-dataset')!.disabled = session.datasets.length < 2;
    this.#action('add-dataset')!.disabled =
      session.datasets.length >= maxDatasets;
    const origin = this.#output('origin-details');
    origin.hidden = !session.origin;
    this.#output('origin-json').textContent = session.origin
      ? JSON.stringify(session.origin, null, 2)
      : '';
    this.#output('recording').hidden = !session.recorded;
    this.#output('recording-json').textContent = session.recorded
      ? JSON.stringify(session.recorded, null, 2)
      : '';
    this.#renderSettings();
    this.#renderTests();
    this.#renderArchive();
    this.#renderWorkspace();
  }

  #renderSettings() {
    const { format, source, runtime, target, run } = this.#session;
    this.#action('format')!.hidden =
      format === 'regex' || (format === 'semantic' && !toolsIdentity.sha256);
    this.#action('format')!.textContent =
      format === 'simply' ? 'Format JSON' : 'Format STRling';
    const replacement =
      run.operation === 'replace' || run.operation === 'replace-all';
    this.#output('replacement').hidden = !replacement;
    const detail = this.#output('flags');
    if (detail) {
      const description = isPcreRuntime(runtime)
        ? ' · UTF-8 mode · p enables Unicode properties' +
          (run.pcreNewline ? ' · all Unicode newlines' : '')
        : '';
      detail.textContent =
        'Raw pattern source · Flags ' +
        [...runtimes[runtime].flags].join(' ') +
        description;
    }
    this.#output('source-meta').textContent =
      (format === 'regex'
        ? 'Raw RegEx'
        : format === 'semantic'
          ? 'strling.semantic@1.0.0'
          : 'Simply protocol 1.0 or 1.1') +
      ' · ' +
      source.length +
      ' / ' +
      limits.pattern +
      ' UTF-16 units';
    this.#output('subject-meta').textContent =
      this.#dataset.text.length + ' / ' + limits.input + ' UTF-16 units';
    if (this.#mode === 'strling') {
      const enabled = Boolean(toolsIdentity.sha256);
      this.#action('convert')!.disabled = !enabled;
      this.#action('explain')!.disabled = !enabled;
      this.#output('compiler-tools-status').textContent = enabled
        ? 'Candidate ' +
          toolsIdentity.version +
          ' · Conversion uses canonical Semantic IR. Explanation evaluates a bounded search of the current subject.'
        : 'Canonical tools require an approved compiler adapter. This build contains the released compiler.';
    }
    const traceAvailable =
      format === 'regex'
        ? isPcreRuntime(runtime)
        : (target === 'pcre243' || target === 'pcre242') &&
          Boolean(runnableArtifact(this.#compilation));
    this.#output('trace-help').textContent = traceAvailable
      ? 'PCRE2 interpreter callouts during a search. Start optimizations and auto-possessification are disabled for tracing.'
      : format !== 'regex' && target !== 'ecmascript'
        ? 'Open the emitted pattern in RegEx Lab to explicitly choose PCRE2 instrumentation for an exploratory run.'
        : 'This runtime has no step trace. Use Structure or Compiler to inspect the parsed pattern.';
    this.#action('trace')!.disabled = !traceAvailable;
  }

  #renderWorkspace() {
    const options: [string, string][] = this.#workspace.sources.map(
      ({ id, label }) => [id, label],
    );
    if (!this.#workingId) options.unshift(['', 'Temporary working copy']);
    selectOptions(
      this.#field('working-source'),
      options,
      this.#workingId ?? '',
    );
    const full = this.#workspace.sources.length >= maxWorkingSources;
    this.#action('new-working')!.disabled = full;
    this.#action('duplicate-working')!.disabled = full;
    this.#action('rename-working')!.disabled = !this.#workingId;
    this.#action('delete-working')!.disabled = !this.#workingId;
    this.#action('duplicate-dataset')!.disabled =
      this.#session.datasets.length >= maxDatasets;
    const reusable: [string, string][] = this.#workspace.sources.flatMap(
      (source) =>
        source.id === this.#workingId
          ? []
          : source.session.datasets.map((dataset, index): [string, string] => [
              source.id + ':' + index,
              source.label + ' · ' + dataset.name,
            ]),
    );
    const reuse = this.#field<HTMLSelectElement>('reuse-dataset');
    selectOptions(reuse, [['', 'Choose a saved dataset'], ...reusable], '');
    reuse.disabled =
      !reusable.length || this.#session.datasets.length >= maxDatasets;
    this.#showWorkspaceStatus();
  }

  #showWorkspaceStatus() {
    this.#action('retry-workspace')!.hidden =
      !this.#workspaceError || Boolean(this.#workspaceStore?.needsReset);
    this.#action('reset-workspace')!.hidden = !this.#workspaceStore?.needsReset;
    const status = this.#output('workspace-status');
    const message =
      this.#workspaceError ||
      (this.#workspaceDirty
        ? 'Saving locally…'
        : this.#workspaceSaved
          ? 'Saved in this browser'
          : 'Working edits autosave in this browser');
    if (status.textContent !== message) status.textContent = message;
  }

  #captureWorking() {
    const item = this.#workspace.sources.find(
      ({ id }) => id === this.#workingId,
    );
    if (!item) return;
    const session = this.#snapshot(false);
    item.session = structuredClone({ ...session, recorded: undefined });
    item.drafts = {};
    for (const format of ['semantic', 'simply'] as const) {
      const value = this.#sourceDrafts.get(format);
      if (value !== undefined) item.drafts[format] = value;
    }
  }

  #queueWorkspaceSave() {
    this.#workspaceDirty = true;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.#flushWorkspace(), 380);
    this.#showWorkspaceStatus();
  }

  #flushWorkspace() {
    clearTimeout(this.#saveTimer);
    if (!this.#workspaceDirty) return;
    try {
      if (!this.#workingId)
        throw new Error(
          'Working source limit reached. Export this temporary copy before switching.',
        );
      if (!this.#workspaceStore?.ready) {
        this.#workspaceStore = new WorkspaceStore(localStorage, this.#mode);
        if (this.#workspaceStore.load()) {
          this.#workspaceStore = undefined;
          throw new Error(
            'Working storage already exists. Export these edits before reloading.',
          );
        }
      }
      this.#captureWorking();
      this.#workspaceStore.save(this.#workspace);
      this.#workspaceDirty = false;
      this.#workspaceSaved = true;
      this.#workspaceError = '';
      this.#showWorkspaceStatus();
    } catch (error) {
      this.#workspaceError = shortError(error);
      this.#showWorkspaceStatus();
    }
  }

  #adoptWorking(session: Session) {
    if (this.#workspace.sources.length >= maxWorkingSources) {
      this.#workingId = undefined;
      this.#workspaceError =
        'Working source limit reached. Export this temporary copy before switching.';
      return;
    }
    const item = workingSource(session, session.name);
    this.#workspace.sources.push(item);
    this.#workspace.active = item.id;
    this.#workingId = item.id;
  }

  #selectWorking(id: string) {
    const item = this.#workspace.sources.find((source) => source.id === id);
    if (!item || id === this.#workingId) return;
    if (
      !this.#workingId &&
      !confirm(
        'This temporary copy has not been autosaved. Switch working sources?',
      )
    ) {
      this.#renderWorkspace();
      return;
    }
    this.#applySession(structuredClone(item.session), false, item);
  }

  #reuseDataset(value: string) {
    const menu =
      this.#field('reuse-dataset').closest<HTMLDetailsElement>(
        '.workbench-menu',
      );
    if (menu) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
    if (!value || this.#session.datasets.length >= maxDatasets) return;
    const delimiter = value.lastIndexOf(':');
    const source = this.#workspace.sources.find(
      ({ id }) => id === value.slice(0, delimiter),
    );
    const dataset =
      source?.session.datasets[Number(value.slice(delimiter + 1))];
    if (!dataset) return;
    this.#addDataset({ ...dataset });
  }

  #addDataset(dataset: Session['datasets'][number]) {
    if (this.#session.datasets.length >= maxDatasets) return;
    this.#session.selected = this.#session.datasets.push(dataset) - 1;
    this.#subject.reset(dataset.text);
    this.#sync();
    this.#update();
  }

  #manageWorking(action: string) {
    const item = this.#workspace.sources.find(
      ({ id }) => id === this.#workingId,
    );
    if (action === 'delete-working') {
      if (
        !item ||
        !confirm(
          'Delete this working source and its working datasets? Saved session revisions are kept.',
        )
      )
        return;
      this.#workspace.sources = this.#workspace.sources.filter(
        ({ id }) => id !== item.id,
      );
      const next = this.#workspace.sources[0];
      if (next) this.#applySession(structuredClone(next.session), false, next);
      else this.#applySession(initialSession(this.#mode), true);
      return;
    }
    if (action === 'rename-working') {
      if (!item) return;
      const label = prompt('Working source name', item.label)
        ?.trim()
        .slice(0, 80);
      if (!label) return;
      item.label = label;
      this.#renderWorkspace();
      this.#queueWorkspaceSave();
      return;
    }
    if (this.#workspace.sources.length >= maxWorkingSources) return;
    const duplicate = action === 'duplicate-working';
    const suggested = duplicate
      ? (item?.label ?? 'Working copy').slice(0, 75) + ' copy'
      : this.#mode === 'regex'
        ? 'New pattern'
        : 'New source';
    const label = prompt('Working source name', suggested)?.trim().slice(0, 80);
    if (!label) return;
    const session = duplicate
      ? structuredClone(this.#snapshot(false))
      : initialSession(this.#mode);
    session.id = crypto.randomUUID();
    session.name = label;
    session.recorded = undefined;
    if (!duplicate) {
      session.format = this.#session.format;
      session.source = '';
      session.datasets = [{ name: 'Sample', text: '' }];
    }
    const next = workingSource(session, label);
    if (duplicate)
      for (const format of ['semantic', 'simply'] as const) {
        const draft = this.#sourceDrafts.get(format);
        if (draft !== undefined) next.drafts[format] = draft;
      }
    this.#workspace.sources.push(next);
    this.#applySession(session, false, next);
  }

  #tabActions() {
    const dataActions = (
      copyLabel: string,
      downloadLabel: string,
      filename: string,
      data: object,
      copyText?: string,
      exported = () => data,
    ) => ({
      copyLabel,
      downloadLabel,
      copy: () => this.#copy(copyText ?? JSON.stringify(data, null, 2)),
      download: () => download(filename, JSON.stringify(exported(), null, 2)),
    });
    switch (this.#tab) {
      case 'results':
        return (
          this.#result &&
          dataActions(
            'Copy result JSON',
            'Download result with source and run settings',
            'lab-result.json',
            this.#result,
            undefined,
            () => this.#observation(),
          )
        );
      case 'structure':
        if (this.#mode === 'strling')
          return (
            this.#compilation &&
            dataActions(
              'Copy compiler response',
              'Download compiler evidence',
              'strling-compiler.json',
              this.#compilation,
            )
          );
        return (
          this.#structureOutput &&
          dataActions(
            'Copy structure data',
            'Download structure data',
            'lab-structure.json',
            this.#structureOutput,
          )
        );
      case 'artifact': {
        const generated = generatedPattern(this.#compilation);
        return (
          generated &&
          this.#compilation &&
          dataActions(
            'Copy pattern',
            'Download artifact',
            'strling-artifact.json',
            this.#compilation,
            generated.pattern,
          )
        );
      }
      case 'compiler-tools':
        return (
          this.#semanticOutput &&
          dataActions(
            this.#semanticOutput.label,
            'Download canonical tool evidence',
            'strling-semantic-tools.json',
            this.#semanticOutput.evidence,
            this.#semanticOutput.copy,
          )
        );
      case 'tests':
        return this.#session.tests.length
          ? dataActions(
              'Copy test definitions',
              'Download tests with their subjects and expectations',
              'lab-tests.json',
              { schema: 'strling-lab-tests-v1', tests: this.#session.tests },
            )
          : undefined;
      case 'trace':
        return (
          this.#trace &&
          dataActions(
            'Copy trace JSON',
            'Download trace',
            'pcre2-trace.json',
            this.#trace,
          )
        );
      case 'compare':
        return (
          this.#comparison &&
          dataActions(
            'Copy comparison JSON',
            'Download comparison with its witness inputs',
            'lab-comparison.json',
            this.#comparison,
          )
        );
      case 'performance':
        return (
          this.#benchmark &&
          dataActions(
            'Copy timing JSON',
            'Download timings',
            'lab-timing.json',
            this.#benchmark,
          )
        );
      case 'sessions':
        return {
          copyLabel: 'Copy settings link',
          downloadLabel: 'Download session with selected inclusions',
          copy: () => this.#sessionAction('share'),
          download: () => this.#sessionAction('export-session'),
        };
    }
  }

  #renderTabActions() {
    const actions = this.#active ? undefined : this.#tabActions();
    for (const [key, label] of [
      ['copy', actions?.copyLabel],
      ['download', actions?.downloadLabel],
    ] as const) {
      const control = this.#action('tab-' + key)!;
      control.disabled = !label;
      control.setAttribute(
        'aria-label',
        label ?? (key === 'copy' ? 'Copy' : 'Download'),
      );
      control.title =
        label ??
        (this.#active
          ? 'Wait for the active operation'
          : 'No output for this tab yet');
    }
  }

  #renderArchive() {
    const relevant = this.#archive.filter(
      ({ revisions }) =>
        (revisions[0]!.session.format === 'regex') === (this.#mode === 'regex'),
    );
    const saved = this.#field<HTMLSelectElement>('saved-session');
    const savedOptions = relevant.map((item): [string, string] => [
      item.id,
      item.revisions[0]!.session.name,
    ]);
    selectOptions(
      saved,
      [['', 'Choose a session'], ...savedOptions],
      saved.value || this.#session.id,
    );
    const active = relevant.find(({ id }) => id === saved.value);
    const label = (revision: Revision) =>
      new Date(revision.savedAt).toLocaleString() +
      ' · ' +
      revision.session.name;
    selectOptions(
      this.#field('revision'),
      active?.revisions.map((revision) => [revision.id, label(revision)]) ?? [],
    );
    const baselines = relevant.flatMap((entry) =>
      entry.revisions.filter(
        (revision) =>
          this.#mode === 'regex' ||
          revision.session.target === this.#session.target,
      ),
    );
    selectOptions(this.#field('baseline'), [
      ['', 'Choose a revision'],
      ...baselines.map((revision): [string, string] => [
        revision.id,
        label(revision),
      ]),
    ]);
    for (const action of ['restore', 'delete-session', 'delete-revision'])
      this.#action(action)!.disabled = !active;
    this.#action('compare-revision')!.disabled = !baselines.length;
  }

  #readArchive(report = true) {
    try {
      this.#archive = new SessionArchive(localStorage).list();
    } catch (error) {
      if (report) this.#say(shortError(error));
    }
    this.#renderArchive();
  }

  #showTab(tab: string) {
    this.#tab = tab;
    for (const item of this.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      const selected = item.dataset.tab === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    for (const panel of this.querySelectorAll<HTMLElement>('[data-panel]'))
      panel.hidden = panel.dataset.panel !== tab;
    if (tab === 'structure') this.#renderStructure();
    this.#renderTabActions();
  }

  #keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      const menu = (event.target as HTMLElement).closest<HTMLDetailsElement>(
        '.workbench-menu[open]',
      );
      if (menu) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
        event.preventDefault();
        return;
      }
    }
    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey) &&
      !(event.target as HTMLElement).closest('dialog')
    ) {
      event.preventDefault();
      void this.#runExplicitly();
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '[data-tab]',
    );
    if (
      !target ||
      !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)
    )
      return;
    const tabs = [...this.querySelectorAll<HTMLButtonElement>('[data-tab]')];
    const current = tabs.indexOf(target);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
            tabs.length;
    event.preventDefault();
    this.#showTab(tabs[next]!.dataset.tab!);
    tabs[next]!.focus();
  }

  #cancel() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#active?.abort();
    this.#active = undefined;
    this.#interruptTiming();
    this.#resetExecutionControl();
  }

  get #canStop() {
    return (
      this.#active !== undefined &&
      !this.#active.signal.aborted &&
      this.#stopRevealTimer === undefined
    );
  }

  #resetExecutionControl() {
    clearTimeout(this.#stopRevealTimer);
    this.#stopRevealTimer = undefined;
    this.#renderExecutionControl();
  }

  #renderExecutionControl() {
    const canStop = this.#canStop;
    const state = canStop ? 'busy' : 'idle';
    const control = this.#action('run')!;
    if (control.dataset.executionState !== state) {
      const label = canStop ? 'Stop' : 'Run';
      control.setAttribute('aria-label', label);
      control.title = canStop
        ? 'Stop and pause Live'
        : 'Run (Ctrl/Command+Enter)';
      this.#output('execution-label').textContent = label;
      control.dataset.executionState = state;
    }
    this.#renderTabActions();
  }

  async #runExplicitly() {
    this.#trust = true;
    this.#showTab('results');
    await this.#perform((signal) => this.#run(signal, true));
  }

  #update(message?: string, keepRecording = false, persist = true) {
    this.#cancel();
    this.#result = undefined;
    this.#lastScan = undefined;
    this.#compilation = undefined;
    this.#pinned = undefined;
    this.#trace = undefined;
    this.#testOutcomes.clear();
    this.#sourceMap = undefined;
    this.#hoverTree = undefined;
    this.#output('compiler-tools')?.replaceChildren();
    this.#semanticOutput = undefined;
    if (this.#inspection?.key !== this.#inspectionKey())
      this.#inspection = undefined;
    this.#structureOutput = undefined;
    this.#invalidateComparison();
    this.#benchmark = undefined;
    this.#output('performance').replaceChildren();
    if (!keepRecording) {
      this.#session.recorded = undefined;
      this.#output('recording').hidden = true;
    }
    this.#renderSettings();
    this.#renderResult();
    this.#renderTrace();
    this.#renderTests();
    this.#source.highlightSource();
    this.#source.report([]);
    this.#artifact();
    if (this.#tab === 'structure') this.#renderStructure();
    this.#renderTabActions();
    if (persist) this.#queueWorkspaceSave();
    this.#say(
      message ??
        (this.#trust
          ? 'Ready'
          : 'Select Run or enable Live to execute this session.'),
    );
    if (
      this.#trust &&
      (this.#mode === 'strling' || this.#checked('live').checked)
    ) {
      this.#timer = setTimeout(() => {
        this.#timer = undefined;
        void this.#perform((signal) =>
          this.#run(signal, this.#checked('live').checked),
        );
      }, 220);
    }
  }

  async #perform(action: (signal: AbortSignal) => Promise<void>) {
    this.#cancel();
    const controller = new AbortController();
    this.#active = controller;
    this.#stopRevealTimer = setTimeout(() => {
      if (this.#active !== controller) return;
      this.#stopRevealTimer = undefined;
      this.#renderExecutionControl();
    }, stopRevealDelayMs);
    this.#renderExecutionControl();
    const deadline = setTimeout(() => {
      controller.abort();
      if (this.#active === controller) {
        this.#resetExecutionControl();
        this.#say(
          'The overall run reached its 30-second limit and was stopped.',
        );
      }
    }, 30_000);
    try {
      await action(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) this.#say(shortError(error));
    } finally {
      clearTimeout(deadline);
      if (this.#active === controller) {
        this.#active = undefined;
        this.#resetExecutionControl();
      }
    }
  }

  async #compile(session: Session, signal: AbortSignal, publish: boolean) {
    if (session.format === 'regex') return;
    const result = await this.#compiler.run(
      {
        source: session.source,
        format: session.format,
        target: session.target,
      },
      signal,
    );
    signal.throwIfAborted();
    if (publish) {
      this.#compilation = result;
      this.#hoverTree = undefined;
      this.#artifact();
      this.#renderSettings();
      this.#diagnostics();
      if (this.#tab === 'structure') this.#renderStructure();
    }
    return result;
  }

  async #semanticTool(
    operation: ToolRequest['operation'],
    signal: AbortSignal,
  ) {
    const session = this.#session;
    const panel = this.#output('compiler-tools');
    panel.replaceChildren();
    this.#semanticOutput = undefined;
    this.#showTab('compiler-tools');
    this.#say('Running canonical ' + operation + '…');
    if (operation === 'format') {
      if (!isScalarText(session.source))
        throw new Error('Formatting requires valid Unicode scalar text.');
      const compile = sourceCompileRequest(session.source, {
        sourceId: 'src:website.lab',
      });
      const document = jsonObject(jsonObject(compile.input)?.document);
      if (!document)
        throw new Error(
          'The Semantic STRling document could not be constructed.',
        );
      const { result } = await this.#compilerTools.run(
        { operation, document },
        signal,
      );
      if (result.status === 'rejected') {
        this.#diagnostics(result.diagnostics);
        const diagnostics = Array.isArray(result.diagnostics)
          ? result.diagnostics
          : [];
        for (const entry of diagnostics) {
          const diagnostic = jsonObject(entry);
          const span = sourceSpan(diagnostic?.primary_location);
          const message = String(diagnostic?.message);
          panel.append(
            span
              ? button(message, () => this.#highlightSource(span))
              : node('p', message),
          );
        }
        this.#semanticOutput = {
          label: 'Copy formatter diagnostics',
          copy: JSON.stringify(result, null, 2),
          evidence: result,
        };
        panel.append(details('Canonical diagnostics', raw(diagnostics)));
        this.#say('The canonical formatter rejected the source.');
        return;
      }
      if (
        typeof result.text !== 'string' ||
        result.text.length > limits.pattern
      )
        throw new Error('Formatted source exceeds the editor size limit.');
      const changed = session.source !== result.text;
      if (changed) {
        session.source = result.text;
        this.#source.replace(result.text);
        this.#update('Canonical STRling source formatted.');
      }
      panel.append(
        node(
          'p',
          changed
            ? 'Canonical STRling source formatted.'
            : 'The source is already canonical.',
        ),
      );
      this.#semanticOutput = {
        label: 'Copy formatted STRling',
        copy: result.text,
        evidence: result,
      };
      if (!changed) this.#say('The source is already canonical.');
      return;
    }

    const destination = this.#field<HTMLSelectElement>('conversion-destination')
      .value as Destination;
    const useTarget =
      this.#field<HTMLSelectElement>('explanation-scope').value === 'target';
    const subject = this.#dataset.text;
    const compilation = await this.#compile(session, signal, true);
    const program = jsonObject(
      jsonObject(compilation?.result?.semantic_result)?.program,
    );
    if (!program)
      throw new Error(
        'Resolve the compiler diagnostics to produce canonical Semantic IR.',
      );
    if (operation === 'explain') {
      if (!isScalarText(subject))
        throw new Error('Explanation requires valid Unicode scalar text.');
      const target = useTarget ? compilation?.profile : undefined;
      if (useTarget && !target)
        throw new Error('The selected target profile could not be verified.');
      const { result } = await this.#compilerTools.run(
        {
          operation,
          program,
          subject,
          ...(target && {
            target_profile: targets[session.target]
              .profile as unknown as JsonObject,
          }),
        },
        signal,
        target,
      );
      const summary =
        String(result.outcome) + ' · ' + String(result.explanation_disposition);
      panel.append(
        node('h3', 'Canonical search explanation'),
        node('p', summary),
      );
      const findings = node('ul');
      const positions = coordinateMap(subject, 'utf8-bytes');
      for (const finding of Array.isArray(result.findings)
        ? result.findings
        : []) {
        const item = jsonObject(finding);
        if (!item) continue;
        const label =
          String(item.confidence) +
          ' · ' +
          String(item.reason_code).replaceAll('_', ' ');
        const location = jsonObject(item.subject_location);
        const start =
          location?.kind === 'position'
            ? location.byte_offset
            : location?.start;
        const end = location?.kind === 'position' ? start : location?.end;
        const range =
          typeof start === 'number' &&
          typeof end === 'number' &&
          editorRange(
            { start, end, unit: 'utf8-bytes' },
            subject.length,
            positions,
          );
        const row = node('li');
        row.append(
          range
            ? button(label + ' · subject byte ' + start, () =>
                this.#subject.select(range.start, range.end),
              )
            : node('span', label),
        );
        findings.append(row);
      }
      if (findings.childElementCount) panel.append(findings);
      this.#semanticOutput = {
        label: 'Copy canonical explanation JSON',
        copy: JSON.stringify(result, null, 2),
        evidence: result,
      };
      panel.append(details('Canonical explanation evidence', raw(result)));
      this.#say('Canonical search explanation · ' + summary);
      return;
    }

    const { result } = await this.#compilerTools.run(
      { operation, program, destination },
      signal,
    );
    const output = jsonObject(result.output);
    const converted =
      destination === 'semantic_strling'
        ? typeof output?.text === 'string'
          ? output.text
          : undefined
        : jsonObject(output?.request)
          ? JSON.stringify(output?.request, null, 2)
          : undefined;
    panel.append(node('h3', 'Canonical conversion · ' + String(result.status)));
    const issues = node('ul');
    for (const issue of Array.isArray(result.issues) ? result.issues : []) {
      const entry = jsonObject(issue);
      if (typeof entry?.message === 'string')
        issues.append(node('li', entry.message));
    }
    if (issues.childElementCount) panel.append(issues);
    if (converted !== undefined) {
      panel.append(details('Converted source', node('pre', converted)));
      if (result.status === 'exact' && converted.length <= limits.pattern) {
        const format =
          destination === 'semantic_strling' ? 'semantic' : 'simply';
        panel.append(
          button('Use exact conversion', () => {
            this.#sourceDrafts.set(session.format, session.source);
            session.format = format;
            session.source = converted;
            this.#source.reset(converted, format);
            this.#sync();
            this.#update('Exact conversion opened in the source editor.');
            this.#source.view.focus();
          }),
        );
      }
    }
    this.#semanticOutput = {
      label:
        converted === undefined
          ? 'Copy conversion evidence'
          : 'Copy converted source',
      copy: converted ?? JSON.stringify(result, null, 2),
      evidence: result,
    };
    panel.append(details('Canonical conversion evidence', raw(result)));
    this.#say('Canonical conversion · ' + String(result.status));
  }

  #diagnostics(
    entries: JsonValue | undefined = this.#compilation?.result?.diagnostics,
  ) {
    const diagnostics = Array.isArray(entries) ? entries : [];
    const positions = this.#sourceCoordinates('utf8-bytes');
    this.#source.report(
      diagnostics.flatMap((value) => {
        const diagnostic = jsonObject(value);
        const span = sourceSpan(diagnostic?.primary_location);
        const range =
          span && editorRange(span, this.#session.source.length, positions);
        if (!range || typeof diagnostic?.message !== 'string') return [];
        const severity =
          diagnostic.severity === 'error'
            ? 'error'
            : diagnostic.severity === 'warning'
              ? 'warning'
              : 'info';
        return [
          {
            from: range.start,
            to: range.end,
            severity,
            message: diagnostic.message,
            source: String(diagnostic.code),
          },
        ];
      }),
    );
  }

  #sourceCoordinates(unit: string) {
    return unit === 'utf8-bytes'
      ? (this.#sourceMap ??= coordinateMap(this.#session.source, unit))
      : coordinateMap(this.#session.source, unit);
  }

  #highlightSource(span?: StructureNode['range']) {
    const valid =
      span &&
      (span.unit === 'utf16-code-units' ||
        span.unit === 'utf8-bytes' ||
        span.unit === 'unicode-code-points');
    this.#source.highlightSource(
      valid
        ? editorRange(
            span,
            this.#session.source.length,
            span.unit === 'utf16-code-units'
              ? undefined
              : this.#sourceCoordinates(span.unit),
          )
        : undefined,
    );
  }

  async #pattern(session: Session, signal: AbortSignal, publish: boolean) {
    if (session.format === 'regex')
      return {
        source: session.source,
        runtime: session.runtime,
        artifactOptions: undefined,
        compilation: undefined,
      };
    const compilation = await this.#compile(session, signal, publish);
    const artifact = runnableArtifact(compilation);
    if (!artifact)
      throw new Error(
        compilation?.failure ??
          'This compiler result has no artifact eligible for the browser runtime. See Compiler and Artifact.',
      );
    return {
      source: artifact.pattern,
      runtime: artifact.runtime,
      artifactOptions: artifact.options,
      compilation,
    };
  }

  #scanProvenance(compilation?: Compilation): ScanProvenance {
    const { format, source, origin } = this.#session;
    const profile = compilation?.profile ?? origin?.profile;
    const compiler = compilation?.identity ?? origin?.compiler;
    return {
      format: origin?.format ?? format,
      source: origin?.source ?? source,
      profile: typeof profile?.sha256 === 'string' ? profile.sha256 : undefined,
      compiler: compiler
        ? JSON.stringify([
            compiler.package,
            compiler.productVersion,
            compiler.abi,
            compiler.protocol,
          ])
        : undefined,
    };
  }

  async #run(signal: AbortSignal, execute: boolean, resume = false) {
    if (this.#mode === 'strling' && !execute) {
      this.#say('Compiling STRling source…');
      const compilation = await this.#compile(this.#session, signal, true);
      this.#say(
        compilation?.failure ??
          'Compiler ' +
            (compilation?.result?.outcome ??
              'did not return a compile result') +
            (runnableArtifact(compilation) ? ' · Run artifact to test it' : ''),
      );
      return;
    }
    const continuation = resume ? this.#session.continuation : undefined;
    if (resume && !continuation)
      throw new Error('No verified scan boundary is saved.');
    if (resume) {
      this.#lastScan = undefined;
      this.#result = undefined;
      this.#renderResult();
    }
    this.#say(
      resume
        ? 'Verifying and resuming saved scan…'
        : this.#mode === 'strling'
          ? 'Compiling and running artifact…'
          : 'Running ' + runtimes[this.#session.runtime].label + '…',
    );
    const pattern = await this.#pattern(this.#session, signal, true);
    signal.throwIfAborted();
    const options = { ...this.#session.run, ...pattern.artifactOptions };
    const request = runRequest(
      pattern.runtime,
      pattern.source,
      this.#dataset.text,
      options,
    );
    const provenance = this.#scanProvenance(pattern.compilation);
    const result = continuation
      ? await this.#provider.resume(request, continuation, provenance, signal)
      : await this.#provider.execute(request, { signal });
    signal.throwIfAborted();
    this.#lastScan =
      !resume &&
      isPcreRuntime(pattern.runtime) &&
      options.operation === 'scan' &&
      result.status === 'matched'
        ? { request, provenance }
        : undefined;
    this.#result = result;
    if (
      'error' in result &&
      result.error.offset !== undefined &&
      result.error.offsetUnit &&
      this.#mode === 'regex'
    ) {
      const unit = result.error.offsetUnit;
      const range = editorRange(
        { start: result.error.offset, end: result.error.offset, unit },
        this.#session.source.length,
        this.#sourceCoordinates(unit),
      );
      if (range)
        this.#source.report([
          {
            from: range.start,
            to: range.end,
            severity: 'error',
            message: result.error.message,
          },
        ]);
    }
    this.#renderResult();
    this.#say(
      (continuation && !('error' in result)
        ? 'Resumed at byte ' + continuation.after.end + ' · '
        : '') + resultSummary(result),
    );
  }

  #cursorControls() {
    const current = this.#session.continuation;
    const result = this.#result;
    const candidates =
      this.#lastScan && result?.status === 'matched'
        ? result.matches
            .slice(0, -1)
            .filter((match) => match.span.end > match.span.start)
        : [];
    this.#output('continuation-tools').hidden = !current && !candidates.length;
    this.#output('checkpoint-controls').hidden = !candidates.length;
    this.#action('resume-scan')!.hidden = !current;
    this.#output('continuation-status').textContent = current
      ? 'Saved boundary at byte ' +
        current.after.end +
        '. Resume verifies this boundary. Run starts a fresh scan.'
      : 'Keep a consuming match boundary from this complete scan, then save a revision to retain it.';
    selectOptions(
      this.#field('checkpoint-match'),
      candidates.map(({ ordinal, span }) => [
        String(ordinal),
        'Match ' + ordinal + ' · byte ' + span.end,
      ]),
    );
  }

  async #recordCursor(signal: AbortSignal) {
    const scan = this.#lastScan;
    if (!scan || !this.#result)
      throw new Error('Run a complete PCRE2 scan to keep a boundary.');
    const ordinal = Number(this.#field('checkpoint-match').value);
    const continuation = await createContinuation(
      scan.request,
      this.#result,
      scan.provenance,
      ordinal,
    );
    signal.throwIfAborted();
    if (!continuation)
      throw new Error('This match does not provide a resumable boundary.');
    this.#session.continuation = continuation;
    this.#queueWorkspaceSave();
    this.#cursorControls();
    this.#artifact();
    this.#say('Scan boundary kept at byte ' + continuation.after.end + '.');
  }

  #renderResult() {
    this.#cursorControls();
    const result = this.#result;
    const provenance = this.#output('provenance');
    provenance.hidden = !result?.observation;
    if (result?.observation) {
      const { runtime, runtimeVersion } = result.observation;
      provenance.textContent =
        'Browser observation · ' +
        runtime +
        (runtimeVersion ? ' · ' + runtimeVersion : '') +
        (result.engineNativeMetadata?.valueEncoding === 'hex'
          ? ' · byte values shown as hexadecimal'
          : '');
    }
    this.#output('result-details').hidden = !result;
    const extraction = this.#output('extraction');
    extraction.hidden = result?.status !== 'matched';
    if (extraction.hidden) this.#output('extracted-values').replaceChildren();
    this.#action('test-from-result')!.disabled = !result;
    if (!result) {
      this.#matches = undefined;
      this.#subject.mark([]);
      this.#output('matches').replaceChildren(
        node(
          'p',
          'Run to see matches or other output for the selected operation.',
        ),
      );
      return;
    }
    const captures = this.#captureSources();
    this.#matches = renderMatches(
      result,
      this.#dataset.text,
      (id, focus) => this.#activateRange(id, focus),
      (id) => this.#highlight(id),
      (name) => {
        const range = captures.get(name);
        return range ? () => this.#highlightSource(range) : undefined;
      },
    );
    this.#output('matches').replaceChildren(this.#matches.content);
    this.#output('result-json').textContent = JSON.stringify(result, null, 2);
    this.#output('result-tree').replaceChildren(objectTree(result));
    if (result.status === 'matched') {
      const select = this.#field<HTMLSelectElement>('extraction-value');
      const captures = new Map<number, string>();
      for (const match of result.matches) {
        for (const capture of match.captures) {
          captures.set(
            capture.index,
            'Group ' +
              capture.index +
              (capture.name ? ' · ' + capture.name : ''),
          );
        }
      }
      selectOptions(
        select,
        [
          ['0', 'Entire match'],
          ...[...captures].map(([index, label]): [string, string] => [
            String(index),
            label,
          ]),
        ],
        select.value || '0',
      );
      this.#extract();
    }
    this.#highlight();
  }

  #extract() {
    const result = this.#result;
    if (result?.status !== 'matched') return;
    const select = this.#field<HTMLSelectElement>('extraction-value');
    const index = Number(select.value);
    const values = result.matches.map((match) =>
      index ? (match.captures[index - 1]?.value ?? null) : match.value,
    );
    const text = JSON.stringify(values, null, 2);
    this.#output('extracted-values').textContent = text;
    return text;
  }

  #captureSources() {
    const mappings = new Map<string, NonNullable<StructureNode['range']>>();
    const compilation = this.#compilation?.result;
    const program = jsonObject(
      jsonObject(compilation?.semantic_result)?.program,
    );
    const tree =
      program && semanticTree(program, jsonObject(compilation?.artifact));
    if (!tree) return mappings;
    const visit = (node: StructureNode) => {
      if (node.range && node.captureName)
        mappings.set(node.captureName, node.range);
      node.children.forEach(visit);
    };
    visit(tree);
    return mappings;
  }

  #hoverHint(position: number) {
    if (this.#hoverTree === undefined) {
      this.#hoverTree = null;
      const { format, source, runtime, run } = this.#session;
      if (format === 'regex') {
        if (runtime !== 'javascript') return;
        try {
          this.#hoverTree = explainRegex(source, run.flags, runtime);
        } catch {
          return;
        }
      } else {
        const result = this.#compilation?.result;
        const program = jsonObject(
          jsonObject(result?.semantic_result)?.program,
        );
        this.#hoverTree = program
          ? (semanticTree(program, jsonObject(result?.artifact)) ?? null)
          : null;
      }
    }
    const find = (node: StructureNode): string | undefined => {
      const span = node.range;
      const range =
        span &&
        editorRange(
          span,
          this.#session.source.length,
          span.unit === 'utf16-code-units'
            ? undefined
            : this.#sourceCoordinates(span.unit),
        );
      if (range && (position < range.start || position >= range.end)) return;
      for (const child of node.children) {
        const match = find(child);
        if (match) return match;
      }
      return range ? node.label : undefined;
    };
    return this.#hoverTree ? find(this.#hoverTree) : undefined;
  }

  #highlight(hovered?: string) {
    const selected = hovered ?? this.#pinned;
    const matches = this.#matches;
    if (!matches) return;
    const additions = selected ? matches.positions.get(selected) : undefined;
    this.#subject.mark(
      additions
        ? [...matches.marks, { ...additions, id: selected!, kind: 'selected' }]
        : matches.marks,
    );
    for (const [id, button] of matches.resultButtons)
      button.setAttribute('aria-pressed', String(id === this.#pinned));
  }

  #activateRange(id: string, focus: boolean) {
    const range = this.#matches?.positions.get(id);
    if (!range) return;
    this.#pinned = id;
    this.#highlight();
    if (focus) this.#subject.select(range.start, range.end, false);
    else {
      this.#showTab('results');
      this.#matches?.resultButtons.get(id)?.focus({ preventScroll: true });
    }
  }

  #selectAt(offset: number, focus: boolean) {
    const matches = this.#matches;
    if (!matches) return;
    const options = [...matches.positions].filter(
      ([, { start, end }]) =>
        start <= offset && (start === end ? offset === start : offset < end),
    );
    options.sort(
      ([a, left], [b, right]) =>
        left.end - left.start - (right.end - right.start) ||
        b.length - a.length,
    );
    if (!options[0]) return;
    if (focus) this.#activateRange(options[0][0], false);
    else {
      this.#pinned = options[0][0];
      this.#highlight();
    }
  }

  #inspectionKey() {
    const { source, runtime, run } = this.#session;
    return JSON.stringify([source, runtime, run.flags, run.pcreNewline]);
  }

  async #inspectStructure(signal: AbortSignal) {
    const { runtime, source, run } = this.#session;
    const key = this.#inspectionKey();
    this.#say('Inspecting ' + runtimes[runtime].label + '…');
    const inspected = await this.#provider.inspect(
      runRequest(runtime, source, '', {
        flags: run.flags,
        pcreNewline: run.pcreNewline,
        replacement: '',
        replacementSyntax: 'literal',
        operation: 'search',
      }),
      signal,
    );
    signal.throwIfAborted();
    if (this.#inspectionKey() !== key) return;
    this.#inspection = { key, value: inspected };
    this.#renderStructure();
    this.#say('Structure inspection · ' + inspected.disposition);
  }

  #renderInspection(inspected: PatternInspection) {
    const { runtime, source, run } = this.#session;
    const panel = this.#output('structure');
    this.#structureOutput = inspected;
    panel.replaceChildren(
      node(
        'p',
        inspected.authority +
          ' · ' +
          inspected.version +
          ' · ' +
          inspected.disposition,
      ),
      button('Inspect native structure', () => {
        void this.#perform((next) => this.#inspectStructure(next));
      }),
    );
    if (inspected.authority === 'pcre2-callout-enumeration') {
      panel.append(
        node(
          'p',
          'Compiled capture definitions and native item ranges. Some directives and structural relationships are unavailable.',
        ),
      );
    } else {
      panel.append(
        node(
          'p',
          'CPython exposes optimized parser instructions and native diagnostic positions. Individual nodes have no source spans.',
        ),
      );
    }
    if (inspected.tree)
      panel.append(
        renderStructure(inspected.tree, (range) =>
          this.#highlightSource(range),
        ),
      );
    if (inspected.diagnostics && 'error' in inspected.diagnostics) {
      const { message, offset, offsetUnit } = inspected.diagnostics.error;
      if (offset === undefined || !offsetUnit) {
        panel.append(node('p', message));
      } else {
        const label = message + ' · ' + offset + ' ' + offsetUnit;
        const span = { start: offset, end: offset, unit: offsetUnit };
        panel.append(
          editorRange(span, source.length, coordinateMap(source, offsetUnit))
            ? button(label, () => this.#highlightSource(span))
            : node('p', label),
        );
      }
    }
    this.#addCode(panel, runtime, source, run);
  }

  #renderStructure() {
    const panel = this.#output('structure');
    const session = this.#session;
    panel.replaceChildren();
    if (session.format === 'regex') {
      this.#structureOutput = undefined;
      if (session.runtime !== 'javascript') {
        if (this.#inspection?.key === this.#inspectionKey()) {
          this.#renderInspection(this.#inspection.value);
          return;
        }
        panel.append(
          node('p', 'Inspect the current pattern with the selected runtime.'),
        );
        panel.append(
          button('Inspect native structure', () => {
            void this.#perform((signal) => this.#inspectStructure(signal));
          }),
        );
        this.#addCode(panel, session.runtime, session.source, session.run);
        return;
      }
      panel.append(node('p', 'Static interpretation · ECMAScript parser'));
      try {
        const tree = explainRegex(
          session.source,
          session.run.flags,
          session.runtime,
        );
        this.#structureOutput = { authority: 'ecmascript-static-parser', tree };
        panel.append(
          renderStructure(tree, (span) => this.#highlightSource(span)),
        );
        const flags = node('ul');
        for (const flag of session.run.flags)
          flags.append(
            node('li', flag + ' · ' + javascriptFlagDescriptions[flag]),
          );
        if (flags.childElementCount) panel.append(flags);
      } catch (error) {
        panel.append(node('p', shortError(error)));
      }
      this.#addCode(panel, session.runtime, session.source, session.run);
      return;
    }

    const response = this.#compilation;
    if (!response) {
      panel.append(
        node('p', 'Compile the source to inspect canonical results.'),
      );
      return;
    }
    panel.append(
      node(
        'p',
        'STRling ' +
          response.identity.productVersion +
          ' · ' +
          (response.result?.outcome ?? 'request failed'),
      ),
    );
    if (response.failure) panel.append(node('p', response.failure));
    const result = response.result;
    if (!result) {
      if (response.protocolResult)
        panel.append(
          details('Simply protocol response', raw(response.protocolResult)),
        );
      return;
    }
    if (typeof result.specification_version === 'string')
      panel.append(
        node('p', 'Semantic specification ' + result.specification_version),
      );
    if (Array.isArray(result.diagnostics)) {
      const list = node('ul');
      for (const value of result.diagnostics) {
        const diagnostic = jsonObject(value);
        const span = sourceSpan(diagnostic?.primary_location);
        const message =
          String(diagnostic?.code) + ' · ' + String(diagnostic?.message);
        const item = node('li');
        item.append(
          span
            ? button(message, () => this.#highlightSource(span))
            : node('span', message),
        );
        list.append(item);
      }
      if (list.childElementCount) panel.append(node('h3', 'Diagnostics'), list);
    }
    const program = jsonObject(jsonObject(result.semantic_result)?.program);
    const tree = program && semanticTree(program, jsonObject(result.artifact));
    if (tree)
      panel.append(
        node('h3', 'Canonical Semantic IR'),
        renderStructure(tree, (span) => this.#highlightSource(span)),
      );
    for (const [key, label] of [
      ['analysis', 'Semantic analysis'],
      ['portability', 'Portability decisions'],
      ['semantic_result', 'Semantic IR JSON'],
    ] as const) {
      if (result[key]) panel.append(details(label, objectTree(result[key])));
    }
    panel.append(
      details(
        'Exact compiler response',
        raw(response.protocolResult ?? result),
      ),
    );
  }

  #addCode(
    panel: HTMLElement,
    runtime: Runtime,
    pattern: string,
    options: RunOptions,
  ) {
    const example = runtimeExample(runtime, pattern, options);
    if (!example) return;
    const code = node('pre', example);
    code.tabIndex = 0;
    const language = runtime.startsWith('python') ? 'Python' : 'JavaScript';
    panel.append(
      details(
        language + ' integration example',
        code,
        button('Copy ' + language + ' example', () => {
          void this.#copy(example);
        }),
      ),
    );
  }

  #artifact() {
    const panel = this.#output('artifact');
    if (!panel) return;
    const response = this.#compilation;
    const generated = generatedPattern(response);
    const runnable = runnableArtifact(response);
    this.#action('run-artifact')!.disabled = !runnable;
    this.#action('open-artifact')!.disabled = !generated;
    this.#action('open-with-cursor')!.hidden =
      !runnable || !this.#session.continuation;
    panel.replaceChildren();
    if (!generated) {
      panel.append(
        node('p', 'No target artifact was emitted for the current source.'),
      );
      return;
    }
    const code = node('pre', generated.pattern);
    code.tabIndex = 0;
    panel.append(
      node(
        'p',
        targets[this.#session.target].label +
          ' · emitted flags ' +
          (generated.flags || '(none)'),
      ),
      code,
    );
    if (!runnable)
      panel.append(
        node(
          'p',
          'There is no matching local provider for this exact target and its artifact requirements.',
        ),
      );
    const mappings = Array.isArray(generated.artifact.source_map)
      ? generated.artifact.source_map
      : [];
    const mappingRows = node('ol');
    for (const row of mappings) {
      const entry = jsonObject(row);
      const generatedRange = sourceSpan(entry?.generated_span);
      if (!generatedRange) continue;
      const locations = Array.isArray(entry?.source_spans)
        ? entry.source_spans
        : [];
      const links = node('li');
      links.append(
        node(
          'span',
          'Artifact [' +
            generatedRange.start +
            ', ' +
            generatedRange.end +
            ') ' +
            generatedRange.unit +
            ' ' +
            JSON.stringify(entry?.node_ids ?? []),
        ),
      );
      for (const location of locations) {
        const span = sourceSpan(location);
        if (span)
          links.append(
            button('Source [' + span.start + ', ' + span.end + ')', () =>
              this.#highlightSource(span),
            ),
          );
      }
      mappingRows.append(links);
    }
    if (mappingRows.childElementCount)
      panel.append(details('Source mappings', mappingRows));
    panel.append(
      details(
        'Artifact metadata, options and requirements',
        raw(generated.artifact),
      ),
    );
    if (runnable)
      this.#addCode(panel, runnable.runtime, generated.pattern, {
        ...this.#session.run,
        ...runnable.options,
      });
  }

  async #eventChange(field: string) {
    try {
      switch (field) {
        case 'import-session': {
          const text = await assertFile(this.#field('import-session'));
          if (text === undefined) return;
          const session = importBundle(text);
          this.#validateMode(session);
          this.#applySession(session, false);
          return;
        }
        case 'import-tests': {
          const text = await assertFile(this.#field('import-tests'));
          if (text === undefined) return;
          const data: unknown = JSON.parse(text);
          if (
            !data ||
            typeof data !== 'object' ||
            !('schema' in data) ||
            data.schema !== 'strling-lab-tests-v1' ||
            !('tests' in data)
          )
            throw new Error('Unsupported test collection.');
          const imported = readTests(data.tests).map((item) => ({
            ...item,
            id: crypto.randomUUID(),
          }));
          if (this.#session.tests.length + imported.length > maxTests)
            throw new Error('The imported tests exceed the suite limit.');
          this.#session.tests.push(...imported);
          this.#invalidateComparison();
          this.#renderTests();
          this.#queueWorkspaceSave();
          this.#say('Imported ' + imported.length + ' tests.');
          return;
        }
        case 'working-source':
          this.#selectWorking(this.#field(field).value);
          return;
        case 'reuse-dataset':
          this.#reuseDataset(this.#field(field).value);
          return;
        case 'saved-session':
          this.#renderArchive();
          return;
        case 'live':
          if (this.#checked('live').checked) this.#trust = true;
          this.#update(undefined, true);
          return;
        default:
          this.#change(field);
      }
    } catch (error) {
      this.#say(shortError(error));
    }
  }

  #change(field: string) {
    const value = this.#field(field).value;
    switch (field) {
      case 'format':
        if (value !== 'semantic' && value !== 'simply') return;
        this.#sourceDrafts.set(this.#session.format, this.#session.source);
        this.#session.format = value;
        this.#session.source =
          this.#sourceDrafts.get(value) ??
          (value === 'semantic' ? semanticExample : simplyExample);
        this.#source.reset(this.#session.source, value);
        break;
      case 'runtime':
        this.#session.runtime = value as Runtime;
        if (!isPcreRuntime(this.#session.runtime))
          delete this.#session.run.pcreNewline;
        break;
      case 'target':
        this.#session.target = value as Target;
        this.#renderArchive();
        break;
      case 'dataset':
        this.#session.selected = Number(value);
        this.#subject.reset(this.#dataset.text);
        break;
      case 'operation':
        this.#session.run.operation = value as RunOptions['operation'];
        break;
      case 'flags':
      case 'replacement':
        if (value === this.#session.run[field]) return;
        this.#session.run[field] = value;
        break;
      case 'replacementSyntax':
        this.#session.run.replacementSyntax =
          value as RunOptions['replacementSyntax'];
        break;
      case 'conversion-destination':
      case 'explanation-scope':
        this.#cancel();
        this.#semanticOutput = undefined;
        this.#output('compiler-tools').replaceChildren();
        this.#renderTabActions();
        this.#say('Semantic tools settings updated.');
        return;
      case 'baseline':
      case 'comparison-runtime':
        this.#cancel();
        this.#invalidateComparison();
        if (field === 'baseline') this.#invalidateTiming();
        return;
      case 'size':
      case 'benchmark-baseline':
        this.#cancel();
        this.#invalidateTiming();
        return;
      case 'extraction-value':
        this.#extract();
        return;
      default:
        return;
    }
    this.#update();
  }

  async #eventAction(action: string) {
    try {
      switch (action) {
        case 'run':
          if (this.#canStop) {
            this.#checked('live').checked = false;
            this.#cancel();
            this.#say('Stopped.');
          } else await this.#runExplicitly();
          return;
        case 'run-artifact':
          await this.#runExplicitly();
          return;
        case 'tall': {
          const tall = this.toggleAttribute('data-tall');
          this.#action('tall')!.setAttribute('aria-pressed', String(tall));
          return;
        }
        case 'tab-copy':
        case 'tab-download': {
          if (!this.#active)
            await this.#tabActions()?.[
              action === 'tab-copy' ? 'copy' : 'download'
            ]();
          return;
        }
        case 'find':
          openSearchPanel(this.#source.view);
          return;
        case 'new-working':
        case 'rename-working':
        case 'delete-working':
        case 'duplicate-working':
          this.#manageWorking(action);
          return;
        case 'retry-workspace':
          this.#workspaceDirty = true;
          this.#flushWorkspace();
          return;
        case 'reset-workspace':
          if (
            confirm(
              'Reset unreadable working storage for this Lab? Saved session revisions are kept.',
            )
          ) {
            this.#workspaceStore?.resetUnreadable();
            this.#workspaceDirty = true;
            this.#flushWorkspace();
          }
          return;
        case 'format': {
          if (this.#session.format === 'semantic') {
            await this.#perform((signal) =>
              this.#semanticTool('format', signal),
            );
            return;
          }
          const formatted = JSON.stringify(
            JSON.parse(this.#session.source),
            null,
            2,
          );
          if (formatted.length > limits.pattern)
            throw new Error('Formatted JSON exceeds the source size limit.');
          this.#session.source = formatted;
          this.#source.replace(formatted);
          this.#update();
          return;
        }
        case 'convert':
        case 'explain':
          await this.#perform((signal) => this.#semanticTool(action, signal));
          return;
        case 'duplicate-dataset':
          this.#addDataset({
            ...this.#dataset,
            name: this.#dataset.name.slice(0, 75) + ' copy',
          });
          return;
        case 'add-dataset':
        case 'rename-dataset': {
          const title =
            action === 'add-dataset'
              ? 'Dataset ' + (this.#session.datasets.length + 1)
              : this.#dataset.name;
          const name = prompt('Dataset name', title)?.trim().slice(0, 80);
          if (!name) return;
          if (action === 'add-dataset') {
            this.#addDataset({ name, text: '' });
            return;
          }
          this.#dataset.name = name;
          this.#sync();
          this.#update();
          return;
        }
        case 'remove-dataset':
          if (!confirm('Remove this dataset from the working session?')) return;
          this.#session.datasets.splice(this.#session.selected, 1);
          this.#session.selected = Math.min(
            this.#session.selected,
            this.#session.datasets.length - 1,
          );
          this.#subject.reset(this.#dataset.text);
          this.#sync();
          this.#update();
          return;
        case 'copy-source':
          await this.#copy(this.#session.source);
          return;
        case 'export-extraction': {
          const extracted = this.#extract();
          if (extracted !== undefined)
            download('lab-extraction.json', extracted);
          return;
        }
        case 'open-artifact':
          this.#transferArtifact();
          return;
        case 'open-with-cursor':
          this.#transferArtifact(true);
          return;
        case 'record-cursor':
          await this.#perform((signal) => this.#recordCursor(signal));
          return;
        case 'resume-scan':
          await this.#perform((signal) => this.#run(signal, true, true));
          return;
        case 'add-test':
        case 'test-from-result':
          this.#editTest(
            undefined,
            action === 'test-from-result' ? this.#result : undefined,
          );
          return;
        case 'cancel-test':
          this.#dialog.close();
          return;
        case 'run-tests':
          await this.#perform((signal) =>
            this.#runTests(this.#session.tests, signal),
          );
          return;
        case 'trace':
          await this.#perform((signal) => this.#debug(signal));
          return;
        case 'previous-event':
        case 'next-event':
          this.#step += action === 'previous-event' ? -1 : 1;
          this.#renderTrace(true);
          return;
        case 'compare-revision':
        case 'compare-runtimes':
          await this.#perform((signal) =>
            this.#compare(action === 'compare-revision', signal),
          );
          return;
        case 'benchmark':
          await this.#perform((signal) => this.#measure(signal));
          return;
        default:
          await this.#sessionAction(action);
      }
    } catch (error) {
      this.#say(shortError(error));
    }
  }

  async #copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.#say('Copied.');
    } catch {
      this.#say(
        'Clipboard access is unavailable. Select the text or use Download.',
      );
    }
  }

  #transferArtifact(withCursor = false) {
    const response = this.#compilation;
    const generated = generatedPattern(response);
    if (!generated || !response?.profile || this.#session.format === 'regex')
      return;
    const incoming = initialSession('regex');
    incoming.name = this.#session.name.slice(0, 68) + ' · artifact';
    incoming.source = generated.pattern;
    incoming.origin = {
      source: this.#session.source,
      compiler: response.identity,
      format: this.#session.format,
      profile: response.profile,
      artifact: generated.artifact,
    };
    incoming.run = { ...this.#session.run, flags: generated.flags };
    incoming.datasets = structuredClone(this.#session.datasets);
    incoming.selected = this.#session.selected;
    incoming.continuation = withCursor ? this.#session.continuation : undefined;
    if (this.#session.target.startsWith('pcre2')) incoming.runtime = 'pcre2';
    if (this.#session.target.startsWith('python')) incoming.runtime = 'python';
    const runnable = runnableArtifact(response);
    if (runnable) {
      incoming.runtime = runnable.runtime;
      Object.assign(incoming.run, runnable.options);
    }
    sessionStorage.setItem(
      transferKey,
      bundleSession(incoming, {
        source: true,
        samples: true,
        tests: false,
        observations: false,
        sourceOrigin: true,
        continuation: withCursor,
      }),
    );
    location.assign('/regex/lab/#lab-transfer');
  }

  #applySession(session: Session, trusted: boolean, working?: WorkingSource) {
    this.#cancel();
    this.#captureWorking();
    this.#session = session;
    this.#trust = trusted;
    this.#sourceDrafts.clear();
    if (working) {
      this.#workspace.active = working.id;
      this.#workingId = working.id;
      this.#sourceDrafts = new Map(
        Object.entries(working.drafts) as [Session['format'], string][],
      );
    } else this.#adoptWorking(session);
    this.#source.reset(session.source, session.format);
    this.#subject.reset(this.#dataset.text);
    this.#checked('live').checked = false;
    this.#output('share').hidden = true;
    this.#sync();
    this.#update(undefined, true);
  }

  #observation(session = this.#session) {
    return {
      schema: 'strling-lab-recorded-observation-v1',
      source: session.source,
      sourceFormat: session.format,
      target: session.target,
      runtime: session.runtime,
      run: session.run,
      datasetName: this.#dataset.name,
      result: this.#result,
      compilation: this.#compilation,
      recordedAt: new Date().toISOString(),
    };
  }

  #snapshot(include = true): Session {
    const name = this.#field('name').value.trim();
    const recorded =
      include &&
      (this.#result ||
        this.#compilation ||
        this.#trace ||
        this.#comparison ||
        this.#benchmark)
        ? {
            capturedAt: new Date().toISOString(),
            result: this.#result,
            compilation: this.#compilation,
            investigation: {
              trace: this.#trace as unknown as JsonObject | undefined,
              comparison: this.#comparison as JsonObject | undefined,
              timing:
                this.#benchmark?.status === 'running'
                  ? undefined
                  : (this.#benchmark as JsonObject | undefined),
            },
          }
        : this.#session.recorded;
    return { ...this.#session, name: name || this.#session.name, recorded };
  }

  async #sessionAction(action: string) {
    const store = new SessionArchive(localStorage);
    const selected = this.#field('saved-session').value;
    const revision = this.#field('revision').value;
    switch (action) {
      case 'save':
        this.#queueWorkspaceSave();
        store.save(importBundle(JSON.stringify(this.#snapshot())));
        this.#session.name = this.#snapshot().name;
        this.#readArchive();
        this.#say('Revision saved in this browser.');
        return;
      case 'duplicate': {
        const session = this.#snapshot();
        session.id = crypto.randomUUID();
        session.name = session.name.slice(0, 73) + ' copy';
        this.#applySession(session, false);
        this.#say('Working copy created. Save a revision to keep it.');
        return;
      }
      case 'new-session':
        if (
          confirm(
            'Start a new session? Unsaved changes in this workbench will be replaced.',
          )
        )
          this.#applySession(initialSession(this.#mode), true);
        return;
      case 'restore': {
        const item = this.#revision(revision);
        if (item) this.#applySession(structuredClone(item.session), false);
        return;
      }
      case 'delete-revision':
        if (
          selected &&
          revision &&
          confirm('Delete the selected local revision?')
        )
          store.deleteRevision(selected, revision);
        break;
      case 'delete-session':
        if (
          selected &&
          confirm('Delete this saved session and all its local revisions?')
        )
          store.deleteSession(selected);
        break;
      case 'clear-sessions':
        if (
          confirm(
            'Clear all saved STRling and RegEx Lab sessions from this browser?',
          )
        )
          store.clear();
        break;
      case 'share': {
        const share = new URL(location.pathname, location.origin);
        share.hash = shareFragment(this.#session);
        this.#output('share').hidden = false;
        this.#field('share-url').value = share.href;
        await this.#copy(share.href);
        return;
      }
      case 'export-session': {
        const choices = {
          source: this.#checked('share-active-source').checked,
          replacement: this.#checked('share-replacement').checked,
          samples: this.#checked('share-samples').checked,
          tests: this.#checked('share-tests').checked,
          observations: this.#checked('share-observations').checked,
          sourceOrigin: this.#checked('share-source').checked,
          continuation: this.#checked('share-continuation').checked,
        };
        if (
          choices.continuation &&
          this.#session.continuation &&
          (!choices.source ||
            !choices.samples ||
            (this.#session.origin && !choices.sourceOrigin) ||
            (this.#session.run.replacement && !choices.replacement))
        )
          throw new Error(
            'To include this cursor, select its active source, sample data, original source and existing replacement text where applicable.',
          );
        const bundle = bundleSession(
          importBundle(JSON.stringify(this.#snapshot(choices.observations))),
          choices,
        );
        download('lab-session.json', bundle);
        return;
      }
      default:
        return;
    }
    this.#readArchive();
  }

  #revision(id: string) {
    return this.#archive
      .flatMap((item) => item.revisions)
      .find((revision) => revision.id === id);
  }

  get #dialog() {
    return this.querySelector<HTMLDialogElement>('[data-dialog="test"]')!;
  }

  #editTest(item?: LabTest, copy?: LabExecutionResult) {
    if (!item && this.#session.tests.length >= maxTests) {
      this.#say('This session has 32 tests. Remove one to add another.');
      return;
    }
    const form = this.#dialog.querySelector('form')!;
    this.#testId = item?.id;
    const settings = item?.run ?? this.#session.run;
    const values = {
      name: item?.name ?? 'Test ' + (this.#session.tests.length + 1),
      group: item?.group ?? '',
      text: item?.text ?? this.#dataset.text,
      flags: settings.flags,
      operation: settings.operation,
      replacement: settings.replacement,
      replacementSyntax: settings.replacementSyntax,
      expected: JSON.stringify(
        item?.expected ??
          (copy
            ? expectedFrom(copy)
            : settings.operation === 'search'
              ? { kind: 'boolean', value: true }
              : settings.operation === 'split'
                ? { kind: 'split', value: [] }
                : settings.operation.startsWith('replace')
                  ? { kind: 'replacement', value: '' }
                  : { kind: 'matches', count: 1 }),
        null,
        2,
      ),
    };
    for (const [key, value] of Object.entries(values)) {
      const field = form.elements.namedItem(key) as
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      field.value = value;
    }
    this.#output('test-error').textContent = '';
    this.#dialog.showModal();
  }

  #saveTest(event: SubmitEvent) {
    event.preventDefault();
    const fields = Object.fromEntries(
      new FormData(event.currentTarget as HTMLFormElement),
    );
    try {
      const [test] = readTests([
        {
          id: this.#testId ?? crypto.randomUUID(),
          name: typeof fields.name === 'string' ? fields.name.trim() : '',
          group: fields.group,
          text: fields.text,
          run: { ...fields, pcreNewline: this.#session.run.pcreNewline },
          expected: JSON.parse(String(fields.expected)),
        },
      ]);
      this.#session.tests = this.#testId
        ? this.#session.tests.map((item) =>
            item.id === this.#testId ? test! : item,
          )
        : [...this.#session.tests, test!];
      this.#testOutcomes.delete(test!.id);
      this.#invalidateComparison();
      this.#queueWorkspaceSave();
      this.#dialog.close();
      this.#renderTests();
      this.#say('Test saved to the working session.');
    } catch (error) {
      this.#output('test-error').textContent = shortError(error);
    }
  }

  #renderTests() {
    const panel = this.#output('tests');
    panel.replaceChildren();
    this.#action('run-tests')!.disabled = !this.#session.tests.length;
    this.#renderTabActions();
    if (!this.#session.tests.length)
      panel.append(node('p', 'No test cases in this session.'));
    const groups = new Map<string, LabTest[]>();
    for (const test of this.#session.tests) {
      const group = test.group || 'Ungrouped';
      const items = groups.get(group) ?? [];
      items.push(test);
      groups.set(group, items);
    }
    for (const [group, items] of groups) {
      const list = node('ul');
      list.className = 'workbench-results';
      panel.append(node('h3', group), list);
      for (const item of items) {
        const row = node('li');
        const outcome = this.#testOutcomes.get(item.id);
        row.append(
          node(
            'strong',
            item.name +
              (outcome
                ? outcome.length
                  ? ' · Failed'
                  : ' · Passed'
                : ' · Ready'),
          ),
        );
        const actions = node('div');
        actions.className = 'workbench-inline';
        actions.append(
          button('Run ' + item.name, () => {
            void this.#perform((signal) => this.#runTests([item], signal));
          }),
          button('Edit ' + item.name, () => this.#editTest(item)),
          button('Delete ' + item.name, () => {
            this.#session.tests = this.#session.tests.filter(
              ({ id }) => id !== item.id,
            );
            this.#testOutcomes.delete(item.id);
            this.#invalidateComparison();
            this.#renderTests();
            this.#queueWorkspaceSave();
            this.#action('add-test')?.focus();
          }),
        );
        row.append(actions, details('Expectation', raw(item.expected)));
        if (outcome?.length) {
          const errors = node('ul');
          errors.append(...outcome.map((message) => node('li', message)));
          row.append(errors);
        }
        list.append(row);
      }
    }
  }

  async #runTests(items: LabTest[], signal: AbortSignal) {
    this.#say('Running ' + items.length + ' tests…');
    const pattern = await this.#pattern(this.#session, signal, true);
    let passed = 0;
    for (const test of items) {
      const result = await this.#provider.execute(
        runRequest(pattern.runtime, pattern.source, test.text, {
          ...test.run,
          ...pattern.artifactOptions,
        }),
        { signal },
      );
      signal.throwIfAborted();
      const differences = assess(test.expected, result);
      this.#testOutcomes.set(test.id, differences);
      if (!differences.length) passed++;
    }
    const active = (document.activeElement as HTMLElement | null)?.closest(
      '[data-panel="tests"]',
    );
    this.#renderTests();
    if (active) this.#action('run-tests')?.focus();
    this.#say(passed + ' of ' + items.length + ' tests passed.');
  }

  async #debug(signal: AbortSignal) {
    this.#say('Recording PCRE2 interpreter callouts…');
    const pattern = await this.#pattern(this.#session, signal, true);
    const request = runRequest(
      pattern.runtime,
      pattern.source,
      this.#dataset.text,
      {
        ...this.#session.run,
        ...pattern.artifactOptions,
        operation: 'search',
      },
    );
    this.#trace = await this.#provider.trace(request, signal);
    signal.throwIfAborted();
    this.#step = 0;
    this.#renderTrace(true);
    this.#say(
      this.#trace.events.length + ' trace events · ' + this.#trace.termination,
    );
  }

  #renderTrace(select = false) {
    const panel = this.#output('trace');
    const trace = this.#trace;
    const event = trace?.events[this.#step];
    panel.replaceChildren();
    this.#action('previous-event')!.disabled = !event || this.#step <= 0;
    this.#action('next-event')!.disabled =
      !event || this.#step >= trace!.events.length - 1;
    this.#renderTabActions();
    if (!trace) {
      panel.append(node('p', 'No trace recorded.'));
      return;
    }
    panel.append(
      node(
        'p',
        (trace.execution.observation?.runtimeVersion ?? 'PCRE2') +
          ' · ' +
          trace.termination +
          ' · ' +
          resultSummary(trace.execution),
      ),
    );
    if (!event) {
      if (select) this.#highlightSource();
      return;
    }
    panel.append(
      node('h3', 'Step ' + (this.#step + 1) + ' of ' + trace.events.length),
    );
    const source = this.#mappedTraceSource(event.pattern);
    const highlightPattern = () => this.#highlightSource(source);
    const selectInput = () => {
      const map = coordinateMap(this.#dataset.text, 'utf8-bytes');
      const offset = map.get(event.subjectPosition);
      if (offset === undefined) return;
      this.#subject.select(offset, offset, false);
      this.#subject.mark([
        { start: offset, end: offset, id: 'trace', kind: 'selected' },
      ]);
    };
    const positionName =
      'Pattern bytes ' + event.pattern.start + '–' + event.pattern.end;
    const position = source
      ? button(positionName, highlightPattern)
      : node('span', positionName);
    const input = button('Input byte ' + event.subjectPosition, selectInput);
    panel.append(
      position,
      input,
      node(
        'p',
        (event.newAttempt ? 'New attempt · ' : '') +
          (event.backtrackSincePrevious
            ? 'Backtrack since previous event · '
            : '') +
          'Callout ' +
          event.callout +
          ' · last capture ' +
          event.lastCapture,
      ),
      details('Capture state', raw(event.captures)),
    );
    if (select) {
      highlightPattern();
      selectInput();
    }
  }

  #mappedTraceSource(span: NonNullable<StructureNode['range']>) {
    if (this.#session.format === 'regex') return span;
    const mappings = generatedPattern(this.#compilation)?.artifact.source_map;
    if (!Array.isArray(mappings)) return;
    const candidates = mappings.flatMap((item) => {
      const record = jsonObject(item);
      const generated = sourceSpan(record?.generated_span);
      if (
        !generated ||
        generated.unit !== span.unit ||
        span.start < generated.start ||
        span.start >= generated.end
      )
        return [];
      const origins = record?.source_spans;
      const source = sourceSpan(
        Array.isArray(origins) ? origins[0] : undefined,
      );
      return source
        ? [{ source, length: generated.end - generated.start }]
        : [];
    });
    return candidates.sort((left, right) => left.length - right.length)[0]
      ?.source;
  }

  #invalidateComparison() {
    this.#comparison = undefined;
    this.#output('comparison').replaceChildren();
    this.#renderTabActions();
  }

  async #compare(revision: boolean, signal: AbortSignal) {
    this.#invalidateComparison();
    const baseline = revision
      ? this.#revision(this.#field('baseline').value)
      : undefined;
    if (revision && !baseline) throw new Error('Choose a baseline revision.');
    const current = this.#session;
    const otherRuntime = this.#field<HTMLSelectElement>('comparison-runtime')
      ?.value as Runtime | undefined;
    if (!revision && otherRuntime === current.runtime)
      throw new Error('Choose a different runtime.');
    this.#say('Running controlled comparison…');
    const fresh = await this.#pattern(current, signal, true);
    const previous = baseline
      ? await this.#pattern(baseline.session, signal, false)
      : { ...fresh, runtime: otherRuntime! };
    const leftRuntime = fresh.runtime;
    const rightRuntime = revision ? leftRuntime : previous.runtime;
    const run = async (
      source: string,
      runtime: Runtime,
      override: Partial<RunOptions> | undefined,
      input: string,
      options: RunOptions,
    ) =>
      this.#provider.execute(
        runRequest(runtime, source, input, { ...options, ...override }),
        { signal },
      );
    const witnesses = [];
    for (const dataset of current.datasets) {
      const left = await run(
        revision ? previous.source : fresh.source,
        leftRuntime,
        revision ? previous.artifactOptions : fresh.artifactOptions,
        dataset.text,
        current.run,
      );
      const right = await run(
        revision ? fresh.source : previous.source,
        rightRuntime,
        revision ? fresh.artifactOptions : previous.artifactOptions,
        dataset.text,
        current.run,
      );
      signal.throwIfAborted();
      witnesses.push({
        ...dataset,
        before: left,
        after: right,
        differences: compareObservations(left, right, dataset.text),
      });
      if (JSON.stringify(witnesses).length > 2_000_000)
        throw new Error(
          'The comparison reached the export size limit. Compare fewer datasets.',
        );
    }
    const regressions = [];
    if (baseline) {
      for (const test of current.tests) {
        const left = await run(
          previous.source,
          leftRuntime,
          previous.artifactOptions,
          test.text,
          test.run,
        );
        const right = await run(
          fresh.source,
          rightRuntime,
          fresh.artifactOptions,
          test.text,
          test.run,
        );
        signal.throwIfAborted();
        regressions.push({
          id: test.id,
          name: test.name,
          before: assess(test.expected, left),
          after: assess(test.expected, right),
        });
      }
    }
    const sources = baseline
      ? { before: baseline.session.source, after: current.source }
      : { pattern: current.source };
    const buildStructure = (pattern: typeof fresh) => {
      if (current.format === 'regex') {
        if (leftRuntime !== 'javascript') return;
        try {
          return explainRegex(pattern.source, current.run.flags, 'javascript');
        } catch {
          return;
        }
      }
      const result = pattern.compilation?.result;
      const program = jsonObject(jsonObject(result?.semantic_result)?.program);
      if (program) return semanticTree(program, jsonObject(result?.artifact));
    };
    const structure = baseline
      ? {
          before: buildStructure(previous),
          after: buildStructure(fresh),
        }
      : undefined;
    this.#comparison = {
      schema: 'strling-lab-comparison-v1',
      kind: revision ? 'revision' : 'runtime',
      baseline: baseline?.id,
      sources,
      sourceFormat: current.format,
      target: current.format === 'regex' ? undefined : current.target,
      structure,
      executionPatterns: {
        before: revision ? previous.source : fresh.source,
        after: revision ? fresh.source : previous.source,
        beforeOptions: (revision ? previous : fresh).artifactOptions,
        afterOptions: (revision ? fresh : previous).artifactOptions,
      },
      runtimeBefore: leftRuntime,
      runtimeAfter: rightRuntime,
      operation: current.run,
      witnesses,
      regressions,
    };
    const panel = this.#output('comparison');
    panel.replaceChildren(
      node(
        'p',
        'Concrete observations from ' + witnesses.length + ' named datasets.',
      ),
    );
    for (const witness of witnesses) {
      const title =
        witness.name +
        ' · ' +
        (witness.differences.length
          ? witness.differences.length + ' differences'
          : 'No observed difference');
      panel.append(
        details(
          title,
          node(
            'p',
            resultSummary(witness.before) +
              ' → ' +
              resultSummary(witness.after),
          ),
          raw(witness.differences),
        ),
      );
    }
    if ('before' in sources && sources.before !== sources.after)
      panel.append(details('Source revisions', raw(sources)));
    if (
      structure &&
      (structure.before || structure.after) &&
      JSON.stringify(structure.before) !== JSON.stringify(structure.after)
    ) {
      panel.append(details('Structure before and after', raw(structure)));
    }
    if (regressions.length)
      panel.append(details('Regression tests', raw(regressions)));
    this.#renderTabActions();
    this.#say('Comparison complete.');
  }

  #invalidateTiming() {
    this.#benchmark = undefined;
    this.#output('performance').replaceChildren();
    this.#renderTabActions();
  }

  async #measure(signal: AbortSignal) {
    this.#invalidateTiming();
    const multiplier = Number(this.#field('size').value);
    const dataset = this.#dataset;
    const text =
      multiplier === 2
        ? dataset.text.repeat(2)
        : multiplier === 0.5
          ? Array.from(dataset.text)
              .slice(0, Math.floor(Array.from(dataset.text).length / 2))
              .join('')
          : dataset.text;
    if (text.length > limits.input)
      throw new Error('The measured sample exceeds the size limit.');
    const includeBaseline = this.#checked('benchmark-baseline').checked;
    const baseline = includeBaseline
      ? this.#revision(this.#field('baseline').value)
      : undefined;
    if (!baseline && includeBaseline)
      throw new Error('Choose a baseline revision in Compare.');
    const current = this.#session;
    const order = baseline
      ? (['baseline', 'current'] as const)
      : (['current'] as const);
    const versions = { baseline: baseline?.session, current };
    const selectedOptions = { ...current.run };
    const experiment: TimingExperiment = {
      schema: timingSchema,
      dataset: dataset.name,
      multiplier,
      repetitions: timingRepetitions,
      timerResolutionMs: estimateTimerResolution(),
      status: 'running',
      order: [...order],
      rounds: baseline ? [] : undefined,
      series: order.map((candidate) => ({
        candidate,
        source: versions[candidate]!.source,
        inputUnits: text.length,
        samples: [],
        stats: seriesStats([]),
      })),
    };
    const providers: BrowserLabProvider[] = [];
    this.#benchmark = experiment;
    this.#renderBenchmark(experiment);
    this.#say('Running bounded timings…');
    const isCurrent = () =>
      this.#benchmark === experiment &&
      (!this.#active || this.#active.signal === signal);
    try {
      await runTimingExperiment(
        experiment,
        async (entry, preparationSignal) => {
          const pattern = await this.#pattern(
            versions[entry.candidate]!,
            preparationSignal,
            entry.candidate === 'current',
          );
          preparationSignal.throwIfAborted();
          const options = { ...selectedOptions, ...pattern.artifactOptions };
          const runtime =
            current.format === 'regex' ? current.runtime : pattern.runtime;
          entry.executionPattern = pattern.source;
          entry.runtime = runtime;
          entry.runtimeIdentity = interactiveIdentity(runtime);
          entry.options = options;
          if (pattern.compilation) {
            const { identity, profile, durationMs, cached } =
              pattern.compilation;
            entry.compiler = { identity, profile, durationMs, cached };
            entry.artifact = generatedPattern(pattern.compilation)?.artifact;
          }
          // Alternation must not recreate a cold worker after the warmup.
          const provider = new BrowserLabProvider();
          providers.push(provider);
          return (executionSignal) =>
            provider.execute(
              runRequest(runtime, pattern.source, text, options),
              { signal: executionSignal },
            );
        },
        signal,
        () => {
          if (isCurrent()) this.#renderBenchmark(experiment);
        },
      );
      if (!signal.aborted && isCurrent())
        this.#say(
          experiment.status === 'complete'
            ? 'Timing experiment finished.'
            : 'Timing experiment incomplete. Completed measurements are available.',
        );
    } finally {
      for (const provider of providers) provider.dispose();
      if (isCurrent()) this.#renderBenchmark(experiment);
    }
  }

  #interruptTiming() {
    const experiment = this.#benchmark;
    if (experiment?.status !== 'running') return;
    interruptTiming(experiment);
    this.#renderBenchmark(experiment);
  }

  #renderBenchmark(experiment: TimingExperiment) {
    const panel = this.#output('performance');
    panel.replaceChildren();
    const paired = experiment.rounds?.filter(
      (round) => round.status === 'complete',
    ).length;
    const state = {
      running: 'Measuring',
      complete: 'Complete',
      incomplete: 'Incomplete',
    }[experiment.status];
    panel.append(
      node(
        'h3',
        paired === undefined
          ? 'Single-candidate experiment'
          : 'Paired comparison',
      ),
      node(
        'p',
        state +
          (paired === undefined
            ? ''
            : ' · ' +
              paired +
              ' of ' +
              timingRepetitions +
              ' paired rounds completed'),
      ),
    );
    if (experiment.issue) panel.append(node('p', experiment.issue));
    if (paired !== undefined) {
      const [baseline, current] = experiment.series;
      const before = baseline?.stats.wall;
      const after = current?.stats.wall;
      if (experiment.status !== 'running' && before && after) {
        const count = Math.min(
          baseline!.samples.filter((sample) => !sample.error).length,
          current!.samples.filter((sample) => !sample.error).length,
        );
        panel.append(
          node(
            'p',
            'End-to-end median difference (current vs baseline) · ' +
              displayTimingDifference(
                before,
                after,
                experiment.timerResolutionMs,
                count,
              ),
          ),
        );
      }
      if (experiment.status !== 'running')
        panel.append(
          details('Paired rounds and execution order', raw(experiment.rounds)),
        );
    }
    for (const entry of experiment.series) {
      const count = entry.samples.filter((sample) => !sample.error).length;
      panel.append(
        node(
          'h3',
          entry.candidate === 'baseline'
            ? 'Baseline revision'
            : 'Current revision',
        ),
        node(
          'p',
          (count === timingRepetitions
            ? ''
            : experiment.status === 'running'
              ? 'Measuring · '
              : 'Incomplete · ') +
            count +
            ' of ' +
            timingRepetitions +
            ' measured runs completed',
        ),
      );
      if (entry.runtime)
        panel.append(
          node(
            'p',
            runtimes[entry.runtime].label +
              (entry.options?.flags ? ' · flags ' + entry.options.flags : '') +
              (entry.options?.pcreNewline
                ? ' · newline ' + entry.options.pcreNewline
                : ''),
          ),
        );
      if (entry.issue) panel.append(node('p', entry.issue));
      for (const [name, stats] of [
        ['End to end', entry.stats.wall],
        ['Worker compile', entry.stats.compile],
        ['Runtime execution', entry.stats.execute],
      ] as const) {
        if (stats)
          panel.append(
            node(
              'p',
              name +
                ' · ' +
                displayTiming(stats, experiment.timerResolutionMs, count),
            ),
          );
      }
      if (entry.compiler) {
        const duration = entry.compiler.durationMs;
        panel.append(
          node(
            'p',
            'STRling compilation · ' +
              displayTiming(
                { min: duration, median: duration, max: duration },
                experiment.timerResolutionMs,
                1,
              ) +
              (entry.compiler.cached ? ' · cached' : ''),
          ),
        );
      }
      if (experiment.status !== 'running')
        panel.append(
          details('Measurements and runtime provenance', raw(entry)),
        );
    }
    this.#renderTabActions();
  }
}

customElements.define('lab-workbench', LabWorkbench);
