import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import postcss from 'postcss';

const loadCommonJs = createRequire(import.meta.url);
const browserCompatData = loadCommonJs('@mdn/browser-compat-data');

export const supportedBrowsers = {
  chrome: '109',
  firefox: '115',
  safari: '16',
  safari_ios: '16',
};

const browserLabels = {
  chrome: 'Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
  safari_ios: 'Safari on iOS',
};

// MDN records legacy flexbox implementations as a support gap even though the
// current unprefixed value is supported across the project's browser floor.
const supportGapExceptions = new Set(['display:flex']);

// Touch-only iOS does not expose a mouse cursor, so cursor compatibility is not
// relevant there. The declaration remains useful for pointer-capable browsers.
const browserExceptions = new Map([
  ['cursor:pointer', new Set(['safari_ios'])],
]);

const browserPrefixes = {
  safari: '-webkit-',
  safari_ios: '-webkit-',
};

function numericVersion(version) {
  if (typeof version !== 'string') return null;
  const match = version.match(/\d+(?:\.\d+)*/);
  return match ? match[0].split('.').map(Number) : null;
}

function compareVersions(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function statementSupportsVersion(statement, targetVersion) {
  if (
    !statement ||
    statement.version_added === false ||
    statement.flags ||
    statement.prefix ||
    statement.alternative_name
  )
    return false;

  const added = numericVersion(statement.version_added);
  const target = numericVersion(targetVersion);
  if (!added || !target || compareVersions(added, target) > 0) return false;

  const removed = numericVersion(statement.version_removed);
  return !removed || compareVersions(target, removed) < 0;
}

function unsupportedBrowsers(compatibility) {
  return Object.entries(supportedBrowsers)
    .filter(([browser, version]) => {
      const support = compatibility.support[browser];
      const statements = Array.isArray(support) ? support : [support];
      return !statements.some((statement) =>
        statementSupportsVersion(statement, version),
      );
    })
    .map(([browser, version]) => ({ browser, version }));
}

function hasSupportGap(compatibility) {
  return Object.values(compatibility.support).some((support) => {
    const statements = Array.isArray(support) ? support : [support];
    return statements.some(
      (statement) =>
        statement &&
        !statement.prefix &&
        !statement.alternative_name &&
        statement.version_removed,
    );
  });
}

export function checkCssCompatibility(css, filename = '<css>') {
  const issues = [];
  const root = postcss.parse(css, { from: filename });

  root.walkDecls((declaration) => {
    if (
      declaration.prop.startsWith('--') ||
      declaration.prop.startsWith('-webkit-') ||
      declaration.prop.startsWith('-moz-')
    )
      return;

    const property = browserCompatData.css.properties[declaration.prop];
    if (!property?.__compat) return;

    const normalizedValue = declaration.value.trim().toLowerCase();
    const featureKey = `${declaration.prop}:${normalizedValue}`;
    const valueFeature = property[normalizedValue];
    const compatibility = valueFeature?.__compat ?? property.__compat;
    const unsupported = unsupportedBrowsers(compatibility).filter(
      ({ browser }) => {
        if (browserExceptions.get(featureKey)?.has(browser)) return false;

        const prefix = browserPrefixes[browser];
        if (!prefix) return true;
        return !declaration.parent.nodes.some(
          (node) =>
            node.type === 'decl' &&
            node.prop === `${prefix}${declaration.prop}` &&
            node.value === declaration.value &&
            node.source.start.line < declaration.source.start.line,
        );
      },
    );
    const supportGap = valueFeature?.__compat
      ? hasSupportGap(valueFeature.__compat) &&
        !supportGapExceptions.has(featureKey)
      : false;

    if (unsupported.length === 0 && !supportGap) return;

    const reasons = [];
    if (unsupported.length > 0)
      reasons.push(
        `unsupported by ${unsupported
          .map(({ browser, version }) => `${browserLabels[browser]} ${version}`)
          .join(', ')}`,
      );
    if (supportGap) reasons.push('has a known unprefixed browser-support gap');

    issues.push({
      column: declaration.source.start.column,
      file: filename,
      line: declaration.source.start.line,
      message: `${declaration.prop}: ${declaration.value} ${reasons.join(' and ')}`,
    });
  });

  return issues;
}

async function cssFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory())
      files.push(...(await cssFiles(new URL(`${entry.name}/`, directory))));
    else if (entry.name.endsWith('.css')) files.push(url);
  }
  return files;
}

export async function checkProjectCss(
  stylesDirectory = new URL('../src/styles/', import.meta.url),
) {
  const issues = [];
  for (const file of await cssFiles(stylesDirectory)) {
    const filename = fileURLToPath(file);
    issues.push(
      ...checkCssCompatibility(await readFile(file, 'utf8'), filename),
    );
  }
  return issues;
}

async function main() {
  const issues = await checkProjectCss();
  if (issues.length > 0) {
    console.error('CSS compatibility check FAILED\n');
    for (const issue of issues)
      console.error(
        `${issue.file}:${issue.line}:${issue.column} ${issue.message}`,
      );
    process.exitCode = 1;
    return;
  }

  console.log(
    `CSS compatibility check passed for ${Object.entries(supportedBrowsers)
      .map(([browser, version]) => `${browserLabels[browser]} ${version}+`)
      .join(', ')}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
