import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { bindings } from '@/data/bindings';
import { learnLessonPath } from '@/data/navigation';
import {
  fourthEdition,
  productRelease,
  releaseSummary,
  historicalSupportMatrix,
  releaseStatusPath,
} from '@/data/release';
import { regexCategories, regexDocs, regexFeatures } from '@/data/regexDocs';
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
        `- [${entry.data.title}](${site.origin}${learnLessonPath(entry.id)}): ${entry.data.summary}`,
    )
    .join('\n');
  const packageIndex = bindings
    .map(
      (binding) =>
        `- ${binding.language}: ${binding.package.name} ${binding.package.version}; ${binding.distribution}; ${binding.status}; ${binding.support}. ${binding.requirements} ${binding.package.url}`,
    )
    .join('\n');
  const regexCategoryIndex = regexCategories
    .map(
      (category) =>
        `- [${category.name}](${site.origin}${category.route.slice(1)}): ${category.featureCount} features. ${category.description}`,
    )
    .join('\n');
  const regexFeatureIndex = regexFeatures
    .map(
      (feature) =>
        `- [${feature.canonicalName}](${site.origin}${feature.route.slice(1)}) — ${feature.semanticFeatureId}: ${feature.semanticDefinition}`,
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

## Regex Feature Catalog

This is the website projection of the canonical Regex Conformance semantic corpus at declared cutoff ${regexDocs.source.cutoffDate}. It defines feature meaning, not empirical implementation support. Semantic digest: ${regexDocs.source.semanticDigest}.

### Categories

${regexCategoryIndex}

### Canonical semantic features

${regexFeatureIndex}

## Binding and package state

Distribution versions and tags are listed with their governed support tier.

${packageIndex}

## ${fourthEdition.name}

${releaseSummary}

- Current release and verification status: ${new URL(releaseStatusPath, site.origin)}
- Official release record at publication: ${productRelease}
- Publication run and receipts: ${fourthEdition.publicationRun}
- Independent public verification: ${fourthEdition.verificationRun}
- Historical support matrix (before publication): ${historicalSupportMatrix}

## Canonical sources

- Website: ${site.origin}/
- GitHub organization: ${site.organizationUrl}
- Compiler, specification, and bindings: ${site.compilerSourceUrl}
- Generic regex semantic corpus: ${site.regexConformanceSourceUrl}/tree/main/semantic-corpus
- Website source: ${site.sourceUrl}

This index includes public user content only. Internal engineering governance and implementation planning are intentionally excluded.
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
