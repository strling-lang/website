import { autocompletion, completeFromList } from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import {
  bracketMatching,
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language';
import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import {
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  hoverTooltip,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';
import { basicSetup, minimalSetup } from 'codemirror';
import { tags } from '@lezer/highlight';
import language from '../lib/regex-lab/semantic-language.json';
import type { TextRange } from '../lib/regex-lab/offsets';
import type { Authoring } from '../lib/regex-lab/session';

const keywords = new Set(language.keyword_terminals);
const sourceColors = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [tags.keyword, tags.operator, tags.escape], color: '#d7c4ff' },
    { tag: [tags.string, tags.number], color: '#a9decc' },
    { tag: tags.comment, color: '#aeb8c5', fontStyle: 'italic' },
  ]),
);
const semantic = StreamLanguage.define({
  name: 'Semantic STRling',
  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['{', '"'] },
  },
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^#.*/)) return 'comment';
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
    const word = stream.match(/^[a-z][a-z0-9_]*/);
    if (Array.isArray(word))
      return keywords.has(word[0]) ? 'keyword' : 'variableName';
    if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';
    stream.next();
    return 'punctuation';
  },
});

const regex = StreamLanguage.define({
  name: 'Regular expression',
  languageData: { closeBrackets: { brackets: ['(', '[', '{'] } },
  token(stream) {
    if (stream.match(/^\\(?:[pPkguUx]\{[^}]*\}|k<[^>]*>|.)/)) return 'escape';
    if (stream.match(/^\{\d+,?\d*\}|^[?+*]/)) return 'operator';
    if (stream.match(/^[()[\]{}|^.$]/)) return 'keyword';
    stream.next();
    return null;
  },
});

export interface Mark {
  start: number;
  end: number;
  id: string;
  kind: 'match' | 'capture' | 'selected' | 'source-navigation';
}

class ZeroMarker extends WidgetType {
  constructor(private readonly mark: Mark) {
    super();
  }
  eq(other: ZeroMarker) {
    return other.mark.id === this.mark.id && other.mark.kind === this.mark.kind;
  }
  toDOM() {
    const marker = document.createElement('span');
    marker.className = 'lab-mark lab-mark--zero lab-mark--' + this.mark.kind;
    marker.dataset.mark = this.mark.id;
    marker.title = 'Zero-width range';
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }
  ignoreEvent() {
    return false;
  }
}

function decorations(marks: Mark[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const ranges = marks
    .map((mark) => ({
      ...mark,
      value:
        mark.start === mark.end
          ? Decoration.widget({ widget: new ZeroMarker(mark), side: 1 })
          : Decoration.mark({
              class: 'lab-mark lab-mark--' + mark.kind,
              attributes: { 'data-mark': mark.id },
            }),
    }))
    .sort((a, b) => a.start - b.start || a.value.startSide - b.value.startSide);
  for (const { start, end, value } of ranges) builder.add(start, end, value);
  return builder.finish();
}

const setSourceHighlight = StateEffect.define<DecorationSet>();
const sourceHighlight = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    if (transaction.docChanged) return Decoration.none;
    for (const effect of transaction.effects)
      if (effect.is(setSourceHighlight)) return effect.value;
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function sourceExtensions(format: Authoring) {
  if (format === 'simply') return json();
  if (format === 'semantic') {
    return [
      semantic,
      autocompletion({
        override: [
          completeFromList(
            [...keywords].map((label) => ({ label, type: 'keyword' })),
          ),
        ],
      }),
    ];
  }
  return regex;
}

export class LabEditor {
  readonly view: EditorView;
  #language = new Compartment();
  #marks = new Compartment();
  #external = false;
  #extensions: Extension[];

  constructor(
    parent: HTMLElement,
    label: string,
    initial: string,
    options: {
      format?: Authoring;
      limit: number;
      onChange: (text: string) => void;
      onLimit: () => void;
      onSelection?: (position: number) => void;
      onHover?: (position: number) => string | undefined;
    },
  ) {
    const { format, limit, onChange, onLimit, onSelection, onHover } = options;
    this.#extensions = [
      format
        ? [basicSetup, sourceHighlight]
        : [minimalSetup, bracketMatching()],
      sourceColors,
      EditorView.theme({}, { dark: true }),
      EditorView.lineWrapping,
      EditorState.lineSeparator.of('\n'),
      EditorView.contentAttributes.of({
        'aria-label': label,
        spellcheck: 'false',
        autocapitalize: 'off',
      }),
      onHover
        ? hoverTooltip((_view, pos) => {
            const description = onHover(pos);
            if (!description) return null;
            return {
              pos,
              above: true,
              create() {
                const dom = document.createElement('div');
                dom.className = 'workbench-editor-hint';
                dom.textContent = description;
                return { dom };
              },
            };
          })
        : [],
      EditorState.changeFilter.of((transaction) => {
        if (!transaction.docChanged || transaction.newDoc.length <= limit)
          return true;
        queueMicrotask(onLimit);
        return false;
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !this.#external)
          onChange(update.state.doc.toString());
        if (update.selectionSet && update.view.hasFocus && !this.#external)
          onSelection?.(update.state.selection.main.head);
      }),
    ];
    this.view = new EditorView({
      parent,
      state: this.#newState(initial, format),
    });
  }

  #newState(doc: string, format?: Authoring) {
    return EditorState.create({
      doc,
      extensions: [
        this.#extensions,
        this.#language.of(format ? sourceExtensions(format) : []),
        this.#marks.of(EditorView.decorations.of(Decoration.none)),
      ],
    });
  }

  reset(text: string, format?: Authoring) {
    this.view.setState(this.#newState(text, format));
  }

  replace(text: string) {
    const { state } = this.view;
    this.#external = true;
    try {
      this.view.dispatch({
        changes:
          state.doc.toString() === text
            ? undefined
            : { from: 0, to: state.doc.length, insert: text },
      });
    } finally {
      this.#external = false;
    }
  }

  report(diagnostics: Diagnostic[]) {
    this.view.dispatch(setDiagnostics(this.view.state, diagnostics));
  }

  mark(marks: Mark[]) {
    this.view.dispatch({
      effects: this.#marks.reconfigure(
        EditorView.decorations.of(decorations(marks)),
      ),
    });
  }

  highlightSource(range?: TextRange) {
    const { state } = this.view;
    const current = state.field(sourceHighlight, false);
    if (!current) return;
    const boundary = (offset: number) =>
      Number.isInteger(offset) &&
      offset >= 0 &&
      offset <= state.doc.length &&
      !/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(
        state.sliceDoc(
          Math.max(0, offset - 1),
          Math.min(state.doc.length, offset + 1),
        ),
      );

    if (
      !range ||
      range.start > range.end ||
      !boundary(range.start) ||
      !boundary(range.end)
    ) {
      if (current !== Decoration.none)
        this.view.dispatch({ effects: setSourceHighlight.of(Decoration.none) });
      return;
    }
    this.view.dispatch({
      effects: [
        setSourceHighlight.of(
          decorations([
            { ...range, id: 'source-navigation', kind: 'source-navigation' },
          ]),
        ),
        EditorView.scrollIntoView(range.start),
      ],
    });
  }

  select(start: number, end = start, focus = true) {
    this.#external = true;
    try {
      this.view.dispatch({
        selection: { anchor: start, head: end },
        scrollIntoView: true,
      });
      if (focus) this.view.focus();
    } finally {
      this.#external = false;
    }
  }

  destroy() {
    this.view.destroy();
  }
}
