import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareBrowserRun, PreparationError, type FixtureRunConfiguration } from '../src/browser/prepare.js';
import { inspectPage } from '../src/browser/inspect.js';

function config(): FixtureRunConfiguration {
  return {
    mode: 'fixtures-only', target: 'https://fixture.test/page', authorizedOrigins: ['https://fixture.test'],
    fixtures: [{ url: 'https://fixture.test/page', kind: 'document', body: '<!doctype html><html lang="en"><title>Original fixture</title><body><button>Example</button></body></html>' }],
  };
}

test('offline preparation is deterministic, immutable, and excludes fixture content and URL secrets', () => {
  const subject = config();
  const target = 'https://fixture.test/private-account?token=secret';
  const input = { ...subject, target, fixtures: [{ ...subject.fixtures[0], url: target }] };
  const prepared = prepareBrowserRun(input);
  assert.deepEqual(prepared, prepareBrowserRun(input));
  assert.equal(prepared.targetOrigin, 'https://fixture.test');
  assert.equal(prepared.fixtureCount, 1);
  assert.ok(Object.isFrozen(prepared) && Object.isFrozen(prepared.limits) && Object.isFrozen(prepared.authorizedOrigins));
  assert.doesNotMatch(JSON.stringify(prepared), /private-account|token|secret|Original fixture|<html/);
  assert.deepEqual(JSON.parse(JSON.stringify(prepared)), prepared);
});

test('valid fixture configuration never returns successful browser execution or observations', () => {
  const result = inspectPage(config());
  assert.equal(result.status, 'not-executed');
  assert.equal(result.error.code, 'browser-unavailable');
  assert.deepEqual(result.coverage, { navigation: 'not-run', readiness: 'not-run', observations: 'not-collected' });
  assert.equal(Object.hasOwn(result, 'observations'), false);
});

test('malformed URLs, credentials, fragments, unsupported schemes, and control characters fail closed', () => {
  for (const target of ['relative/path', 'not a url', 'file:///etc/passwd', 'data:text/html,hello', 'javascript:alert(1)',
    'ftp://fixture.test/page', 'https://user:password@fixture.test/page', 'https://fixture.test/page#secret', 'https://fixture.test/page#',
    'https://fixture.test/\npage', 'https:\\fixture.test/page', 'https://fixture.test/' + 'x'.repeat(2048)]) {
    assert.throws(() => prepareBrowserRun({ ...config(), target }), PreparationError);
  }
});

test('all literal IP destinations, alternate representations, local names, and metadata names are denied', () => {
  for (const host of ['127.0.0.1', '127.1', '2130706433', '0x7f000001', '0177.0.0.1',
    '10.0.0.1', '172.16.0.1', '192.168.1.1', '0.0.0.0', '169.254.169.254', '100.100.100.200',
    '[::1]', '[::]', '[fd00::1]', '[fe80::1]', '[::ffff:127.0.0.1]', '[fd00:ec2::254]',
    'localhost', 'service.localhost', 'metadata.google.internal', 'example.com', '8.8.8.8', '[2606:4700:4700::1111]']) {
    const url = `http://${host}/`;
    assert.throws(() => prepareBrowserRun({ ...config(), target: url, authorizedOrigins: [url] }), PreparationError, host);
  }
});

test('origin grants are exact and do not authorize another scheme, port, or subdomain', () => {
  for (const target of ['https://other.fixture.test/page', 'http://fixture.test/page', 'https://fixture.test:444/page']) {
    assert.throws(() => prepareBrowserRun({ ...config(), target }), /authorized offline fixture set/);
  }
  for (const authorizedOrigins of [['https://fixture.test/path'], ['https://fixture.test/?token=x'],
    ['https://fixture.test', 'https://fixture.test:443']]) {
    assert.throws(() => prepareBrowserRun({ ...config(), authorizedOrigins }), PreparationError);
  }
});

test('configured redirects terminate at an explicitly authorized document fixture', () => {
  const subject = config();
  const input = { ...subject, target: 'https://fixture.test/start', fixtures: [
    { url: 'https://fixture.test/start', kind: 'redirect', location: subject.target }, ...subject.fixtures,
  ] };
  assert.equal(prepareBrowserRun(input).fixtureCount, 2);
  for (const location of ['https://unauthorized.test/page', 'http://127.0.0.1/', 'https://fixture.test/missing']) {
    assert.throws(() => prepareBrowserRun({ ...input, fixtures: [{ ...input.fixtures[0], location }, ...subject.fixtures] }), PreparationError);
  }
  assert.throws(() => prepareBrowserRun({ ...input, fixtures: [
    { ...input.fixtures[0], location: input.target }, ...subject.fixtures,
  ] }), PreparationError);
});

