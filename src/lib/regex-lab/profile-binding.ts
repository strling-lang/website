import type { JsonObject } from '@strling-lang/strling';

export function sameProfileReference(
  actual: JsonObject | undefined,
  expected: JsonObject | undefined,
): boolean {
  return Boolean(
    actual &&
    expected &&
    typeof expected.profile_id === 'string' &&
    typeof expected.profile_version === 'string' &&
    typeof expected.sha256 === 'string' &&
    actual.profile_id === expected.profile_id &&
    actual.profile_version === expected.profile_version &&
    actual.sha256 === expected.sha256,
  );
}
