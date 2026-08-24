import type { NormalizedLabProfile } from '@/lib/regex-conformance/contracts';
import {
  createLabExecutionRequest,
  ReactiveLabExecutor,
  type LabCapture,
  type LabExecutionProvider,
  type LabExecutionResult,
  type LabMatch,
  type LabOptionValue,
} from '@/lib/regex-lab';

import type { RegexProfileResolverElement } from './regexProfileResolver';

interface LabHydrationState {
  lastConsumedCheckpoint: string | null;
  lastConsumedSequence: number | null;
  profiles: NormalizedLabProfile[];
}

interface InspectionRange {
  ref: string;
  kind: 'match' | 'capture';
  start: number;
  end: number;
}

const unavailableProvider: LabExecutionProvider = {
  providerId: 'unavailable-until-certified-checkpoint',
  kind: 'remote-isolated',
  supports: () => false,
  execute: async () => {
    throw new Error('No certified execution provider is configured.');
  },
};

function resultStatusLabel(result: LabExecutionResult): string {
  switch (result.status) {
    case 'matched':
      return `${result.matches.length} match${result.matches.length === 1 ? '' : 'es'}`;
    case 'no-match':
      return 'No match';
    case 'compile-rejection':
      return 'Pattern rejected';
    case 'runtime-error':
      return 'Runtime error';
    case 'resource-terminated':
      return 'Execution terminated';
    case 'unsupported-operation':
      return 'Unsupported operation';
    case 'infrastructure-failure':
      return 'Infrastructure failure';
  }
}

function displayValue(value: string): string {
  return value.length === 0 ? '(zero-width)' : value;
}

function selectionOffsets(
  root: HTMLElement,
): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  ) {
    return null;
  }
  const beforeStart = range.cloneRange();
  beforeStart.selectNodeContents(root);
  beforeStart.setEnd(range.startContainer, range.startOffset);
  const beforeEnd = range.cloneRange();
  beforeEnd.selectNodeContents(root);
  beforeEnd.setEnd(range.endContainer, range.endOffset);
  return {
    start: beforeStart.toString().length,
    end: beforeEnd.toString().length,
  };
}

function restoreSelection(
  root: HTMLElement,
  offsets: { start: number; end: number } | null,
): void {
  if (!offsets) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let cursor = 0;
  let startSet = false;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (!startSet && offsets.start <= cursor + length) {
      range.setStart(node, Math.max(0, offsets.start - cursor));
      startSet = true;
    }
    if (offsets.end <= cursor + length) {
      range.setEnd(node, Math.max(0, offsets.end - cursor));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    cursor += length;
  }
}

function inspectionReference(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  if ('captureId' in value && typeof value.captureId === 'string') {
    return value.captureId;
  }
  if ('matchId' in value && typeof value.matchId === 'string') {
    return value.matchId;
  }
  return null;
}

function objectTreeNode(
  key: string,
  value: unknown,
  inheritedRef: string | null = null,
): HTMLElement {
  const ownRef = inspectionReference(value) ?? inheritedRef;
  if (value !== null && typeof value === 'object') {
    const details = document.createElement('details');
    details.className = 'lab-tree-branch';
    if (key === 'result') details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = Array.isArray(value)
      ? `${key} [${value.length}]`
      : key;
    summary.dataset.treeKey = key;
    if (ownRef) {
      summary.dataset.inspectionRef = ownRef;
      summary.dataset.inspectionRefs = ownRef;
    }
    const children = document.createElement('div');
    children.className = 'lab-tree-children';
    for (const [childKey, childValue] of Object.entries(value)) {
      children.append(objectTreeNode(childKey, childValue, ownRef));
    }
    details.append(summary, children);
    return details;
  }
  const row = document.createElement('div');
  row.className = 'lab-tree-value';
  row.dataset.treeKey = key;
  if (ownRef) {
    row.dataset.inspectionRef = ownRef;
    row.dataset.inspectionRefs = ownRef;
    row.tabIndex = 0;
  }
  const term = document.createElement('span');
  term.textContent = key;
  const scalar = document.createElement('code');
  scalar.textContent =
    typeof value === 'string' ? JSON.stringify(value) : String(value);
  row.append(term, scalar);
  return row;
}

