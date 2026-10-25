import { performance } from 'node:perf_hooks';
import { checkCachedChromium, BrowserMetadataError, type BrowserCompatibility, type BrowserMetadataCode } from './compatibility.js';
import { OFFLINE_BROWSER_REQUIREMENTS, type BrowserAdapter, type BrowserSession, type BrowserStartRequest } from './contracts.js';
import { prepareBrowserRun, PreparationError, type FixtureRunConfiguration, type PreparationCode } from './prepare.js';
import { budgetForStage, createTimeoutModel } from './timeouts.js';

type AdapterCode = BrowserMetadataCode | PreparationCode | 'boundary-unverified' | 'cancelled' | 'execution-timeout';
export class BrowserAdapterError extends Error {
  constructor(public readonly code: 'boundary-unverified' | 'cancelled' | 'execution-timeout', public readonly browser?: BrowserCompatibility) {
    super(code === 'boundary-unverified' ? 'Browser launch denied: OS egress isolation and independent process supervision are unverified'
      : code === 'cancelled' ? 'Browser request was cancelled before launch' : 'Browser launch budget expired');
    this.name = 'BrowserAdapterError';
  }
}

/** Deliberately cannot launch, even if a caller claims its boundary is safe. */
export class NonExecutingPlaywrightAdapter implements BrowserAdapter {
  async start(request: BrowserStartRequest): Promise<BrowserSession> {
    prepareBrowserRun(request.configuration);
    if (request.requirements !== OFFLINE_BROWSER_REQUIREMENTS) throw new PreparationError('invalid-configuration');
    const checkBudget = () => {
      if (request.signal.aborted) throw new BrowserAdapterError('cancelled');
      if (request.budget.expired || request.budget.remainingMs <= 0 || performance.now() >= request.budget.deadlineMs) {
        throw new BrowserAdapterError('execution-timeout');
      }
    };
    checkBudget();
    const browser = await checkCachedChromium();
    checkBudget();
    // There is no launch call, unsafe flag, caller override, or system-browser fallback.
    // No browser/session exists, so browser cleanup is not applicable.
    throw new BrowserAdapterError('boundary-unverified', browser);
  }
}

export interface FixtureInspectionResult {
  readonly schemaVersion: 'browser-adapter-1';
  readonly status: 'not-executed';
  readonly boundary: 'unverified';
  readonly coverage: {
    readonly navigation: 'not-run'; readonly readiness: 'not-run'; readonly observations: 'not-collected';
  };
  readonly cleanup: 'not-applicable-no-browser';
  readonly error: { readonly code: AdapterCode; readonly message: string };
  readonly browser?: BrowserCompatibility;
}

/** Metadata preflight only. Never starts Chromium, DNS, or HTTP requests. */
export async function inspectFixturePage(input: unknown): Promise<FixtureInspectionResult> {
  let code: AdapterCode = 'invalid-configuration';
  let message = 'Invalid offline browser configuration';
  let browser: BrowserCompatibility | undefined;
  try {
    const prepared = prepareBrowserRun(input);
    const started = performance.now();
    const model = createTimeoutModel(prepared.limits, started);
    await new NonExecutingPlaywrightAdapter().start({
      configuration: input as FixtureRunConfiguration, requirements: OFFLINE_BROWSER_REQUIREMENTS,
      signal: new AbortController().signal, budget: budgetForStage(model, 'launch', started),
    });
  } catch (error) {
    if (error instanceof BrowserAdapterError || error instanceof BrowserMetadataError || error instanceof PreparationError) {
      code = error.code;
      message = error.message;
      if (error instanceof BrowserAdapterError) browser = error.browser;
    }
  }
  return Object.freeze({
    schemaVersion: 'browser-adapter-1', status: 'not-executed', boundary: 'unverified',
    coverage: Object.freeze({ navigation: 'not-run', readiness: 'not-run', observations: 'not-collected' }),
    cleanup: 'not-applicable-no-browser', error: Object.freeze({ code, message }),
    ...(browser ? { browser } : {}),
  });
}
