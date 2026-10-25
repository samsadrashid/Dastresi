import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRule, evaluateRule, type Rule } from '../src/rule.js';
import { finding } from './data.js';

function rule(): Rule<null> {
  return {
    id: 'contract-example', version: '1', description: 'Synthetic contract check',
    applicability: 'Synthetic input is available', limitations: ['No accessibility behavior is tested'],
    references: ['https://www.w3.org/TR/WCAG22/'],
    applies: () => ({ applicable: true, explanation: 'Input available' }),
    evaluate: () => ({ outcome: 'pass', explanation: 'Synthetic observation', evidence: finding().evidence }),
  };
}
test('valid synchronous and asynchronous implementations preserve each evaluated outcome', async () => {
  const subject = rule();
  assert.equal((await evaluateRule(subject, null)).outcome, 'pass');
  for (const outcome of ['fail', 'needs-review'] as const) {
    subject.evaluate = async () => ({ outcome, explanation: 'Synthetic case', findings: [finding()] });
    assert.equal((await evaluateRule(subject, null)).outcome, outcome);
  }
});
test('inapplicable rule skips evaluation and preserves explanation', async () => {
  const subject = rule();
  subject.applies = async () => ({ applicable: false, explanation: 'Input absent' });
  subject.evaluate = () => { throw new Error('Must not execute'); };
  assert.deepEqual(await evaluateRule(subject, null), {
    ruleId: subject.id, ruleVersion: subject.version, outcome: 'not-applicable', explanation: 'Input absent',
  });
});
test('metadata requires applicability, limitations, references, and functions', () => {
  for (const patch of [
    { applicability: '' }, { limitations: [] }, { references: [] },
    { references: ['file:///tmp/a'] }, { evaluate: null }, { id: '' },
  ]) assert.throws(() => assertRule({ ...rule(), ...patch }));
});
test('exceptions propagate rather than becoming accessibility outcomes', async () => {
  for (const method of ['applies', 'evaluate'] as const) {
    const subject = rule();
    subject[method] = () => { throw new Error('Synthetic execution failure'); };
    await assert.rejects(evaluateRule(subject, null), /Synthetic execution failure/);
  }
});
test('runtime validation rejects malformed applicability and outcomes from untyped callers', async () => {
  const subject = rule();
  subject.applies = (() => ({ applicable: 'yes', explanation: '' })) as unknown as Rule<null>['applies'];
  await assert.rejects(evaluateRule(subject, null), /Invalid applicability/);
  const other = rule();
  other.evaluate = (() => ({ outcome: 'fail', explanation: 'Missing findings' })) as unknown as Rule<null>['evaluate'];
  await assert.rejects(evaluateRule(other, null), /findings/);
  other.evaluate = (() => ({ outcome: 'not-applicable', explanation: 'Wrong stage' })) as unknown as Rule<null>['evaluate'];
  await assert.rejects(evaluateRule(other, null), /applicable rule/);
});
