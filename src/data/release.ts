export const fourthEdition = {
  name: 'Fourth Edition',
  version: '4.0.3',
  releaseDate: '2026-11-19',
  productSource: 'd01ac3785736ad552c90f00b4ca13c0e2e5c9c62',
  certificationClosure: 'eba5dad3de3fa620eb1ea13e0514d02f4b23e288',
  publicationRun:
    'https://github.com/strling-lang/strling/actions/runs/44567784868/attempts/2',
  verificationRun:
    'https://github.com/strling-lang/strling/actions/runs/44580786117/attempts/1',
} as const;

export const productRepository = 'https://github.com/strling-lang/strling';
export const productTag = `v${fourthEdition.version}`;
export const productRelease = `${productRepository}/releases/tag/${productTag}`;
export const releasePolicy = `${productRepository}/blob/${fourthEdition.certificationClosure}/governance/release-policy.json`;
export const supportMatrix = `${productRepository}/blob/${fourthEdition.certificationClosure}/docs/support-matrix.md#distribution-routes`;
export const releaseLabel = `STRling ${fourthEdition.version}`;
export const releaseSummary = `${releaseLabel} is the stable ${fourthEdition.name} release, published on ${fourthEdition.releaseDate}. Independent public verification covered the initial publication routes. C++ is available as a direct build, with ConanCenter admission deferred.`;
