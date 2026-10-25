import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, symlink, open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { assertStaticAuditReport, MAX_STATIC_REPORT_BYTES } from '../src/static/report.js';
import { readHtml } from '../src/cli/input.js';
import { runCli } from '../src/cli/run.js';
const entry = fileURLToPath(new URL('../src/cli/main.js', import.meta.url));
const fixture = (name: string) => resolve('tests/fixtures/static', `${name}.html`);
function cli(args: string[]) { return spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 10_000, maxBuffer: MAX_STATIC_REPORT_BYTES + 1024 }); }
const audit = (...files: string[]) => cli(['audit', ...files.flatMap((file) => ['--html', file]), '--format', 'json']);
async function temporary(action: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-static-cli-'));
  try { await action(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
for (const [name, code] of [['declarations', 0], ['issues', 3], ['recovery', 4]] as const) {
  test(`actual CLI ${name}: validated JSON and exit ${code}`, () => {
    const result = audit(fixture(name));
    assert.equal(result.status, code, result.stderr || String(result.error)); assert.equal(result.stderr, '');
    const report: unknown = JSON.parse(result.stdout); assertStaticAuditReport(report);
    assert.equal(report.sources[0]!.checks.length, 4);
    assert.equal(result.stdout, audit(fixture(name)).stdout);
    assert.ok(Buffer.byteLength(result.stdout) <= MAX_STATIC_REPORT_BYTES);
    if (name === 'recovery') assert.ok(report.sources[0]!.parserErrors > 0);
    if (name === 'issues') assert.deepEqual(report.sources[0]!.checks.flatMap((check) =>
      check.status === 'executed' && (check.result.outcome === 'fail' || check.result.outcome === 'needs-review')
        ? check.result.findings.map((finding) => finding.id) : []), [
      'static-document-title:empty:27:0', 'static-document-language:missing:15:0',
      'static-image-alternative:missing:55:0', 'static-explicit-label:unresolved:67:0',
    ]);
  });
}
test('actual CLI validates saved static JSON through the existing validate command', async () => temporary(async (directory) => {
  const result = audit(fixture('issues'));
  const saved = join(directory, 'report.json'); await writeFile(saved, result.stdout);
  const checked = cli(['validate', saved]); assert.equal(checked.status, 0, checked.stderr); assert.match(checked.stdout, /Valid static audit data/);
}));
test('multiple inputs preserve order and maximum eight inputs works', () => {
  const files = [fixture('declarations'), fixture('issues')];
  const result = audit(...files); assert.equal(result.status, 3);
  const report: unknown = JSON.parse(result.stdout); assertStaticAuditReport(report);
  assert.deepEqual(report.sources.map((source) => source.id), ['source-1', 'source-2']);
  const eight = audit(...Array<string>(8).fill(fixture('declarations'))); assert.equal(eight.status, 0, eight.stderr);
});
test('too many inputs and malformed flags fail as usage without stdout', () => {
  const cases = [
    ['audit'], ['audit', '--html', fixture('declarations')], ['audit', '--format', 'json'],
    ['audit', '--html', fixture('declarations'), '--format', 'html'],
    ['audit', '--html', fixture('declarations'), '--format', 'json', '--format', 'json'],
    ['audit', '--html', '--format', 'json'], ['audit', '--html', '', '--format', 'json'],
    ['audit', ...Array<string>(9).fill('missing.html').flatMap((file) => ['--html', file]), '--format', 'json'],
  ];
  for (const args of cases) { const result = cli(args); assert.equal(result.status, 2, result.stderr); assert.equal(result.stdout, ''); assert.match(result.stderr, /^Usage error:/); }
});
test('missing, directory, unsupported extension and URL inputs fail safely', async () => temporary(async (directory) => {
  for (const file of [join(directory, 'absent.html'), directory, join(directory, 'source.txt'), 'https://example.invalid/page.html', 'file:///private/page.html']) {
    const result = audit(file); assert.equal(result.status, 1, String(result.error)); assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Error:/); assert.ok(result.stderr.length < 520); assert.ok(!result.stderr.includes(directory)); assert.doesNotMatch(result.stderr, /example.invalid|\/private/);
  }
}));
test('directories named HTML are rejected as unsupported file types', async () => temporary(async (directory) => {
  const { mkdir } = await import('node:fs/promises'); const file = join(directory, 'directory.html'); await mkdir(file);
  const result = audit(file); assert.equal(result.status, 1); assert.match(result.stderr, /regular file/);
}));
test('symlinks are rejected through actual CLI', { skip: process.platform === 'win32' }, async () => temporary(async (directory) => {
  const file = join(directory, 'link.html'); await symlink(fixture('declarations'), file);
  const result = audit(file); assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /symlinks/);
}));
test('FIFO input is rejected without hanging', { skip: process.platform === 'win32' }, async (context) => temporary(async (directory) => {
  const file = join(directory, 'pipe.html'); const creation = spawnSync('mkfifo', [file], { timeout: 5000 });
  if (creation.status !== 0) { context.skip('mkfifo unavailable'); return; }
  const result = audit(file); assert.equal(result.status, 1, String(result.error)); assert.match(result.stderr, /regular file/);
}));
test('HTML reader accepts exact 1 MiB and rejects overflow before full consumption', async () => temporary(async (directory) => {
  const file = join(directory, 'large.html'); const prefix = '<!doctype html><html lang="en"><title>A</title><body>';
  await writeFile(file, prefix + ' '.repeat(1048576 - Buffer.byteLength(prefix)));
  assert.equal(Buffer.byteLength(await readHtml(file)), 1048576);
  assert.equal(audit(file).status, 0);
  const handle = await open(file, 'w'); try { await handle.truncate(1048577); } finally { await handle.close(); }
  const result = audit(file); assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /1 MiB/);
}));
test('invalid UTF-8 and NUL-containing input are explicit errors', async () => temporary(async (directory) => {
  const file = join(directory, 'binary.html');
  for (const bytes of [Buffer.from([0xff, 0xfe]), Buffer.from('<html>\0')]) {
    await writeFile(file, bytes); const result = audit(file); assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /UTF-8/);
  }
}));
test('fatal parser limits and rule overflow emit no partial report', async () => temporary(async (directory) => {
  const file = join(directory, 'limits.html');
  for (const source of ['<div>'.repeat(300), '<img>'.repeat(1001), '<!doctype html>' + '<img a="1" a="2">'.repeat(101)]) {
    await writeFile(file, source); const result = audit(file); assert.equal(result.status, 1, String(result.error)); assert.equal(result.stdout, ''); assert.match(result.stderr, /limit|execution failed/);
  }
}));
test('output cap is enforced atomically across eight individually bounded sources', async () => temporary(async (directory) => {
  const file = join(directory, 'many.html');
  await writeFile(file, '<!doctype html><html lang="en"><title>Many</title>' + '<img><label for="missing">Caption</label>'.repeat(1000));
  const result = audit(...Array<string>(8).fill(file)); assert.equal(result.status, 1, result.stderr || String(result.error));
  assert.equal(result.stdout, ''); assert.match(result.stderr, /10 MiB output limit/);
}));
test('empty HTML is incomplete, not a successful report', async () => temporary(async (directory) => {
  const file = join(directory, 'empty.html'); await writeFile(file, '');
  const result = audit(file); assert.equal(result.status, 1); assert.equal(result.stderr, '');
  const report: unknown = JSON.parse(result.stdout); assertStaticAuditReport(report); assert.equal(report.status, 'incomplete');
}));
test('later unreadable file prevents emission of earlier results', () => {
  const result = audit(fixture('declarations'), 'missing.html'); assert.equal(result.status, 1); assert.equal(result.stdout, '');
});

