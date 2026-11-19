---
title: 'Communicating a nested sequence hypothesis'
description: 'Represent a synthetic motif family with paired context, bounded recursive structure, executable STRling patterns, and explanations tied to the model.'
summary: 'Turn a deeply nested motif family into a readable hypothesis that others can inspect, test, explain, and revise.'
order: 7
time: '60 minutes'
difficulty: frontier
keywords:
  - 'complex pattern representation'
  - 'nested sequence motifs'
  - 'executable hypotheses'
  - 'bounded recursive composition'
  - 'STRling pattern communication'
related:
  - '/docs/composition/'
  - '/learn/policy-driven-import-records/'
  - '/docs/compatibility/'
---

A research group proposes a family of sequence motifs. A colleague hands you this occurrence and asks which parts could change while it still belongs to the family.

```text
TTAAATGCAAAGGTGCAAACGATTTGCCCACAGATTTCCATACTGACCTTTGCTAGGCC
```

Answering takes more than finding a short signature. The surrounding sequence identifies a family. Within it, a marker constrains a later marker, two gaps share a length, and two different children occupy the same structural level. Here we invent every rule so another reader can inspect the hypothesis, check an occurrence, and predict what a revision will admit. A match establishes membership under those rules. Biological function, frequency, and discovery validity would require independent evidence.

## Model card for synthetic-motif-atlas/H1

Read a window as **left context, one module, right context**. Use uppercase A, C, G, T. Write intervals as zero-based, half-open `[start,end)`. Our local `S(k)` means exactly k characters independently chosen from A and T. A range such as `S(2..4)` allows any length from two through four. This S is a lesson abbreviation.

| Policy field in `families`  | Alpha          | Beta           |
| --------------------------- | -------------- | -------------- |
| `seeds`                     | a, b           | b              |
| `pairs`                     | Amber, Indigo  | Indigo         |
| `lengths` per paired module | 1, 2           | 1, 2           |
| `tandem`                    | allowed        | forbidden      |
| `roots` (exact depths)      | 0, 1, 2, 3     | 1, 2           |
| `left` then `S(external)`   | TTAA + S(2..4) | GGAA + S(1..2) |
| `S(external)` then `right`  | S(2..4) + GGCC | S(1..2) + TTCC |

The two external gaps choose lengths independently. Read the following grammar from the root toward the seeds.

```text
C(f,0) = one seed allowed by f
paired C(f,d) = pair.open S(k) C(f,d-1) S(k) pair.close
tandem C(f,d) = GGT C(f,d-1) CCA C(f,d-1) ACC
```

For positive d, choose a permitted form. Choose one pair and one k for each wrapper. A tandem chooses two children independently at exactly d−1. Seed a is `ACG[AG]T`, seed b is `TTC[CT]A`. Amber opens with GCA and closes with TGC. Indigo opens with CAG and closes with CTG. The literals in each pair happen to be reverse complements.

**Annotated occurrence.** Split the opening example into `TTAAAT` | `GCAAAGGTGCAAACGATTTGCCCACAGATTTCCATACTGACCTTTGC` | `TAGGCC`. The motif is an Amber wrapper around a tandem. Its two children are Amber(seed a) and Indigo(seed b). Each wrapper uses equal-length internal gaps. The tandem has depth two, so its enclosing wrapper has depth three. The full Alpha window occupies [0,59), with motif [6,53).

**Near miss.** Change only the outer closing TGC to CTG. Indigo is allowed in Alpha, but that closing cannot finish an Amber wrapper. **Revision.** H2 permits k = 3 anywhere inside an Alpha wrapper. Changing its two outer internal gaps from AA and TT to AAA and TTT produces a newly admitted occurrence.

## Give each rule a source name

In the source model, `seeds.a` and `seeds.b` store a prefix, a choice of one letter, and a suffix. For example, seed a accepts ACGAT and ACGGT. The variable letter occupies exactly one position. The `pairs.amber` and `pairs.indigo` records each carry both marker literals. The three tandem delimiters live together in `frame`. These names let a reviewer trace each line of the card through the factory and into a witness.

```typescript
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
```

Try `spacer(2)` against AA, AT, TA, TT and A. Only the first four have the required length. The model validates vocabulary references, nonempty choices, and finite ordered bounds before building. Positive repetition bounds matter here because this facade uses a zero maximum for an unbounded repeat.

## Preserve the three relationships

1. **Choose a marker record once.** Choosing openings and closings independently admits the crossed outer pair. The source keeps `pair.open` and `pair.close` in the same branch.
2. **Choose k once.** Writing an independent one-to-two repeat on each side admits a wrapper with AA on the left and T on the right. Reusing k permits AA opposite TT. Requiring identical text would discard that valid wrapper.
3. **Choose an exact child depth.** Building each sibling at any depth up to the limit admits a seed opposite a depth-one wrapper. The same child Pattern in both positions describes a language. Each position can match a different member of it.

