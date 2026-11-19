import * as s from '@strling-lang/strling/simply';
import {
  loadPatternCompiler,
  compileProjection,
} from '../pattern-engineering/compiler.ts';
import {
  integer,
  limits,
  statistics,
  validate,
  type Family,
  type FamilyName,
  type Model,
} from './motif-model.ts';

function choice(items: s.Pattern[]) {
  const [first, ...rest] = items;
  if (!first) throw new Error('Expected a nonempty choice');
  return rest.length ? s.anyOf(first, ...rest) : first;
}
function seedPattern(seed: Model['seeds']['a' | 'b']) {
  return s.merge(seed.prefix, s.inChars(...seed.letters), seed.suffix);
}
export function spacer(k: number) {
  integer(k, 1, limits.internal);
  return s.inChars('A', 'T').rep(k);
}
export function moduleAtDepth(
  model: Model,
  f: Family,
  depth: number,
): s.Pattern {
  integer(depth, 0, limits.depth);
  if (depth === 0)
    return choice(f.seeds.map((id) => seedPattern(model.seeds[id])));
  const child = moduleAtDepth(model, f, depth - 1);
  const branches = f.pairs.flatMap((id) => {
    const pair = model.pairs[id];
    return f.lengths.map((k) =>
      s.merge(pair.open, spacer(k), child, spacer(k), pair.close),
    );
  });
  if (f.tandem) {
    const [open, join, close] = model.frame;
    branches.push(s.merge(open, child, join, child, close));
  }
  return choice(branches);
}
export async function compileModel(model: Model) {
  validate(model);
  const compile = await loadPatternCompiler();
  return (Object.keys(model.families) as FamilyName[]).flatMap((family) => {
    const f = model.families[family];
    return f.roots.map((depth) => {
      const gap = () => s.inChars('A', 'T').rep(...f.external);
      const pattern = s.merge(
        s.start(),
        s.group('leftContext', f.left, gap()),
        s.group('motif', moduleAtDepth(model, f, depth)),
        s.group('rightContext', gap(), f.right),
        s.end(),
      );
      const operations = pattern.buildRequest(compileProjection).steps;
      if (!Array.isArray(operations))
        throw new Error('Expected recorded Simply steps');
      const steps = operations.length;
      if (steps > limits.steps)
        throw new Error('Request exceeds tutorial budget');
      const regex = compile(pattern);
      if (
        regex.source.length > limits.characters ||
        regex.global ||
        regex.sticky
      )
        throw new Error('Artifact exceeds tutorial constraints');
      return {
        model,
        family,
        depth,
        regex,
        steps,
        ...statistics(model, f, depth),
      };
    });
  });
}
export type Matcher = Awaited<ReturnType<typeof compileModel>>[number];