test('validate rejects invalid saved static reports with bounded diagnostics', async () => temporary(async (directory) => {
  const report = JSON.parse(audit(fixture('declarations')).stdout);
  report.status = 'incomplete';
  const file = join(directory, 'invalid.json'); await writeFile(file, JSON.stringify(report));
  const result = cli(['validate', file]); assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Error: staticReport:/); assert.ok(!result.stderr.includes(directory));
}));

test('adversarial declaration corpus preserves narrow rule semantics and inert source privacy', async () => temporary(async (directory) => {
  const marker = 'DastresiPrivateSourceCanary';
  const wrap = (body: string) => `<!doctype html><html lang="en"><head><title>${marker}</title></head><body>${body}</body></html>`;
  const cases = [
    ['\ufeff<!doctype html>\r\n<html LANG=" en "><title>😀é</title><body><label for="名">Name</label><input id="名"><img alt="Diagram">', ['pass', 'pass', 'pass', 'pass'], 0],
    ['<!doctype html><html><!-- <title>Misleading</title><img alt="fake"> --><body>Text', ['fail', 'fail', 'not-applicable', 'not-applicable'], 3],
    [wrap('<script>throw new Error("Not executed"); const text = "<img>";</script><noscript><img></noscript>'), ['pass', 'pass', 'not-applicable', 'not-applicable'], 0],
    ['<!doctype html><title>Title</title><main><input></main>', ['pass', 'not-applicable', 'not-applicable', 'not-applicable'], 0],
    ['<!doctype html><html lang=" \t"><title>\r\n </title>', ['fail', 'fail', 'not-applicable', 'not-applicable'], 3],
    ['<!doctype html><html lang="??"><title>Untitled</title><img alt="image">', ['pass', 'pass', 'pass', 'not-applicable'], 0],
    [wrap(`<img><img alt=""><img alt=" \t "><img alt="${marker}">`), ['pass', 'pass', 'needs-review', 'not-applicable'], 4],
    [wrap('<label for="x">One</label><label for="x">Two</label><input id="x">'), ['pass', 'pass', 'not-applicable', 'pass'], 0],
    [wrap('<label for="x">Wrong target<input id="y"></label>'), ['pass', 'pass', 'not-applicable', 'fail'], 3],
    [wrap('<label for="ok">Name</label><input id="ok"><div id="x"></div><div id="x"></div>'), ['pass', 'pass', 'not-applicable', 'pass'], 0],
    [wrap('<label for="x">Name</label><input id="x"><input id="x">'), ['pass', 'pass', 'not-applicable', 'needs-review'], 4],
    [wrap('<label for="x">Name</label><template><input id="x"></template>'), ['pass', 'pass', 'not-applicable', 'fail'], 3],
    [wrap('<template><template><label for="x">Name</label><input id="x"></template></template>'), ['pass', 'pass', 'not-applicable', 'needs-review'], 4],
    [wrap('<table><tr><td><label for="x">Quantity</label><input id="x"></table>'), ['pass', 'pass', 'not-applicable', 'pass'], 0],
    [wrap('<svg><title>Graphic</title><image alt="Not an HTML img"></image></svg>'), ['pass', 'pass', 'not-applicable', 'not-applicable'], 0],
  ] as const;
  const file = join(directory, 'corpus.html');
  for (const [source, expected, code] of cases) {
    await writeFile(file, source);
    const result = audit(file); assert.equal(result.status, code, result.stderr || String(result.error)); assert.equal(result.stderr, '');
    const report: unknown = JSON.parse(result.stdout); assertStaticAuditReport(report);
    assert.equal(report.status, 'completed'); assert.equal(report.coverage.renderedPage, 'not-executed');
    assert.deepEqual(report.sources[0]!.checks.map((check) => check.status === 'executed' ? check.result.outcome : check.status), expected);
    assert.equal(result.stdout, audit(file).stdout);
    assert.ok(!result.stdout.includes(marker)); assert.ok(!result.stdout.includes(directory)); assert.ok(!result.stdout.includes('<html'));
  }
}));

