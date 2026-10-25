import { isIP } from 'node:net';
import { types } from 'node:util';

/** Offline preflight only. No DNS, HTTP client, browser, or executable content. */
export type PreparationCode = 'invalid-configuration' | 'destination-denied' | 'fixture-limit';
export class PreparationError extends Error {
  constructor(public readonly code: PreparationCode) {
    super(code === 'destination-denied' ? 'Destination is outside the authorized offline fixture set'
      : code === 'fixture-limit' ? 'Offline fixture resource limit exceeded'
      : 'Invalid offline browser configuration');
    this.name = 'PreparationError';
  }
}

export interface BrowserLimits {
  readonly navigationMs: number;
  readonly readinessMs: number;
  readonly executionMs: number;
  readonly maxRequests: number;
  readonly maxDomElements: number;
}
export interface FixtureRunConfiguration {
  readonly mode: 'fixtures-only';
  readonly target: string;
  readonly authorizedOrigins: readonly string[];
  readonly fixtures: readonly (
    | { readonly url: string; readonly kind: 'document' | 'script' | 'stylesheet'; readonly body: string }
    | { readonly url: string; readonly kind: 'redirect'; readonly location: string }
  )[];
  readonly limits?: Partial<BrowserLimits>;
}
export interface PreparedBrowserRun {
  readonly mode: 'fixtures-only';
  /** Origin only: paths, query parameters, fragments, and credentials never appear. */
  readonly targetOrigin: string;
  readonly authorizedOrigins: readonly string[];
  readonly fixtureCount: number;
  readonly fixtureBytes: number;
  /** Planned budgets; no browser exists here to enforce runtime deadlines. */
  readonly limits: BrowserLimits;
}

export const DEFAULT_BROWSER_LIMITS: BrowserLimits = Object.freeze({
  navigationMs: 10_000, readinessMs: 5_000, executionMs: 20_000,
  maxRequests: 100, maxDomElements: 10_000,
});
const MAX_LIMITS: BrowserLimits = Object.freeze({
  navigationMs: 30_000, readinessMs: 15_000, executionMs: 60_000,
  maxRequests: 500, maxDomElements: 50_000,
});
const MAX_FIXTURE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

function fail(code: PreparationCode = 'invalid-configuration'): never { throw new PreparationError(code); }

function record(value: unknown, allowed: readonly string[], required: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || types.isProxy(value)) fail();
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail();
  const copy = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail();
    copy[key] = descriptor.value;
  }
  if (required.some((key) => !Object.hasOwn(copy, key))) fail();
  return copy;
}
function list(value: unknown, maximum: number): unknown[] {
  if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  if (value.length === 0 || value.length > maximum) fail('fixture-limit');
  if (Reflect.ownKeys(value).length !== value.length + 1) fail();
  const copy: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail();
    copy.push(descriptor.value);
  }
  return copy;
}
function fixtureUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f-\u009f\\]/u.test(value)) fail();
  let url: URL;
  try { url = new URL(value); } catch { return fail(); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || value.includes('#')) fail();
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // All IPs (including public IPs) are denied. WHATWG URL parsing canonicalizes
  // alternate IPv4 forms first. No hostname is ever resolved or connected to.
  if (isIP(host) !== 0 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+test$/.test(host)) {
    fail('destination-denied');
  }
  return url;
}

/** Returns only a redacted, immutable summary, never fixture bodies or target paths. */
export function prepareBrowserRun(input: unknown): PreparedBrowserRun {
  const config = record(input, ['mode', 'target', 'authorizedOrigins', 'fixtures', 'limits'], ['mode', 'target', 'authorizedOrigins', 'fixtures']);
  if (config.mode !== 'fixtures-only') fail();
  const target = fixtureUrl(config.target);
  const origins = list(config.authorizedOrigins, 8).map((value) => {
    const url = fixtureUrl(value);
    if (url.pathname !== '/' || url.search) fail();
    return url.origin;
  });
  if (new Set(origins).size !== origins.length) fail();
  function authorized(value: unknown): URL {
    const url = fixtureUrl(value);
    if (!origins.includes(url.origin)) fail('destination-denied');
    return url;
  }
  authorized(config.target);
  const limits = { ...DEFAULT_BROWSER_LIMITS };
  if (Object.hasOwn(config, 'limits')) {
    const overrides = record(config.limits, Object.keys(limits), []);
    for (const key of Object.keys(overrides) as (keyof BrowserLimits)[]) {
      const value = overrides[key];
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_LIMITS[key]) fail();
      limits[key] = value;
    }
  }
  if (limits.executionMs < limits.navigationMs + limits.readinessMs) fail();
  let fixtureBytes = 0;
  const fixtures = list(config.fixtures, 32);
  const entries = new Map<string, 'document' | 'script' | 'stylesheet' | 'redirect'>();
  const redirects = new Map<string, string>();
  for (const raw of fixtures) {
    const fixture = record(raw, ['url', 'kind', 'body', 'location'], ['url', 'kind']);
    const url = authorized(fixture.url);
    if (entries.has(url.href)) fail();
    if (fixture.kind === 'redirect') {
      if (Object.hasOwn(fixture, 'body') || !Object.hasOwn(fixture, 'location')) fail();
      // Absolute destinations only: no implicit origin inheritance or DNS.
      redirects.set(url.href, authorized(fixture.location).href);
    } else {
      if (typeof fixture.kind !== 'string' || !['document', 'script', 'stylesheet'].includes(fixture.kind) || typeof fixture.body !== 'string'
        || Object.hasOwn(fixture, 'location')) fail();
      const bytes = Buffer.byteLength(fixture.body);
      if (bytes > MAX_FIXTURE_BYTES) fail('fixture-limit');
      fixtureBytes += bytes;
      if (fixtureBytes > MAX_TOTAL_BYTES) fail('fixture-limit');
    }
    entries.set(url.href, fixture.kind as 'document' | 'script' | 'stylesheet' | 'redirect');
  }
  if (!entries.has(target.href)) fail('destination-denied');
  // A navigation/redirect must terminate in a document; reject cycles and
  // missing destinations before any future browser could be started.
  for (const start of [target.href, ...redirects.keys()]) {
    let current = start;
    const seen = new Set<string>();
    while (redirects.has(current)) {
      if (seen.has(current)) fail();
      seen.add(current);
      current = redirects.get(current)!;
    }
    if (entries.get(current) !== 'document') fail('destination-denied');
  }
  return Object.freeze({
    mode: 'fixtures-only', targetOrigin: target.origin,
    authorizedOrigins: Object.freeze([...origins].sort()), fixtureCount: fixtures.length, fixtureBytes,
    limits: Object.freeze(limits),
  });
}
