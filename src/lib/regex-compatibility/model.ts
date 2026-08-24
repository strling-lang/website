import type {
  CompatibilityScope,
  CompatibilityState,
  NormalizedCompatibilityFinding,
  NormalizedCompatibilityProfile,
} from '../regex-conformance/contracts.ts';

export interface CompatibilityCatalogFeature {
  semanticFeatureId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  route: string;
}

export type CompatibilityEvidenceAvailability = 'available' | 'not-provided';
export type CompatibilityFindingOrigin = 'checkpoint' | 'absent';

export interface CompatibilityCell {
  profileReleaseId: string;
  state: CompatibilityState;
  stateLabel: string;
  conditions: string[];
  explanation: string | null;
  testedScope: CompatibilityScope | null;
  evidenceAvailability: CompatibilityEvidenceAvailability;
  origin: CompatibilityFindingOrigin;
  finding: NormalizedCompatibilityFinding | null;
}

export interface CompatibilityFeatureRow {
  feature: CompatibilityCatalogFeature;
  cells: CompatibilityCell[];
}

export interface CompatibilityEvidenceDetails {
  profile: {
    displayName: string;
    profileId: string;
    releaseId: string;
    profileReleaseId: string;
    technicalLabel: string;
  };
  feature: CompatibilityCatalogFeature;
  state: CompatibilityState;
  stateLabel: string;
  conditions: string[];
  explanation: string;
  testedScope: CompatibilityScope | null;
  evidenceAvailability: CompatibilityEvidenceAvailability;
  evidence: {
    reference: string;
    digest: string;
    observationReferences: string[];
    derivedFindingReferences: string[];
  } | null;
  checkpointId: string | null;
  sourceSemanticSnapshot: { snapshotId: string; digest: string } | null;
  evidenceManifest: { path: string; digest: string } | null;
}

export interface CompatibilityStatePresentation {
  label: string;
  description: string;
  tone: 'positive' | 'negative' | 'qualified' | 'neutral' | 'pending';
}

export const compatibilityStatePresentation: Record<
  CompatibilityState,
  CompatibilityStatePresentation
> = {
  supported: {
    label: 'Supported',
    description: 'Certified evidence establishes support for the tested scope.',
    tone: 'positive',
  },
  unsupported: {
    label: 'Unsupported',
    description:
      'Certified evidence establishes rejection or lack of support for the tested scope.',
    tone: 'negative',
  },
  conditional: {
    label: 'Conditional',
    description: 'Support depends on the listed modes, options, or conditions.',
    tone: 'qualified',
  },
  'not-applicable': {
    label: 'Not applicable',
    description: 'The feature does not apply to the certified profile scope.',
    tone: 'neutral',
  },
  'not-tested': {
    label: 'Not tested',
    description: 'The checkpoint records that this scope was not tested.',
    tone: 'pending',
  },
  'unknown-insufficient-evidence': {
    label: 'Unknown / insufficient evidence',
    description: 'Available certified evidence does not establish a result.',
    tone: 'pending',
  },
};

function missingFindingCell(profileReleaseId: string): CompatibilityCell {
  const state = 'unknown-insufficient-evidence';
  return {
    profileReleaseId,
    state,
    stateLabel: compatibilityStatePresentation[state].label,
    conditions: [],
    explanation:
      'No certified compatibility finding is present for this exact feature and profile.',
    testedScope: null,
    evidenceAvailability: 'not-provided',
    origin: 'absent',
    finding: null,
  };
}

function findingCell(
  finding: NormalizedCompatibilityFinding,
): CompatibilityCell {
  return {
    profileReleaseId: finding.profileReleaseId,
    state: finding.state,
    stateLabel: compatibilityStatePresentation[finding.state].label,
    conditions: [...finding.conditions],
    explanation: finding.explanation,
    testedScope: finding.testedScope,
    evidenceAvailability: finding.evidence ? 'available' : 'not-provided',
    origin: 'checkpoint',
    finding,
  };
}

export function buildCompatibilityRows(
  catalog: readonly CompatibilityCatalogFeature[],
  profiles: readonly NormalizedCompatibilityProfile[],
  findings: readonly NormalizedCompatibilityFinding[],
  selectedProfileReleaseIds: readonly string[],
): CompatibilityFeatureRow[] {
  const published = new Set(
    profiles.map((profile) => profile.profileReleaseId),
  );
  const selected = selectedProfileReleaseIds.filter((profileReleaseId) =>
    published.has(profileReleaseId),
  );
  const byIdentity = new Map(
    findings.map((finding) => [
      `${finding.semanticFeatureId}\u0000${finding.profileReleaseId}`,
      finding,
    ]),
  );
  return catalog.map((feature) => ({
    feature,
    cells: selected.map((profileReleaseId) => {
      const finding = byIdentity.get(
        `${feature.semanticFeatureId}\u0000${profileReleaseId}`,
      );
      return finding
        ? findingCell(finding)
        : missingFindingCell(profileReleaseId);
    }),
  }));
}

export function filterCompatibilityRows(
  rows: readonly CompatibilityFeatureRow[],
  query: string,
  categoryId: string | null = null,
): CompatibilityFeatureRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (categoryId && row.feature.categoryId !== categoryId) return false;
    if (!normalizedQuery) return true;
    return [
      row.feature.name,
      row.feature.semanticFeatureId,
      row.feature.categoryName,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function compatibilityCoverage(
  rows: readonly CompatibilityFeatureRow[],
): { findingCount: number; evidenceCount: number; absentCount: number } {
  const cells = rows.flatMap((row) => row.cells);
  return {
    findingCount: cells.filter((cell) => cell.origin === 'checkpoint').length,
    evidenceCount: cells.filter(
      (cell) => cell.evidenceAvailability === 'available',
    ).length,
    absentCount: cells.filter((cell) => cell.origin === 'absent').length,
  };
}

export function compatibilityEvidenceDetails(
  row: CompatibilityFeatureRow,
  cell: CompatibilityCell,
  profile: NormalizedCompatibilityProfile,
): CompatibilityEvidenceDetails {
  const finding = cell.finding;
  return {
    profile: {
      displayName: profile.displayName,
      profileId: profile.profileId,
      releaseId: profile.releaseId,
      profileReleaseId: profile.profileReleaseId,
      technicalLabel: profile.technicalLabel,
    },
    feature: row.feature,
    state: cell.state,
    stateLabel: cell.stateLabel,
    conditions: [...cell.conditions],
    explanation:
      cell.explanation ??
      compatibilityStatePresentation[cell.state].description,
    testedScope: cell.testedScope,
    evidenceAvailability: cell.evidenceAvailability,
    evidence: finding?.evidence
      ? {
          reference: finding.evidence.reference,
          digest: finding.evidence.digest,
          observationReferences: [...finding.evidence.observationReferences],
          derivedFindingReferences: [
            ...finding.evidence.derivedFindingReferences,
          ],
        }
      : null,
    checkpointId: finding?.sourceCheckpointId ?? null,
    sourceSemanticSnapshot: finding
      ? { ...finding.sourceSemanticSnapshot }
      : null,
    evidenceManifest: finding
      ? {
          path: finding.evidenceManifest.path,
          digest: finding.evidenceManifest.digest,
        }
      : null,
  };
}