## Build a finite module

TypeScript recursion stops at the seed case and constructs finite Pattern objects before compilation. The canonical semantic model has no runtime recursion or subroutine node. The guard rejects negative, fractional, or excessive depths before expanding a child.

```typescript
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
```

Read the base case even for Beta. Beta permits roots at depths one and two, and both require seed children internally. The outer factory iterates `f.roots` once to select complete matchers. Keeping the depth choice there preserves equal child depths inside tandems. A mathematical grammar or a specialized sequence model can also express structural relationships. A flattened regular expression encodes these finite alternatives too. The named grammar gives the reader a place to review each relationship without counting duplicated branches.

## Compile and recognize an exact window

Run the downloadable example with Node 22.12.0 and the pinned 4.0.3 TypeScript Preview adapter. The [TypeScript binding page](/packages/typescript/) describes the scope of upstream runtime evidence. In an empty folder, save the six Frontier files in a subfolder named `frontier`, then save the two supporting files side by side in a sibling subfolder named `pattern-engineering`. The compiler loads the profile relative to its own file.

- <a download href="/examples/frontier/example.ts">Runnable example</a>
- <a download href="/examples/frontier/motif-model.ts">Model and revision</a>
- <a download href="/examples/frontier/motif-patterns.ts">Pattern factories</a>
- <a download href="/examples/frontier/motif-witness.ts">Witness evaluator</a>
- <a download href="/examples/frontier/motif-scan.ts">Bounded scanner</a>
- <a download href="/examples/frontier/motif-fixtures.ts">Fixture strings</a>
- <a download href="/examples/pattern-engineering/compiler.ts">Canonical compiler helper</a>
- <a download href="/examples/pattern-engineering/ecmascript-2024.json">ECMAScript target profile</a>

```sh
npm init -y
npm pkg set type=module
npm install --save-exact @strling-lang/strling@4.0.3
node --experimental-strip-types frontier/example.ts
```

Each revision has six compiled matchers, four for Alpha and two for Beta. `compileModel` anchors both ends and introduces just three captures around the otherwise capture-free components. This avoids duplicating capture identities when reusing a child. The shared helper loads bundled WebAssembly, checks the compilation outcome, and executes the emitted pattern and flags with JavaScript RegExp under ECMAScript 2024 profile 1.3.0. Recording a request alone cannot establish a match.

In the runner, select Alpha's depth-three matcher once. Inspect its captures, then use the same artifact on a single deliberately changed window.

```typescript
const matchers = await compileModel(H1);
const deep = matchers.find((m) => m.family === 'Alpha' && m.depth === 3)!;
console.log(deep.regex.exec(fixtures.deepAlpha)?.groups);
console.log(deep.regex.test(fixtures.crossed)); // false
```

| Exact window                        | Bases | H1 result      | Motif interval |
| ----------------------------------- | ----: | -------------- | -------------- |
| `TTAAAAACGATTTGGCC`                 |    17 | Alpha, depth 0 | [6,11)         |
| Opening example                     |    59 | Alpha, depth 3 | [6,53)         |
| `GGAAACAGTCAGTATTCTAATCTGACTGTTTCC` |    33 | Beta, depth 2  | [5,28)         |

The three captures for the opening example are exactly the three pieces in the model card. Compiling the Alpha depth-three request records 3,377 steps and emits 10,171 pattern characters under H1. Under H2 these grow to 8,053 and 24,491. The example enforces ceilings of 20,000 steps and 50,000 emitted characters alongside the construction cap of three. Naming a child helps reviewers even when its compiled representation repeats.

## Explain the opening occurrence

The compiled RegExp gates acceptance of each exact window. A separate lesson-owned evaluator tries literal markers and finite splits under the same family policy. Each successful path records the original text, stable rule, exact depth where applicable, interval, and ordered children. The evaluator retains every valid derivation. For each compiled match, the selected capture tuple must agree with at least one tree. All three worked positives have a single witness in this corpus.

- Alpha context window [0,59)
  - Left context [0,6), TTAA followed by AT
  - Amber wrapper [6,53), depth 3
    - Tandem [11,48), depth 2
      - Amber wrapper [14,27), depth 1
        - Seed a [18,23), ACGAT
      - Indigo wrapper [30,45), depth 1
        - Seed b [35,40), TTCCA
  - Right context [53,59), TA followed by GGCC

