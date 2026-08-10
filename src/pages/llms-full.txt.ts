import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { bindings } from '@/data/bindings';
import { fourthEdition } from '@/data/release';
import { site } from '@/data/site';

export const GET: APIRoute = async () => {
  const docs = (await getCollection('docs')).sort(
    (a, b) => a.data.order - b.data.order,
  );
  const learn = (await getCollection('learn')).sort(
    (a, b) => a.data.order - b.data.order,
  );
  const docIndex = docs
    .map(
      (entry) =>
        `- [${entry.data.title}](${site.origin}/docs/${entry.id.replace(/\.(md|mdx)$/i, '')}/): ${entry.data.summary}`,
    )
    .join('\n');
  const learnIndex = learn
    .map(
      (entry) =>
        `- [${entry.data.title}](${site.origin}/learn/${entry.id.replace(/\.(md|mdx)$/i, '')}/): ${entry.data.summary}`,
    )
    .join('\n');
  const packageIndex = bindings
    .map(
      (binding) =>
        `- ${binding.language}: ${binding.status}; ${binding.distribution}. ${binding.editionNote}`,
    )
    .join('\n');

  return new Response(
    `# STRling public user-content index

## Identity

STRling is The Universal Regular Expression Compiler. It offers readable, composable building blocks that compile to regular-expression patterns. Canonical terminology: STRling, RegEx, Simply API, binding, generated RegEx, target engine, portability, and Fourth Edition.

## Learn

${learnIndex}

## User documentation

${docIndex}

## Binding and package state

Package state is intentionally qualified. “Source available” does not mean registry-published.

${packageIndex}

## Fourth Edition

Status: ${fourthEdition.status}. ${fourthEdition.summary}

Verified public preparation:
${fourthEdition.verifiedWork.map((item) => `- ${item}`).join('\n')}

Still provisional:
${fourthEdition.provisional.map((item) => `- ${item}`).join('\n')}

## Canonical sources

- Website: ${site.origin}/
- GitHub organization: ${site.organizationUrl}
- Compiler, specification, and bindings: ${site.compilerSourceUrl}
- Website source: ${site.sourceUrl}

This index includes public user content only. Internal engineering governance and implementation planning are intentionally excluded.
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
