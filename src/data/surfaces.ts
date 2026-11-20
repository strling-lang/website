export type SurfaceDomain = 'strling' | 'regex';
export type SurfaceStatus = 'available' | 'coming-soon';

export interface ProductSurface {
  id:
    | 'strling-docs'
    | 'strling-lab'
    | 'regex-docs'
    | 'regex-lab'
    | 'regex-compatibility';
  domain: SurfaceDomain;
  label: string;
  navigationLabel: string;
  route: string;
  status: SurfaceStatus;
  description: string;
  capabilities: readonly string[];
  scopeNote?: string;
}

export const surfaces = {
  strlingDocs: {
    id: 'strling-docs',
    domain: 'strling',
    label: 'STRling Docs',
    navigationLabel: 'Docs',
    route: '/docs/',
    status: 'available',
    description:
      'User documentation for STRling concepts, behavior, diagnostics, and portability.',
    capabilities: [],
  },
  strlingLab: {
    id: 'strling-lab',
    domain: 'strling',
    label: 'STRling Lab',
    navigationLabel: 'Lab',
    route: '/lab/',
    status: 'available',
    description:
      'A browser workspace for compiling STRling source, inspecting target artifacts, and testing eligible patterns.',
    capabilities: [
      'Compile Semantic STRling or Simply builder requests',
      'Inspect diagnostics, semantic IR, and generated artifacts',
      'Run eligible artifacts and compare results across revisions',
    ],
    scopeNote:
      'Compiler output and observations from browser execution have separate provenance.',
  },
  regexDocs: {
    id: 'regex-docs',
    domain: 'regex',
    label: 'RegEx Docs',
    navigationLabel: 'RegEx Docs',
    route: '/regex/docs/',
    status: 'available',
    description:
      'The canonical public catalog of regular-expression feature meaning, variants, manifestations, relationships, and source provenance.',
    capabilities: [
      'Feature meaning, syntax forms, examples, and semantics',
      'Variants, edge cases, and feature interactions',
      'Terminology and portability context',
    ],
    scopeNote:
      'Semantic definitions come from the reviewed Regex Conformance corpus. Empirical compatibility evidence remains a separate layer.',
  },
  regexLab: {
    id: 'regex-lab',
    domain: 'regex',
    label: 'RegEx Lab',
    navigationLabel: 'RegEx Lab',
    route: '/regex/lab/',
    status: 'available',
    description:
      'A browser workspace for testing raw regular expressions with JavaScript, PCRE2, or Python re.',
    capabilities: [
      'Enter a regular expression and use identified engine options or flags',
      'Test against sample text and inspect matches and ranges',
      'Inspect captures, named groups, and structured or raw result information',
    ],
    scopeNote:
      'Each run records the selected runtime and the results observed in this browser.',
  },
  regexCompatibility: {
    id: 'regex-compatibility',
    domain: 'regex',
    label: 'RegEx Compatibility Check',
    navigationLabel: 'Compatibility Check',
    route: '/regex/compatibility/',
    status: 'coming-soon',
    description:
      'An explorer for certified feature findings scoped to exact RegEx systems, versions, profiles, hosts, modes, and options.',
    capabilities: [
      'Select exact regex implementations, systems, and versions',
      'Account for profiles, hosts, modes, and options',
      'Determine available features or compare environments using certified Regex Conformance evidence',
    ],
    scopeNote:
      'Compatibility will be derived from certified evidence rather than manually maintained support tables. No unfinished conformance results are exposed here.',
  },
} as const satisfies Record<string, ProductSurface>;

export const strlingSurfaces = [
  surfaces.strlingDocs,
  surfaces.strlingLab,
] as const;

export const regexSurfaces = [
  surfaces.regexDocs,
  surfaces.regexLab,
  surfaces.regexCompatibility,
] as const;

export function surfaceStatusLabel(status: SurfaceStatus): string {
  return status === 'coming-soon' ? 'Coming soon' : 'Available';
}
