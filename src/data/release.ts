export const fourthEdition = {
  name: 'Fourth Edition',
  status: 'Pre-release',
  statusTone: 'prerelease' as const,
  version: null,
  releaseDate: null,
  summary:
    'The Fourth Edition is the next coordinated STRling edition. Its final version, date, package matrix, and migration guidance are not yet certified.',
  verifiedWork: [
    'A shared, readable Simply API is present across 17 language binding directories.',
    'The compiler repository includes a formal grammar, semantics, feature registry, and shared conformance fixtures.',
    'Target compatibility and structured diagnostics are represented in the public specification.',
    'Registry publication automation and source integration paths are being prepared across the ecosystem.',
  ],
  provisional: [
    'Final edition version and release date',
    'Certified binding-by-binding package availability',
    'Final migration guidance from earlier public packages',
    'Final compatibility guarantees for each target engine',
  ],
} as const;
