export const CHECKPOINT_INDEX_SCHEMA =
  'regex-conformance-downstream-index-v1' as const;
export const COVERAGE_CHECKPOINT_SCHEMA =
  'regex-conformance-coverage-checkpoint-v1' as const;
export const LAB_PROJECTION_SCHEMA =
  'regex-conformance-lab-projection-v1' as const;
export const COMPATIBILITY_PROJECTION_SCHEMA =
  'regex-conformance-compatibility-projection-v1' as const;
export const EVIDENCE_MANIFEST_SCHEMA =
  'regex-conformance-evidence-manifest-v1' as const;

export type Sha256Digest = `sha256:${string}`;
export type CompatibilityState =
  | 'supported'
  | 'unsupported'
  | 'conditional'
  | 'not-applicable'
  | 'not-tested'
  | 'unknown-insufficient-evidence';
export type RegexProduct = 'lab' | 'compatibility';

export interface SemanticSnapshotIdentity {
  snapshotId: string;
  digest: Sha256Digest;
}

export interface FileIdentity {
  fileId: string;
  path: string;
  digest: Sha256Digest;
}

export interface CheckpointIndexEntryV1 extends FileIdentity {
  sequence: number;
  checkpointId: string;
  previousCheckpointId: string | null;
}

export interface CheckpointIndexV1 {
  schemaVersion: typeof CHECKPOINT_INDEX_SCHEMA;
  sourceSemanticSnapshot: SemanticSnapshotIdentity;
  checkpoints: CheckpointIndexEntryV1[];
}

export interface ProfileDimensionValue {
  dimensionId: string;
  question: string;
  valueId: string;
  valueLabel: string;
  order: number;
}

export interface ProfileReleaseIdentity {
  profileId: string;
  releaseId: string;
  profileReleaseId: string;
  displayName: string;
  technicalLabel: string;
  dimensions: ProfileDimensionValue[];
  labEligibility: 'eligible' | 'ineligible';
  compatibilityPublication: 'published' | 'withheld';
}

export interface CoverageCheckpointV1 {
  schemaVersion: typeof COVERAGE_CHECKPOINT_SCHEMA;
  sequence: number;
  checkpointId: string;
  previousCheckpointId: string | null;
  sourceSemanticSnapshot: SemanticSnapshotIdentity;
  profileReleases: ProfileReleaseIdentity[];
  projections: {
    lab: FileIdentity | null;
    compatibility: FileIdentity | null;
  };
  evidenceManifest: FileIdentity;
}

export interface LabOperationDefinition {
  operationId: string;
  label: string;
  description: string;
}

export interface LabOptionChoice {
  value: string;
  label: string;
}

export interface LabOptionDefinition {
  optionId: string;
  label: string;
  kind: 'boolean' | 'choice';
  defaultValue: boolean | string;
  choices?: LabOptionChoice[];
}

export interface LabProfileProjection {
  profileReleaseId: string;
  operations: LabOperationDefinition[];
  options: LabOptionDefinition[];
  nativeIndexUnit: string;
}

export interface LabProjectionV1 {
  schemaVersion: typeof LAB_PROJECTION_SCHEMA;
  checkpointId: string;
  sourceSemanticSnapshot: SemanticSnapshotIdentity;
  profiles: LabProfileProjection[];
}

export interface CompatibilityEvidenceReference {
  evidenceId: string;
  reference: string;
  digest: Sha256Digest;
  observationReferences: string[];
  derivedFindingReferences: string[];
}

export interface CompatibilityScope {
  operationId: string;
  mode: string | null;
  options: Record<string, boolean | string | number | null>;
}

export interface CompatibilityFindingProjection {
  profileReleaseId: string;
  semanticFeatureId: string;
  state: CompatibilityState;
  conditions: string[];
  explanation: string | null;
  testedScope: CompatibilityScope | null;
  evidence: CompatibilityEvidenceReference | null;
}

export interface CompatibilityProjectionV1 {
  schemaVersion: typeof COMPATIBILITY_PROJECTION_SCHEMA;
  checkpointId: string;
  sourceSemanticSnapshot: SemanticSnapshotIdentity;
  publishedProfileReleaseIds: string[];
  findings: CompatibilityFindingProjection[];
}

export interface EvidenceManifestV1 {
  schemaVersion: typeof EVIDENCE_MANIFEST_SCHEMA;
  checkpointId: string;
  evidence: Array<{
    evidenceId: string;
    reference: string;
    digest: Sha256Digest;
  }>;
}

export interface RawCheckpointBundle {
  index: unknown;
  files: Record<string, unknown>;
}

export interface ValidatedCheckpoint {
  sequence: number;
  checkpointId: string;
  previousCheckpointId: string | null;
  sourceSemanticSnapshot: SemanticSnapshotIdentity;
  checkpointFile: FileIdentity;
  profileReleases: ProfileReleaseIdentity[];
  projectionFiles: {
    lab: FileIdentity | null;
    compatibility: FileIdentity | null;
  };
  evidenceManifestFile: FileIdentity;
  labProjection: LabProjectionV1 | null;
  compatibilityProjection: CompatibilityProjectionV1 | null;
  evidenceManifest: EvidenceManifestV1;
}

export interface ValidatedCheckpointBundle {
  sourceSemanticSnapshot: SemanticSnapshotIdentity;
  checkpoints: ValidatedCheckpoint[];
}

export interface ConsumptionCursor {
  lastConsumedCheckpoint: string | null;
  lastConsumedSequence: number | null;
}

export interface NormalizedLabProfile
  extends ProfileReleaseIdentity, LabProfileProjection {
  sourceCheckpointId: string;
}

export interface NormalizedCompatibilityFinding extends CompatibilityFindingProjection {
  sourceCheckpointId: string;
  sourceSemanticSnapshot: SemanticSnapshotIdentity;
  evidenceManifest: FileIdentity;
}

export interface NormalizedCompatibilityProfile extends ProfileReleaseIdentity {
  sourceCheckpointId: string;
}

export interface RegexConsumptionState {
  schemaVersion: 'strling-regex-consumption-state-v1';
  lab: ConsumptionCursor & { profiles: NormalizedLabProfile[] };
  compatibility: ConsumptionCursor & {
    profiles: NormalizedCompatibilityProfile[];
    findings: NormalizedCompatibilityFinding[];
  };
}

export type CheckpointValidationIssueCode =
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'BROKEN_SEQUENCE'
  | 'SKIPPED_PREDECESSOR'
  | 'DUPLICATE_CHECKPOINT'
  | 'DIGEST_MISMATCH'
  | 'MISSING_REFERENCED_FILE'
  | 'SEMANTIC_SNAPSHOT_INCOMPATIBLE'
  | 'DUPLICATE_PROFILE_IDENTITY'
  | 'CONFLICTING_PROFILE_IDENTITY'
  | 'MALFORMED_COMPATIBILITY_STATE'
  | 'MALFORMED_DOCUMENT';

export interface CheckpointValidationIssue {
  code: CheckpointValidationIssueCode;
  path: string;
  message: string;
}

export class CheckpointValidationError extends Error {
  readonly issues: CheckpointValidationIssue[];

  constructor(issues: CheckpointValidationIssue[]) {
    super(issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
    this.name = 'CheckpointValidationError';
    this.issues = issues;
  }
}
