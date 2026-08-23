import { access, readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const expectedGeneration = {
  format: 'strling-regex-docs-projection',
  version: 1,
};

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith('--')) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      options[argument.slice(2)] = true;
      continue;
    }
    options[argument.slice(2)] = value;
    index += 1;
  }
  return options;
}

const unique = (values) => [...new Set(values)];
const countBy = (values) =>
  values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
const duplicates = (values) =>
  Object.entries(countBy(values))
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
const difference = (left, right) =>
  unique(left)
    .filter((value) => !new Set(right).has(value))
    .sort();
const normalizePath = (path) => path.split(sep).join('/');
const routeFor = (categoryId, featureId) =>
  `/regex/docs/${categoryId}/${featureId.replace(/^feature\./, '')}/`;

function addIssue(issues, code, message, details = []) {
  issues.push({ code, message, details: [...details] });
}

export function canonicalFromLock(lock) {
  return {
    kind: 'reviewed-lock',
    digest: lock.source.semanticDigest,
    snapshotPath: lock.source.snapshotPath,
    features: lock.reviewedFeatures.map((feature) => ({
      id: feature.semanticFeatureId,
      name: feature.canonicalName,
      categoryId: feature.semanticCategoryId,
    })),
  };
}

export function canonicalFromSnapshot(snapshot, snapshotPath = undefined) {
  return {
    kind: 'upstream-snapshot',
    digest: snapshot.corpus_digest_sha256,
    snapshotPath,
    declaredFeatureCount: snapshot.counts?.canonical_features,
    features: snapshot.features.map((feature) => ({
      id: feature.feature_id,
      name: feature.canonical_name,
      categoryId: feature.category,
    })),
  };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function verifyRenderedRoutes(distDirectory, canonical) {
  const issues = [];
  const renderedFeatureIds = [];
  const renderedCategoryIds = [];
  const docsRoot = resolve(distDirectory, 'regex', 'docs');
  if (!(await exists(resolve(docsRoot, 'index.html')))) {
    addIssue(
      issues,
      'RENDERED_CATALOG_MISSING',
      'Rendered Regex Feature Catalog index is missing.',
    );
    return { issues, renderedFeatureIds, renderedCategoryIds };
  }

  const expectedFeatureRoutes = new Set(
    canonical.features.map((feature) =>
      routeFor(feature.categoryId, feature.id),
    ),
  );
  const expectedCategories = new Set(
    canonical.features.map((feature) => feature.categoryId),
  );

  for (const categoryId of expectedCategories) {
    const categoryFile = resolve(docsRoot, categoryId, 'index.html');
    if (!(await exists(categoryFile))) {
      addIssue(
        issues,
        'RENDERED_CATEGORY_MISSING',
        `Rendered category page is missing: ${categoryId}`,
        [categoryId],
      );
      continue;
    }
    const html = await readFile(categoryFile, 'utf8');
    if (!html.includes(`data-semantic-category-id="${categoryId}"`)) {
      addIssue(
        issues,
        'RENDERED_CATEGORY_METADATA_MISSING',
        `Rendered category metadata is missing: ${categoryId}`,
        [categoryId],
      );
    } else renderedCategoryIds.push(categoryId);
  }

  for (const feature of canonical.features) {
    const path = resolve(
      docsRoot,
      feature.categoryId,
      feature.id.replace(/^feature\./, ''),
      'index.html',
    );
    if (!(await exists(path))) {
      addIssue(
        issues,
        'RENDERED_FEATURE_MISSING',
        `Rendered feature page is missing: ${feature.id}`,
        [feature.id],
      );
      continue;
    }
    const html = await readFile(path, 'utf8');
    if (!html.includes(`data-semantic-feature-id="${feature.id}"`)) {
      addIssue(
        issues,
        'RENDERED_FEATURE_METADATA_MISSING',
        `Rendered feature metadata is missing: ${feature.id}`,
        [feature.id],
      );
    } else renderedFeatureIds.push(feature.id);
  }

  if (await exists(docsRoot)) {
    const categoryEntries = await readdir(docsRoot, { withFileTypes: true });
    for (const categoryEntry of categoryEntries.filter((entry) =>
      entry.isDirectory(),
    )) {
      const categoryDirectory = resolve(docsRoot, categoryEntry.name);
      const featureEntries = await readdir(categoryDirectory, {
        withFileTypes: true,
      });
      for (const featureEntry of featureEntries.filter((entry) =>
        entry.isDirectory(),
      )) {
        const route = `/regex/docs/${categoryEntry.name}/${featureEntry.name}/`;
        if (!expectedFeatureRoutes.has(route)) {
          addIssue(
            issues,
            'RENDERED_FEATURE_UNEXPECTED',
            `Unexpected rendered feature route: ${route}`,
            [route],
          );
        }
      }
    }
  }

  return { issues, renderedFeatureIds, renderedCategoryIds };
}

export async function verifyCoverage({
  canonical,
  lock,
  projection,
  distDirectory,
}) {
  const issues = [];
  const canonicalIds = canonical.features.map((feature) => feature.id);
  const canonicalCategoryIds = unique(
    canonical.features.map((feature) => feature.categoryId),
  ).sort();
  const lockIds = lock.reviewedFeatures.map(
    (feature) => feature.semanticFeatureId,
  );
  const lockCategoryIds = lock.reviewedCategories.map(
    (category) => category.semanticCategoryId,
  );
  const websiteIds = projection.features.map(
    (feature) => feature.semanticFeatureId,
  );
  const websiteCategoryIds = projection.categories.map(
    (category) => category.semanticCategoryId,
  );

  for (const [label, generation] of [
    ['source lock', lock.generation],
    ['documentation projection', projection.generation],
  ]) {
    if (
      generation?.format !== expectedGeneration.format ||
      generation?.version !== expectedGeneration.version
    )
      addIssue(
        issues,
        'GENERATION_FORMAT_MISMATCH',
        `${label} uses an unsupported generation format or version.`,
      );
  }

  if (canonical.declaredFeatureCount !== undefined) {
    if (canonical.declaredFeatureCount !== canonical.features.length)
      addIssue(
        issues,
        'CANONICAL_DECLARED_COUNT_MISMATCH',
        `Canonical snapshot declares ${canonical.declaredFeatureCount} features but contains ${canonical.features.length}.`,
      );
  }

  if (lock.source.semanticDigest !== canonical.digest)
    addIssue(
      issues,
      'CANONICAL_DIGEST_CHANGED',
      'Canonical semantic digest differs from the reviewed website lock.',
      [`old: ${lock.source.semanticDigest}`, `new: ${canonical.digest}`],
    );
  if (projection.source.semanticDigest !== lock.source.semanticDigest)
    addIssue(
      issues,
      'WEBSITE_DIGEST_MISMATCH',
      'Documentation projection semantic digest differs from the reviewed source lock.',
      [
        `lock: ${lock.source.semanticDigest}`,
        `docs: ${projection.source.semanticDigest}`,
      ],
    );
  if (
    canonical.snapshotPath &&
    canonical.snapshotPath !== lock.source.snapshotPath
  )
    addIssue(
      issues,
      'CANONICAL_SNAPSHOT_CHANGED',
      'Promoted canonical snapshot path differs from the reviewed website lock.',
      [`old: ${lock.source.snapshotPath}`, `new: ${canonical.snapshotPath}`],
    );

  const missingLockFeatures = difference(canonicalIds, lockIds);
  const staleLockFeatures = difference(lockIds, canonicalIds);
  if (missingLockFeatures.length)
    addIssue(
      issues,
      'LOCK_MISSING_FEATURES',
      'Reviewed source lock is missing canonical features.',
      missingLockFeatures,
    );
  if (staleLockFeatures.length)
    addIssue(
      issues,
      'LOCK_UNEXPECTED_FEATURES',
      'Reviewed source lock contains features absent upstream.',
      staleLockFeatures,
    );

  const missingLockCategories = difference(
    canonicalCategoryIds,
    lockCategoryIds,
  );
  const staleLockCategories = difference(lockCategoryIds, canonicalCategoryIds);
  if (missingLockCategories.length)
    addIssue(
      issues,
      'LOCK_MISSING_CATEGORIES',
      'Reviewed source lock is missing canonical categories.',
      missingLockCategories,
    );
  if (staleLockCategories.length)
    addIssue(
      issues,
      'LOCK_UNEXPECTED_CATEGORIES',
      'Reviewed source lock contains categories absent upstream.',
      staleLockCategories,
    );

  const lockById = new Map(
    lock.reviewedFeatures.map((feature) => [
      feature.semanticFeatureId,
      feature,
    ]),
  );
  const canonicalById = new Map(
    canonical.features.map((feature) => [feature.id, feature]),
  );
  for (const [id, canonicalFeature] of canonicalById) {
    const locked = lockById.get(id);
    if (!locked) continue;
    if (locked.canonicalName !== canonicalFeature.name)
      addIssue(
        issues,
        'CANONICAL_FEATURE_RENAMED',
        `Canonical feature name changed: ${id}`,
        [`old: ${locked.canonicalName}`, `new: ${canonicalFeature.name}`],
      );
    if (locked.semanticCategoryId !== canonicalFeature.categoryId)
      addIssue(
        issues,
        'UPSTREAM_CATEGORY_MOVE',
        `Canonical feature changed category: ${id}`,
        [
          `old: ${locked.semanticCategoryId}`,
          `new: ${canonicalFeature.categoryId}`,
        ],
      );
  }

  const missingCategories = difference(
    canonicalCategoryIds,
    websiteCategoryIds,
  );
  const unexpectedCategories = difference(
    websiteCategoryIds,
    canonicalCategoryIds,
  );
  if (missingCategories.length)
    addIssue(
      issues,
      'WEBSITE_MISSING_CATEGORIES',
      'Website documentation is missing canonical categories.',
      missingCategories,
    );
  if (unexpectedCategories.length)
    addIssue(
      issues,
      'WEBSITE_UNEXPECTED_CATEGORIES',
      'Website documentation contains noncanonical categories.',
      unexpectedCategories,
    );

  const duplicateCategoryIds = duplicates(websiteCategoryIds);
  if (duplicateCategoryIds.length)
    addIssue(
      issues,
      'DUPLICATE_CATEGORY_IDS',
      'Website documentation contains duplicate category IDs.',
      duplicateCategoryIds,
    );

  const missingFeatures = difference(canonicalIds, websiteIds);
  const unexpectedFeatures = difference(websiteIds, canonicalIds);
  const duplicateFeatureIds = duplicates(websiteIds);
  if (missingFeatures.length)
    addIssue(
      issues,
      'WEBSITE_MISSING_FEATURES',
      'Missing website documentation.',
      missingFeatures,
    );
  if (unexpectedFeatures.length)
    addIssue(
      issues,
      'WEBSITE_UNEXPECTED_FEATURES',
      'Website documentation contains noncanonical features.',
      unexpectedFeatures,
    );
  if (duplicateFeatureIds.length)
    addIssue(
      issues,
      'DUPLICATE_FEATURE_IDS',
      'Website documentation contains duplicate canonical feature IDs.',
      duplicateFeatureIds,
    );

  const websiteById = new Map();
  for (const feature of projection.features) {
    if (!websiteById.has(feature.semanticFeatureId))
      websiteById.set(feature.semanticFeatureId, feature);
  }
  const categoryMismatches = [];
  const renamedWebsiteFeatures = [];
  for (const [id, canonicalFeature] of canonicalById) {
    const websiteFeature = websiteById.get(id);
    if (!websiteFeature) continue;
    if (websiteFeature.semanticCategoryId !== canonicalFeature.categoryId)
      categoryMismatches.push(
        `${id}: canonical=${canonicalFeature.categoryId}, website=${websiteFeature.semanticCategoryId}`,
      );
    if (websiteFeature.canonicalName !== canonicalFeature.name)
      renamedWebsiteFeatures.push(
        `${id}: canonical=${canonicalFeature.name}, website=${websiteFeature.canonicalName}`,
      );
  }
  if (categoryMismatches.length)
    addIssue(
      issues,
      'CATEGORY_MISMATCHES',
      'Website features are assigned to the wrong canonical category.',
      categoryMismatches,
    );
  if (renamedWebsiteFeatures.length)
    addIssue(
      issues,
      'WEBSITE_FEATURE_NAME_MISMATCHES',
      'Website canonical feature names differ from the canonical index.',
      renamedWebsiteFeatures,
    );

  const categoryCounts = countBy(
    projection.features.map((feature) => feature.semanticCategoryId),
  );
  const canonicalCategoryCounts = countBy(
    canonical.features.map((feature) => feature.categoryId),
  );
  const categoryCountMismatches = [];
  for (const category of projection.categories) {
    const actual = categoryCounts[category.semanticCategoryId] ?? 0;
    const canonicalCount =
      canonicalCategoryCounts[category.semanticCategoryId] ?? 0;
    if (
      category.featureCount !== actual ||
      category.featureCount !== canonicalCount
    )
      categoryCountMismatches.push(
        `${category.semanticCategoryId}: canonical=${canonicalCount}, declared=${category.featureCount}, docs=${actual}`,
      );
  }
  if (categoryCountMismatches.length)
    addIssue(
      issues,
      'CATEGORY_COUNT_MISMATCHES',
      'Category feature counts differ.',
      categoryCountMismatches,
    );

  const requiredMetadataFailures = [];
  const routeFailures = [];
  const relationFailures = [];
  for (const feature of projection.features) {
    const requiredStrings = [
      'semanticFeatureId',
      'semanticCategoryId',
      'canonicalName',
      'sourceSemanticDigest',
      'semanticDefinition',
      'route',
      'slug',
    ];
    const requiredArrays = [
      'aliases',
      'relatedFeatures',
      'featureRelations',
      'manifestations',
      'prerequisiteFeatureIds',
      'modifiers',
      'operations',
      'authoritativeSources',
    ];
    for (const field of requiredStrings) {
      if (typeof feature[field] !== 'string' || !feature[field].trim())
        requiredMetadataFailures.push(`${feature.semanticFeatureId}: ${field}`);
    }
    for (const field of requiredArrays) {
      if (!Array.isArray(feature[field]))
        requiredMetadataFailures.push(`${feature.semanticFeatureId}: ${field}`);
    }
    if (!feature.testConcepts?.positive || !feature.testConcepts?.negative)
      requiredMetadataFailures.push(
        `${feature.semanticFeatureId}: testConcepts`,
      );
    if (!feature.authoritativeSources?.length)
      requiredMetadataFailures.push(
        `${feature.semanticFeatureId}: authoritativeSources is empty`,
      );
    if (feature.sourceSemanticDigest !== lock.source.semanticDigest)
      requiredMetadataFailures.push(
        `${feature.semanticFeatureId}: sourceSemanticDigest`,
      );
    const expectedRoute = routeFor(
      feature.semanticCategoryId,
      feature.semanticFeatureId,
    );
    if (feature.route !== expectedRoute)
      routeFailures.push(
        `${feature.semanticFeatureId}: expected=${expectedRoute}, actual=${feature.route}`,
      );
    for (const relatedId of unique([
      ...(feature.relatedFeatures ?? []),
      ...(feature.prerequisiteFeatureIds ?? []),
      ...(feature.featureRelations ?? []).map(
        (relation) => relation.targetFeatureId,
      ),
    ])) {
      if (!canonicalById.has(relatedId))
        relationFailures.push(`${feature.semanticFeatureId} -> ${relatedId}`);
    }
  }
  if (requiredMetadataFailures.length)
    addIssue(
      issues,
      'REQUIRED_METADATA_MISSING',
      'Required feature documentation metadata is absent or invalid.',
      requiredMetadataFailures,
    );
  if (routeFailures.length)
    addIssue(
      issues,
      'BROKEN_CANONICAL_FEATURE_LINKS',
      'Canonical feature routes are invalid.',
      routeFailures,
    );
  if (duplicates(projection.features.map((feature) => feature.route)).length)
    addIssue(
      issues,
      'DUPLICATE_FEATURE_ROUTES',
      'Multiple features resolve to the same route.',
      duplicates(projection.features.map((feature) => feature.route)),
    );
  if (relationFailures.length)
    addIssue(
      issues,
      'BROKEN_RELATED_FEATURE_REFERENCES',
      'Related-feature references point to nonexistent canonical IDs.',
      relationFailures,
    );

  for (const category of projection.categories) {
    for (const relatedId of category.relatedCategoryIds ?? []) {
      if (!canonicalCategoryIds.includes(relatedId))
        addIssue(
          issues,
          'BROKEN_RELATED_CATEGORY_REFERENCE',
          `${category.semanticCategoryId} references missing category ${relatedId}.`,
          [relatedId],
        );
    }
  }

  let rendered = {
    issues: [],
    renderedFeatureIds: [],
    renderedCategoryIds: [],
  };
  if (distDirectory) {
    rendered = await verifyRenderedRoutes(distDirectory, canonical);
    issues.push(...rendered.issues);
  }

  return {
    ok: issues.length === 0,
    issues,
    stats: {
      canonicalCategories: canonicalCategoryIds.length,
      websiteCategories: websiteCategoryIds.length,
      missingCategories: missingCategories.length,
      unexpectedCategories: unexpectedCategories.length,
      canonicalFeatures: canonical.features.length,
      websiteFeatures: projection.features.length,
      missingFeatures: missingFeatures.length,
      unexpectedFeatures: unexpectedFeatures.length,
      duplicateFeatureIds: duplicateFeatureIds.length,
      categoryMismatches: categoryMismatches.length,
      brokenRelations: relationFailures.length,
      renderedFeatures: rendered.renderedFeatureIds.length,
      renderedCategories: rendered.renderedCategoryIds.length,
      digest: canonical.digest,
    },
  };
}

async function discoverCanonicalSnapshot(root) {
  const snapshotDirectory = resolve(root, 'semantic-corpus', 'snapshots');
  const entries = await readdir(snapshotDirectory, { withFileTypes: true });
  const snapshots = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(
        /^regex-semantic-features-(\d{4}-\d{2}-\d{2})\.v(\d+)\.json$/,
      );
      return match
        ? { name: entry.name, date: match[1], version: Number(match[2]) }
        : undefined;
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date) || b.version - a.version);
  if (!snapshots[0])
    throw new Error(
      `No canonical semantic snapshot found in ${snapshotDirectory}.`,
    );
  return {
    path: resolve(snapshotDirectory, snapshots[0].name),
    snapshotPath: `semantic-corpus/snapshots/${snapshots[0].name}`,
  };
}

