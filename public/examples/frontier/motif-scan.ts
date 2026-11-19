import { limits, reverseComplement } from './motif-model.ts';
import type { Matcher } from './motif-patterns.ts';
import { recognize, type Node } from './motif-witness.ts';
type Strand = '+' | '-';
type Occurrence = {
  id: string;
  version: string;
  family: string;
  depth: number;
  strand: Strand;
  window: readonly [number, number];
  motif: readonly [number, number];
  witnesses: Node[];
};
// Children stay in model traversal order, including on the minus strand.
function project(
  node: Node,
  input: string,
  offset: number,
  strand: Strand,
): Node {
  const start =
    strand === '+' ? offset + node.start : input.length - offset - node.end;
  const end =
    strand === '+' ? offset + node.end : input.length - offset - node.start;
  const slice = input.slice(start, end);
  if ((strand === '+' ? slice : reverseComplement(slice)) !== node.text)
    throw new Error('Witness slice disagrees with original input');
  let cursor = node.start;
  for (const child of node.children) {
    if (
      child.start !== cursor ||
      child.end > node.end ||
      child.end < child.start
    )
      throw new Error('Witness children must partition their parent');
    cursor = child.end;
  }
  if (node.children.length && cursor !== node.end)
    throw new Error('Incomplete witness');
  return {
    ...node,
    start,
    end,
    children: node.children.map((child) =>
      project(child, input, offset, strand),
    ),
  };
}
export function scan(
  input: string,
  matchers: readonly Matcher[],
  both = false,
) {
  if (input.length > limits.input || /[^ACGT]/.test(input))
    throw new Error('Expected at most 256 uppercase A/C/G/T bases');
  const found = new Map<string, Occurrence>();
  for (const strand of (both ? ['+', '-'] : ['+']) as Strand[]) {
    const text = strand === '+' ? input : reverseComplement(input);
    for (const m of matchers)
      for (let i = 0; i + m.min <= text.length; i++) {
        if (!text.startsWith(m.model.families[m.family].left, i)) continue;
        for (let j = i + m.min; j <= Math.min(i + m.max, text.length); j++) {
          for (const tree of recognize(text.slice(i, j), m)) {
            const root = project(tree, input, i, strand),
              motif = root.children[1]!;
            const observation = {
              id: m.model.id,
              version: m.model.version,
              family: m.family,
              depth: m.depth,
              strand,
              window: [root.start, root.end],
              motif: [motif.start, motif.end],
            } as const;
            const key = JSON.stringify(observation),
              prior = found.get(key);
            if (prior) prior.witnesses.push(root);
            else found.set(key, { ...observation, witnesses: [root] });
          }
        }
      }
  }
  return [...found.values()];
}