export class RegexLabElement extends HTMLElement {
  #profiles: NormalizedLabProfile[] = [];
  #profile: NormalizedLabProfile | null = null;
  #provider: LabExecutionProvider = unavailableProvider;
  #executor: ReactiveLabExecutor | null = null;
  #requestCounter = 0;
  #pinnedRef: string | null = null;
  #hoveredRef: string | null = null;
  #initialized = false;

  async connectedCallback(): Promise<void> {
    if (this.#initialized) return;
    this.#initialized = true;
    await customElements.whenDefined('regex-profile-resolver');
    this.#executor = new ReactiveLabExecutor(this.#provider, {
      debounceMs: 180,
      onStateChange: (state) => {
        this.#renderExecutionState(state.phase, state.result);
      },
    });
    this.#bindEvents();
    const stateScript =
      this.querySelector<HTMLScriptElement>('[data-lab-state]');
    if (stateScript?.textContent) {
      this.hydrate(JSON.parse(stateScript.textContent) as LabHydrationState);
    }
  }

  disconnectedCallback(): void {
    this.#executor?.dispose();
  }

  setProvider(provider: LabExecutionProvider): void {
    this.#provider = provider;
    this.#executor?.setProvider(provider);
  }

  hydrate(state: LabHydrationState): void {
    this.#profiles = [...state.profiles];
    const resolver = this.querySelector(
      'regex-profile-resolver',
    ) as RegexProfileResolverElement | null;
    resolver?.setProfiles(this.#profiles);
    this.#profile =
      (resolver?.selectedProfiles[0] as NormalizedLabProfile) ?? null;
    this.#renderProfileControls();
    this.#setLocked(!this.#profile);
    if (this.#profile) this.#scheduleExecution();
  }

  #bindEvents(): void {
    this.addEventListener('profile-selection-change', (event) => {
      const profiles = (
        event as CustomEvent<{ profiles: NormalizedLabProfile[] }>
      ).detail.profiles;
      this.#profile = profiles[0] ?? null;
      this.#renderProfileControls();
      this.#setLocked(!this.#profile);
      this.#scheduleExecution();
    });
    this.querySelector('[data-lab-pattern]')?.addEventListener('input', () =>
      this.#scheduleExecution(),
    );
    this.querySelector('[data-lab-operation]')?.addEventListener('change', () =>
      this.#scheduleExecution(),
    );
    this.querySelector('[data-lab-options]')?.addEventListener('change', () =>
      this.#scheduleExecution(),
    );
    const editor = this.#editor;
    editor?.addEventListener('input', () => this.#scheduleExecution());
    editor?.addEventListener('paste', (event) => this.#pastePlainText(event));
    editor?.addEventListener('mouseup', () => this.#focusSelectedDecoration());
    this.querySelector('[data-lab-clear-inspection]')?.addEventListener(
      'click',
      () => this.#clearInspection(),
    );
    this.addEventListener('pointerover', (event) => {
      const target = (event.target as Element).closest<HTMLElement>(
        '[data-inspection-ref]',
      );
      if (target) this.#setHovered(target.dataset.inspectionRef ?? null);
    });
    this.addEventListener('pointerout', (event) => {
      const related = event.relatedTarget;
      if (
        !(related instanceof Element) ||
        !related.closest('[data-inspection-ref]')
      ) {
        this.#setHovered(null);
      }
    });
    this.addEventListener('focusin', (event) => {
      const target = (event.target as Element).closest<HTMLElement>(
        '[data-inspection-ref]',
      );
      if (target) this.#setHovered(target.dataset.inspectionRef ?? null);
    });
    this.addEventListener('focusout', (event) => {
      const related = event.relatedTarget;
      if (!(related instanceof Element) || !this.contains(related)) {
        this.#setHovered(null);
      }
    });
    this.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLElement>(
        '[data-inspection-ref]',
      );
      if (!target) return;
      this.#pinnedRef = target.dataset.inspectionRef ?? null;
      this.#applyInspection();
    });
    this.addEventListener('keydown', (event) => this.#handleKeydown(event));
    for (const tab of this.querySelectorAll<HTMLButtonElement>(
      '[data-lab-tab]',
    )) {
      tab.addEventListener('click', () => this.#activateTab(tab));
    }
  }

  get #editor(): HTMLElement | null {
    return this.querySelector('[data-lab-editor]');
  }

  #setLocked(locked: boolean): void {
    const pattern =
      this.querySelector<HTMLTextAreaElement>('[data-lab-pattern]');
    const operation = this.querySelector<HTMLSelectElement>(
      '[data-lab-operation]',
    );
    const options = this.querySelector<HTMLFieldSetElement>(
      '[data-lab-options-fieldset]',
    );
    const clear = this.querySelector<HTMLButtonElement>(
      '[data-lab-clear-inspection]',
    );
    if (pattern) pattern.disabled = locked;
    if (operation) operation.disabled = locked;
    if (options) options.disabled = locked;
    if (clear) clear.disabled = locked;
    if (this.#editor) {
      this.#editor.contentEditable = String(!locked);
      this.#editor.setAttribute('aria-disabled', String(locked));
    }
    const gate = this.querySelector<HTMLElement>('[data-lab-gate]');
    if (gate) gate.hidden = !locked;
  }

  #renderProfileControls(): void {
    const operation = this.querySelector<HTMLSelectElement>(
      '[data-lab-operation]',
    );
    const options = this.querySelector<HTMLElement>('[data-lab-options]');
    const textMeta = this.querySelector<HTMLElement>('[data-lab-text-meta]');
    if (!operation || !options || !textMeta) return;
    operation.replaceChildren();
    options.replaceChildren();
    if (!this.#profile) {
      const waiting = document.createElement('option');
      waiting.textContent = 'Waiting for profile metadata';
      operation.append(waiting);
      textMeta.textContent = 'Editable after checkpoint';
      return;
    }
    for (const item of this.#profile.operations) {
      const option = document.createElement('option');
      option.value = item.operationId;
      option.textContent = item.label;
      option.title = item.description;
      operation.append(option);
    }
    for (const definition of this.#profile.options) {
      const label = document.createElement('label');
      label.className = 'lab-option-control';
      const labelText = document.createElement('span');
      labelText.textContent = definition.label;
      if (definition.kind === 'boolean') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = definition.defaultValue === true;
        input.dataset.labOption = definition.optionId;
        label.append(input, labelText);
      } else {
        label.append(labelText);
        const select = document.createElement('select');
        select.className = 'tool-select';
        select.dataset.labOption = definition.optionId;
        for (const choice of definition.choices ?? []) {
          const option = document.createElement('option');
          option.value = choice.value;
          option.textContent = choice.label;
          option.selected = choice.value === definition.defaultValue;
          select.append(option);
        }
        label.append(select);
      }
      options.append(label);
    }
    textMeta.textContent = this.#profile.nativeIndexUnit;
  }

  #currentOptions(): Record<string, LabOptionValue> {
    const options: Record<string, LabOptionValue> = {};
    for (const control of this.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('[data-lab-option]')) {
      const key = control.dataset.labOption;
      if (!key) continue;
      options[key] =
        control instanceof HTMLInputElement && control.type === 'checkbox'
          ? control.checked
          : control.value;
    }
    return options;
  }

  #inputText(): string {
    return this.#editor?.innerText.replaceAll('\r\n', '\n') ?? '';
  }

  #scheduleExecution(): void {
    if (!this.#profile || !this.#executor) {
      this.#executor?.clear();
      return;
    }
    const pattern =
      this.querySelector<HTMLTextAreaElement>('[data-lab-pattern]');
    const operation = this.querySelector<HTMLSelectElement>(
      '[data-lab-operation]',
    );
    if (!pattern || !operation?.value) return;
    this.#requestCounter += 1;
    this.#executor.update(
      createLabExecutionRequest({
        requestId: `lab-${Date.now()}-${this.#requestCounter}`,
        runtime: {
          profileId: this.#profile.profileId,
          releaseId: this.#profile.releaseId,
          profileReleaseId: this.#profile.profileReleaseId,
          technicalLabel: this.#profile.technicalLabel,
        },
        operationId: operation.value,
        pattern: pattern.value,
        options: this.#currentOptions(),
        input: this.#inputText(),
      }),
    );
  }

  #renderExecutionState(
    phase: 'idle' | 'debouncing' | 'running' | 'settled',
    result: LabExecutionResult | null,
  ): void {
    const workspace = this.querySelector<HTMLElement>('[data-lab-workspace]');
    const runState = this.querySelector<HTMLElement>('[data-lab-run-state]');
    const live = this.querySelector<HTMLElement>('[data-lab-live]');
    if (workspace) {
      workspace.setAttribute('aria-busy', String(phase === 'running'));
    }
    if (phase !== 'settled' || !result) {
      this.#clearRenderedResult();
      const label =
        phase === 'running'
          ? 'Running'
          : phase === 'debouncing'
            ? 'Waiting for input'
            : 'Waiting';
      if (runState) runState.textContent = label;
      if (live) live.textContent = label;
      return;
    }
    const label = resultStatusLabel(result);
    if (runState) {
      runState.textContent = `${label} · ${result.timing.durationMs.toFixed(1)} ms`;
    }
    if (live) live.textContent = label;
    this.#renderResult(result);
  }

  #clearRenderedResult(): void {
    const empty = this.querySelector<HTMLElement>('[data-lab-matches-empty]');
    const matches = this.querySelector<HTMLOListElement>('[data-lab-matches]');
    const objectEmpty = this.querySelector<HTMLElement>(
      '[data-lab-object-empty]',
    );
    const tree = this.querySelector<HTMLElement>('[data-lab-object-tree]');
    const raw = this.querySelector<HTMLElement>('[data-lab-raw]');
    if (empty) {
      empty.hidden = false;
      empty.textContent = this.#profile
        ? 'Waiting for the current execution.'
        : 'Select a certified profile to run this pattern.';
    }
    if (matches) {
      matches.hidden = true;
      matches.replaceChildren();
    }
    if (objectEmpty) objectEmpty.hidden = false;
    if (tree) {
      tree.hidden = true;
      tree.replaceChildren();
    }
    if (raw) raw.hidden = true;
    this.#decorateEditor(null);
  }

  #renderResult(result: LabExecutionResult): void {
    this.#pinnedRef = null;
    this.#hoveredRef = null;
    const empty = this.querySelector<HTMLElement>('[data-lab-matches-empty]');
    const matches = this.querySelector<HTMLOListElement>('[data-lab-matches]');
    const objectEmpty = this.querySelector<HTMLElement>(
      '[data-lab-object-empty]',
    );
    const tree = this.querySelector<HTMLElement>('[data-lab-object-tree]');
    const raw = this.querySelector<HTMLElement>('[data-lab-raw]');
    const rawCode = this.querySelector<HTMLElement>('[data-lab-raw-code]');
    if (!empty || !matches || !objectEmpty || !tree || !raw || !rawCode) return;
    matches.replaceChildren();
    if (result.status === 'matched') {
      empty.hidden = true;
      matches.hidden = false;
      for (const match of result.matches) {
        matches.append(this.#matchItem(match));
      }
    } else {
      matches.hidden = true;
      empty.hidden = false;
      empty.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = resultStatusLabel(result);
      empty.append(strong);
      if ('error' in result) {
        empty.append(document.createElement('br'), result.error.message);
      }
    }
    objectEmpty.hidden = true;
    tree.hidden = false;
    tree.replaceChildren(objectTreeNode('result', result));
    raw.hidden = false;
    rawCode.textContent = JSON.stringify(result, null, 2);
    this.#decorateEditor(result.status === 'matched' ? result.matches : null);
    this.#applyInspection();
  }

  #matchItem(match: LabMatch): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'lab-match-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lab-match-summary';
    button.dataset.inspectionRef = match.matchId;
    button.dataset.inspectionRefs = match.matchId;
    button.setAttribute('aria-pressed', 'false');
    const ordinal = document.createElement('span');
    ordinal.className = 'lab-match-ordinal';
    ordinal.textContent = `Match ${match.ordinal}`;
    const value = document.createElement('code');
    value.textContent = displayValue(match.value);
    const span = document.createElement('span');
    span.className = 'lab-match-span';
    span.textContent = `${match.span.start}–${match.span.end} · ${match.span.unit}`;
    button.append(ordinal, value, span);
    item.append(button);
    if (match.captures.length > 0) {
      const captures = document.createElement('ul');
      captures.className = 'lab-capture-list';
      for (const capture of match.captures) {
        captures.append(this.#captureItem(capture));
      }
      item.append(captures);
    }
    return item;
  }

  #captureItem(capture: LabCapture): HTMLLIElement {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lab-capture-summary';
    button.dataset.inspectionRef = capture.captureId;
    button.dataset.inspectionRefs = capture.captureId;
    button.setAttribute('aria-pressed', 'false');
    const identity = document.createElement('span');
    identity.textContent = capture.name
      ? `${capture.index} · ${capture.name}`
      : String(capture.index);
    const participation = document.createElement('span');
    participation.className = `capture-participation capture-participation--${capture.participation}`;
    participation.textContent = capture.participation.replaceAll('-', ' ');
    button.append(identity, participation);
    if (capture.value !== undefined) {
      const value = document.createElement('code');
      value.textContent = displayValue(capture.value);
      button.append(value);
    }
    if (capture.span) {
      const span = document.createElement('span');
      span.className = 'lab-match-span';
      span.textContent = `${capture.span.start}–${capture.span.end}`;
      button.append(span);
    }
    item.append(button);
    return item;
  }

  #decorateEditor(matches: readonly LabMatch[] | null): void {
    const editor = this.#editor;
    if (!editor) return;
    const offsets =
      document.activeElement === editor ? selectionOffsets(editor) : null;
    const text = this.#inputText();
    editor.replaceChildren();
    if (!matches || matches.length === 0) {
      editor.append(document.createTextNode(text));
      restoreSelection(editor, offsets);
      return;
    }
    const ranges: InspectionRange[] = [];
    for (const match of matches) {
      ranges.push({
        ref: match.matchId,
        kind: 'match',
        start: match.span.start,
        end: match.span.end,
      });
      for (const capture of match.captures) {
        if (capture.participation === 'participated' && capture.span) {
          ranges.push({
            ref: capture.captureId,
            kind: 'capture',
            start: capture.span.start,
            end: capture.span.end,
          });
        }
      }
    }
    const boundaries = new Set([0, text.length]);
    for (const range of ranges) {
      boundaries.add(Math.max(0, Math.min(text.length, range.start)));
      boundaries.add(Math.max(0, Math.min(text.length, range.end)));
    }
    const ordered = [...boundaries].sort((left, right) => left - right);
    const markers = ranges.filter((range) => range.start === range.end);
    for (let index = 0; index < ordered.length; index += 1) {
      const start = ordered[index];
      if (start === undefined) continue;
      for (const marker of markers.filter((range) => range.start === start)) {
        const element = document.createElement('span');
        element.className = 'lab-zero-marker';
        element.dataset.inspectionRef = marker.ref;
        element.dataset.inspectionRefs = marker.ref;
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', `Zero-width match at ${start}`);
        editor.append(element);
      }
      const end = ordered[index + 1];
      if (end === undefined || end <= start) continue;
      const segment = text.slice(start, end);
      const active = ranges.filter(
        (range) =>
          range.start !== range.end && range.start <= start && range.end >= end,
      );
      if (active.length === 0) {
        editor.append(document.createTextNode(segment));
        continue;
      }
      const primary = active.at(-1);
      const element = document.createElement('span');
      element.className = `lab-decoration lab-decoration--${primary?.kind ?? 'match'}`;
      element.dataset.inspectionRef = primary?.ref;
      element.dataset.inspectionRefs = active
        .map((range) => range.ref)
        .join(' ');
      element.textContent = segment;
      editor.append(element);
    }
    restoreSelection(editor, offsets);
  }

  #setHovered(reference: string | null): void {
    this.#hoveredRef = reference;
    this.#applyInspection();
  }

  #applyInspection(): void {
    const active = this.#pinnedRef ?? this.#hoveredRef;
    for (const element of this.querySelectorAll<HTMLElement>(
      '[data-inspection-refs]',
    )) {
      const references = element.dataset.inspectionRefs?.split(' ') ?? [];
      const matches = active ? references.includes(active) : false;
      element.classList.toggle('is-inspected', matches);
      if (element instanceof HTMLButtonElement) {
        element.setAttribute(
          'aria-pressed',
          String(
            this.#pinnedRef !== null && references.includes(this.#pinnedRef),
          ),
        );
      }
    }
  }

  #clearInspection(): void {
    this.#pinnedRef = null;
    this.#hoveredRef = null;
    this.#applyInspection();
  }

  #focusSelectedDecoration(): void {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const target =
      node instanceof Element ? node : (node?.parentElement ?? null);
    const decorated = target?.closest<HTMLElement>('[data-inspection-ref]');
    const reference = decorated?.dataset.inspectionRef;
    if (!reference) return;
    this.#pinnedRef = reference;
    this.#applyInspection();
    const resultTarget = [
      ...this.querySelectorAll<HTMLElement>(
        '.lab-results [data-inspection-ref]',
      ),
    ].find((element) => element.dataset.inspectionRef === reference);
    resultTarget?.focus();
  }

  #pastePlainText(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text/plain');
    const selection = window.getSelection();
    if (text === undefined || !selection?.rangeCount) return;
    event.preventDefault();
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    this.#editor?.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  #activateTab(tab: HTMLButtonElement): void {
    const target = tab.dataset.labTab;
    for (const candidate of this.querySelectorAll<HTMLButtonElement>(
      '[data-lab-tab]',
    )) {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    }
    for (const panel of this.querySelectorAll<HTMLElement>(
      '[data-lab-panel]',
    )) {
      panel.hidden = panel.dataset.labPanel !== target;
    }
  }

  #handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.#clearInspection();
      return;
    }
    const tab = (event.target as Element).closest<HTMLButtonElement>(
      '[data-lab-tab]',
    );
    if (
      !tab ||
      !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
    ) {
      return;
    }
    const tabs = [
      ...this.querySelectorAll<HTMLButtonElement>('[data-lab-tab]'),
    ];
    const index = tabs.indexOf(tab);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') {
      next = (index - 1 + tabs.length) % tabs.length;
    }
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    const nextTab = tabs[next];
    if (!nextTab) return;
    event.preventDefault();
    this.#activateTab(nextTab);
    nextTab.focus();
  }
}

if (!customElements.get('regex-lab')) {
  customElements.define('regex-lab', RegexLabElement);
}