function printFailure(result, lock) {
  console.error('Regex documentation coverage FAILED\n');
  const digestIssue = result.issues.find(
    (issue) => issue.code === 'CANONICAL_DIGEST_CHANGED',
  );
  if (digestIssue) {
    console.error('Canonical semantic digest changed:');
    console.error(`old: ${lock.source.semanticDigest}`);
    console.error(`new: ${result.stats.digest}\n`);
  }
  console.error(`Canonical features: ${result.stats.canonicalFeatures}`);
  console.error(`Website docs:       ${result.stats.websiteFeatures}\n`);
  for (const issue of result.issues) {
    console.error(`${issue.message}`);
    for (const detail of issue.details.slice(0, 50))
      console.error(`  ${detail}`);
    if (issue.details.length > 50)
      console.error(`  …and ${issue.details.length - 50} more`);
    console.error('');
  }
  console.error(
    'Update the Regex Feature Catalog and reviewed source lock, then rerun npm run check:regex-docs.',
  );
}

function printPass(result, mode, distChecked) {
  const stats = result.stats;
  console.log('REGEX FEATURE DOCUMENTATION COVERAGE: PASS\n');
  console.log(`Canonical semantic digest: ${stats.digest}`);
  console.log(`Canonical categories: ${stats.canonicalCategories}`);
  console.log(`Website categories: ${stats.websiteCategories}`);
  console.log(`Canonical features: ${stats.canonicalFeatures}`);
  console.log(`Website feature pages: ${stats.websiteFeatures}\n`);
  console.log(`Missing categories: ${stats.missingCategories}`);
  console.log(`Missing features: ${stats.missingFeatures}`);
  console.log(`Unexpected features: ${stats.unexpectedFeatures}`);
  console.log(`Duplicate IDs: ${stats.duplicateFeatureIds}`);
  console.log(`Category mismatches: ${stats.categoryMismatches}`);
  console.log(`Broken canonical relations: ${stats.brokenRelations}\n`);
  console.log(`Local coverage gate: PASS`);
  if (mode === 'upstream') console.log('Upstream freshness gate: PASS');
  if (distChecked)
    console.log(
      `Rendered route gate: PASS (${stats.renderedCategories} categories, ${stats.renderedFeatures} features)`,
    );
}

