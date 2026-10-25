import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { chromium } from 'playwright-core';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchBrowserMetadata, checkCachedChromium, BrowserMetadataError } from '../src/browser/compatibility.js';
import { NonExecutingPlaywrightAdapter, BrowserAdapterError, inspectFixturePage } from '../src/browser/nonexecuting-adapter.js';
import { OFFLINE_BROWSER_REQUIREMENTS, type BrowserStartRequest } from '../src/browser/contracts.js';

const evidence = {
  packageVersion: '1.64.0', browserRevision: '1248', expectedVersion: '156.0.8078.4',
  installedVersion: '156.0.8078.4', platform: 'darwin', architecture: 'arm64', binaryArm64: true,
};
function request(): BrowserStartRequest {
  return {
    configuration: {
      mode: 'fixtures-only', target: 'https://adapter.test/page', authorizedOrigins: ['https://adapter.test'],
      fixtures: [{ url: 'https://adapter.test/page', kind: 'document', body: '<!doctype html><html lang="en"><title>Adapter fixture</title></html>' }],
    },
    requirements: OFFLINE_BROWSER_REQUIREMENTS, signal: new AbortController().signal,
    budget: { expired: false, remainingMs: 20_000, deadlineMs: performance.now() + 20_000 },
  };
}

test('matching browser metadata is explicitly metadata-only, not evidence of a launch or boundary', () => {
  const result = matchBrowserMetadata(evidence);
  assert.equal(result.verification, 'metadata-only');
  assert.equal(result.browserVersion, '156.0.8078.4');
  assert.ok(Object.isFrozen(result));
});

test('package, browser revision/version, architecture and platform mismatches fail closed', () => {
  for (const patch of [{ packageVersion: '1.63.0' }, { browserRevision: '1243' },
    { installedVersion: '153.0.8010.12' }, { expectedVersion: undefined }, { binaryArm64: false },
    { architecture: 'x64' }, { platform: 'linux' }]) {
    assert.throws(() => matchBrowserMetadata({ ...evidence, ...patch }), BrowserMetadataError);
  }
});

test('cancelled and expired adapter requests fail before metadata verification or browser launch', async () => {
  const subject = new NonExecutingPlaywrightAdapter();
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(subject.start({ ...request(), signal: cancelled.signal }), (error: unknown) =>
    error instanceof BrowserAdapterError && error.code === 'cancelled');
  await assert.rejects(subject.start({ ...request(), budget: { deadlineMs: 0, remainingMs: 0, expired: true } }), (error: unknown) =>
    error instanceof BrowserAdapterError && error.code === 'execution-timeout');
});

test('invalid or live targets return explicit nonexecution with sanitized errors', async () => {
  for (const input of [null, { ...request().configuration, target: 'http://169.254.169.254/' },
    { ...request().configuration, executablePath: '/SECRET/path' }, { ['\u001b[H\nSECRET']: true }]) {
    const result = await inspectFixturePage(input);
    assert.equal(result.status, 'not-executed');
    assert.equal(result.cleanup, 'not-applicable-no-browser');
    assert.deepEqual(result.coverage, { navigation: 'not-run', readiness: 'not-run', observations: 'not-collected' });
    assert.doesNotMatch(JSON.stringify(result), /SECRET|169\.254|\/Users\//);
    assert.equal(Object.hasOwn(result, 'observations'), false);
  }
});

test('installed Chromium metadata preflight never launches even when a matching executable exists', async () => {
  // This is a real package/filesystem metadata check, NOT a Chromium integration test.
  const launches = ['launch', 'launchServer', 'launchPersistentContext'] as const;
  const spies = launches.map((method) => mock.method(chromium, method, async () => { throw new Error('Forbidden launch'); }));
  try {
    const result = await inspectFixturePage(request().configuration);
    assert.equal(result.status, 'not-executed');
    assert.equal(result.boundary, 'unverified');
    assert.equal(result.cleanup, 'not-applicable-no-browser');
    assert.ok(['boundary-unverified', 'browser-missing', 'browser-incompatible', 'unsupported-platform'].includes(result.error.code));
    if (result.error.code === 'boundary-unverified') {
      assert.equal(result.browser?.verification, 'metadata-only');
      assert.equal((await checkCachedChromium()).browserRevision, '1248');
    } else {
      assert.equal(Object.hasOwn(result, 'browser'), false);
    }
    for (const spy of spies) assert.equal(spy.mock.callCount(), 0);
    assert.doesNotMatch(JSON.stringify(result), /\/Users\/|Adapter fixture|adapter\.test/);
  } finally { for (const spy of spies) spy.mock.restore(); }
});

test('an absent trusted browser cache returns browser-missing without a system-browser fallback', {
  skip: process.platform !== 'darwin' || process.arch !== 'arm64' ? 'macOS ARM64 metadata layout only' : false,
}, () => {
  // Child Node process isolates Playwright's host cache setting; Chromium is never run.
  const moduleUrl = new URL('../src/browser/compatibility.js', import.meta.url).href;
  const program = `const { checkCachedChromium } = await import(${JSON.stringify(moduleUrl)});
    try { await checkCachedChromium(); process.exitCode = 1; }
    catch (error) { process.stdout.write(error.code ?? 'unexpected-error'); }`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', program], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(tmpdir(), 'dastresi-absent-' + randomUUID()) },
  });
  assert.equal(child.status, 0, String(child.error));
  assert.equal(child.stdout, 'browser-missing');
});