| Wrapper      | Opening     | Left spacer | Right spacer | Closing     |
| ------------ | ----------- | ----------- | ------------ | ----------- |
| Outer Amber  | GCA [6,9)   | AA [9,11)   | TT [48,50)   | TGC [50,53) |
| Left Amber   | GCA [14,17) | A [17,18)   | T [23,24)    | TGC [24,27) |
| Right Indigo | CAG [30,33) | AT [33,35)  | TA [40,42)   | CTG [42,45) |

Read the tandem left to right. GGT occupies [11,14), CCA separates the children at [27,30), and ACC closes at [45,48). Joining the leaf values in traversal order accounts for every character. This hierarchy is evidence produced by the lesson evaluator. The emitted matcher supplies the three root captures.

## Locate occurrences on either strand

An extra DNA character after the 59-base example makes the complete 60-base candidate fail. The first 59 bases still form a valid interval. The scanner tries every start and every admissible end, bounded by each family/depth matcher's minimum and maximum lengths. For a paired branch, add both marker lengths and twice k to the child's bounds. For a tandem, add all three delimiters and twice the child bound. Include both context markers and both external gaps. The largest windows under either revision are 119 bases for Alpha and 37 for Beta.

Scan `CCG + deepAlpha + GGA`. The 65-base input has one forward window [3,62), with motif [9,56). The scanner reuses compiled matchers, retains overlaps, and groups witnesses only when version, family, depth, strand, window and motif agree. Its input limit is 256 bases. Lowercase, whitespace and unknown bases cause errors, preserving the supplied coordinate system.

For a two-strand exercise, reverse the input and complement A↔T and C↔G. This host operation transforms the whole input. Convert **every** reverse-coordinate span [a,b) to [n−b,n−a) in the original. Keep children in model traversal order, which now visits decreasing original coordinates.

```text
CCGGGCCTAGCAAAGGTCAGTATGGAAATCTGTGGGCAAATCGTTTGCACCTTTGCATTTAAGGATT
```

The asymmetric 67-base input has one minus-strand Alpha window. The reverse-oriented [5,64) maps to original [3,62), with motif [9,56). Reverse-complementing each original slice reconstructs its stored model-oriented text. Distinct strand observations survive even when their windows overlap.

## Revise one policy and predict the result

Before running H2, predict three outcomes. What happens to the opening example, the crossed-marker near miss, and this occurrence with AAA and TTT around its tandem?

```text
TTAAATGCAAAAGGTGCAAACGATTTGCCCACAGATTTCCATACTGACCTTTTGCTAGGCC
```

H2 replaces only `families.Alpha.lengths` with `[1, 2, 3]`. The recursive factory reads that policy at every Alpha wrapper. Beta and the two external gap ranges retain their own settings.

| Corpus                                                        | H1     | H2     | Rule that decides                              |
| ------------------------------------------------------------- | ------ | ------ | ---------------------------------------------- |
| Three worked positives                                        | accept | accept | Each existing choice is still permitted        |
| New 61-base Alpha, depth 3                                    | reject | accept | Both outer internal gaps have length three     |
| Crossed pair, unequal gap lengths, unequal tandem depths      | reject | reject | Each breaks a relationship that H2 preserves   |
| Depth four, Beta seed a, Beta tandem, Alpha external gap five | reject | reject | Root, family, and external policies stay fixed |

These labels describe deliberate fixture edits and observed results. The named reason comes from inspecting the model. The comparison checks a finite corpus. Inclusion follows separately from the policy edit, which only adds Alpha choices.

| Exact Alpha depth | H1 structural derivations | H2 structural derivations |
| ----------------- | ------------------------: | ------------------------: |
| 0                 |                         2 |                         2 |
| 1                 |                        12 |                        16 |
| 2                 |                       192 |                       352 |
| 3                 |                    37,632 |                   126,016 |
| Total             |                    37,838 |                   126,386 |

The source helper `statistics` starts with two seed identities. If the preceding exact depth has A derivations, the next has `4A + A²` under H1 or `6A + A²` under H2. The coefficient counts marker and length choices. The square counts two independent children at the same depth. This measures structural derivations, excluding variable bases and external context choices. It supplies neither unique sequence counts nor biological probabilities.

## Transfer the technique

Move the length-three change to the inner Indigo wrapper of the opening example. Predict its family, depth, capture boundaries, and which witnesses change. Check the prediction under both revisions. Then try that same inner wrapper inside Beta. A useful review question is which single field you would point to when a colleague asks why the predictions differ.

Bounded construction, exhaustive interval search on short inputs, and explicit witnesses make this hypothesis inspectable. Throughput on long inputs and the scientific interpretation of an observed occurrence are separate questions.
