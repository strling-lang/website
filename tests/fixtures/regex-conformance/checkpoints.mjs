// TEST-ONLY FIXTURE DATA. These synthetic profiles and findings are not
// production truth and must never be imported by src/.
import {
  CHECKPOINT_INDEX_SCHEMA,
  COMPATIBILITY_PROJECTION_SCHEMA,
  COVERAGE_CHECKPOINT_SCHEMA,
  EVIDENCE_MANIFEST_SCHEMA,
  LAB_PROJECTION_SCHEMA,
} from '../../../src/lib/regex-conformance/contracts.ts';
import { sha256Json } from '../../../src/lib/regex-conformance/digest.ts';

export const fixtureSemanticSnapshot = {
  snapshotId: 'test-only-semantic-snapshot-v1',
  digest: `sha256:${'a'.repeat(64)}`,
};

const dimension = (dimensionId, question, valueId, valueLabel, order) => ({
  dimensionId,
  question,
  valueId,
  valueLabel,
  order,
});

export const fixtureProfiles = [
  {
    profileId: 'test-only.python.stdlib-re.cpython',
    releaseId: 'test-only.cpython-3.14',
    profileReleaseId: 'test-only.python.stdlib-re.cpython.3.14',
    displayName: 'Python · standard-library re · CPython 3.14 (test fixture)',
    technicalLabel: 'test-only/python/re/cpython@3.14',
    dimensions: [
      dimension(
        'context',
        'Where are you using RegEx?',
        'programming-language',
        'Programming language',
        1,
      ),
      dimension('language', 'Which language?', 'python', 'Python', 2),
      dimension(
        'api',
        'Which RegEx API?',
        'stdlib-re',
        'Standard-library re',
        3,
      ),
      dimension('runtime', 'Which runtime?', 'cpython', 'CPython', 4),
      dimension('release', 'Which release?', '3.14', '3.14', 5),
    ],
    labEligibility: 'eligible',
    compatibilityPublication: 'published',
  },
  {
    profileId: 'test-only.python.stdlib-re.cpython',
    releaseId: 'test-only.cpython-3.13',
    profileReleaseId: 'test-only.python.stdlib-re.cpython.3.13',
    displayName: 'Python · standard-library re · CPython 3.13 (test fixture)',
    technicalLabel: 'test-only/python/re/cpython@3.13',
    dimensions: [
      dimension(
        'context',
        'Where are you using RegEx?',
        'programming-language',
        'Programming language',
        1,
      ),
      dimension('language', 'Which language?', 'python', 'Python', 2),
      dimension(
        'api',
        'Which RegEx API?',
        'stdlib-re',
        'Standard-library re',
        3,
      ),
      dimension('runtime', 'Which runtime?', 'cpython', 'CPython', 4),
      dimension('release', 'Which release?', '3.13', '3.13', 5),
    ],
    labEligibility: 'eligible',
    compatibilityPublication: 'published',
  },
  {
    profileId: 'test-only.cli.pcre2grep',
    releaseId: 'test-only.pcre2grep-10.46',
    profileReleaseId: 'test-only.cli.pcre2grep.10.46',
    displayName: 'Command line · pcre2grep 10.46 (test fixture)',
    technicalLabel: 'test-only/cli/pcre2grep@10.46',
    dimensions: [
      dimension(
        'context',
        'Where are you using RegEx?',
        'command-line',
        'Command-line tool',
        1,
      ),
      dimension('tool', 'Which tool?', 'pcre2grep', 'pcre2grep', 2),
      dimension('release', 'Which release?', '10.46', '10.46', 3),
    ],
    labEligibility: 'ineligible',
    compatibilityPublication: 'published',
  },
  {
    profileId: 'test-only.server.node.regexp',
    releaseId: 'test-only.node-24',
    profileReleaseId: 'test-only.server.node.regexp.24',
    displayName: 'Server · JavaScript RegExp · Node.js 24 (test fixture)',
    technicalLabel: 'test-only/server/javascript/regexp/node@24',
    dimensions: [
      dimension(
        'context',
        'Where are you using RegEx?',
        'server-application',
        'Server / application',
        1,
      ),
      dimension('language', 'Which language?', 'javascript', 'JavaScript', 2),
      dimension('api', 'Which RegEx API?', 'regexp', 'Built-in RegExp', 3),
      dimension('runtime', 'Which runtime?', 'node', 'Node.js', 4),
      dimension('release', 'Which release?', '24', '24', 5),
    ],
    labEligibility: 'eligible',
    compatibilityPublication: 'withheld',
  },
];

