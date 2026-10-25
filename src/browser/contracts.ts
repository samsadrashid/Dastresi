import type { FixtureRunConfiguration } from './prepare.js';
import type { TimeoutModel, StageBudget } from './timeouts.js';

/** Requirements for a future adapter, not evidence that enforcement exists. */
export const OFFLINE_BROWSER_REQUIREMENTS = Object.freeze({
  fixtureRequests: 'exact-url-and-resource-kind-only',
  unmatchedRequests: 'abort',
  outboundNetwork: 'deny-all-at-os-boundary',
  dns: 'deny-all',
  downloads: 'deny',
  permissions: 'deny-all',
  popups: 'deny',
  serviceWorkers: 'deny',
  webSockets: 'deny',
  browserSandbox: 'required',
  context: 'fresh-nonpersistent',
  credentials: 'none',
  artifacts: 'none',
} as const);

/** Proposed output. A future adapter must runtime-validate before publishing it. */
export interface BrowserObservations {
  readonly finalOrigin: string;
  readonly title: string;
  readonly documentLanguage: string;
  readonly dom: {
    readonly elements: number;
    readonly forms: number;
    readonly links: number;
    readonly buttons: number;
    readonly inputs: number;
  };
}

export interface BrowserStageRequest {
  readonly signal: AbortSignal;
  readonly budget: StageBudget;
}
export interface BrowserCleanupRequest {
  readonly signal: AbortSignal;
  readonly budget: StageBudget;
}
export type BrowserCleanupOutcome =
  | { readonly status: 'closed'; readonly processTree: 'verified-empty' }
  | { readonly status: 'unverified'; readonly processTree: 'unknown' };

/** Adapter lifecycle specification only; no implementation is supplied. */
export interface BrowserSession {
  navigate(request: BrowserStageRequest): Promise<void>;
  waitUntilReady(request: BrowserStageRequest): Promise<void>;
  collect(request: BrowserStageRequest): Promise<BrowserObservations>;
  close(request: BrowserCleanupRequest): Promise<BrowserCleanupOutcome>;
}
export interface BrowserStartRequest {
  /** Raw fixture data stays in process memory and must not be logged. */
  readonly configuration: FixtureRunConfiguration;
  readonly requirements: typeof OFFLINE_BROWSER_REQUIREMENTS;
  readonly signal: AbortSignal;
  readonly budget: StageBudget;
}
export interface BrowserAdapter {
  /** start must also clean up a partially launched browser when it rejects. */
  start(request: BrowserStartRequest): Promise<BrowserSession>;
}

/** Independent supervisor needed even when JavaScript or Chromium is wedged. */
export interface BrowserSupervisor {
  arm(deadlines: TimeoutModel): Promise<void>;
  terminateAndVerify(request: BrowserCleanupRequest): Promise<BrowserCleanupOutcome>;
}