test('subresource fixtures also require exact authorized origins and cannot serve as navigation documents', () => {
  const subject = config();
  const script = { url: 'https://fixture.test/code.js', kind: 'script', body: 'document.documentElement.dataset.fixture = "ready";' };
  assert.equal(prepareBrowserRun({ ...subject, fixtures: [...subject.fixtures, script] }).fixtureCount, 2);
  assert.throws(() => prepareBrowserRun({ ...subject, fixtures: [...subject.fixtures, { ...script, url: 'https://other.test/code.js' }] }), PreparationError);
  assert.throws(() => prepareBrowserRun({ ...subject, target: script.url, fixtures: [...subject.fixtures, script] }), PreparationError);
});

test('timeouts and resource budgets reject zero, fractional, nonfinite, excessive, and contradictory values', () => {
  for (const limits of [{ navigationMs: 0 }, { readinessMs: -1 }, { executionMs: 1 }, { maxRequests: 501 },
    { maxDomElements: 50_001 }, { navigationMs: 30_001 }, { readinessMs: 15_001 }, { executionMs: 60_001 },
    { maxRequests: 1.5 }, { executionMs: Infinity }, { executionMs: NaN }, { unexpected: true }]) {
    assert.throws(() => prepareBrowserRun({ ...config(), limits }), PreparationError);
  }
  const prepared = prepareBrowserRun({ ...config(), limits: { navigationMs: 1000, readinessMs: 500, executionMs: 1500 } });
  assert.equal(prepared.limits.executionMs, 1500);
});

test('per-fixture, aggregate byte, and fixture-count limits use finite budgets', () => {
  const subject = config();
  const fixture = { url: subject.target, kind: 'document', body: 'x'.repeat(256 * 1024) };
  assert.equal(prepareBrowserRun({ ...subject, fixtures: [fixture] }).fixtureBytes, 256 * 1024);
  assert.throws(() => prepareBrowserRun({ ...subject, fixtures: [{ ...fixture, body: fixture.body + 'x' }] }), /resource limit/);
  const many = Array.from({ length: 9 }, (_, index) => ({ ...fixture, url: index === 0 ? subject.target : `https://fixture.test/${index}` }));
  assert.throws(() => prepareBrowserRun({ ...subject, fixtures: many }), /resource limit/);
  assert.throws(() => prepareBrowserRun({ ...subject, fixtures: Array.from({ length: 33 }, (_, index) => ({ ...fixture, url: `https://fixture.test/${index}`, body: '' })) }), /resource limit/);
});

test('unexpected page-state, permission, executable, and live-mode options are rejected', () => {
  for (const patch of [{ mode: 'live' }, { permissions: ['geolocation'] }, { executablePath: '/binary' },
    { readyScript: 'arbitrary code' }, { expectedPageState: 'complete' }, { allowPrivate: true }]) {
    assert.throws(() => prepareBrowserRun({ ...config(), ...patch }), PreparationError);
  }
  assert.throws(() => prepareBrowserRun({ ...config(), fixtures: [{ ...config().fixtures[0], headers: { 'set-cookie': 'secret' } }] }), PreparationError);
});

test('untrusted accessors, proxies, inherited properties, and sparse input are rejected without executing getters', () => {
  let calls = 0;
  const subject = { ...config() };
  Object.defineProperty(subject, 'target', { enumerable: true, get: () => { calls++; throw new Error('Must not execute'); } });
  for (const input of [subject, Object.create(config()), new Proxy(config(), {}), { ...config(), fixtures: new Array(1) }]) {
    assert.throws(() => prepareBrowserRun(input), PreparationError);
  }
  assert.equal(calls, 0);
});

test('execution errors contain fixed sanitized messages and never echo URLs or fixture content', () => {
  for (const input of [{ ...config(), target: 'https://user:SECRET@fixture.test/private?token=SECRET' },
    { ...config(), ['\u001b[H\nSECRET']: true }, null]) {
    const result = inspectPage(input);
    assert.equal(result.status, 'not-executed');
    assert.equal(result.error.code, 'invalid-configuration');
    assert.doesNotMatch(JSON.stringify(result), /SECRET|private|token|fixture\.test/);
    assert.doesNotMatch(result.error.message, /[\u0000-\u001f\u007f-\u009f]/);
  }
});