const evidenceManifestOne = {
  schemaVersion: EVIDENCE_MANIFEST_SCHEMA,
  checkpointId: 'test-only-checkpoint-0001',
  evidence: [
    {
      evidenceId: 'test-only-evidence-named-capture',
      reference: 'test-fixture://evidence/named-capture',
      digest: `sha256:${'b'.repeat(64)}`,
    },
    {
      evidenceId: 'test-only-evidence-word-boundary',
      reference: 'test-fixture://evidence/word-boundary',
      digest: `sha256:${'c'.repeat(64)}`,
    },
  ],
};

const labProjectionOne = {
  schemaVersion: LAB_PROJECTION_SCHEMA,
  checkpointId: 'test-only-checkpoint-0001',
  sourceSemanticSnapshot: fixtureSemanticSnapshot,
  profiles: fixtureProfiles
    .filter((profile) => profile.labEligibility === 'eligible')
    .map((profile) => ({
      profileReleaseId: profile.profileReleaseId,
      operations: [
        {
          operationId: 'search-all',
          label: 'Find all matches',
          description: 'Return non-overlapping matches in fixture order.',
        },
        {
          operationId: 'search-first',
          label: 'Find first match',
          description: 'Return only the first fixture match.',
        },
      ],
      options: [
        {
          optionId: 'ignore-case',
          label: 'Ignore case',
          kind: 'boolean',
          defaultValue: false,
        },
        {
          optionId: 'line-mode',
          label: 'Line mode',
          kind: 'choice',
          defaultValue: 'single',
          choices: [
            { value: 'single', label: 'Single line' },
            { value: 'multiline', label: 'Multiline' },
          ],
        },
      ],
      nativeIndexUnit: 'Unicode code points (test fixture)',
    })),
};

const evidenceRef = (evidenceId, reference, digest) => ({
  evidenceId,
  reference,
  digest,
  observationReferences: [`test-fixture://observations/${evidenceId}`],
  derivedFindingReferences: [`test-fixture://findings/${evidenceId}`],
});

const compatibilityProjectionOne = {
  schemaVersion: COMPATIBILITY_PROJECTION_SCHEMA,
  checkpointId: 'test-only-checkpoint-0001',
  sourceSemanticSnapshot: fixtureSemanticSnapshot,
  publishedProfileReleaseIds: fixtureProfiles
    .filter((profile) => profile.compatibilityPublication === 'published')
    .map((profile) => profile.profileReleaseId),
  findings: [
    {
      profileReleaseId: 'test-only.python.stdlib-re.cpython.3.14',
      semanticFeatureId: 'feature.named-capture',
      state: 'supported',
      conditions: [],
      explanation: null,
      testedScope: {
        operationId: 'search-all',
        mode: 'text',
        options: { 'ignore-case': false },
      },
      evidence: evidenceRef(
        'test-only-evidence-named-capture',
        'test-fixture://evidence/named-capture',
        `sha256:${'b'.repeat(64)}`,
      ),
    },
    {
      profileReleaseId: 'test-only.python.stdlib-re.cpython.3.13',
      semanticFeatureId: 'feature.named-capture',
      state: 'conditional',
      conditions: ['Fixture-only condition: named syntax is mode-dependent.'],
      explanation: 'Synthetic conditional result for consumer testing.',
      testedScope: {
        operationId: 'search-first',
        mode: 'text',
        options: {},
      },
      evidence: evidenceRef(
        'test-only-evidence-named-capture',
        'test-fixture://evidence/named-capture',
        `sha256:${'b'.repeat(64)}`,
      ),
    },
    {
      profileReleaseId: 'test-only.cli.pcre2grep.10.46',
      semanticFeatureId: 'feature.named-capture',
      state: 'unsupported',
      conditions: [],
      explanation: 'Synthetic unsupported result for consumer testing.',
      testedScope: {
        operationId: 'command-search',
        mode: null,
        options: {},
      },
      evidence: evidenceRef(
        'test-only-evidence-named-capture',
        'test-fixture://evidence/named-capture',
        `sha256:${'b'.repeat(64)}`,
      ),
    },
    {
      profileReleaseId: 'test-only.python.stdlib-re.cpython.3.14',
      semanticFeatureId: 'feature.word-boundary',
      state: 'not-tested',
      conditions: [],
      explanation: 'No fixture observation was scheduled for this scope.',
      testedScope: null,
      evidence: null,
    },
    {
      profileReleaseId: 'test-only.python.stdlib-re.cpython.3.13',
      semanticFeatureId: 'feature.word-boundary',
      state: 'unknown-insufficient-evidence',
      conditions: [],
      explanation: 'The fixture observations do not establish a result.',
      testedScope: null,
      evidence: null,
    },
    {
      profileReleaseId: 'test-only.cli.pcre2grep.10.46',
      semanticFeatureId: 'feature.word-boundary',
      state: 'not-applicable',
      conditions: ['Fixture scope excludes this host operation.'],
      explanation: 'The feature does not apply to the synthetic scope.',
      testedScope: null,
      evidence: evidenceRef(
        'test-only-evidence-word-boundary',
        'test-fixture://evidence/word-boundary',
        `sha256:${'c'.repeat(64)}`,
      ),
    },
  ],
};

