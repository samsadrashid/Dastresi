import type { BrowserLimits } from './prepare.js';

export type BrowserStage = 'launch' | 'navigation' | 'readiness' | 'collection' | 'cleanup' | 'termination';
export interface StageBudget {
  readonly deadlineMs: number;
  readonly remainingMs: number;
  readonly expired: boolean;
}
export interface TimeoutModel {
  readonly startedAtMs: number;
  readonly executionDeadlineMs: number;
  readonly cleanupDeadlineMs: number;
  readonly terminationDeadlineMs: number;
  readonly navigationMs: number;
  readonly readinessMs: number;
}

export const CLEANUP_GRACE_MS = 2000;
export const TERMINATION_GRACE_MS = 1000;

/** All times share one host monotonic clock, never page time or Date.now(). */
export function createTimeoutModel(
  limits: Pick<BrowserLimits, 'navigationMs' | 'readinessMs' | 'executionMs'>,
  startedAtMs: number,
): TimeoutModel {
  if (!Number.isFinite(startedAtMs) || startedAtMs < 0 || startedAtMs > Number.MAX_SAFE_INTEGER - 63_000
    || !Number.isSafeInteger(limits.navigationMs) || limits.navigationMs < 1 || limits.navigationMs > 30_000
    || !Number.isSafeInteger(limits.readinessMs) || limits.readinessMs < 1 || limits.readinessMs > 15_000
    || !Number.isSafeInteger(limits.executionMs) || limits.executionMs < limits.navigationMs + limits.readinessMs
    || limits.executionMs > 60_000) throw new RangeError('Invalid browser timeout model');
  const executionDeadlineMs = startedAtMs + limits.executionMs;
  return Object.freeze({
    startedAtMs, executionDeadlineMs,
    cleanupDeadlineMs: executionDeadlineMs + CLEANUP_GRACE_MS,
    terminationDeadlineMs: executionDeadlineMs + CLEANUP_GRACE_MS + TERMINATION_GRACE_MS,
    navigationMs: limits.navigationMs, readinessMs: limits.readinessMs,
  });
}

/** Calculate once when entering a stage; polling must not reset its deadline. */
export function budgetForStage(model: TimeoutModel, stage: BrowserStage, nowMs: number): StageBudget {
  if (!Number.isFinite(nowMs) || nowMs < model.startedAtMs || nowMs > Number.MAX_SAFE_INTEGER - 63_000) {
    throw new RangeError('Invalid browser monotonic time');
  }
  let deadlineMs: number;
  switch (stage) {
    case 'launch': case 'collection': deadlineMs = model.executionDeadlineMs; break;
    case 'navigation': deadlineMs = Math.min(nowMs + model.navigationMs, model.executionDeadlineMs); break;
    case 'readiness': deadlineMs = Math.min(nowMs + model.readinessMs, model.executionDeadlineMs); break;
    case 'cleanup': deadlineMs = Math.min(nowMs + CLEANUP_GRACE_MS, model.cleanupDeadlineMs); break;
    case 'termination': deadlineMs = Math.min(nowMs + TERMINATION_GRACE_MS, model.terminationDeadlineMs); break;
    default: throw new RangeError('Invalid browser lifecycle stage');
  }
  return Object.freeze({ deadlineMs, remainingMs: Math.max(0, deadlineMs - nowMs), expired: nowMs >= deadlineMs });
}
