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
    status: 'coming-soon',
    description:
      'A planned website workspace for writing STRling source and inspecting execution results.',
    capabilities: [
      'Write STRling syntax and test it against sample text',
      'See live matching behavior',
      'Inspect returned matches, ranges, captures, named groups, and structured result data',
    ],
    scopeNote:
      'Compilation and execution are unavailable in the website Lab. Use the downloadable examples to run the published compiler locally.',
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
    status: 'coming-soon',
    description:
      'An interface for running RegEx against sample text when a qualified execution engine and exact profile are configured.',
    capabilities: [
      'Enter a regular expression and use identified engine options or flags',
      'Test against sample text and inspect matches and ranges',
      'Inspect captures, named groups, and structured or raw result information',
    ],
    scopeNote:
      'Public execution is gated on a certified profile and an execution provider.',
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