const file = (fileId, path, value) => ({
  fileId,
  path,
  digest: sha256Json(value),
});

const checkpointOne = {
  schemaVersion: COVERAGE_CHECKPOINT_SCHEMA,
  sequence: 1,
  checkpointId: 'test-only-checkpoint-0001',
  previousCheckpointId: null,
  sourceSemanticSnapshot: fixtureSemanticSnapshot,
  profileReleases: fixtureProfiles,
  projections: {
    lab: file(
      'test-only-lab-projection-0001',
      'downstream/lab/test-only-coverage-shard-0001.json',
      labProjectionOne,
    ),
    compatibility: file(
      'test-only-compatibility-projection-0001',
      'downstream/compatibility/test-only-coverage-shard-0001.json',
      compatibilityProjectionOne,
    ),
  },
  evidenceManifest: file(
    'test-only-evidence-manifest-0001',
    'downstream/evidence/test-only-coverage-shard-0001.json',
    evidenceManifestOne,
  ),
};

const evidenceManifestTwo = {
  schemaVersion: EVIDENCE_MANIFEST_SCHEMA,
  checkpointId: 'test-only-checkpoint-0002',
  evidence: [],
};

const checkpointTwo = {
  schemaVersion: COVERAGE_CHECKPOINT_SCHEMA,
  sequence: 2,
  checkpointId: 'test-only-checkpoint-0002',
  previousCheckpointId: 'test-only-checkpoint-0001',
  sourceSemanticSnapshot: fixtureSemanticSnapshot,
  profileReleases: [],
  projections: { lab: null, compatibility: null },
  evidenceManifest: file(
    'test-only-evidence-manifest-0002',
    'downstream/evidence/test-only-coverage-shard-0002.json',
    evidenceManifestTwo,
  ),
};

const checkpointPathOne =
  'downstream/checkpoints/test-only-coverage-shard-0001.v1.json';
const checkpointPathTwo =
  'downstream/checkpoints/test-only-coverage-shard-0002.v1.json';

const baseFiles = {
  [checkpointPathOne]: checkpointOne,
  [checkpointPathTwo]: checkpointTwo,
  [checkpointOne.projections.lab.path]: labProjectionOne,
  [checkpointOne.projections.compatibility.path]: compatibilityProjectionOne,
  [checkpointOne.evidenceManifest.path]: evidenceManifestOne,
  [checkpointTwo.evidenceManifest.path]: evidenceManifestTwo,
};

const baseIndex = {
  schemaVersion: CHECKPOINT_INDEX_SCHEMA,
  sourceSemanticSnapshot: fixtureSemanticSnapshot,
  checkpoints: [
    {
      ...file(
        'test-only-checkpoint-file-0001',
        checkpointPathOne,
        checkpointOne,
      ),
      sequence: 1,
      checkpointId: 'test-only-checkpoint-0001',
      previousCheckpointId: null,
    },
    {
      ...file(
        'test-only-checkpoint-file-0002',
        checkpointPathTwo,
        checkpointTwo,
      ),
      sequence: 2,
      checkpointId: 'test-only-checkpoint-0002',
      previousCheckpointId: 'test-only-checkpoint-0001',
    },
  ],
};

const clone = (value) => structuredClone(value);

export function validCheckpointBundle() {
  return { index: clone(baseIndex), files: clone(baseFiles) };
}

export function malformedDigestCheckpointBundle() {
  const bundle = validCheckpointBundle();
  bundle.index.checkpoints[0].digest = `sha256:${'0'.repeat(64)}`;
  return bundle;
}

export function skippedCheckpointBundle() {
  const bundle = validCheckpointBundle();
  bundle.index.checkpoints[1].previousCheckpointId = 'test-only-missing';
  return bundle;
}

export function duplicateCheckpointBundle() {
  const bundle = validCheckpointBundle();
  bundle.index.checkpoints.push(clone(bundle.index.checkpoints[1]));
  return bundle;
}

export function mutateReferencedFile(bundle, path, mutate) {
  mutate(bundle.files[path]);
  const checkpointIndexEntry = bundle.index.checkpoints.find(
    (entry) => entry.path === path,
  );
  if (checkpointIndexEntry)
    checkpointIndexEntry.digest = sha256Json(bundle.files[path]);
}

export const fixturePaths = {
  checkpointOne: checkpointPathOne,
  checkpointTwo: checkpointPathTwo,
  labOne: checkpointOne.projections.lab.path,
  compatibilityOne: checkpointOne.projections.compatibility.path,
  evidenceOne: checkpointOne.evidenceManifest.path,
};
