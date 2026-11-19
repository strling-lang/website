export const limits = Object.freeze({
  depth: 3,
  internal: 3,
  context: 4,
  input: 256,
  steps: 20000,
  characters: 50000,
});
type Choices<T> = readonly [T, ...T[]];
type Range = readonly [number, number];
type Seed = {
  readonly prefix: string;
  readonly letters: string;
  readonly suffix: string;
};
type Pair = { readonly open: string; readonly close: string };
export type Family = {
  readonly seeds: Choices<'a' | 'b'>;
  readonly pairs: Choices<'amber' | 'indigo'>;
  readonly lengths: Choices<number>;
  readonly roots: Choices<number>;
  readonly tandem: boolean;
  readonly left: string;
  readonly right: string;
  readonly external: Range;
};
export type Model = {
  readonly id: 'synthetic-motif-atlas';
  readonly version: 'H1' | 'H2';
  readonly seeds: Readonly<Record<'a' | 'b', Seed>>;
  readonly pairs: Readonly<Record<'amber' | 'indigo', Pair>>;
  readonly frame: readonly [string, string, string];
  readonly families: Readonly<Record<'Alpha' | 'Beta', Family>>;
};
export type FamilyName = keyof Model['families'];
export function integer(value: number, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new RangeError(`Expected integer ${min}..${max}, got ${value}`);
}
export function reverseComplement(text: string) {
  const bases: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
  return Array.from(text)
    .reverse()
    .map((c) => {
      if (!bases[c]) throw new Error('Invalid base');
      return bases[c];
    })
    .join('');
}
function freeze<T>(object: T): T {
  if (object && typeof object === 'object' && !Object.isFrozen(object)) {
    for (const value of Object.values(object)) freeze(value);
    Object.freeze(object);
  }
  return object;
}
export function validate(model: Model) {
  const literal = (v: string) => {
    if (!v || /[^ACGT]/.test(v)) throw new Error('Invalid model literal');
  };
  for (const seed of Object.values(model.seeds)) {
    literal(seed.prefix);
    literal(seed.letters);
    literal(seed.suffix);
  }
  for (const pair of Object.values(model.pairs)) {
    literal(pair.open);
    literal(pair.close);
    if (reverseComplement(pair.open) !== pair.close)
      throw new Error('Mismatched pair');
  }
  model.frame.forEach(literal);
  for (const f of Object.values(model.families)) {
    for (const list of [f.seeds, f.pairs, f.lengths, f.roots])
      if (!list.length || new Set<unknown>(list).size !== list.length)
        throw new Error('Expected nonempty distinct choices');
    if (
      f.seeds.some((id) => !Object.hasOwn(model.seeds, id)) ||
      f.pairs.some((id) => !Object.hasOwn(model.pairs, id))
    )
      throw new Error('Unknown rule ID');
    f.roots.forEach((d) => integer(d, 0, limits.depth));
    f.lengths.forEach((k) => integer(k, 1, limits.internal));
    integer(f.external[0], 1, limits.context);
    integer(f.external[1], f.external[0], limits.context);
    literal(f.left);
    literal(f.right);
  }
  return freeze(model);
}
export const H1 = validate({
  id: 'synthetic-motif-atlas',
  version: 'H1',
  seeds: {
    a: { prefix: 'ACG', letters: 'AG', suffix: 'T' },
    b: { prefix: 'TTC', letters: 'CT', suffix: 'A' },
  },
  pairs: {
    amber: { open: 'GCA', close: 'TGC' },
    indigo: { open: 'CAG', close: 'CTG' },
  },
  frame: ['GGT', 'CCA', 'ACC'],
  families: {
    Alpha: {
      seeds: ['a', 'b'],
      pairs: ['amber', 'indigo'],
      lengths: [1, 2],
      roots: [0, 1, 2, 3],
      tandem: true,
      left: 'TTAA',
      right: 'GGCC',
      external: [2, 4],
    },
    Beta: {
      seeds: ['b'],
      pairs: ['indigo'],
      lengths: [1, 2],
      roots: [1, 2],
      tandem: false,
      left: 'GGAA',
      right: 'TTCC',
      external: [1, 2],
    },
  },
} satisfies Model);
export const H2 = validate({
  ...H1,
  version: 'H2',
  families: {
    ...H1.families,
    Alpha: { ...H1.families.Alpha, lengths: [1, 2, 3] },
  },
});
export function statistics(model: Model, f: Family, d: number) {
  integer(d, 0, limits.depth);
  const sizes = f.seeds.map(
    (id) => model.seeds[id].prefix.length + 1 + model.seeds[id].suffix.length,
  );
  let min = Math.min(...sizes),
    max = Math.max(...sizes),
    count = f.seeds.length;
  const offsets = f.pairs.flatMap((id) =>
    f.lengths.map(
      (k) => model.pairs[id].open.length + model.pairs[id].close.length + 2 * k,
    ),
  );
  const frameLength = model.frame.join('').length;
  for (let i = 0; i < d; i++) {
    min = Math.min(
      min + Math.min(...offsets),
      f.tandem ? frameLength + 2 * min : Infinity,
    );
    max = Math.max(
      max + Math.max(...offsets),
      f.tandem ? frameLength + 2 * max : 0,
    );
    count = offsets.length * count + (f.tandem ? count * count : 0);
  }
  const literals = f.left.length + f.right.length;
  return {
    min: min + literals + 2 * f.external[0],
    max: max + literals + 2 * f.external[1],
    count,
  };
}
