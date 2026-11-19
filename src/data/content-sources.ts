import {
  fourthEdition,
  productRelease,
  releasePolicy,
  historicalSupportMatrix,
} from './release.ts';

export const contentSources = [
  {
    label: 'Official Fourth Edition release',
    url: productRelease,
    use: 'Public release identity, date, certified source, and certification closure. The release notes were written before independent public verification completed.',
  },
  {
    label: 'Release policy',
    url: releasePolicy,
    use: 'Authoritative product version and versioning rules at the certification closure.',
  },
  {
    label: 'Historical support matrix',
    url: historicalSupportMatrix,
    use: 'Governed binding tiers, runtime scopes, and native prerequisites at certification. The snapshot predates publication.',
  },
  {
    label: 'Independent public distribution verification',
    url: fourthEdition.verificationRun,
    use: 'Artifact and consumer evidence for the owner-approved initial publication routes.',
  },
  {
    label: 'Canonical compiler and bindings',
    url: 'https://github.com/strling-lang/strling',
    use: 'Public identity, 17 binding directories, Simply APIs, manifests, formal grammar, semantics, conformance fixtures, and Apache License 2.0.',
  },
  {
    label: 'Canonical generic regex semantics',
    url: 'https://github.com/strling-lang/regex-conformance/tree/main/semantic-corpus',
    use: 'Canonical regex feature identities, definitions, variants, manifestations, relations, operations, and source bindings. Certified empirical evidence will separately govern compatibility results once available.',
  },
  {
    label: 'Python binding history',
    url: 'https://github.com/strling-lang/STRling.py',
    use: 'Established Python package behavior and earlier public package line.',
  },
  {
    label: 'JavaScript binding history',
    url: 'https://github.com/strling-lang/STRling.js',
    use: 'Earlier JavaScript package behavior and project history.',
  },
  {
    label: 'Organization profile and shared mark',
    url: 'https://github.com/strling-lang/.github',
    use: 'Organization identity, contribution policy, and the remotely referenced silver bell logo.',
  },
  {
    label: 'Live registries',
    url: '/packages/',
    use: 'The binding directory links reviewed public registries and authenticated Git distribution routes.',
  },
] as const;
