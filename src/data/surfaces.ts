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
      'Canonical user documentation for STRling concepts, behavior, diagnostics, and portability.',
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
      'An interactive workspace for writing STRling syntax, testing it against sample text, and seeing live matching behavior.',
    capabilities: [
      'Write STRling syntax and test it against sample text',
      'See live matching behavior',
      'Inspect returned matches, ranges, captures, named groups, and structured result data',
    ],
    scopeNote:
      'The first edition will focus on execution and observable results. Explanations, failure analysis, optimization, warnings, and intelligent guidance will come later.',
  },
  regexDocs: {
    id: 'regex-docs',
    domain: 'regex',
    label: 'RegEx Docs',
    navigationLabel: 'RegEx Docs',
    route: '/regex/docs/',
    status: 'coming-soon',
    description:
      'A comprehensive user-facing reference for governed regular-expression features known to exist in at least one regex system or profile.',
    capabilities: [
      'Feature meaning, syntax forms, examples, and semantics',
      'Variants, edge cases, and feature interactions',
      'Terminology and portability context',
    ],
    scopeNote:
      'The governed feature index will be audited and certified before this reference is populated. No speculative feature inventory is published here.',
  },
  regexLab: {
    id: 'regex-lab',
    domain: 'regex',
    label: 'RegEx Lab',
    navigationLabel: 'RegEx Lab',
    route: '/regex/lab/',
    status: 'coming-soon',
    description:
      'An interactive environment for testing regular expressions against sample text with an explicitly identified execution engine and profile.',
    capabilities: [
      'Enter a regular expression and use identified engine options or flags',
      'Test against sample text and inspect matches and ranges',
      'Inspect captures, named groups, and structured or raw result information',
    ],
    scopeNote:
      'Later versions may add portability warnings, explanations, optimization guidance, unsupported-feature warnings, and alternative formulations.',
  },
  regexCompatibility: {
    id: 'regex-compatibility',
    domain: 'regex',
    label: 'RegEx Compatibility Check',
    navigationLabel: 'Compatibility Check',
    route: '/regex/compatibility/',
    status: 'coming-soon',
    description:
      'An evidence-backed tool for comparing feature availability across exact regex systems, versions, profiles, hosts, modes, and options.',
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
