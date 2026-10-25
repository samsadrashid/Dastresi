import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertAuditResult, assertFinding, assertRuleResult, ValidationError } from '../src/schema.js';
import { audit, finding, result } from './data.js';

test('valid findings and every declared rule outcome are accepted', () => {
  assertFinding(finding());
  const base = { ruleId: 'contract-example', ruleVersion: '1', explanation: 'Observed test condition' };
  for (const outcome of [
    { ...base, outcome: 'pass', evidence: finding().evidence },
    { ...base, outcome: 'fail', findings: [finding()] },
    { ...base, outcome: 'needs-review', findings: [finding()] },
    { ...base, outcome: 'not-applicable' },
  ]) assertRuleResult(outcome);
  assertAuditResult(audit());
});

const invalidFindings: Record<string, unknown>[] = [
  { title: ' ' }, { impact: '' }, { recommendation: null }, { verification: false },
  { id: 3 }, { ruleId: '' }, { ruleVersion: '' }, { severity: 'urgent' },
  { confidence: 1 }, { evidence: [] }, { evidence: [{ location: '', observation: 'x' }] },
  { references: [] }, { references: ['javascript:alert(1)'] },
  { references: ['https://user:secret@example.test/'] }, { unexpected: true },
];
for (const [index, patch] of invalidFindings.entries()) {
  test(`reject invalid finding variant ${index + 1}`, () => {
    assert.throws(() => assertFinding({ ...finding(), ...patch }), ValidationError);
  });
}
test('reject nonobjects and missing finding fields with a useful path', () => {
  for (const input of [null, [], 'text', {}]) assert.throws(() => assertFinding(input), ValidationError);
  assert.throws(() => assertFinding({ ...finding(), evidence: [{}] }), /finding.evidence\[0\].observation/);
});
test('reject inconsistent, unsupported, and empty rule outcomes', () => {
  for (const input of [
    { ...result(), outcome: 'unknown' }, { ...result(), findings: [] },
    { ...result(), findings: [{ ...finding(), ruleId: 'other' }] },
    { ...result(), findings: [{ ...finding(), ruleVersion: 'other' }] },
    { ...result(), findings: [finding(), finding()] },
    { ruleId: 'x', ruleVersion: '1', outcome: 'pass', explanation: 'x', evidence: [] },
    { ruleId: 'x', ruleVersion: '1', outcome: 'not-applicable', explanation: 'x', findings: [finding()] },
  ]) assert.throws(() => assertRuleResult(input), ValidationError);
});
test('audit rejects invalid targets, timestamps, versions, duplicate identities, and execution error overlap', () => {
  for (const patch of [
    { schemaVersion: '2' }, { target: { url: 'file:///tmp/data', state: 'initial' } },
    { target: { url: 'https://example.test', state: '' } },
    { startedAt: 'yesterday' }, { finishedAt: '2026-10-24T00:00:00.000Z' },
    { startedAt: '2026-02-30T00:00:00.000Z' },
    { results: [result(), result()] }, { results: null }, { errors: [{ ruleId: 'other', message: '' }] },
    { errors: [{ ruleId: 'contract-example', message: 'Failed to execute' }] },
    { errors: [{ ruleId: 'other', message: 'x' }, { ruleId: 'other', message: 'y' }] },
    { extra: true },
  ]) assert.throws(() => assertAuditResult({ ...audit(), ...patch }), ValidationError);
});
test('empty and partially failed audits remain valid data without claiming checks passed', () => {
  assertAuditResult({ ...audit(), results: [] });
  assertAuditResult({ ...audit(), errors: [{ ruleId: 'other', message: 'Unavailable input' }] });
});

test('sparse arrays are rejected throughout the audit contract', () => {
  for (const patch of [{ evidence: new Array(1) }, { references: new Array(1) }]) {
    assert.throws(() => assertFinding({ ...finding(), ...patch }), ValidationError);
  }
  assert.throws(() => assertAuditResult({ ...audit(), results: new Array(1) }), ValidationError);
  assert.throws(() => assertAuditResult({ ...audit(), errors: new Array(1) }), ValidationError);
  assert.throws(() => assertRuleResult({ ...result(), findings: new Array(1) }), ValidationError);
});

test('inherited and nonenumerable required fields cannot satisfy the contract', () => {
  assert.throws(() => assertFinding(Object.create(finding())), ValidationError);
  const hidden = finding();
  Object.defineProperty(hidden, 'title', { value: hidden.title, enumerable: false });
  assert.throws(() => assertFinding(hidden), ValidationError);
  assert.throws(() => assertAuditResult({ ...audit(), target: Object.create(audit().target) }), ValidationError);
});

test('object and array accessors are rejected without invoking them', () => {
  let calls = 0;
  const getter = () => { calls++; throw new Error('Getter must not execute'); };
  const subject = finding();
  Object.defineProperty(subject, 'title', { get: getter, enumerable: true });
  assert.throws(() => assertFinding(subject), ValidationError);
  const entries = finding().evidence;
  Object.defineProperty(entries, '0', { get: getter, enumerable: true });
  assert.throws(() => assertFinding({ ...finding(), evidence: entries }), ValidationError);
  assert.equal(calls, 0);
});

test('serialization hooks, array extra properties, symbols, and custom prototypes are rejected', () => {
  const extraArray = Object.assign(finding().evidence, { toJSON: () => [] });
  for (const value of [
    { ...finding(), toJSON: () => ({}) },
    { ...finding(), evidence: extraArray },
    { ...finding(), [Symbol('hidden')]: 'value' },
  ]) assert.throws(() => assertFinding(value), ValidationError);
  const custom = finding().evidence;
  Object.setPrototypeOf(custom, Object.create(Array.prototype));
  assert.throws(() => assertFinding({ ...finding(), evidence: custom }), ValidationError);
  const proxy = new Proxy(finding(), { ownKeys: () => { throw new Error('Proxy must not execute'); } });
  assert.throws(() => assertFinding(proxy), ValidationError);
  assert.throws(() => assertFinding({ ...finding(), evidence: new Proxy(finding().evidence, {}) }), ValidationError);
});

test('accepted findings and every audit outcome survive a JSON round trip', () => {
  const base = { ruleId: 'contract-example', ruleVersion: '1', explanation: 'Test observation' };
  for (const value of [
    { ...base, outcome: 'pass', evidence: finding().evidence },
    { ...base, outcome: 'fail', findings: [finding()] },
    { ...base, outcome: 'needs-review', findings: [finding()] },
    { ...base, outcome: 'not-applicable' },
  ]) {
    const report = { ...audit(), results: [value] };
    assertAuditResult(report);
    const decoded: unknown = JSON.parse(JSON.stringify(report));
    assertAuditResult(decoded);
    assert.deepEqual(decoded, report);
  }
  const plain = Object.assign(Object.create(null), finding()) as unknown;
  assertFinding(plain);
  assertFinding(JSON.parse(JSON.stringify(plain)));
});
