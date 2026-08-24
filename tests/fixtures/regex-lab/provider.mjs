// TEST-ONLY provider. It models result shapes and timing; it does not claim
// behavior for any real regex engine or Conformance profile.
import {
  LAB_EXECUTION_RESULT_SCHEMA,
  createLabExecutionRequest,
} from '../../../src/lib/regex-lab/index.ts';

const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class DeterministicFixtureLabProvider {
  providerId = 'test-only-deterministic-provider';
  kind = 'fixture';

  supports(runtime) {
    return runtime.profileReleaseId.startsWith('test-only.');
  }

  async execute(request) {
    const delay = request.pattern === 'SLOW' ? 45 : 1;
    await pause(delay);
    const base = {
      schemaVersion: LAB_EXECUTION_RESULT_SCHEMA,
      requestId: request.requestId,
      profileReleaseId: request.runtime.profileReleaseId,
      operationId: request.operationId,
      provider: { providerId: this.providerId, kind: this.kind },
      timing: { durationMs: delay, compileMs: 0.2, executionMs: delay - 0.2 },
    };
    if (request.operationId === 'test-only-unsupported') {
      return {
        ...base,
        status: 'unsupported-operation',
        error: { message: 'Fixture operation is unsupported.' },
      };
    }
    if (request.pattern === '[') {
      return {
        ...base,
        status: 'compile-rejection',
        error: {
          message: 'Fixture compile rejection.',
          code: 'TEST_ONLY_UNCLOSED_CLASS',
          offset: 0,
        },
      };
    }
    if (request.pattern === 'RUNTIME_ERROR') {
      return {
        ...base,
        status: 'runtime-error',
        error: { message: 'Fixture runtime error.', code: 'TEST_ONLY_RUNTIME' },
      };
    }
    if (request.pattern === 'TIMEOUT') {
      return {
        ...base,
        status: 'resource-terminated',
        error: {
          message: 'Fixture timeout.',
          code: 'TEST_ONLY_TIMEOUT',
          termination: 'timeout',
        },
      };
    }
    if (request.pattern === 'INFRASTRUCTURE_FAILURE') {
      throw new Error('Fixture provider transport failed.');
    }
    if (request.pattern === 'NO_MATCH') {
      return { ...base, status: 'no-match', matches: [] };
    }
    if (request.pattern === 'ZERO') {
      return {
        ...base,
        status: 'matched',
        matches: [
          {
            matchId: 'match-1',
            ordinal: 1,
            value: '',
            span: { start: 1, end: 1, unit: 'test fixture units' },
            captures: [],
          },
        ],
      };
    }
    return {
      ...base,
      status: 'matched',
      matches: [
        {
          matchId: 'match-1',
          ordinal: 1,
          value: 'alpha-1',
          span: { start: 0, end: 7, unit: 'test fixture units' },
          captures: [
            {
              captureId: 'match-1-capture-1',
              index: 1,
              name: 'word',
              participation: 'participated',
              value: 'alpha',
              span: { start: 0, end: 5, unit: 'test fixture units' },
            },
            {
              captureId: 'match-1-capture-2',
              index: 2,
              participation: 'nonparticipating',
            },
          ],
        },
        {
          matchId: 'match-2',
          ordinal: 2,
          value: 'beta-2',
          span: { start: 8, end: 14, unit: 'test fixture units' },
          captures: [
            {
              captureId: 'match-2-capture-1',
              index: 1,
              name: 'word',
              participation: 'participated',
              value: 'beta',
              span: { start: 8, end: 12, unit: 'test fixture units' },
            },
            {
              captureId: 'match-2-capture-2',
              index: 2,
              participation: 'unavailable',
            },
          ],
          engineNativeMetadata: { fixtureOnly: true },
        },
      ],
      engineNativeMetadata: { fixtureOnly: true, nativeShape: 'synthetic' },
    };
  }
}

export function fixtureRequest(overrides = {}) {
  return createLabExecutionRequest({
    requestId: 'test-only-request-1',
    runtime: {
      profileId: 'test-only.python.stdlib-re.cpython',
      releaseId: 'test-only.cpython-3.14',
      profileReleaseId: 'test-only.python.stdlib-re.cpython.3.14',
      technicalLabel: 'test-only/python/re/cpython@3.14',
    },
    operationId: 'search-all',
    pattern: 'MULTI',
    options: {},
    input: 'alpha-1 beta-2',
    ...overrides,
  });
}
