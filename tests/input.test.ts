import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtemp, open, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readReport, MAX_REPORT_BYTES, FileInputError } from '../src/cli/input.js';
import { audit } from './data.js';

test('bounded input accepts ordinary reports and the exact 10 MiB boundary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-input-'));
  try {
    const file = join(directory, 'report.json');
    const data = JSON.stringify(audit());
    await writeFile(file, data);
    assert.equal(await readReport(file), data);
    await writeFile(file, data + ' '.repeat(MAX_REPORT_BYTES - Buffer.byteLength(data)));
    assert.equal(Buffer.byteLength(await readReport(file)), MAX_REPORT_BYTES);
    const cli = spawnSync(process.execPath, [new URL('../src/cli/main.js', import.meta.url).pathname, 'validate', file], { encoding: 'utf8', timeout: 5000 });
    assert.equal(cli.status, 0, cli.stderr);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('oversized files, directories, and missing paths fail clearly through the CLI', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-input-'));
  try {
    const oversized = join(directory, 'large.json');
    const handle = await open(oversized, 'w');
    try { await handle.truncate(MAX_REPORT_BYTES + 1); } finally { await handle.close(); }
    for (const [file, expected] of [
      [oversized, /10 MiB limit/], [directory, /regular file/], [join(directory, 'absent.json'), /Unable to read JSON report/],
    ] as const) {
      await assert.rejects(readReport(file), FileInputError);
      const cli = spawnSync(process.execPath, [new URL('../src/cli/main.js', import.meta.url).pathname, 'validate', file], { encoding: 'utf8', timeout: 5000 });
      assert.equal(cli.status, 1, String(cli.error));
      assert.match(cli.stderr, expected);
      assert.doesNotMatch(cli.stderr, new RegExp(directory));
      assert.equal(cli.stdout, '');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('final-component symlinks are rejected', { skip: process.platform === 'win32' ? 'Windows symlink privileges vary' : false }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-input-'));
  try {
    const file = join(directory, 'report.json');
    const link = join(directory, 'link.json');
    await writeFile(file, JSON.stringify(audit()));
    await symlink(file, link);
    await assert.rejects(readReport(link), /symlinks and special files/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('POSIX FIFO and device inputs fail without hanging', { skip: process.platform === 'win32' ? 'POSIX special files only' : false }, async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-input-'));
  try {
    const fifo = join(directory, 'input.fifo');
    const creation = spawnSync('mkfifo', [fifo], { encoding: 'utf8', timeout: 5000 });
    if (creation.error || creation.status !== 0) { context.skip('mkfifo unavailable or not permitted'); return; }
    for (const file of [fifo, '/dev/null']) {
      const cli = spawnSync(process.execPath, [new URL('../src/cli/main.js', import.meta.url).pathname, 'validate', file], { encoding: 'utf8', timeout: 5000 });
      assert.equal(cli.status, 1, String(cli.error));
      assert.match(cli.stderr, /regular file/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a file growing after the initial stat cannot exceed the bounded read budget', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-input-'));
  let restore = () => {};
  try {
    const file = join(directory, 'growing.json');
    await writeFile(file, '');
    const stat = await fsPromises.lstat(file);
    let consumed = 0;
    let closed = false;
    // Deterministic simulation of a regular file that grows continuously after stat.
    const fake = {
      stat: async () => stat,
      read: async (_buffer: Buffer, offset: number, length: number, position: number) => {
        assert.equal(position, consumed);
        assert.equal(offset, consumed);
        assert.ok(length <= 64 * 1024);
        consumed += length;
        return { bytesRead: length };
      },
      close: async () => { closed = true; },
    };
    const patched = mock.method(fsPromises, 'open', async () => fake as unknown as Awaited<ReturnType<typeof open>>);
    restore = () => { patched.mock.restore(); syncBuiltinESMExports(); };
    syncBuiltinESMExports();
    await assert.rejects(readReport(file), /10 MiB limit/);
    assert.equal(consumed, MAX_REPORT_BYTES + 1);
    assert.equal(closed, true);
  } finally { restore(); await rm(directory, { recursive: true, force: true }); }
});

test('a different opened file identity is rejected before any read and the handle is closed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dastresi-input-'));
  let restore = () => {};
  try {
    const file = join(directory, 'replaced.json');
    await writeFile(file, '{}');
    const stat = await fsPromises.lstat(file);
    let closed = false;
    const fake = {
      stat: async () => ({ ...stat, ino: stat.ino + 1, isFile: () => true }),
      read: async () => { assert.fail('Replaced file must not be read'); },
      close: async () => { closed = true; },
    };
    const patched = mock.method(fsPromises, 'open', async () => fake as unknown as Awaited<ReturnType<typeof open>>);
    restore = () => { patched.mock.restore(); syncBuiltinESMExports(); };
    syncBuiltinESMExports();
    await assert.rejects(readReport(file), /regular file/);
    assert.equal(closed, true);
  } finally { restore(); await rm(directory, { recursive: true, force: true }); }
});
