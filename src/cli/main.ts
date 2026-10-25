#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { runCli } from './run.js';
import { readHtml, readReport } from './input.js';

let outputFailed = false;
process.stderr.on('error', () => { outputFailed = true; process.exitCode = 1; });
process.stdout.on('error', () => {
  outputFailed = true; process.exitCode = 1;
  process.stderr.write('Error: unable to write CLI output\n');
});

try {
  const manifest: unknown = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null || !('version' in manifest) || typeof manifest.version !== 'string') {
    throw new Error('Invalid package metadata');
  }
  const code = await runCli(process.argv.slice(2), {
    readFile: readReport,
    readHtml,
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  }, manifest.version);
  process.exitCode = outputFailed ? 1 : code;
} catch {
  process.stderr.write('Error: unable to initialize Dastresi CLI\n');
  process.exitCode = 1;
}
