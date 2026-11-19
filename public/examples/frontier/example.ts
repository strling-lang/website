import { H1, H2 } from './motif-model.ts';
import { fixtures as x } from './motif-fixtures.ts';
import { compileModel } from './motif-patterns.ts';
import { scan } from './motif-scan.ts';
import { recognize } from './motif-witness.ts';
for (const model of [H1, H2]) {
  const matchers = await compileModel(model);
  const deep = matchers.find((m) => m.family === 'Alpha' && m.depth === 3)!;
  console.log(model.version, {
    steps: deep.steps,
    characters: deep.regex.source.length,
    captures: deep.regex.exec(x.deepAlpha)?.groups,
  });
  for (const [name, text] of Object.entries(x)) {
    console.log(
      name,
      matchers.flatMap((m) =>
        recognize(text, m).map(() => [m.family, m.depth]),
      ),
    );
  }
  for (const input of ['CCG' + x.deepAlpha + 'GGA', x.reverse])
    console.log(JSON.stringify(scan(input, matchers, true), null, 2));
}
