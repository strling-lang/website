import projectionJson from './regex-docs/projection.json';

export interface RegexCategory {
  semanticCategoryId: string;
  slug: string;
  name: string;
  description: string;
  order: number;
  featureCount: number;
  relatedCategoryIds: string[];
  route: string;
}

export interface RegexSource {
  sourceId: string;
  title: string;
  authority: string;
  sourceClass: string;
  normative: boolean;
  url: string;
  versionOrRevision: string;
  retrievedOn: string;
  scope: string;
}

export interface RegexFeatureRelation {
  interactionId: string;
  relationType: string;
  direction: 'incoming' | 'outgoing';
  targetFeatureId: string;
}

export interface RegexFeature {
  semanticFeatureId: string;
  semanticCategoryId: string;
  canonicalName: string;
  slug: string;
  route: string;
  sourceSemanticDigest: string;
  aliases: string[];
  historicalNames: string[];
  relatedFeatures: string[];
  featureRelations: RegexFeatureRelation[];
  featureClass: string;
  semanticDefinition: string;
  abstractGrammarForm: string;
  semanticVariants: Array<{
    variant_id: string;
    name: string;
    distinguishing_rule: string;
  }>;
  manifestations: Array<{
    manifestationId: string;
    kind: string;
    form: string;
    sourceId: string;
    identityNote: string;
  }>;
  prerequisiteFeatureIds: string[];
  modifiers: Array<{
    modifierId: string;
    name: string;
    semanticEffect: string;
  }>;
  operations: Array<{
    operationId: string;
    name: string;
    semanticContract: string;
  }>;
  captureResultSemantics: string;
  replacementImplications: string;
  unicodeEncodingImplications: string;
  diagnosticErrorSemantics: string;
  resourceTerminationImplications: string;
  optionStateDependencies: string[];
  testConcepts: { positive: string; negative: string; edge: string };
  unresolvedSemanticQuestions: string[];
  lifecycle: {
    status: string;
    evidence: Array<{ claim: string; source_ids: string[] }>;
  };
  revision: number;
  provenance: {
    claim_scope: string;
    discovery_cutoff: string;
    source_ids: string[];
  };
  authoritativeSources: RegexSource[];
}

interface RegexDocsProjection {
  generation: { format: string; version: number };
  source: {
    repository: string;
    snapshotPath: string;
    revision: string;
    semanticDigest: string;
    snapshotId: string;
    schemaVersion: string;
    cutoffDate: string;
    status: string;
  };
  categories: RegexCategory[];
  features: RegexFeature[];
}

export const regexDocs = projectionJson as RegexDocsProjection;
export const regexCategories = regexDocs.categories;
export const regexFeatures = regexDocs.features;

export const regexCategoryById = new Map(
  regexCategories.map((category) => [category.semanticCategoryId, category]),
);
export const regexFeatureById = new Map(
  regexFeatures.map((feature) => [feature.semanticFeatureId, feature]),
);

export function featuresForCategory(categoryId: string): RegexFeature[] {
  return regexFeatures.filter(
    (feature) => feature.semanticCategoryId === categoryId,
  );
}

export function sourceUrl(source: RegexSource): string {
  if (!source.url.startsWith('repository:')) return source.url;
  const repositoryPath = source.url.slice('repository:'.length);
  return `https://github.com/${regexDocs.source.repository}/blob/${regexDocs.source.revision}/${repositoryPath}`;
}

export const regexSnapshotUrl = `https://github.com/${regexDocs.source.repository}/blob/${regexDocs.source.revision}/${regexDocs.source.snapshotPath}`;

const regexCategorySidebarLabels: Record<string, string> = {
  'character-classes': 'Character classes',
  'approximate-partial-and-multipattern': 'Approximate & multi-pattern',
  'quantification-and-match-selection': 'Quantification & selection',
  'unicode-and-text-model': 'Unicode & text model',
  'diagnostics-resources-and-safety': 'Diagnostics & safety',
  'anchors-and-boundaries': 'Anchors & boundaries',
  'backreferences-recursion-and-conditionals': 'Backreferences & recursion',
  'backtracking-control-and-code': 'Backtracking control',
  'groups-and-captures': 'Groups & captures',
  'replacement-language': 'Replacement',
  'lookaround-assertions': 'Lookaround',
  'grammar-and-composition': 'Grammar & composition',
  'host-operations-and-results': 'Operations & results',
  'editor-cli-and-product-surfaces': 'Editor, CLI & product',
};

export function regexCategorySidebarLabel(category: RegexCategory): string {
  return (
    regexCategorySidebarLabels[category.semanticCategoryId] ?? category.name
  );
}

export function humanizeIdentifier(value: string): string {
  return value
    .replace(/^(feature|modifier|operation)\./, '')
    .replaceAll('-', ' ');
}

export function relationLabel(value: string): string {
  return value.replaceAll('-', ' ');
}
