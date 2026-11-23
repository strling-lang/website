import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from '@codemirror/search';
import {
  runScopeHandlers,
  type Command,
  type EditorView,
  type Panel,
} from '@codemirror/view';
import { button, node } from './labRendering';

function textField(name: string, label: string) {
  // A one-row textarea can retain a multiline selection seeded by CodeMirror.
  const field = node('textarea');
  field.name = name;
  field.rows = 1;
  field.wrap = 'off';
  field.spellcheck = false;
  field.autocomplete = 'off';
  field.autocapitalize = 'off';
  field.placeholder = label;
  field.setAttribute('aria-label', label);
  return field;
}

function option(label: string) {
  const checkbox = node('input');
  checkbox.type = 'checkbox';
  const wrapper = node('label');
  wrapper.className = 'workbench-check';
  wrapper.append(checkbox, label);
  return { checkbox, wrapper };
}

function fieldRow(field: HTMLTextAreaElement, ...buttons: HTMLButtonElement[]) {
  const controls = node('div');
  controls.className = 'lab-find-actions';
  controls.append(...buttons);
  const row = node('div');
  row.className = 'lab-find-row';
  row.append(field, controls);
  return row;
}

export function createLabSearchPanel(view: EditorView): Panel {
  const dom = node('div');
  dom.className = 'lab-find-panel';
  dom.setAttribute('role', 'group');
  dom.setAttribute('aria-label', 'Find and replace');

  const find = textField('search', 'Find');
  find.setAttribute('main-field', 'true');
  const replacement = textField('replace', 'Replace with');
  const matchCase = option('Match Case');
  const wholeWord = option('Whole Word');
  const action = (label: string, run: Command) =>
    button(label, () => run(view));

  const previous = action('Previous', findPrevious);
  const next = action('Next', findNext);
  const all = action('Find All', selectMatches);
  const close = button('Close', () => {
    closeSearchPanel(view);
    view.focus();
  });
  const replace = action('Replace', replaceNext);
  const replaceEveryMatch = action('Replace All', replaceAll);
  const options = node('div');
  options.className = 'lab-find-options';
  options.append(matchCase.wrapper, wholeWord.wrapper);
  dom.append(fieldRow(find, previous, next, all, close), options);
  if (!view.state.readOnly)
    dom.append(fieldRow(replacement, replace, replaceEveryMatch));

  function sync(query: SearchQuery) {
    if (find.value !== query.search) find.value = query.search;
    if (replacement.value !== query.replace) replacement.value = query.replace;
    matchCase.checkbox.checked = query.caseSensitive;
    wholeWord.checkbox.checked = query.wholeWord;
    for (const control of [previous, next, all, replace, replaceEveryMatch])
      control.disabled = !query.valid;
  }

  dom.addEventListener('input', () => {
    const query = new SearchQuery({
      search: find.value,
      replace: replacement.value,
      caseSensitive: matchCase.checkbox.checked,
      wholeWord: wholeWord.checkbox.checked,
      literal: true,
    });
    if (!query.eq(getSearchQuery(view.state)))
      view.dispatch({ effects: setSearchQuery.of(query) });
  });
  dom.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (runScopeHandlers(view, event, 'search-panel')) {
      event.preventDefault();
    } else if (
      event.key === 'Enter' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      if (event.target === find) {
        event.preventDefault();
        (event.shiftKey ? findPrevious : findNext)(view);
      } else if (event.target === replacement) {
        event.preventDefault();
        replaceNext(view);
      }
    }
  });

  sync(getSearchQuery(view.state));
  return {
    dom,
    mount() {
      find.focus();
      find.select();
    },
    update({ state, startState }) {
      const query = getSearchQuery(state);
      if (query !== getSearchQuery(startState)) sync(query);
    },
  };
}
