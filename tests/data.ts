import type { AuditResult, Finding, RuleResult } from '../src/schema.js';

/** Synthetic contract data, not an accessibility rule or WCAG evaluation. */
export function finding(): Finding {
  return {
    id: 'sample-finding', ruleId: 'contract-example', ruleVersion: '1',
    title: 'Synthetic observation', impact: 'Example impact for schema testing',
    recommendation: 'Review this synthetic example', verification: 'Repeat the example inspection',
    severity: 'moderate', confidence: 'high',
    evidence: [{ location: 'example region', observation: 'Synthetic evidence' }],
    references: ['https://www.w3.org/TR/WCAG22/'],
  };
}
export function result(): RuleResult {
  return { ruleId: 'contract-example', ruleVersion: '1', outcome: 'fail', explanation: 'Synthetic test', findings: [finding()] };
}
export function audit(): AuditResult {
  return {
    schemaVersion: '1', target: { url: 'https://example.test/', state: 'initial' },
    startedAt: '2026-10-25T00:00:00.000Z', finishedAt: '2026-10-25T00:00:01.000Z',
    results: [result()], errors: [],
  };
}
