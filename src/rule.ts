import { assertRuleResult, type RuleResult, type RuleOutcome } from './schema.js';

export type Applicability =
  | { applicable: true; explanation: string }
  | { applicable: false; explanation: string };

/** Context is supplied by a future runner. No browser or accessibility rules here. */
export interface Rule<Context> {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly applicability: string;
  readonly limitations: readonly string[];
  readonly references: readonly string[];
  applies(context: Context): Applicability | Promise<Applicability>;
  evaluate(context: Context): Exclude<RuleOutcome, { outcome: 'not-applicable' }> | Promise<Exclude<RuleOutcome, { outcome: 'not-applicable' }>>;
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
export function assertRule<Context>(value: unknown): asserts value is Rule<Context> {
  if (typeof value !== 'object' || value === null) throw new TypeError('Rule must be an object');
  const rule = value as Record<string, unknown>;
  for (const field of ['id', 'version', 'description', 'applicability']) {
    if (!text(rule[field])) throw new TypeError(`Rule ${field} must be nonempty text`);
  }
  if (!Array.isArray(rule.limitations) || rule.limitations.length === 0 || !rule.limitations.every(text)) {
    throw new TypeError('Rule limitations must contain nonempty text');
  }
  if (!Array.isArray(rule.references) || rule.references.length === 0) throw new TypeError('Rule references are required');
  for (const reference of rule.references) {
    if (!text(reference)) throw new TypeError('Rule reference must be an HTTP(S) URL');
    const parsed = new URL(reference);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new TypeError('Rule reference must be an HTTP(S) URL without credentials');
    }
  }
  if (typeof rule.applies !== 'function' || typeof rule.evaluate !== 'function') {
    throw new TypeError('Rule applies and evaluate functions are required');
  }
}

/** Throws on invalid implementations or execution failure; never converts errors to passes. */
export async function evaluateRule<Context>(rule: Rule<Context>, context: Context): Promise<RuleResult> {
  assertRule<Context>(rule);
  const applicability = await rule.applies(context);
  if (!applicability || typeof applicability.applicable !== 'boolean' || !text(applicability.explanation)) {
    throw new TypeError('Invalid applicability result');
  }
  const outcome: RuleOutcome = applicability.applicable
    ? await rule.evaluate(context)
    : { outcome: 'not-applicable', explanation: applicability.explanation };
  if (applicability.applicable && outcome.outcome === 'not-applicable') {
    throw new TypeError('An applicable rule must return an evaluation outcome');
  }
  const result = { ...outcome, ruleId: rule.id, ruleVersion: rule.version };
  assertRuleResult(result);
  return result;
}
