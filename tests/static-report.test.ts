import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { auditHtmlSources, assertStaticAuditReport, serializeStaticReport, staticReportExitCode } from '../src/static/report.js';
import { staticDeclarationRules } from '../src/static/rules/index.js';
import { runCli } from '../src/cli/run.js';
import type { Rule } from '../src/rule.js';
import type { ParsedHtml } from '../src/static/parse-html.js';
const fixture = (name: string) => readFile(new URL(`../../tests/fixtures/static/${name}.html`, import.meta.url), 'utf8');

test('static report reuses exact validated rule results and anonymous source identity', async () => {
  const report = await auditHtmlSources([await fixture('issues')]);
  assertStaticAuditReport(JSON.parse(serializeStaticReport(report)));
  assert.equal(report.status, 'completed');
  assert.equal(report.coverage.renderedPage, 'not-executed');
  assert.deepEqual(report.sources[0]!.checks.map((check) => check.status === 'executed' ? check.result.outcome : check.status), ['fail', 'fail', 'needs-review', 'fail']);
  const title = report.sources[0]!.checks[0]!;
  assert.equal(title.status, 'executed');
  if (title.status === 'executed' && title.result.outcome === 'fail') {
    assert.equal(title.result.findings[0]!.id, 'static-document-title:empty:27:0');
    assert.deepEqual(title.result.findings[0]!.evidence, [{ observation: 'Document title declaration is empty.', location: 'source:line 1, column 28; UTF-16 [27, 34)' }]);
  } else assert.fail('Expected title finding');
  const expected = [
    ['static-document-language:missing:15:0', 'Root lang declaration is missing.', 16, 15, 21],
    ['static-image-alternative:missing:55:0', 'Image alt declaration is missing; inspect intent and other naming mechanisms.', 56, 55, 60],
    ['static-explicit-label:unresolved:67:0', 'Explicit label reference does not resolve in this source tree.', 68, 67, 79],
  ] as const;
  for (const [position, [id, observation, column, start, end]] of expected.entries()) {
    const check = report.sources[0]!.checks[position + 1]!;
    if (check.status !== 'executed' || (check.result.outcome !== 'fail' && check.result.outcome !== 'needs-review')) assert.fail('Expected finding');
    assert.equal(check.result.findings.length, 1);
    assert.equal(check.result.findings[0]!.id, id);
    assert.deepEqual(check.result.findings[0]!.evidence, [{ observation, location: `source:line 1, column ${column}; UTF-16 [${start}, ${end})` }]);
  }
  assert.equal(staticReportExitCode(report), 3);
});
test('empty input means title not executed, not missing-evidence inapplicability', async () => {
  const report = await auditHtmlSources(['']);
  assert.equal(report.status, 'incomplete');
  assert.deepEqual(report.sources[0]!.checks[0], { status: 'not-executed', ruleId: 'static-document-title', ruleVersion: '1', reason: 'missing-authored-evidence' });
  assert.equal(staticReportExitCode(report), 1);
});
test('genuine absent image and explicit label declarations remain not-applicable', async () => {
  const report = await auditHtmlSources(['<!doctype html><html lang="en"><title>Title</title>']);
  assert.equal(report.status, 'completed');
  assert.equal(staticReportExitCode(report), 0);
  for (const check of report.sources[0]!.checks.slice(2)) assert.equal(check.status === 'executed' && check.result.outcome, 'not-applicable');
});
test('identical ordered sources give byte-identical JSON without clock, source or paths', async () => {
  const source = await fixture('declarations');
  const first = serializeStaticReport(await auditHtmlSources([source, source]));
  assert.equal(first, serializeStaticReport(await auditHtmlSources([source, source])));
  assert.doesNotMatch(first, /Fixture declarations|<html|\/Users\/|startedAt|finishedAt/);
  assert.deepEqual(JSON.parse(first).sources.map((item: { id: string }) => item.id), ['source-1', 'source-2']);
});
test('report validation rejects contradictory, unexpected, missing, sparse and accessor data', async () => {
  const report = await auditHtmlSources([await fixture('declarations')]);
  const change = (mutate: (data: any) => void) => { // Deliberately malformed runtime inputs.
    const data = JSON.parse(JSON.stringify(report)); mutate(data); assert.throws(() => assertStaticAuditReport(data));
  };
  change((data) => { data.status = 'incomplete'; });
  change((data) => { data.sources[0].path = '/private/path'; });
  change((data) => { data.sources[0].id = 'source-2'; });
  change((data) => { data.sources[0].bytes = 1048577; });
  change((data) => { data.coverage.renderedPage = 'executed'; });
  change((data) => { data.coverage.limitations = []; });
  change((data) => { delete data.sources[0]; });
  change((data) => { data.sources[0].checks.reverse(); });
  change((data) => { data.sources[0].checks[0].result.outcome = 'not-applicable'; delete data.sources[0].checks[0].result.evidence; });
  change((data) => { Object.defineProperty(data, 'status', { get() { assert.fail('Getter invoked'); }, enumerable: true }); });
  change((data) => { data.sources[0].checks[0].result.evidence[0].location = ''; });
  change((data) => { const status = data.status; delete data.status; Object.setPrototypeOf(data, { status }); });
  change((data) => { data.sources[0].checks[0] = new Proxy({}, { get() { assert.fail('Proxy invoked'); } }); });
});
test('required rule failure or invalid result emits no JSON and returns execution error', async () => {
  const rule = staticDeclarationRules[0]!;
  const original = rule.evaluate;
  try {
    for (const evaluate of [() => { throw new Error('/secret/private'); }, () => ({ outcome: 'pass', evidence: [] })]) {
      rule.evaluate = evaluate as unknown as Rule<ParsedHtml>['evaluate'];
      let stdout = ''; let stderr = '';
      const code = await runCli(['audit', '--html', 'fixture.html', '--format', 'json'], {
        readFile: async () => '', readHtml: async () => '<!doctype html><title>A</title>',
        stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; },
      }, '0.1.0');
      assert.equal(code, 1); assert.equal(stdout, ''); assert.equal(stderr, 'Error: Static rule execution failed\n');
    }
  } finally { rule.evaluate = original; }
});
test('source count API limits reject without partial success', async () => {
  for (const sources of [[], Array<string>(9).fill('')]) await assert.rejects(auditHtmlSources(sources), /one to eight/);
});
