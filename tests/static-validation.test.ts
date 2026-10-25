import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { auditHtmlSources, assertStaticAuditReport, serializeStaticReport, staticReportExitCode } from '../src/static/report.js';
import { parseHtml } from '../src/static/parse-html.js';
import { evaluateRule } from '../src/rule.js';
import { documentTitleRule, explicitLabelRule } from '../src/static/rules/index.js';

/** Expectations authored independently from the rule implementation; rationale in docs/phase-5-validation.md. */
const corpus = [
  ['international-form', ['pass', 'pass', 'pass', 'pass'], 0],
  ['bom-document', ['pass', 'pass', 'pass', 'pass'], 0],
  ['mixed-labels', ['pass', 'pass', 'needs-review', 'needs-review'], 4],
  ['recovered-table', ['pass', 'pass', 'not-applicable', 'pass'], 0],
  ['implicit-structure', ['pass', 'not-applicable', 'not-applicable', 'not-applicable'], 0],
  ['inert-content', ['pass', 'pass', 'needs-review', 'needs-review'], 4],
  ['ambiguous-declarations', ['needs-review', 'needs-review', 'pass', 'not-applicable'], 4],
] as const;
const fixture = (name: string) => resolve('tests/fixtures/validation', `${name}.html`);
const entry = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));
const cli = (files: string[]) => spawnSync(process.execPath, [entry, 'audit', ...files.flatMap((file) => ['--html', file]), '--format', 'json'], { encoding: 'utf8', timeout: 10_000 });
for (const [name, expected, code] of corpus) {
  test(`independent document ${name}: exact statuses, stable JSON and authored finding spans`, async () => {
    const source = await readFile(fixture(name), 'utf8');
    const parsed = parseHtml(source);
    const first = cli([fixture(name)]);
    assert.equal(first.status, code, first.stderr || String(first.error)); assert.equal(first.stderr, '');
    const report: unknown = JSON.parse(first.stdout); assertStaticAuditReport(report);
    assert.equal(report.status, 'completed');
    assert.equal(report.coverage.renderedPage, 'not-executed');
    assert.deepEqual(report.sources[0]!.checks.map((check) => check.status === 'executed' ? check.result.outcome : check.status), expected);
    assert.equal(first.stdout, cli([fixture(name)]).stdout);
    assert.equal(first.stdout, serializeStaticReport(await auditHtmlSources([source])));
    assert.ok(!first.stdout.includes(fixture(name))); assert.ok(!first.stdout.includes('<html'));
    for (const check of report.sources[0]!.checks) {
      if (check.status !== 'executed' || (check.result.outcome !== 'fail' && check.result.outcome !== 'needs-review')) continue;
      for (const finding of check.result.findings) for (const evidence of finding.evidence) {
        const match = /^source:line (\d+), column (\d+); UTF-16 \[(\d+), (\d+)\)$/.exec(evidence.location)!;
        assert.ok(match);
        assert.ok(parsed.nodes.some((node) => [node.location, ...(node.kind === 'element' ? [node.startTag, ...node.attributes.map((attr) => attr.location)] : [])]
          .some((span) => span && span.startLine === Number(match[1]) && span.startCol === Number(match[2])
            && span.startOffset === Number(match[3]) && span.endOffset === Number(match[4]))));
      }
    }
    if (name === 'recovered-table') assert.ok(parsed.nodes.some((node) => node.kind === 'element' && node.tagName === 'tbody' && node.location === null));
  });
}
test('non-ASCII whitespace ID references resolve exactly, ASCII whitespace remains ambiguous', async () => {
  for (const value of ['&#160;', '&#x2003;']) {
    assert.equal((await evaluateRule(explicitLabelRule, parseHtml(`<label for="${value}">Name</label><input id="${value}">`))).outcome, 'pass');
  }
  assert.equal((await evaluateRule(explicitLabelRule, parseHtml('<label for=" ">Name</label><input id=" ">'))).outcome, 'needs-review');
});
test('direct title evaluation cannot disguise unavailable evidence as non-applicability', async () => {
  for (const source of ['', ' \r\n\t']) await assert.rejects(evaluateRule(documentTitleRule, parseHtml(source)), /authored source evidence/);
});
test('mixed definite and ambiguous observations are counted explicitly', async () => {
  const report = await auditHtmlSources([await readFile(fixture('mixed-labels'), 'utf8')]);
  const label = report.sources[0]!.checks[3]!;
  assert.equal(label.status, 'executed');
  if (label.status === 'executed') {
    assert.equal(label.result.outcome, 'needs-review');
    assert.match(label.result.explanation, /1 definite source issue\(s\); 1 review observation\(s\)/);
    if (label.result.outcome === 'needs-review') assert.deepEqual(label.result.findings.map((finding) => finding.id.split(':')[1]), ['unresolved', 'ambiguous']);
  }
});
test('multi-source failure and incomplete coverage precedence, IDs and order are preserved', async () => {
  const clean = await readFile(fixture('international-form'), 'utf8');
  const mixed = await readFile(fixture('mixed-labels'), 'utf8');
  const failure = '<!doctype html><html><title></title>';
  const report = await auditHtmlSources([clean, mixed, failure]);
  assert.equal(staticReportExitCode(report), 3);
  assert.deepEqual(report.sources.map((source) => source.id), ['source-1', 'source-2', 'source-3']);
  const incomplete = await auditHtmlSources([failure, '']);
  assert.equal(incomplete.status, 'incomplete'); assert.equal(staticReportExitCode(incomplete), 1);
  const last = incomplete.sources[1]!.checks[0]!;
  assert.equal(last.status, 'not-executed');
});
test('actual CLI incomplete coverage outranks completed failures and remains explicitly incomplete JSON', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-phase5-'));
  try {
    const empty = join(directory, 'empty.html'); await writeFile(empty, '');
    const result = cli([resolve('tests/fixtures/static/issues.html'), empty]);
    assert.equal(result.status, 1); assert.equal(result.stderr, '');
    const report: unknown = JSON.parse(result.stdout); assertStaticAuditReport(report);
    assert.equal(report.status, 'incomplete'); assert.equal(report.sources[1]!.checks[0]!.status, 'not-executed');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('leading BOM retains original bytes and exact authored source positions without changing parsing mode', async () => {
  const source = await readFile(fixture('bom-document'), 'utf8');
  const parsed = parseHtml(source);
  assert.equal(parsed.source, source); assert.equal(parsed.sourceBytes, Buffer.byteLength(source));
  const html = parsed.nodes.find((node) => node.kind === 'element' && node.tagName === 'html');
  assert.ok(html && html.kind === 'element' && html.startTag);
  assert.equal(html.startTag.startOffset, 16); assert.equal(html.startTag.startCol, 17);
  assert.equal(source.slice(html.startTag.startOffset, html.startTag.endOffset), '<html lang="en">');
  const document = parsed.nodes[0]!;
  assert.ok(document.kind === 'document'); assert.equal(document.mode, 'no-quirks');
  const report = await auditHtmlSources([source]); assert.equal(report.sources[0]!.bytes, Buffer.byteLength(source));
});
test('independent actual CLI exit matrix distinguishes help, operational errors, usage, failure and review', () => {
  const cases = [
    [['--help'], 0], [['--version'], 0], [['audit'], 2],
    [['audit', '--html', 'absent-phase5.html', '--format', 'json'], 1],
    [['audit', '--html', resolve('tests/fixtures/static/issues.html'), '--format', 'json'], 3],
    [['audit', '--html', fixture('mixed-labels'), '--format', 'json'], 4],
  ] as const;
  for (const [args, expected] of cases) {
    const result = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, expected, result.stderr || String(result.error));
    if (expected === 1 || expected === 2) { assert.equal(result.stdout, ''); assert.ok(result.stderr.length <= 520); }
    if (expected === 3 || expected === 4) { const report: unknown = JSON.parse(result.stdout); assertStaticAuditReport(report); assert.equal(report.status, 'completed'); }
  }
});

test('closed output pipe fails with a fixed diagnostic and no unhandled stack', async () => {
  const child = spawn(process.execPath, [entry, 'audit', '--html', fixture('international-form'), '--format', 'json']);
  let stderr = ''; child.stderr.setEncoding('utf8'); child.stderr.on('data', (data: string) => { stderr += data; });
  child.stdout.destroy();
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    assert.equal(code, 1); assert.equal(stderr, 'Error: unable to write CLI output\n');
  } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
});
test('BOM-only input has unavailable evidence while an interior BOM remains text', async () => {
  const report = await auditHtmlSources(['\ufeff']);
  assert.equal(report.status, 'incomplete'); assert.equal(report.sources[0]!.bytes, 3);
  assert.equal(report.sources[0]!.checks[0]!.status, 'not-executed');
  const parsed = parseHtml('<title>A\ufeffB</title>');
  assert.ok(parsed.nodes.some((node) => node.kind === 'text' && node.value === 'A\ufeffB'));
});
