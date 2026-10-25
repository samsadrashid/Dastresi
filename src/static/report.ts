import { types } from 'node:util';
import { evaluateRule } from '../rule.js';
import { assertRuleResult, ValidationError, type RuleResult } from '../schema.js';
import { HTML_PARSER_LIMITS, MAX_STATIC_INPUT_FILES, parseHtml } from './parse-html.js';
import { staticDeclarationRules } from './rules/index.js';

export const MAX_STATIC_REPORT_BYTES = 10 * 1024 * 1024;
const limitations = Object.freeze([
  'Source declarations only; no WCAG conformance assessment or semantic suitability judgment.',
  'Rendered layout, contrast, visibility, accessibility tree, accessible names, keyboard behavior, and browser execution are not executed.',
  'Scripts and resources are not executed or loaded; noscript uses scriptingEnabled=true; templates remain inert.',
  'Parser recovery is retained; parser and file reads have no hard execution deadline or memory isolation.',
]);
export type StaticCheck = { status: 'executed'; result: RuleResult }
  | { status: 'not-executed'; ruleId: string; ruleVersion: string; reason: 'missing-authored-evidence' };
export interface StaticSourceReport {
  id: string; kind: 'local-html'; bytes: number; parserErrors: number; checks: StaticCheck[];
}
export interface StaticAuditReport {
  format: 'dastresi-static'; schemaVersion: '1'; status: 'completed' | 'incomplete';
  coverage: { mode: 'static-source'; renderedPage: 'not-executed'; limitations: string[] };
  sources: StaticSourceReport[];
}
export class StaticAuditError extends Error {
  constructor(message: 'Static rule execution failed' | 'Static report exceeds the 10 MiB output limit' | 'Expected one to eight HTML inputs') {
    super(message); this.name = 'StaticAuditError';
  }
}

/** All-or-nothing: exceptions return no report; absent authored evidence is explicit. */
export async function auditHtmlSources(inputs: readonly string[]): Promise<StaticAuditReport> {
  if (!inputs.length || inputs.length > MAX_STATIC_INPUT_FILES) throw new StaticAuditError('Expected one to eight HTML inputs');
  const sources: StaticSourceReport[] = [];
  for (const source of inputs) {
    const parsed = parseHtml(source);
    const checks: StaticCheck[] = [];
    for (const rule of staticDeclarationRules) {
      if (rule.id === 'static-document-title' && !parsed.nodes.some((node) => node.location !== null)) {
        checks.push({ status: 'not-executed', ruleId: rule.id, ruleVersion: rule.version, reason: 'missing-authored-evidence' });
        continue;
      }
      try { checks.push({ status: 'executed', result: await evaluateRule(rule, parsed) }); }
      catch { throw new StaticAuditError('Static rule execution failed'); }
    }
    sources.push({ id: `source-${sources.length + 1}`, kind: 'local-html', bytes: parsed.sourceBytes, parserErrors: parsed.parserErrors.length, checks });
  }
  const report: StaticAuditReport = { format: 'dastresi-static', schemaVersion: '1',
    status: sources.some((source) => source.checks.some((check) => check.status === 'not-executed')) ? 'incomplete' : 'completed',
    coverage: { mode: 'static-source', renderedPage: 'not-executed', limitations: [...limitations] }, sources };
  assertStaticAuditReport(report);
  return report;
}

function invalid(): never { throw new ValidationError('staticReport', 'invalid static report contract'); }
/** Own-data inspection prevents inherited fields/getters and serialization hooks. */
function object(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || types.isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.hasOwn(Object.prototype, 'toJSON')) return invalid();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some((key) => typeof key !== 'string' || !names.includes(key))) return invalid();
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return invalid();
    result[key] = descriptor.value;
  }
  return result;
}
function array(value: unknown, min: number, max: number): unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || Object.hasOwn(Array.prototype, 'toJSON') || Object.hasOwn(Object.prototype, 'toJSON')
    || value.length < min || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) return invalid();
  const items: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) return invalid();
    items.push(descriptor.value);
  }
  return items;
}
function integer(value: unknown, max: number): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) invalid();
}
export function assertStaticAuditReport(value: unknown): asserts value is StaticAuditReport {
  const report = object(value, ['format', 'schemaVersion', 'status', 'coverage', 'sources']);
  if (report.format !== 'dastresi-static' || report.schemaVersion !== '1') invalid();
  const coverage = object(report.coverage, ['mode', 'renderedPage', 'limitations']);
  if (coverage.mode !== 'static-source' || coverage.renderedPage !== 'not-executed') invalid();
  const declared = array(coverage.limitations, limitations.length, limitations.length);
  if (declared.some((item, index) => item !== limitations[index])) invalid();
  let incomplete = false;
  for (const [position, raw] of array(report.sources, 1, MAX_STATIC_INPUT_FILES).entries()) {
    const source = object(raw, ['id', 'kind', 'bytes', 'parserErrors', 'checks']);
    if (source.id !== `source-${position + 1}` || source.kind !== 'local-html') invalid();
    integer(source.bytes, HTML_PARSER_LIMITS.maxSourceBytes);
    integer(source.parserErrors, HTML_PARSER_LIMITS.maxParserErrors);
    for (const [index, rawCheck] of array(source.checks, staticDeclarationRules.length, staticDeclarationRules.length).entries()) {
      const rule = staticDeclarationRules[index]!;
      // First inspect the union tag without invoking accessors.
      if (typeof rawCheck !== 'object' || rawCheck === null || types.isProxy(rawCheck)) invalid();
      const tag = Object.getOwnPropertyDescriptor(rawCheck, 'status');
      if (!tag || !Object.hasOwn(tag, 'value')) invalid();
      if (tag.value === 'executed') {
        const check = object(rawCheck, ['status', 'result']);
        assertRuleResult(check.result);
        if (check.result.ruleId !== rule.id || check.result.ruleVersion !== rule.version
          || (rule.id === 'static-document-title' && check.result.outcome === 'not-applicable')) invalid();
      } else {
        const check = object(rawCheck, ['status', 'ruleId', 'ruleVersion', 'reason']);
        if (check.status !== 'not-executed' || rule.id !== 'static-document-title' || check.ruleId !== rule.id
          || check.ruleVersion !== rule.version || check.reason !== 'missing-authored-evidence') invalid();
        incomplete = true;
      }
    }
  }
  if (report.status !== (incomplete ? 'incomplete' : 'completed')) invalid();
}
export function serializeStaticReport(report: StaticAuditReport): string {
  assertStaticAuditReport(report);
  const output = `${JSON.stringify(report)}\n`;
  if (Buffer.byteLength(output, 'utf8') > MAX_STATIC_REPORT_BYTES) throw new StaticAuditError('Static report exceeds the 10 MiB output limit');
  return output;
}
/** Completed means all four checks resolved, including genuine not-applicable. */
export function staticReportExitCode(report: StaticAuditReport): number {
  assertStaticAuditReport(report);
  if (report.status === 'incomplete') return 1;
  const results = report.sources.flatMap((source) => source.checks.flatMap((check) => check.status === 'executed' ? [check.result] : []));
  if (results.some((result) => result.outcome === 'fail')) return 3;
  if (results.some((result) => result.outcome === 'needs-review')) return 4;
  return 0;
}
