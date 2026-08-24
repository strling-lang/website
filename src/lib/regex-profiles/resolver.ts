import type {
  ProfileDimensionValue,
  ProfileReleaseIdentity,
} from '../regex-conformance/contracts.ts';

export type ProfileSelections = Readonly<Record<string, string>>;

export interface ResolverOption {
  valueId: string;
  valueLabel: string;
  candidateCount: number;
}

export interface ResolverQuestion {
  dimensionId: string;
  question: string;
  order: number;
  options: ResolverOption[];
}

export interface ImpliedProfileAnswer {
  dimensionId: string;
  question: string;
  valueId: string;
  valueLabel: string;
  order: number;
}

export interface ProfileResolverState<
  TProfile extends ProfileReleaseIdentity = ProfileReleaseIdentity,
> {
  selections: Record<string, string>;
  candidates: TProfile[];
  impliedAnswers: ImpliedProfileAnswer[];
  nextQuestion: ResolverQuestion | null;
  resolvedProfile: TProfile | null;
  ambiguousProfiles: TProfile[];
  invalidSelection: { dimensionId: string; valueId: string } | null;
}

interface DimensionDefinition {
  dimensionId: string;
  question: string;
  order: number;
}

function profileDimension(
  profile: ProfileReleaseIdentity,
  dimensionId: string,
): ProfileDimensionValue | undefined {
  return profile.dimensions.find(
    (dimension) => dimension.dimensionId === dimensionId,
  );
}

function validateDimensionMetadata(
  profiles: readonly ProfileReleaseIdentity[],
): Map<string, DimensionDefinition> {
  const definitions = new Map<string, DimensionDefinition>();
  for (const profile of profiles) {
    const profileDimensions = new Set<string>();
    for (const dimension of profile.dimensions) {
      if (profileDimensions.has(dimension.dimensionId)) {
        throw new Error(
          `Profile ${profile.profileReleaseId} repeats dimension ${dimension.dimensionId}.`,
        );
      }
      profileDimensions.add(dimension.dimensionId);
      const existing = definitions.get(dimension.dimensionId);
      if (existing && existing.question !== dimension.question) {
        throw new Error(
          `Dimension ${dimension.dimensionId} has conflicting question metadata.`,
        );
      }
      definitions.set(dimension.dimensionId, {
        dimensionId: dimension.dimensionId,
        question: dimension.question,
        order: Math.min(existing?.order ?? dimension.order, dimension.order),
      });
    }
  }
  return definitions;
}

function filterCandidates<TProfile extends ProfileReleaseIdentity>(
  profiles: readonly TProfile[],
  selections: ProfileSelections,
): TProfile[] {
  return profiles.filter((profile) =>
    Object.entries(selections).every(
      ([dimensionId, valueId]) =>
        profileDimension(profile, dimensionId)?.valueId === valueId,
    ),
  );
}

function availableDimensions<TProfile extends ProfileReleaseIdentity>(
  candidates: readonly TProfile[],
  definitions: ReadonlyMap<string, DimensionDefinition>,
  selections: ProfileSelections,
): DimensionDefinition[] {
  return [...definitions.values()]
    .filter(
      (definition) =>
        selections[definition.dimensionId] === undefined &&
        candidates.every((profile) =>
          profileDimension(profile, definition.dimensionId),
        ),
    )
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.dimensionId.localeCompare(right.dimensionId),
    );
}

function valuesForDimension<TProfile extends ProfileReleaseIdentity>(
  candidates: readonly TProfile[],
  dimensionId: string,
): ResolverOption[] {
  const values = new Map<string, ResolverOption>();
  for (const profile of candidates) {
    const dimension = profileDimension(profile, dimensionId);
    if (!dimension) continue;
    const current = values.get(dimension.valueId);
    if (current) current.candidateCount += 1;
    else {
      values.set(dimension.valueId, {
        valueId: dimension.valueId,
        valueLabel: dimension.valueLabel,
        candidateCount: 1,
      });
    }
  }
  return [...values.values()].sort((left, right) =>
    left.valueLabel.localeCompare(right.valueLabel, undefined, {
      numeric: true,
    }),
  );
}

export function resolveProfiles<
  TProfile extends ProfileReleaseIdentity = ProfileReleaseIdentity,
>(
  profiles: readonly TProfile[],
  selections: ProfileSelections = {},
): ProfileResolverState<TProfile> {
  const definitions = validateDimensionMetadata(profiles);
  const normalizedSelections = { ...selections };
  let candidates = [...profiles];

  for (const [dimensionId, valueId] of Object.entries(normalizedSelections)) {
    const nextCandidates = filterCandidates(candidates, {
      [dimensionId]: valueId,
    });
    if (nextCandidates.length === 0) {
      return {
        selections: normalizedSelections,
        candidates: [],
        impliedAnswers: [],
        nextQuestion: null,
        resolvedProfile: null,
        ambiguousProfiles: [],
        invalidSelection: { dimensionId, valueId },
      };
    }
    candidates = nextCandidates;
  }

  if (candidates.length === 1) {
    return {
      selections: normalizedSelections,
      candidates,
      impliedAnswers: [],
      nextQuestion: null,
      resolvedProfile: candidates[0] ?? null,
      ambiguousProfiles: [],
      invalidSelection: null,
    };
  }

  const impliedAnswers: ImpliedProfileAnswer[] = [];
  for (const definition of availableDimensions(
    candidates,
    definitions,
    normalizedSelections,
  )) {
    const options = valuesForDimension(candidates, definition.dimensionId);
    if (options.length === 1) {
      const only = options[0];
      if (only) {
        impliedAnswers.push({
          ...definition,
          valueId: only.valueId,
          valueLabel: only.valueLabel,
        });
      }
      continue;
    }
    if (options.length > 1) {
      return {
        selections: normalizedSelections,
        candidates,
        impliedAnswers,
        nextQuestion: { ...definition, options },
        resolvedProfile: null,
        ambiguousProfiles: [],
        invalidSelection: null,
      };
    }
  }

  return {
    selections: normalizedSelections,
    candidates,
    impliedAnswers,
    nextQuestion: null,
    resolvedProfile: null,
    ambiguousProfiles: candidates,
    invalidSelection: null,
  };
}

export function answerProfileQuestion<
  TProfile extends ProfileReleaseIdentity = ProfileReleaseIdentity,
>(
  profiles: readonly TProfile[],
  state: ProfileResolverState<TProfile>,
  valueId: string,
): ProfileResolverState<TProfile> {
  if (!state.nextQuestion) return state;
  return resolveProfiles(profiles, {
    ...state.selections,
    [state.nextQuestion.dimensionId]: valueId,
  });
}

export function selectedProfileSummary(
  profile: ProfileReleaseIdentity,
): string {
  return profile.dimensions
    .map((dimension) => dimension.valueLabel)
    .join(' · ');
}
