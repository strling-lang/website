import {
  CheckpointValidationError,
  type CheckpointValidationIssue,
  type NormalizedCompatibilityFinding,
  type NormalizedCompatibilityProfile,
  type NormalizedLabProfile,
  type RegexConsumptionState,
  type RegexProduct,
  type ValidatedCheckpoint,
  type ValidatedCheckpointBundle,
} from './contracts.ts';

export function createEmptyConsumptionState(): RegexConsumptionState {
  return {
    schemaVersion: 'strling-regex-consumption-state-v1',
    lab: {
      lastConsumedCheckpoint: null,
      lastConsumedSequence: null,
      profiles: [],
    },
    compatibility: {
      lastConsumedCheckpoint: null,
      lastConsumedSequence: null,
      profiles: [],
      findings: [],
    },
  };
}

function cloneState(state: RegexConsumptionState): RegexConsumptionState {
  return structuredClone(state);
}

function pendingCheckpoints(
  bundle: ValidatedCheckpointBundle,
  state: RegexConsumptionState,
  product: RegexProduct,
): ValidatedCheckpoint[] {
  const cursor = state[product];
  if (cursor.lastConsumedCheckpoint === null) return bundle.checkpoints;
  const index = bundle.checkpoints.findIndex(
    (checkpoint) =>
      checkpoint.checkpointId === cursor.lastConsumedCheckpoint &&
      checkpoint.sequence === cursor.lastConsumedSequence,
  );
  if (index < 0) {
    const issue: CheckpointValidationIssue = {
      code: 'SKIPPED_PREDECESSOR',
      path: `${product}.lastConsumedCheckpoint`,
      message: `Cursor ${cursor.lastConsumedCheckpoint} is not present in the validated checkpoint chain.`,
    };
    throw new CheckpointValidationError([issue]);
  }
  return bundle.checkpoints.slice(index + 1);
}

function applyLabCheckpoint(
  profiles: NormalizedLabProfile[],
  checkpoint: ValidatedCheckpoint,
): NormalizedLabProfile[] {
  const byId = new Map(
    profiles.map((profile) => [profile.profileReleaseId, profile]),
  );
  const identityById = new Map(
    checkpoint.profileReleases.map((profile) => [
      profile.profileReleaseId,
      profile,
    ]),
  );
  for (const identity of checkpoint.profileReleases) {
    if (identity.labEligibility === 'ineligible') {
      byId.delete(identity.profileReleaseId);
    }
  }
  for (const projection of checkpoint.labProjection?.profiles ?? []) {
    const identity = identityById.get(projection.profileReleaseId);
    if (!identity) continue;
    byId.set(projection.profileReleaseId, {
      ...identity,
      ...projection,
      sourceCheckpointId: checkpoint.checkpointId,
    });
  }
  return [...byId.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

function applyCompatibilityCheckpoint(
  profiles: NormalizedCompatibilityProfile[],
  findings: NormalizedCompatibilityFinding[],
  checkpoint: ValidatedCheckpoint,
): {
  profiles: NormalizedCompatibilityProfile[];
  findings: NormalizedCompatibilityFinding[];
} {
  const profilesById = new Map(
    profiles.map((profile) => [profile.profileReleaseId, profile]),
  );
  const findingsById = new Map(
    findings.map((finding) => [
      `${finding.profileReleaseId}\u0000${finding.semanticFeatureId}`,
      finding,
    ]),
  );
  for (const identity of checkpoint.profileReleases) {
    if (identity.compatibilityPublication === 'withheld') {
      profilesById.delete(identity.profileReleaseId);
      for (const key of findingsById.keys()) {
        if (key.startsWith(`${identity.profileReleaseId}\u0000`)) {
          findingsById.delete(key);
        }
      }
    }
  }
  const published = new Set(
    checkpoint.compatibilityProjection?.publishedProfileReleaseIds ?? [],
  );
  for (const identity of checkpoint.profileReleases) {
    if (published.has(identity.profileReleaseId)) {
      profilesById.set(identity.profileReleaseId, {
        ...identity,
        sourceCheckpointId: checkpoint.checkpointId,
      });
    }
  }
  for (const finding of checkpoint.compatibilityProjection?.findings ?? []) {
    findingsById.set(
      `${finding.profileReleaseId}\u0000${finding.semanticFeatureId}`,
      {
        ...finding,
        sourceCheckpointId: checkpoint.checkpointId,
        sourceSemanticSnapshot: checkpoint.sourceSemanticSnapshot,
        evidenceManifest: checkpoint.evidenceManifestFile,
      },
    );
  }
  return {
    profiles: [...profilesById.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    ),
    findings: [...findingsById.values()].sort((left, right) =>
      `${left.semanticFeatureId}\u0000${left.profileReleaseId}`.localeCompare(
        `${right.semanticFeatureId}\u0000${right.profileReleaseId}`,
      ),
    ),
  };
}

export function consumeCheckpoints(
  current: RegexConsumptionState,
  bundle: ValidatedCheckpointBundle,
  product: RegexProduct,
): RegexConsumptionState {
  const next = cloneState(current);
  for (const checkpoint of pendingCheckpoints(bundle, next, product)) {
    if (product === 'lab') {
      next.lab.profiles = applyLabCheckpoint(next.lab.profiles, checkpoint);
      next.lab.lastConsumedCheckpoint = checkpoint.checkpointId;
      next.lab.lastConsumedSequence = checkpoint.sequence;
    } else {
      const compatibility = applyCompatibilityCheckpoint(
        next.compatibility.profiles,
        next.compatibility.findings,
        checkpoint,
      );
      next.compatibility.profiles = compatibility.profiles;
      next.compatibility.findings = compatibility.findings;
      next.compatibility.lastConsumedCheckpoint = checkpoint.checkpointId;
      next.compatibility.lastConsumedSequence = checkpoint.sequence;
    }
  }
  return next;
}
