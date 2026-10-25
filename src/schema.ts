import { terminalText } from './diagnostics.js';
import { types } from 'node:util';

/** Versioned JSON contracts. These describe observations, never conformance. */
export type Outcome = 'pass' | 'fail' | 'needs-review' | 'not-applicable';
export interface Evidence {
  observation: string;
  location: string;
}
export interface Finding {
  id: string;
  ruleId: string;
  ruleVersion: string;
  title: string;
  impact: string;
  recommendation: string;
  verification: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  confidence: 'low' | 'medium' | 'high';
  evidence: Evidence[];
  references: string[];
}
export type RuleOutcome =
  | { outcome: 'pass'; explanation: string; evidence: Evidence[] }
  | { outcome: 'fail' | 'needs-review'; explanation: string; findings: Finding[] }
  | { outcome: 'not-applicable'; explanation: string };
export type RuleResult = {
  ruleId: string;
  ruleVersion: string;
} & RuleOutcome;
export interface AuditResult {
  schemaVersion: '1';
  target: { url: string; state: string };
  startedAt: string;
  finishedAt: string;
  results: RuleResult[];
  errors: { ruleId: string; message: string }[];
}

export class ValidationError extends Error {
  public readonly field: string;
  constructor(field: string, detail: string) {
    const safeField = terminalText(field, 256);
    super(terminalText(`${safeField}: ${terminalText(detail, 256)}`));
    this.field = safeField;
    this.name = 'ValidationError';
  }
}
function invalid(field: string, detail: string): never {
  throw new ValidationError(field, detail);
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || types.isProxy(value) || Array.isArray(value)) {
    invalid(field, 'expected an object');
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(field, 'expected a plain object');
  if (Object.hasOwn(Object.prototype, 'toJSON')) invalid(field, 'inherited serialization hooks are unsupported');
  // Read descriptors, never getters. The null-prototype view prevents inherited
  // fields from satisfying required checks; the caller's input is not modified.
  const data = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') invalid(field, 'symbol properties are unsupported');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      invalid(`${field}.${terminalText(key, 128)}`, 'expected an enumerable own data property');
    }
    data[key] = descriptor.value;
  }
  return data;
}
function keys(value: Record<string, unknown>, allowed: string[], field: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) invalid(`${field}.${terminalText(key, 128)}`, 'unknown field');
  }
}
function string(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) invalid(field, 'expected nonempty text');
}
function choice(value: unknown, options: string[], field: string): void {
  if (typeof value !== 'string' || !options.includes(value)) invalid(field, `expected ${options.join(', ')}`);
}
function array(value: unknown, field: string, check: (item: unknown, field: string) => void, nonempty = false): void {
  if (types.isProxy(value) || !Array.isArray(value)) invalid(field, 'expected an array');
  if (Object.getPrototypeOf(value) !== Array.prototype || Object.hasOwn(Object.prototype, 'toJSON')
    || Object.hasOwn(Array.prototype, 'toJSON')) invalid(field, 'expected a plain array without serialization hooks');
  if (nonempty && value.length === 0) invalid(field, 'expected at least one item');
  if (Reflect.ownKeys(value).length !== value.length + 1) invalid(field, 'expected a dense array without extra properties');
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      invalid(`${field}[${index}]`, 'expected an enumerable own data property');
    }
    check(descriptor.value, `${field}[${index}]`);
  }
}
function url(value: unknown, field: string): void {
  string(value, field);
  let parsed: URL;
  try { parsed = new URL(value); } catch { return invalid(field, 'expected an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    invalid(field, 'expected an HTTP(S) URL without credentials');
  }
}
function timestamp(value: unknown, field: string): number {
  string(value, field);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    invalid(field, 'expected a canonical UTC timestamp, e.g. 2026-10-25T00:00:00.000Z');
  }
  return time;
}
function evidence(value: unknown, field: string): void {
  const item = object(value, field);
  keys(item, ['observation', 'location'], field);
  string(item.observation, `${field}.observation`);
  string(item.location, `${field}.location`);
}
export function assertFinding(value: unknown, field = 'finding'): asserts value is Finding {
  const item = object(value, field);
  keys(item, ['id', 'ruleId', 'ruleVersion', 'title', 'impact', 'recommendation', 'verification', 'severity', 'confidence', 'evidence', 'references'], field);
  for (const key of ['id', 'ruleId', 'ruleVersion', 'title', 'impact', 'recommendation', 'verification']) {
    string(item[key], `${field}.${key}`);
  }
  choice(item.severity, ['low', 'moderate', 'high', 'critical'], `${field}.severity`);
  choice(item.confidence, ['low', 'medium', 'high'], `${field}.confidence`);
  array(item.evidence, `${field}.evidence`, evidence, true);
  array(item.references, `${field}.references`, url, true);
}
export function assertRuleResult(value: unknown, field = 'result'): asserts value is RuleResult {
  const item = object(value, field);
  string(item.ruleId, `${field}.ruleId`);
  string(item.ruleVersion, `${field}.ruleVersion`);
  string(item.explanation, `${field}.explanation`);
  choice(item.outcome, ['pass', 'fail', 'needs-review', 'not-applicable'], `${field}.outcome`);
  const payload = item.outcome === 'pass' ? ['evidence'] : item.outcome === 'not-applicable' ? [] : ['findings'];
  keys(item, ['ruleId', 'ruleVersion', 'outcome', 'explanation', ...payload], field);
  if (item.outcome === 'pass') array(item.evidence, `${field}.evidence`, evidence, true);
  if (item.outcome === 'fail' || item.outcome === 'needs-review') {
    const ids = new Set<string>();
    array(item.findings, `${field}.findings`, (finding, location) => {
      assertFinding(finding, location);
      if (finding.ruleId !== item.ruleId || finding.ruleVersion !== item.ruleVersion) {
        invalid(location, 'finding rule identity must match result');
      }
      if (ids.has(finding.id)) invalid(location, 'duplicate finding id');
      ids.add(finding.id);
    }, true);
  }
}
export function assertAuditResult(value: unknown): asserts value is AuditResult {
  const item = object(value, 'audit');
  keys(item, ['schemaVersion', 'target', 'startedAt', 'finishedAt', 'results', 'errors'], 'audit');
  if (item.schemaVersion !== '1') invalid('audit.schemaVersion', 'unsupported schema version');
  const target = object(item.target, 'audit.target');
  keys(target, ['url', 'state'], 'audit.target');
  url(target.url, 'audit.target.url');
  string(target.state, 'audit.target.state');
  const start = timestamp(item.startedAt, 'audit.startedAt');
  const end = timestamp(item.finishedAt, 'audit.finishedAt');
  if (end < start) invalid('audit.finishedAt', 'must not precede startedAt');
  const seen = new Set<string>();
  array(item.results, 'audit.results', (result, field) => {
    assertRuleResult(result, field);
    if (seen.has(result.ruleId)) invalid(field, 'duplicate rule result');
    seen.add(result.ruleId);
  });
  array(item.errors, 'audit.errors', (error, field) => {
    const entry = object(error, field);
    keys(entry, ['ruleId', 'message'], field);
    string(entry.ruleId, `${field}.ruleId`);
    string(entry.message, `${field}.message`);
    if (seen.has(entry.ruleId)) invalid(field, 'rule already has a result or error');
    seen.add(entry.ruleId);
  });
}