test('hyphen-prefixed Unicode paths work when explicitly directory-qualified', async () => temporary(async (directory) => {
  const name = '- source 名 😀.HTML';
  await writeFile(join(directory, name), '<!doctype html><html lang="en"><title>Path fixture</title>');
  for (const [file, expected] of [[name, 2], [`./${name}`, 0]] as const) {
    const result = spawnSync(process.execPath, [entry, 'audit', '--html', file, '--format', 'json'], { cwd: directory, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, expected, result.stderr || String(result.error));
    if (expected === 0) { const report: unknown = JSON.parse(result.stdout); assertStaticAuditReport(report); assert.equal(result.stderr, ''); }
    else { assert.equal(result.stdout, ''); assert.match(result.stderr, /^Usage error:/); }
    assert.ok(!result.stdout.includes(name)); assert.ok(!result.stderr.includes(directory));
  }
}));

test('saved-report validation separates sensitive-looking values, invalid contracts and bounded errors', async () => temporary(async (directory) => {
  const secret = 'DastresiSavedValueCanary';
  const valid = JSON.parse(audit(fixture('issues')).stdout);
  valid.sources[0].checks[0].result.findings[0].impact = secret;
  const file = join(directory, 'saved.json');
  for (const [data, expected] of [
    [JSON.stringify(valid), 0], ['{"private":"' + secret + '"', 1],
    [JSON.stringify({ ...valid, schemaVersion: '2' }), 1],
    [JSON.stringify({ ...valid, sources: [] }), 1],
    [JSON.stringify({ ...valid, ['\u001b[2J\n' + 'x'.repeat(10_000)]: secret }), 1],
    [' '.repeat(MAX_STATIC_REPORT_BYTES + 1), 1],
  ] as const) {
    await writeFile(file, data); const result = cli(['validate', file]);
    assert.equal(result.status, expected, String(result.error));
    if (expected === 0) { assert.match(result.stdout, /^Valid static audit data:/); assert.equal(result.stderr, ''); }
    else { assert.equal(result.stdout, ''); assert.match(result.stderr, /^Error:/); }
    assert.ok(!result.stdout.includes(secret) && !result.stderr.includes(secret));
    assert.ok(!result.stderr.includes(directory)); assert.ok(result.stderr.length <= 520);
    assert.doesNotMatch(result.stderr.slice(0, -1), /[\u0000-\u001f\u007f-\u009f]/);
  }
}));

test('the default node ceiling rejects a bounded broad document without partial JSON', async () => temporary(async (directory) => {
  const file = join(directory, 'broad.html');
  const source = '<!doctype html><html lang="en"><title>Broad</title><body>' + '<br>'.repeat(50_000);
  assert.ok(Buffer.byteLength(source) < 1024 * 1024);
  await writeFile(file, source); const result = audit(file);
  assert.equal(result.status, 1, String(result.error)); assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Error: HTML node limit exceeded\n');
}));

test('multi-file reads observe later file changes and suppress output after a subsequent read error', async () => temporary(async (directory) => {
  const first = join(directory, 'first.html'); const second = join(directory, 'second.html');
  const good = '<!doctype html><html lang="en"><title>Before</title>';
  await writeFile(first, good); await writeFile(second, good);
  const args = ['audit', '--html', first, '--html', second, '--format', 'json'];
  const reads: string[] = []; let stdout = ''; let stderr = '';
  const result = await runCli(args, {
    readFile: async () => { assert.fail('Audit must not read saved-report input'); },
    readHtml: async (file) => {
      reads.push(file); const source = await readHtml(file);
      if (file === first) await writeFile(second, '<!doctype html><html><title></title>');
      return source;
    }, stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; },
  }, '0.1.0');
  assert.equal(result, 3); assert.equal(stderr, ''); assert.deepEqual(reads, [first, second]);
  const report: unknown = JSON.parse(stdout); assertStaticAuditReport(report);
  assert.deepEqual(report.sources.map((source) => source.id), ['source-1', 'source-2']);
  assert.equal(report.sources[0]!.checks[0]!.status === 'executed' && report.sources[0]!.checks[0]!.result.outcome, 'pass');
  assert.equal(report.sources[1]!.checks[0]!.status === 'executed' && report.sources[1]!.checks[0]!.result.outcome, 'fail');
  stdout = ''; stderr = '';
  const failure = await runCli(args, {
    readFile: async () => '', readHtml: async (file) => {
      if (file === second) throw new Error(`Private filesystem detail: ${second}`);
      return readHtml(file);
    }, stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; },
  }, '0.1.0');
  assert.equal(failure, 1); assert.equal(stdout, ''); assert.equal(stderr, 'Error: Unable to produce static audit report\n');
}));
