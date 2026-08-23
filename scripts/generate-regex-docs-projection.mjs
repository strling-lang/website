import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectionFormat = 'strling-regex-docs-projection';
export const projectionVersion = 1;

const categoryPresentation = [
  {
    id: 'character-classes',
    name: 'Character classes',
    description:
      'Character classes describe sets, ranges, properties, and other rules that select a single governed text unit.',
  },
  {
    id: 'approximate-partial-and-multipattern',
    name: 'Approximate, partial, streaming and multi-pattern',
    description:
      'These features extend matching beyond one complete subject and one exact pattern, covering edits, incomplete input, streams, and pattern databases.',
  },
  {
    id: 'quantification-and-match-selection',
    name: 'Quantification and match selection',
    description:
      'Quantification controls repetition, while selection rules decide which viable start, length, and alternative become the reported match.',
  },
  {
    id: 'unicode-and-text-model',
    name: 'Unicode and text model',
    description:
      'Text-model features define the units, encodings, properties, normalization, case behavior, and segmentation rules visible to matching.',
  },
  {
    id: 'diagnostics-resources-and-safety',
    name: 'Diagnostics, resources and safety',
    description:
      'These features govern errors, limits, termination, memory and time behavior, and the observable safety contracts of compilation and matching.',
  },
  {
    id: 'anchors-and-boundaries',
    name: 'Anchors and boundaries',
    description:
      'Anchors and boundaries test positions in a subject or search region without consuming the surrounding text.',
  },
  {
    id: 'backreferences-recursion-and-conditionals',
    name: 'Backreferences, recursion and conditionals',
    description:
      'These constructs reuse captured text or subpatterns and choose behavior from capture, assertion, or recursive state.',
  },
  {
    id: 'backtracking-control-and-code',
    name: 'Backtracking control and embedded code',
    description:
      'Control features change the matcher’s search path, commit or reject alternatives, or invoke host-visible code and callouts.',
  },
  {
    id: 'groups-and-captures',
    name: 'Groups and captures',
    description:
      'Groups organize subpatterns and captures expose matched spans, names, histories, and other result state to later constructs or host operations.',
  },
  {
    id: 'replacement-language',
    name: 'Replacement language',
    description:
      'Replacement features define how matched text and captures are expanded, transformed, or supplied to callbacks after a match.',
  },
  {
    id: 'lookaround-assertions',
    name: 'Lookaround assertions',
    description:
      'Lookaround tests whether a subpattern does or does not match before or after the current position without consuming it as part of the result.',
  },
  {
    id: 'grammar-and-composition',
    name: 'Grammar and composition',
    description:
      'Grammar and composition features define literals, concatenation, alternatives, comments, quoting, and the structural rules for forming patterns.',
  },
  {
    id: 'host-operations-and-results',
    name: 'Host-operation and result semantics',
    description:
      'These features describe how host APIs search, iterate, split, extract, position, and advance through results around the regex itself.',
  },
  {
    id: 'editor-cli-and-product-surfaces',
    name: 'Editor, CLI and product surfaces',
    description:
      'Product-surface features capture observable regex behavior supplied by editors, command-line tools, databases, and other host environments.',
  },
];

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith('--')) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${argument}`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  return options;
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function featureSlug(featureId) {
  return featureId.replace(/^feature\./, '');
}

function sourceRevision(canonicalPath, explicitRevision) {
  if (explicitRevision) return explicitRevision;
  let directory = dirname(canonicalPath);
  while (directory !== dirname(directory)) {
    try {
      return execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      directory = dirname(directory);
    }
  }
  throw new Error(
    'Could not determine the Regex Conformance revision; pass --source-revision.',
  );
}

function sourceSnapshotPath(canonicalPath) {
  const marker = `${sep}semantic-corpus${sep}`;
  const markerIndex = canonicalPath.lastIndexOf(marker);
  if (markerIndex === -1)
    throw new Error('Canonical snapshot must be inside semantic-corpus/.');
  return normalizePath(canonicalPath.slice(markerIndex + 1));
}

function unique(values) {
  return [...new Set(values)];
}

function relationDetails(feature, interactions) {
  return interactions
    .filter(
      (interaction) =>
        (interaction.source_id === feature.feature_id &&
          interaction.target_id.startsWith('feature.')) ||
        (interaction.target_id === feature.feature_id &&
          interaction.source_id.startsWith('feature.')),
    )
    .map((interaction) => ({
      interactionId: interaction.interaction_id,
      relationType: interaction.interaction_type,
      direction:
        interaction.source_id === feature.feature_id ? 'outgoing' : 'incoming',
      targetFeatureId:
        interaction.source_id === feature.feature_id
          ? interaction.target_id
          : interaction.source_id,
    }))
    .sort((a, b) =>
      `${a.targetFeatureId}:${a.relationType}:${a.direction}`.localeCompare(
        `${b.targetFeatureId}:${b.relationType}:${b.direction}`,
      ),
    );
}

export async function generateProjection({
  canonicalPath,
  outputDirectory,
  revision,
}) {
  const canonical = JSON.parse(await readFile(canonicalPath, 'utf8'));
  const canonicalCategories = unique(
    canonical.features.map((feature) => feature.category),
  );
  const presentationIds = categoryPresentation.map((category) => category.id);
  const missingPresentation = canonicalCategories.filter(
    (category) => !presentationIds.includes(category),
  );
  const stalePresentation = presentationIds.filter(
    (category) => !canonicalCategories.includes(category),
  );
  if (missingPresentation.length || stalePresentation.length) {
    throw new Error(
      `Category presentation requires review. Missing: ${missingPresentation.join(', ') || 'none'}. Stale: ${stalePresentation.join(', ') || 'none'}.`,
    );
  }

  const sourceById = new Map(
    canonical.sources.map((source) => [source.source_id, source]),
  );
  const manifestationById = new Map(
    canonical.manifestations.map((item) => [item.manifestation_id, item]),
  );
  const modifierById = new Map(
    canonical.modifiers.map((item) => [item.modifier_id, item]),
  );
  const operationById = new Map(
    canonical.operations.map((item) => [item.operation_id, item]),
  );
  const features = canonical.features
    .map((feature) => {
      const featureRelations = relationDetails(feature, canonical.interactions);
      const relatedFeatures = unique(
        featureRelations.map((relation) => relation.targetFeatureId),
      ).sort();
      const manifestations = feature.manifestation_ids.map((id) => {
        const manifestation = manifestationById.get(id);
        if (!manifestation)
          throw new Error(`${feature.feature_id} references missing ${id}.`);
        return {
          manifestationId: manifestation.manifestation_id,
          kind: manifestation.kind,
          form: manifestation.syntax_or_api_form,
          sourceId: manifestation.source_id,
          identityNote: manifestation.identity_note,
        };
      });
      const modifierIds = unique([
        ...feature.modifier_ids,
        ...feature.option_state_dependencies,
      ]);
      const modifiers = modifierIds.map((id) => {
        const modifier = modifierById.get(id);
        if (!modifier)
          throw new Error(`${feature.feature_id} references ${id}.`);
        return {
          modifierId: modifier.modifier_id,
          name: modifier.name,
          semanticEffect: modifier.semantic_effect,
        };
      });
      const operations = feature.supported_operation_ids.map((id) => {
        const operation = operationById.get(`operation.${id}`);
        if (!operation)
          throw new Error(
            `${feature.feature_id} references missing operation ${id}.`,
          );
        return {
          operationId: operation.operation_id,
          name: operation.name,
          semanticContract: operation.semantic_contract,
        };
      });
      const sourceIds = unique([
        ...feature.normative_reference_ids,
        ...feature.implementation_reference_ids,
        ...feature.provenance.source_ids,
        ...manifestations.map((item) => item.sourceId),
      ]);
      const authoritativeSources = sourceIds.map((id) => {
        const source = sourceById.get(id);
        if (!source) throw new Error(`${feature.feature_id} references ${id}.`);
        return {
          sourceId: source.source_id,
          title: source.title,
          authority: source.authority,
          sourceClass: source.source_class,
          normative: source.normative,
          url: source.url,
          versionOrRevision: source.version_or_revision,
          retrievedOn: source.retrieved_on,
          scope: source.scope,
        };
      });

      return {
        semanticFeatureId: feature.feature_id,
        semanticCategoryId: feature.category,
        canonicalName: feature.canonical_name,
        slug: featureSlug(feature.feature_id),
        route: `/regex/docs/${feature.category}/${featureSlug(feature.feature_id)}/`,
        sourceSemanticDigest: canonical.corpus_digest_sha256,
        aliases: feature.aliases,
        historicalNames: feature.historical_names,
        relatedFeatures,
        featureRelations,
        featureClass: feature.feature_class,
        semanticDefinition: feature.semantic_definition,
        abstractGrammarForm: feature.abstract_grammar_form,
        semanticVariants: feature.semantic_variants,
        manifestations,
        prerequisiteFeatureIds: feature.prerequisite_feature_ids,
        modifiers,
        operations,
        captureResultSemantics: feature.capture_result_semantics,
        replacementImplications: feature.replacement_implications,
        unicodeEncodingImplications: feature.unicode_encoding_implications,
        diagnosticErrorSemantics: feature.diagnostic_error_semantics,
        resourceTerminationImplications:
          feature.resource_termination_implications,
        optionStateDependencies: feature.option_state_dependencies,
        testConcepts: feature.test_concepts,
        unresolvedSemanticQuestions: feature.unresolved_semantic_questions,
        lifecycle: feature.lifecycle,
        revision: feature.revision,
        provenance: feature.provenance,
        authoritativeSources,
      };
    })
    .sort((a, b) => a.semanticFeatureId.localeCompare(b.semanticFeatureId));

  const projectedFeatureById = new Map(
    features.map((feature) => [feature.semanticFeatureId, feature]),
  );
  const categories = categoryPresentation.map((presentation, order) => {
    const categoryFeatures = features.filter(
      (feature) => feature.semanticCategoryId === presentation.id,
    );
    const crossCategoryCounts = new Map();
    for (const feature of categoryFeatures) {
      for (const relatedId of feature.relatedFeatures) {
        const related = projectedFeatureById.get(relatedId);
        if (!related || related.semanticCategoryId === presentation.id)
          continue;
        crossCategoryCounts.set(
          related.semanticCategoryId,
          (crossCategoryCounts.get(related.semanticCategoryId) ?? 0) + 1,
        );
      }
    }
    const relatedCategoryIds = [...crossCategoryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([id]) => id);
    return {
      semanticCategoryId: presentation.id,
      slug: presentation.id,
      name: presentation.name,
      description: presentation.description,
      order: order + 1,
      featureCount: categoryFeatures.length,
      relatedCategoryIds,
      route: `/regex/docs/${presentation.id}/`,
    };
  });

  const snapshotPath = sourceSnapshotPath(canonicalPath);
  const reviewedRevision = sourceRevision(canonicalPath, revision);
  const source = {
    repository: 'strling-lang/regex-conformance',
    snapshotPath,
    revision: reviewedRevision,
    semanticDigest: canonical.corpus_digest_sha256,
    snapshotId: canonical.snapshot_id,
    schemaVersion: canonical.schema_version,
    cutoffDate: canonical.cutoff_date,
    status: canonical.status,
  };
  const generation = {
    format: projectionFormat,
    version: projectionVersion,
  };
  const categoryCounts = Object.fromEntries(
    categories.map((category) => [
      category.semanticCategoryId,
      category.featureCount,
    ]),
  );
  const lock = {
    generation,
    source,
    canonicalFeatureCount: features.length,
    canonicalCategoryCount: categories.length,
    categoryCounts,
    reviewedCategories: categories.map((category) => ({
      semanticCategoryId: category.semanticCategoryId,
      canonicalName: category.name,
      featureCount: category.featureCount,
    })),
    reviewedFeatures: features.map((feature) => ({
      semanticFeatureId: feature.semanticFeatureId,
      canonicalName: feature.canonicalName,
      semanticCategoryId: feature.semanticCategoryId,
      slug: feature.slug,
    })),
  };
  const projection = {
    generation,
    source,
    categories,
    features,
  };

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outputDirectory, 'source-lock.json'),
      `${JSON.stringify(lock, null, 2)}\n`,
    ),
    writeFile(
      resolve(outputDirectory, 'projection.json'),
      `${JSON.stringify(projection, null, 2)}\n`,
    ),
  ]);
  return { lock, projection };
}

const isDirect =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  const options = parseArgs(process.argv.slice(2));
  const canonicalPath = resolve(
    options.canonical ??
      '../regex-conformance/semantic-corpus/snapshots/regex-semantic-features-2026-08-22.v1.json',
  );
  const outputDirectory = resolve(options.output ?? 'src/data/regex-docs');
  const { lock } = await generateProjection({
    canonicalPath,
    outputDirectory,
    revision: options['source-revision'],
  });
  console.log(
    `Generated ${basename(outputDirectory)} projection: ${lock.canonicalCategoryCount} categories, ${lock.canonicalFeatureCount} features, digest ${lock.source.semanticDigest}.`,
  );
}
