import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { tmpdir } from 'node:os';
import fsPromises, { mkdtemp, writeFile, rm, open } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { readHtml } from '../src/cli/input.js';

for (const replacement of [false, true]) {
  test(`HTML handle verification ${replacement ? 'rejects replacement' : 'bounds growth at 1 MiB plus one byte'} and closes`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dastresi-input-phase5-'));
    let restore = () => {};
    try {
      const file = join(directory, 'input.html'); await writeFile(file, '');
      const stat = await fsPromises.lstat(file);
      let consumed = 0; let closed = false;
      // Controlled race simulation, not a claim that all OS races are eliminated.
      const fake = {
        stat: async () => replacement ? { ...stat, ino: stat.ino + 1, isFile: () => true } : stat,
        read: async (_buffer: Buffer, offset: number, length: number, position: number) => {
          assert.equal(replacement, false); assert.equal(offset, consumed); assert.equal(position, consumed);
          assert.ok(length <= 64 * 1024); consumed += length; return { bytesRead: length };
        },
        close: async () => { closed = true; },
      };
      const patched = mock.method(fsPromises, 'open', async () => fake as unknown as Awaited<ReturnType<typeof open>>);
      restore = () => { patched.mock.restore(); syncBuiltinESMExports(); }; syncBuiltinESMExports();
      await assert.rejects(readHtml(file), replacement ? /regular file/ : /1 MiB limit/);
      assert.equal(consumed, replacement ? 0 : 1048577); assert.equal(closed, true);
    } finally { restore(); await rm(directory, { recursive: true, force: true }); }
  });
}
