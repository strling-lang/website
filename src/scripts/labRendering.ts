import type { LabExecutionResult, LabSpan } from '../lib/regex-lab/contracts';
import {
  coordinateMap,
  editorRange,
  type TextRange,
} from '../lib/regex-lab/offsets';
import type { StructureNode } from '../lib/regex-lab/structure';
import type { Mark } from './labEditor';

export function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

export function button(label: string, action: () => void) {
  const element = node('button', label);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

export function raw(value: unknown) {
  const pre = node('pre', JSON.stringify(value, null, 2));
  pre.tabIndex = 0;
  return pre;
}

export function details(label: string, ...contents: Node[]) {
  const element = node('details');
  const body = node('div');
  body.className = 'workbench-disclosure-body';
  body.append(...contents);
  element.append(node('summary', label), body);
  return element;
}

export function objectTree(value: unknown) {
  const group = (key: string, value: unknown, depth: number): HTMLElement => {
    if (!value || typeof value !== 'object' || depth >= 10)
      return node(
        'div',
        key +
          ' · ' +
          (typeof value === 'object' && value
            ? 'See raw JSON'
            : JSON.stringify(value)),
      );
    const entries = Object.entries(value);
    const list = node('div');
    list.className = 'workbench-tree';
    const branch = details(key + ' · ' + entries.length + ' entries', list);
    let expanded = false;
    branch.addEventListener('toggle', () => {
      if (!branch.open || expanded) return;
      expanded = true;
      for (const [key, child] of entries.slice(0, 128))
        list.append(group(key, child, depth + 1));
      if (entries.length > 128)
        list.append(node('p', 'Additional entries are available in raw JSON.'));
    });
    return branch;
  };
  const root = group('Result object', value, 0);
  if (root instanceof HTMLDetailsElement) root.open = true;
  return root;
}

export function renderStructure(
  root: StructureNode,
  navigate: (range: NonNullable<StructureNode['range']>) => void,
) {
  function branch(item: StructureNode, depth: number): HTMLElement {
    const { range } = item;
    const itemLabel = range
      ? button(item.label, () => navigate(range))
      : node('span', item.label);
    if (item.text) itemLabel.title = item.text;
    const row = node('li');
    const content = node('div');
    content.className = 'workbench-structure-row';
    content.append(itemLabel);
    if (item.text && item.text.length <= 90) {
      content.append(node('code', item.text));
    }
    row.append(content);
    if (item.children.length) row.append(level(item.children, depth + 1));
    return row;
  }
  function level(items: StructureNode[], depth: number) {
    const list = node('ul');
    list.className = 'workbench-structure-tree';
    list.setAttribute('role', 'list');
    if (depth > 0 && depth <= 5)
      list.classList.add('workbench-structure-indent');
    list.append(...items.map((item) => branch(item, depth)));
    return list;
  }
  return level([root], 0);
}

export function resultSummary(result: LabExecutionResult): string {
  if ('error' in result) {
    const location =
      result.error.offset === undefined
        ? ''
        : ' · offset ' +
          result.error.offset +
          ' ' +
          (result.error.offsetUnit ?? '');
    return (
      result.status.replaceAll('-', ' ') +
      location +
      ' · ' +
      result.error.message
    );
  }
  if ('matches' in result)
    return result.matches.length
      ? result.matches.length +
          (result.matches.length === 1 ? ' match' : ' matches')
      : 'No match';
  if (typeof result.output === 'boolean')
    return result.output ? 'Matched' : 'No match';
  if (Array.isArray(result.output))
    return result.output.length + ' split fields';
  return 'Replacement completed';
}

export function renderMatches(
  result: LabExecutionResult,
  subject: string,
  activate: (id: string, focus: boolean) => void,
  highlight: (id?: string) => void,
  captureSource?: (name: string) => (() => void) | undefined,
) {
  const cards = node('ol');
  cards.className = 'workbench-results';
  const marks: Mark[] = [];
  const positions = new Map<string, TextRange>();
  const resultButtons = new Map<string, HTMLButtonElement>();
  if (!('matches' in result) || result.matches.length === 0) {
    const summary = node('p', resultSummary(result));
    const content = node('div');
    content.append(summary);
    if ('output' in result && typeof result.output !== 'boolean') {
      const output =
        typeof result.output === 'string'
          ? node('pre', result.output)
          : raw(result.output);
      output.tabIndex = 0;
      content.append(output);
    }
    return { content, marks, positions, resultButtons };
  }

  const map =
    result.observation?.indexUnit === 'utf16-code-units'
      ? undefined
      : coordinateMap(subject, result.observation?.indexUnit ?? '');
  const rangeButton = (
    id: string,
    description: string,
    span: LabSpan | undefined,
    kind: 'match' | 'capture',
  ) => {
    const range = span && editorRange(span, subject.length, map);
    const native = span
      ? ' · [' + span.start + ', ' + span.end + ') ' + span.unit
      : '';
    const converted =
      range && span?.unit !== 'utf16-code-units'
        ? ' · editor [' + range.start + ', ' + range.end + ')'
        : '';
    if (!range) return node('span', description + native);
    marks.push({ ...range, id, kind });
    positions.set(id, range);
    const item = button(description + native + converted, () =>
      activate(id, true),
    );
    item.dataset.rangeId = id;
    item.setAttribute('aria-pressed', 'false');
    item.addEventListener('pointerenter', () => highlight(id));
    item.addEventListener('pointerleave', () => highlight());
    resultButtons.set(id, item);
    return item;
  };
  const excerpt = (text: string | undefined) => {
    if (text === undefined) return '';
    if (text === '') return 'empty / zero-width';
    return JSON.stringify(text.length > 100 ? text.slice(0, 100) + '…' : text);
  };

  for (const match of result.matches) {
    const card = node('li');
    card.append(
      rangeButton(
        match.matchId,
        'Match ' + match.ordinal + ' · ' + excerpt(match.value),
        match.span,
        'match',
      ),
    );
    if (match.captures.length) {
      const list = node('ul');
      for (const capture of match.captures) {
        const description =
          'Group ' +
          capture.index +
          (capture.name ? ' · ' + capture.name : '') +
          ' · ' +
          (capture.participation === 'participated'
            ? excerpt(capture.value)
            : capture.participation);
        const row = node('li');
        row.append(
          rangeButton(capture.captureId, description, capture.span, 'capture'),
        );
        const source = capture.name && captureSource?.(capture.name);
        if (source) row.append(button('Source for ' + capture.name, source));
        list.append(row);
      }
      const captures = details(
        'Captures (' + match.captures.length + ')',
        list,
      );
      captures.open = true;
      card.append(captures);
    }
    cards.append(card);
  }
  return { content: cards, marks, positions, resultButtons };
}

export function selectOptions(
  select: HTMLSelectElement,
  options: [string, string][],
  value?: string,
) {
  const current = value ?? select.value;
  select.replaceChildren(
    ...options.map(([value, label]) => new Option(label, value)),
  );
  if (options.some(([value]) => value === current)) select.value = current;
}

export function download(
  name: string,
  text: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = node('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function shortError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The workbench could not complete that action.';
}
