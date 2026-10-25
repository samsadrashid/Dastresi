import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_BROWSER_LIMITS } from '../src/browser/prepare.js';
import { createTimeoutModel, budgetForStage } from '../src/browser/timeouts.js';

test('overall deadline starts before launch and bounds every execution stage', () => {
  const model = createTimeoutModel(DEFAULT_BROWSER_LIMITS, 100);
  assert.equal(model.executionDeadlineMs, 20_100);
  assert.equal(budgetForStage(model, 'launch', 100).remainingMs, 20_000);
  assert.equal(budgetForStage(model, 'navigation', 15_100).remainingMs, 5000);
  assert.equal(budgetForStage(model, 'readiness', 19_100).remainingMs, 1000);
  assert.equal(budgetForStage(model, 'collection', 20_100).expired, true);
  assert.equal(budgetForStage(model, 'navigation', 21_100).remainingMs, 0);
});

test('navigation/readiness caps and fractional monotonic clocks are supported', () => {
  const model = createTimeoutModel(DEFAULT_BROWSER_LIMITS, 0.5);
  assert.equal(budgetForStage(model, 'navigation', 100.5).deadlineMs, 10_100.5);
  assert.equal(budgetForStage(model, 'readiness', 100.5).deadlineMs, 5100.5);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(budgetForStage(model, 'collection', 100.5)));
});

test('cleanup and forced termination have bounded grace periods even on early failure', () => {
  const model = createTimeoutModel(DEFAULT_BROWSER_LIMITS, 0);
  assert.equal(budgetForStage(model, 'cleanup', 100).deadlineMs, 2100);
  assert.equal(budgetForStage(model, 'cleanup', 21_500).remainingMs, 500);
  assert.equal(budgetForStage(model, 'termination', 22_500).remainingMs, 500);
  assert.equal(budgetForStage(model, 'termination', 23_000).expired, true);
});

test('invalid clocks and incompatible durations are rejected', () => {
  for (const now of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => createTimeoutModel(DEFAULT_BROWSER_LIMITS, now), RangeError);
  }
  for (const patch of [{ navigationMs: 0 }, { readinessMs: 1.1 }, { executionMs: 1 }, { executionMs: 60_001 }]) {
    assert.throws(() => createTimeoutModel({ ...DEFAULT_BROWSER_LIMITS, ...patch }, 0), RangeError);
  }
  const model = createTimeoutModel(DEFAULT_BROWSER_LIMITS, 100);
  assert.throws(() => budgetForStage(model, 'navigation', 99), RangeError);
});

