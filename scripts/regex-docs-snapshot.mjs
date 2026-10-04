import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export function snapshotDigest(snapshot) {
  const digest =
    snapshot.corpus_digest_sha256 ?? snapshot.snapshot_digest_sha256;
  if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest))
    throw new Error(
      'Canonical snapshot requires a valid SHA-256 semantic digest.',
    );
  return digest;
}

function snapshotPath(root, path) {
  const directory = resolve(root, 'semantic-corpus', 'snapshots');
  const absolute = resolve(root, path);
  if (!absolute.startsWith(`${directory}${sep}`) || !absolute.endsWith('.json'))
    throw new Error(`Invalid canonical snapshot reference: ${path}`);
  return absolute;
}

export async function readCanonicalSnapshot(path) {
  const snapshot = JSON.parse(await readFile(path, 'utf8'));
  snapshotDigest(snapshot);
  if (snapshot.schema_version === 'regex-semantic-corpus-v1') return snapshot;
  if (snapshot.schema_version !== 'regex-semantic-corpus.v4')
    throw new Error(
      `Unsupported canonical snapshot schema: ${snapshot.schema_version}`,
    );

  // v4 carries the predecessor's typed interactions by explicit reference.
  const reference = snapshot.carried_forward_by_reference?.typed_interactions;
  let interactions = [];
  if (reference) {
    const [referencedPath, fragment] = reference.split('#');
    if (fragment !== '/interactions')
      throw new Error(`Unsupported interaction reference: ${reference}`);
    const root = resolve(dirname(path), '..', '..');
    const predecessor = JSON.parse(
      await readFile(snapshotPath(root, referencedPath), 'utf8'),
    );
    interactions = predecessor.interactions;
    if (!Array.isArray(interactions))
      throw new Error(`Missing carried-forward interactions: ${reference}`);
  }
  for (const feature of snapshot.features) {
    for (const relation of feature.typed_relations) {
      if (!relation.target_id.startsWith('feature.')) continue;
      interactions.push({
        interaction_id: `${feature.feature_id}:${relation.relation_type}:${relation.target_id}`,
        source_id: feature.feature_id,
        target_id: relation.target_id,
        interaction_type: relation.relation_type,
      });
    }
  }

  const cutoff = snapshot.authority.cutoff;
  return {
    ...snapshot,
    corpus_digest_sha256: snapshotDigest(snapshot),
    cutoff_date: cutoff,
    interactions,
    features: snapshot.features.map((feature) => {
      const assertions = feature.semantic_assertions;
      const statement = (field) => {
        const assertion = assertions?.[field];
        if (
          !assertion?.statement ||
          !assertion.scope ||
          !assertion.source_ids?.length
        )
          throw new Error(
            `${feature.feature_id} requires source-bound ${field}.`,
          );
        return assertion.statement;
      };
      const sourceIds = [
        ...new Set([
          ...Object.values(assertions).flatMap(
            (assertion) => assertion.source_ids,
          ),
          ...feature.semantic_variants.flatMap(
            (variant) => variant.semantic_assertion.source_ids,
          ),
          ...(feature.test_concepts.source_ids ?? []),
        ]),
      ];
      return {
        ...feature,
        semantic_definition: statement('definition'),
        capture_result_semantics: statement('capture_result'),
        replacement_implications: statement('replacement'),
        unicode_encoding_implications: statement('unicode_encoding'),
        diagnostic_error_semantics: statement('diagnostic_error'),
        resource_termination_implications: statement('resource_termination'),
        option_state_dependencies: feature.modifier_ids,
        semantic_variants: feature.semantic_variants.map((variant) => ({
          ...variant,
          distinguishing_rule: variant.semantic_assertion.statement,
        })),
        test_concepts: Array.isArray(feature.test_concepts)
          ? feature.test_concepts
          : { ...feature.test_concepts, edge: feature.test_concepts.boundary },
        revision: feature.semantic_revision,
        provenance: {
          claim_scope: assertions.definition.scope,
          discovery_cutoff: cutoff,
          source_ids: sourceIds,
        },
        normative_reference_ids: [],
        implementation_reference_ids: [],
      };
    }),
  };
}
