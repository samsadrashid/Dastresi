import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/cli/run.js';
import { audit } from './data.js';
import { MAX_DIAGNOSTIC_LENGTH, terminalText } from '../src/diagnostics.js';
import { ValidationError } from '../src/schema.js';

async function run(args: string[], content = JSON.stringify(audit()), unreadable = false) {
  let stdout = '';
  let stderr = '';
  let reads = 0;
  const code = await runCli(args, {
    readFile: async () => { reads++; if (unreadable) throw new Error('private detail'); return content; },
    stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; },
  }, '0.1.0');
  return { code, stdout, stderr, reads };
}
test('help and version avoid file access', async () => {
  for (const args of [[], ['--help'], ['--version']]) {
    const output = await run(args);
    assert.equal(output.code, 0);
    assert.equal(output.stderr, '');
    assert.equal(output.reads, 0);
    assert.match(output.stdout, args[0] === '--version' ? /^0\.1\.0\n$/ : /Usage:/);
  }
});
test('unknown commands, missing arguments, flags, and extras produce usage errors', async () => {
  for (const args of [['audit', 'https://example.test'], ['validate'], ['validate', '--help'], ['validate', ''], ['--help', 'extra'], ['validate', 'a', 'b']]) {
    const output = await run(args);
    assert.equal(output.code, 2);
    assert.equal(output.reads, 0);
    assert.equal(output.stdout, '');
    assert.match(output.stderr, /Usage error/);
  }
});
test('valid data reports validation rather than conformance, including execution errors', async () => {
  const output = await run(['validate', 'audit.json'], JSON.stringify({ ...audit(), errors: [{ ruleId: 'other', message: 'Synthetic failure' }] }));
  assert.equal(output.code, 0);
  assert.match(output.stdout, /1 execution error/);
  assert.match(output.stdout, /not a conformance assessment/);
});
test('invalid JSON, schema violations, and unreadable files return data errors without stack traces', async () => {
  for (const [content, unreadable] of [['{', false], ['{}', false], ['', true]] as const) {
    const output = await run(['validate', 'audit.json'], content, unreadable);
    assert.equal(output.code, 1);
    assert.equal(output.stdout, '');
    assert.match(output.stderr, /^Error:/);
    assert.doesNotMatch(output.stderr, /private detail|\bat \w/);
  }
});

test('malicious field names produce bounded terminal-safe diagnostics', async () => {
  for (const name of ['\u001b[2J\u001b[Hfake\noutput', '\r\t\b\u0000\u007f\u009b\u202e\u2066', 'x'.repeat(100_000)]) {
    const output = await run(['validate', 'audit.json'], JSON.stringify({ ...audit(), [name]: true }));
    assert.equal(output.code, 1);
    assert.match(output.stderr, /^Error: audit\./);
    assert.doesNotMatch(output.stderr.slice(0, -1), /[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2060-\u206f]/u);
    assert.ok(output.stderr.length <= MAX_DIAGNOSTIC_LENGTH + 'Error: \n'.length);
    assert.equal(output.stderr.split('\n').length, 2);
  }
});

test('diagnostic details, caller-supplied paths, and version text are escaped and bounded', async () => {
  const error = new ValidationError('untrusted\n\u001b[H' + 'x'.repeat(100_000), '\u009b\r' + 'y'.repeat(100_000));
  assert.ok(error.message.length <= MAX_DIAGNOSTIC_LENGTH);
  assert.ok(error.field.length <= 256);
  assert.doesNotMatch(error.message, /[\u0000-\u001f\u007f-\u009f]/);
  assert.match(error.message, /\\u000a\\u001b/);
  const safe = terminalText('context\n\u001b[H' + 'z'.repeat(100_000));
  assert.match(safe, /^context\\u000a\\u001b/);
  assert.ok(safe.length <= MAX_DIAGNOSTIC_LENGTH);
  let output = '';
  await runCli(['--version'], { readFile: async () => '', stdout: (text) => { output += text; }, stderr: () => {} }, '\u001b[H\nversion');
  assert.equal(output, '\\u001b[H\\u000aversion\n');
});
test('built entrypoint reads actual files and sets process exit codes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-cli-'));
  const entrypoint = new URL('../src/cli/main.js', import.meta.url);
  try {
    const file = join(directory, 'audit.json');
    await writeFile(file, JSON.stringify(audit()));
    const valid = spawnSync(process.execPath, [entrypoint.pathname, 'validate', file], { encoding: 'utf8', cwd: directory });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /Valid audit data/);
    const absent = spawnSync(process.execPath, [entrypoint.pathname, 'validate', join(directory, 'missing.json')], { encoding: 'utf8' });
    assert.equal(absent.status, 1);
    const usage = spawnSync(process.execPath, [entrypoint.pathname, 'audit'], { encoding: 'utf8' });
    assert.equal(usage.status, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