const isDirect =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  const options = parseArgs(process.argv.slice(2));
  const lock = JSON.parse(
    await readFile(
      resolve(options.lock ?? 'src/data/regex-docs/source-lock.json'),
      'utf8',
    ),
  );
  const projection = JSON.parse(
    await readFile(
      resolve(options.docs ?? 'src/data/regex-docs/projection.json'),
      'utf8',
    ),
  );
  let canonical;
  let mode = 'local';
  if (options['canonical-root']) {
    const discovered = await discoverCanonicalSnapshot(
      resolve(options['canonical-root']),
    );
    const snapshot = JSON.parse(await readFile(discovered.path, 'utf8'));
    canonical = canonicalFromSnapshot(snapshot, discovered.snapshotPath);
    mode = 'upstream';
  } else if (options.canonical) {
    const canonicalPath = resolve(options.canonical);
    const snapshot = JSON.parse(await readFile(canonicalPath, 'utf8'));
    const marker = `${sep}semantic-corpus${sep}`;
    const index = canonicalPath.lastIndexOf(marker);
    const snapshotPath =
      index === -1
        ? normalizePath(relative(resolve('.'), canonicalPath))
        : normalizePath(canonicalPath.slice(index + 1));
    canonical = canonicalFromSnapshot(snapshot, snapshotPath);
    mode = 'upstream';
  } else canonical = canonicalFromLock(lock);

  const result = await verifyCoverage({
    canonical,
    lock,
    projection,
    distDirectory: options.dist ? resolve(options.dist) : undefined,
  });
  if (!result.ok) {
    printFailure(result, lock);
    process.exitCode = 1;
  } else printPass(result, mode, Boolean(options.dist));
}
