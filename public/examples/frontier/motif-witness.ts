import { type Matcher } from './motif-patterns.ts';
export type Node = {
  rule: string;
  start: number;
  end: number;
  text: string;
  children: Node[];
  depth?: number;
};
export function witnesses(
  text: string,
  { model, family, depth }: Pick<Matcher, 'model' | 'family' | 'depth'>,
): Node[] {
  const f = model.families[family];
  if (!f.roots.includes(depth) || /[^ACGT]/.test(text)) return [];
  const node = (
    rule: string,
    start: number,
    end: number,
    children: Node[] = [],
    d?: number,
  ): Node => ({
    rule,
    start,
    end,
    text: text.slice(start, end),
    children,
    depth: d,
  });
  function literal(rule: string, i: number, value: string) {
    return text.startsWith(value, i)
      ? node(rule, i, i + value.length)
      : undefined;
  }
  function gap(i: number, k: number) {
    const value = text.slice(i, i + k);
    return value.length === k && !/[^AT]/.test(value)
      ? node('spacer', i, i + k)
      : undefined;
  }
  function modules(i: number, d: number): Node[] {
    const result: Node[] = [];
    if (d === 0) {
      for (const id of f.seeds) {
        const { prefix, letters, suffix } = model.seeds[id],
          j = i + prefix.length;
        if (
          text.startsWith(prefix, i) &&
          letters.includes(text[j] ?? '!') &&
          text.startsWith(suffix, j + 1)
        )
          result.push(node('seed.' + id, i, j + 1 + suffix.length, [], 0));
      }
      return result;
    }
    for (const id of f.pairs) {
      const pair = model.pairs[id],
        open = literal('open', i, pair.open);
      if (!open) continue;
      for (const k of f.lengths) {
        const left = gap(open.end, k);
        if (!left) continue;
        for (const child of modules(left.end, d - 1)) {
          const right = gap(child.end, k);
          if (!right) continue;
          const close = literal('close', right.end, pair.close);
          if (close)
            result.push(
              node(
                'pair.' + id,
                i,
                close.end,
                [open, left, child, right, close],
                d,
              ),
            );
        }
      }
    }
    const [a, b, c] = model.frame;
    const open = literal('open', i, a);
    if (f.tandem && open)
      for (const left of modules(open.end, d - 1)) {
        const join = literal('separator', left.end, b);
        if (!join) continue;
        for (const right of modules(join.end, d - 1)) {
          const close = literal('close', right.end, c);
          if (close)
            result.push(
              node(
                'join.tandem',
                i,
                close.end,
                [open, left, join, right, close],
                d,
              ),
            );
        }
      }
    return result;
  }
  const start = literal('leftMarker', 0, f.left),
    result: Node[] = [];
  if (!start) return result;
  for (let k = f.external[0]; k <= f.external[1]; k++) {
    const left = gap(start.end, k);
    if (!left) continue;
    for (const motif of modules(left.end, depth)) {
      const r = text.length - f.right.length - motif.end;
      if (r < f.external[0] || r > f.external[1]) continue;
      const right = gap(motif.end, r),
        end = literal('rightMarker', motif.end + r, f.right);
      if (right && end)
        result.push(
          node('window', 0, text.length, [
            node('leftContext', 0, left.end, [start, left]),
            motif,
            node('rightContext', motif.end, text.length, [right, end]),
          ]),
        );
    }
  }
  return result;
}
export function recognize(text: string, m: Matcher) {
  const match = m.regex.exec(text);
  if (!match) return [];
  const trees = witnesses(text, m);
  if (
    !trees.some((t) =>
      t.children.every(
        (c, i) =>
          c.text ===
          match.groups?.[['leftContext', 'motif', 'rightContext'][i]!],
      ),
    )
  )
    throw new Error('Root captures disagree with domain evidence');
  return trees;
}
