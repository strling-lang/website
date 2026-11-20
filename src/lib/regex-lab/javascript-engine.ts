import type { LabMatch, LabSpan } from './contracts.ts';
import {
  checkOutput,
  limits,
  OutputLimitError,
  runtimeFailure,
  type EngineResult,
  type RunOptions,
} from './interactive.ts';

const span = ([start, end]: [number, number]): LabSpan => ({
  start,
  end,
  unit: 'utf16-code-units',
});

function normalize(
  match: RegExpExecArray,
  ordinal: number,
  staticNames: ReadonlyMap<number, string>,
): LabMatch {
  const indices = match.indices!;
  if (indices.length - 1 > limits.captures) throw new OutputLimitError();
  const matchId = 'match-' + ordinal;
  const names = new Map(
    Object.entries(indices.groups ?? {})
      .filter(([, range]) => range)
      .map(([name, range]) => [range, name]),
  );
  return {
    matchId,
    ordinal,
    span: span(indices[0]!),
    value: match[0],
    captures: Array.from({ length: indices.length - 1 }, (_, offset) => {
      const index = offset + 1;
      const range = indices[index];
      return {
        captureId: matchId + '-' + index,
        index,
        name: (range ? names.get(range) : undefined) ?? staticNames.get(index),
        participation: range ? 'participated' : 'unmatched',
        span: range ? span(range) : undefined,
        value: match[index],
      };
    }),
    engineNativeMetadata: {
      namedGroups: Object.fromEntries(
        Object.entries(indices.groups ?? {}).map(([name, range]) => [
          name,
          range ? span(range) : null,
        ]),
      ),
    },
  };
}

function captureNames(source: string, flags: string) {
  const names = new Map<number, string>();
  try {
    const tree = new RegExpParser({ ecmaVersion: 2025 }).parsePattern(
      source,
      0,
      source.length,
      {
        unicode: flags.includes('u'),
        unicodeSets: flags.includes('v'),
      },
    );
    let index = 0;
    visitRegExpAST(tree, {
      onCapturingGroupEnter(group) {
        index++;
        if (group.name) names.set(index, group.name);
      },
    });
  } catch {
    // A newer browser can support syntax outside the independent parser's grammar.
  }
  return names;
}

function nextIndex(text: string, index: number, unicode: boolean) {
  return index + (unicode && (text.codePointAt(index) ?? 0) > 0xffff ? 2 : 1);
}

function collect(regex: RegExp, input: string, all: boolean) {
  const matches: LabMatch[] = [];
  let total = 0;
  let names: ReadonlyMap<number, string> | undefined;
  for (let match = regex.exec(input); match; match = regex.exec(input)) {
    if (matches.length === limits.matches) throw new OutputLimitError();
    if (!names && match.indices?.groups)
      names = captureNames(regex.source, regex.flags);
    const result = normalize(match, matches.length + 1, names ?? new Map());
    total += JSON.stringify(result).length;
    if (total > limits.output) throw new OutputLimitError();
    matches.push(result);
    if (!all) break;
    if (!match[0])
      regex.lastIndex = nextIndex(
        input,
        regex.lastIndex,
        regex.unicode || regex.unicodeSets,
      );
  }
  return matches;
}

function replace(regex: RegExp, input: string, options: RunOptions): string {
  const { operation, replacement, replacementSyntax } = options;
  let count = 0;
  let upperBound = input.length;
  const slots =
    replacementSyntax === 'native'
      ? Array.from(
          replacement.matchAll(/\$(?:\$|&|[\x60']|[0-9]{1,2}|<[^>]*>)/g),
        ).filter(([value]) => value !== '$$').length
      : 0;
  for (let match = regex.exec(input); match; match = regex.exec(input)) {
    upperBound += replacement.length + slots * input.length;
    if (++count > limits.matches || upperBound > limits.output)
      throw new OutputLimitError();
    if (operation === 'replace') break;
    if (!match[0])
      regex.lastIndex = nextIndex(
        input,
        regex.lastIndex,
        regex.unicode || regex.unicodeSets,
      );
  }
  regex.lastIndex = 0;
  return input.replace(
    regex,
    replacementSyntax === 'literal'
      ? replacement.replaceAll('$', () => '$$')
      : replacement,
  );
}

export function runJavaScript(
  pattern: string,
  input: string,
  options: RunOptions,
): EngineResult {
  const started = performance.now();
  const { operation } = options;
  let regex: RegExp;
  try {
    // Validate the submitted pattern before adding operation-specific constraints.
    const source = new RegExp(pattern, options.flags);
    const flags = source.flags.replace(/[dg]/g, '');
    regex =
      operation === 'fullmatch'
        ? new RegExp(
            '(?:' + source.source + ')(?![\\s\\S])',
            flags.replace('y', '') + 'dy',
          )
        : new RegExp(
            source.source,
            flags +
              'd' +
              (operation === 'scan' || operation === 'replace-all' ? 'g' : ''),
          );
  } catch (error) {
    return {
      status: 'compile-rejection',
      error: {
        message:
          error instanceof Error ? error.message : 'Invalid JavaScript RegExp.',
      },
      compileMs: performance.now() - started,
    };
  }
  const compiled = performance.now();
  let result: EngineResult;
  try {
    switch (operation) {
      case 'search':
        result = { status: 'completed', output: regex.test(input) };
        break;
      case 'split': {
        const parts = input.split(regex, limits.matches + 2);
        if (parts.length > limits.matches + 1) throw new OutputLimitError();
        result = {
          status: 'completed',
          output: Array.from(parts, (part) => part ?? null),
        };
        break;
      }
      case 'replace':
      case 'replace-all':
        result = {
          status: 'completed',
          output: replace(regex, input, options),
        };
        break;
      default: {
        const matches = collect(regex, input, operation === 'scan');
        result = matches.length
          ? { status: 'matched', matches }
          : { status: 'no-match', matches: [] };
      }
    }
    checkOutput(result);
  } catch (error) {
    result = runtimeFailure(error);
  }
  return {
    ...result,
    compileMs: compiled - started,
    executionMs: performance.now() - compiled,
  };
}
import { RegExpParser, visitRegExpAST } from '@eslint-community/regexpp';
