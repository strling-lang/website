export const contentSources = [
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
    use: 'Current availability was checked against PyPI, npm, NuGet, Pub.dev, RubyGems, Packagist, and MetaCPAN during the site build.',
  },
] as const;
