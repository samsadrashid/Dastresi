import { prepareBrowserRun, PreparationError, type PreparationCode } from './prepare.js';

/** A failed preflight or unavailable browser can never masquerade as observations. */
export interface BrowserExecutionResult {
  readonly schemaVersion: 'browser-preparation-1';
  readonly status: 'not-executed';
  readonly boundary: 'offline-preparation-only';
  readonly coverage: {
    readonly navigation: 'not-run';
    readonly readiness: 'not-run';
    readonly observations: 'not-collected';
  };
  readonly error: {
    readonly code: PreparationCode | 'browser-unavailable';
    readonly message: string;
  };
}

/** Existing offline preparation entrypoint. This function performs no I/O. */
export function inspectPage(input: unknown): BrowserExecutionResult {
  let code: PreparationCode | 'browser-unavailable' = 'browser-unavailable';
  let message = 'Browser execution is unavailable; only offline preparation is implemented';
  try { prepareBrowserRun(input); }
  catch (error) {
    code = error instanceof PreparationError ? error.code : 'invalid-configuration';
    message = error instanceof PreparationError ? error.message : 'Invalid offline browser configuration';
  }
  return Object.freeze({
    schemaVersion: 'browser-preparation-1', status: 'not-executed', boundary: 'offline-preparation-only',
    coverage: Object.freeze({ navigation: 'not-run', readiness: 'not-run', observations: 'not-collected' }),
    error: Object.freeze({ code, message }),
  });
}
