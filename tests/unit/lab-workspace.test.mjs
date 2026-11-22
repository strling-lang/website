import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSession } from '../../src/lib/regex-lab/session.ts';
import {
  maxWorkspaceUnits,
  newWorkspace,
  workingSource,
  WorkspaceStore,
} from '../../src/lib/regex-lab/workspace.ts';
import {
  displayTiming,
  estimateTimerResolution,
  timingRepetitions,
} from '../../src/lib/regex-lab/timing.ts';

function storage() {
  const content = new Map();
  return {
    getItem: (key) => content.get(key) ?? null,
    setItem: (key, value) => content.set(key, value),
    removeItem: (key) => content.delete(key),
  };
}

test('keeps working state, formats and archive storage separate and rejects stale writes', () => {
  const memory = storage();
  memory.setItem('strling.labs.archive.v1', 'existing revision record');
  const first = new WorkspaceStore(memory, 'strling');
  const second = new WorkspaceStore(memory, 'strling');
  assert.equal(first.load(), undefined);
  assert.equal(second.load(), undefined);
  const source = workingSource(initialSession('strling'), 'My source');
  source.drafts.simply = '{"distinct":true}';
  source.session.datasets[0].text = 'sample text';
  const workspace = newWorkspace('strling', source);
  first.save(workspace);
  assert.throws(() => second.save(workspace), /changed in another tab/);
  const saved = new WorkspaceStore(memory, 'strling').load();
  assert.equal(saved.sources[0].drafts.simply, source.drafts.simply);
  assert.equal(saved.sources[0].session.datasets[0].text, 'sample text');
  assert.equal(new WorkspaceStore(memory, 'regex').load(), undefined);
  assert.equal(
    memory.getItem('strling.labs.archive.v1'),
    'existing revision record',
  );
});

test('protects invalid, oversized and quota-refused workspace data', () => {
  const memory = storage();
  const store = new WorkspaceStore(memory, 'regex');
  const key = 'strling.labs.working.v1.regex';
  memory.setItem(key, '{invalid');
  assert.throws(() => store.load(), /could not be read/);
  const workspace = newWorkspace(
    'regex',
    workingSource(initialSession('regex'), 'Pattern'),
  );
  assert.throws(() => store.save(workspace), /needs recovery/);
  assert.equal(memory.getItem(key), '{invalid');
  store.resetUnreadable();
  store.save(workspace);
  const original = memory.getItem(key);
  workspace.sources[0].session.source = 'x'.repeat(maxWorkspaceUnits);
  assert.throws(() => store.save(workspace), /storage is full/);
  assert.equal(memory.getItem(key), original);
  workspace.sources[0].session.source = 'a';
  memory.setItem = () => {
    throw new Error('Quota exceeded');
  };
  assert.throws(() => store.save(workspace), /could not save/);
  assert.equal(memory.getItem(key), original);
});

test('keeps eight raw measurements while adapting displayed precision to timer resolution and variability', () => {
  const small = { min: 2.01, median: 2.043, max: 2.09 };
  const large = { min: 20.01, median: 52.432, max: 80.95 };
  assert.equal(timingRepetitions, 8);
  assert.match(displayTiming(small, 1, 8), /^2 ms typical/);
  assert.match(displayTiming(large, 0.01, 8), /^50 ms typical/);
  assert.doesNotMatch(displayTiming(small, 0.1, 1), /observed/);
  assert.equal(
    estimateTimerResolution(() => 10),
    undefined,
  );
  let ticks = 0;
  assert.equal(
    estimateTimerResolution(() => Math.floor(ticks++ / 2) * 0.25),
    0.25,
  );
});
