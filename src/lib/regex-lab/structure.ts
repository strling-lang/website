import { RegExpParser, type AST } from '@eslint-community/regexpp';
import type { JsonObject, JsonValue } from '@strling-lang/strling';
import { jsonObject } from './compiler.ts';
import type { Runtime } from './interactive.ts';
import type { TextRange } from './offsets.ts';

export interface StructureNode {
  label: string;
  captureName?: string;
  text?: string;
  range?: TextRange & { unit: string };
  children: StructureNode[];
}

type Node = Exclude<AST.Node, AST.RegExpLiteral | AST.Flags>;

function children(node: Node): Node[] {
  switch (node.type) {
    case 'Pattern':
    case 'Group':
    case 'CapturingGroup':
      return node.alternatives;
    case 'Assertion':
      return 'alternatives' in node ? node.alternatives : [];
    case 'Alternative':
    case 'CharacterClass':
    case 'StringAlternative':
      return node.elements;
    case 'Quantifier':
      return [node.element];
    case 'CharacterClassRange':
      return [node.min, node.max];
    case 'ClassIntersection':
    case 'ClassSubtraction':
      return [node.left, node.right];
    case 'ExpressionCharacterClass':
      return [node.expression];
    case 'ClassStringDisjunction':
      return node.alternatives;
    default:
      return [];
  }
}

function describe(node: Node): string {
  switch (node.type) {
    case 'CapturingGroup':
      return node.name ? 'Named capture ' + node.name : 'Numbered capture';
    case 'Group':
      return node.modifiers
        ? 'Noncapturing group with scoped flags'
        : 'Noncapturing group';
    case 'Quantifier':
      return (
        (node.greedy ? 'Greedy' : 'Lazy') +
        ' repetition from ' +
        node.min +
        ' to ' +
        (node.max === Infinity ? 'unbounded' : node.max)
      );
    case 'Assertion':
      return (
        ('negate' in node && node.negate ? 'Negative ' : '') +
        {
          start: 'start anchor',
          end: 'end anchor',
          word: 'word boundary',
          lookahead: 'lookahead assertion',
          lookbehind: 'lookbehind assertion',
        }[node.kind]
      );
    case 'Character':
      return (
        'Character U+' + node.value.toString(16).toUpperCase().padStart(4, '0')
      );
    case 'CharacterSet':
      return (
        (node.kind === 'property' && node.strings
          ? 'Unicode string property '
          : 'Character set ') +
        node.kind +
        ('key' in node
          ? ' ' + node.key + (node.value ? '=' + node.value : '')
          : '') +
        ('negate' in node && node.negate ? ' (negated)' : '')
      );
    case 'CharacterClass':
    case 'ExpressionCharacterClass':
      return node.negate ? 'Negated character class' : 'Character class';
    case 'Backreference':
      return 'Backreference to ' + node.ref;
    case 'Alternative':
      return node.elements.length ? 'Alternative' : 'Empty alternative';
    case 'Pattern':
      return 'ECMAScript pattern';
    case 'CharacterClassRange':
      return 'Character range';
    case 'ClassIntersection':
      return 'Set intersection';
    case 'ClassSubtraction':
      return 'Set subtraction';
    case 'ClassStringDisjunction':
      return 'Set of string alternatives';
    case 'StringAlternative':
      return 'String alternative';
    default:
      return node.type;
  }
}

export function explainRegex(
  pattern: string,
  flags: string,
  runtime: Runtime,
): StructureNode {
  if (runtime !== 'javascript')
    throw new Error(
      'The lab has a structural parser for ECMAScript syntax. Use the selected engine for syntax validation.',
    );
  const parser = new RegExpParser({ ecmaVersion: 2025 });
  parser.parseFlags(flags);
  const ast = parser.parsePattern(pattern, 0, pattern.length, {
    unicode: flags.includes('u'),
    unicodeSets: flags.includes('v'),
  });
  let count = 0;
  function project(node: Node, depth: number): StructureNode {
    if (++count > 2_048 || depth > 100)
      throw new Error('The structure exceeds the display limit.');
    return {
      label: describe(node),
      text: node.raw,
      range: { start: node.start, end: node.end, unit: 'utf16-code-units' },
      children: children(node).map((child) => project(child, depth + 1)),
    };
  }
  return project(ast, 0);
}

export const javascriptFlagDescriptions: Record<string, string> = {
  d: 'Return UTF-16 match indices.',
  g: 'Global mode. Scan and replace all select it explicitly.',
  i: 'Ignore case.',
  m: 'Apply start and end anchors to lines.',
  s: 'Allow dot to match line terminators.',
  u: 'Unicode-aware syntax and code point iteration.',
  v: 'Unicode sets, string properties and set operations.',
  y: 'Match only at the current starting position.',
};

export function sourceSpan(
  value: JsonValue | undefined,
): StructureNode['range'] {
  const span = jsonObject(value);
  if (
    typeof span?.start !== 'number' ||
    typeof span.end !== 'number' ||
    typeof span.coordinate_system !== 'string'
  )
    return;
  return { start: span.start, end: span.end, unit: span.coordinate_system };
}

export function semanticTree(
  program: JsonObject,
  artifact?: JsonObject,
): StructureNode | undefined {
  const locations = new Map<string, NonNullable<StructureNode['range']>>();
  for (const entry of Array.isArray(artifact?.source_map)
    ? artifact.source_map
    : []) {
    const mapping = jsonObject(entry);
    const sources = mapping?.source_spans;
    const location = sourceSpan(
      Array.isArray(sources) ? sources[0] : undefined,
    );
    if (!location) continue;
    for (const id of Array.isArray(mapping?.node_ids) ? mapping.node_ids : []) {
      if (typeof id === 'string') locations.set(id, location);
    }
  }
  const node = jsonObject(program.root);
  if (!node) return;
  function project(item: JsonObject): StructureNode {
    const values = Object.values(item).flatMap((value) =>
      Array.isArray(value) ? [...value] : [value],
    );
    const nodeId = typeof item.node_id === 'string' ? item.node_id : '';
    const properties = Object.entries(item)
      .filter(
        ([key, value]) =>
          key !== 'node_id' &&
          key !== 'kind' &&
          (value === null || typeof value !== 'object'),
      )
      .map(([key, value]) => key + ' ' + JSON.stringify(value));
    const origins = jsonObject(item.origin)?.source_spans;
    return {
      label: String(item.kind ?? 'Semantic node'),
      captureName:
        item.kind === 'capture' && typeof item.name === 'string'
          ? item.name
          : undefined,
      text: properties.join(' · ') || nodeId,
      range:
        sourceSpan(Array.isArray(origins) ? origins[0] : undefined) ??
        locations.get(nodeId),
      children: values
        .map(jsonObject)
        .filter((value): value is JsonObject =>
          Boolean(value && typeof value.kind === 'string'),
        )
        .map(project),
    };
  }
  return project(node);
}
