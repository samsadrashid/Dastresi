# Browser runner interfaces, deadlines, and test gate

This contains offline design and arithmetic plus a Phase 2A non-executing adapter.
There is no executing adapter, supervisor implementation, browser process, or
network enforcement. The existing
`inspectPage` still returns only `not-executed`; the CLI is unchanged.

## Interfaces

`src/browser/contracts.ts` specifies the future integration points without
importing Playwright or creating executable browser code:

- `BrowserAdapter.start`: receives validated fixture configuration, immutable
  security requirements, a host abort signal, and the launch budget. It returns
  an isolated session only after its policies are installed. It owns cleanup of
  partial launches, including failures before a session becomes available.
- `BrowserSession`: separate navigation, readiness, observation collection, and
  close operations. Every operation receives a host abort signal and absolute
  deadline. Signals express cooperative cancellation, not proof of termination.
- `BrowserObservations`: proposed origin-only final location, title, document
  language, and element/form/link/button/input counts. The adapter must implement
  runtime validation, string limits, count limits, and redaction before returning
  this type. The TypeScript interface alone does not validate page-authored data.
- `BrowserCleanupOutcome`: process-tree cleanup is either verified empty or
  unverified. Closing a transport connection alone cannot produce verified-empty.
- `BrowserSupervisor`: arms an independent deadline and terminates/verifies the
  browser process tree. This must operate outside a potentially wedged worker.

These types do not add a browser success outcome to the current public API.
Before introducing one, specify a runtime schema that requires complete coverage,
valid observations, and verified cleanup. Any blocked request, timeout, exceeded
budget, unsupported state, cancellation, or unverified cleanup must prevent an
unqualified success. Preserve fixed error codes and sanitized messages; never
propagate raw Playwright errors containing URLs, headers, selectors, or page text.

## Security policy

`OFFLINE_BROWSER_REQUIREMENTS` is an immutable declaration of adapter obligations.
Its presence is not proof those obligations are enforced. Exact fixture URL and
resource-kind matching must cover documents, redirects, scripts, styles, and
requests from script execution. Reject unlisted resources and unsupported methods;
count attempts even when blocked. Fixture bodies stay in process memory and are
never written to logs or results. No live browsing, authenticated sessions,
custom browser arguments, caller-supplied executables, or persisted profiles are
part of this contract.

Require the browser sandbox, fresh nonpersistent contexts, no permissions or
credentials, and no downloads/artifacts. Block popups, service workers, and
WebSockets. Close unexpected contexts/pages and report incomplete coverage.
Install policies before creating/navigating a page, including initial redirects.

Use independently enforced deny-all OS egress and DNS for fixture-mode Chromium.
Neither `.test` naming, offline context settings, routing, nor disabled background
features substitute for that boundary. Validate it with external network counters
and forbidden-destination canaries. Browser-level checks must not silently fall
back to real network access. No DNS resolver is needed or supplied in this phase.
See [browser-security.md](browser-security.md) for the live-mode gateway and
DNS/address-pinning requirements, which remain outside the approved scope.

## Timeout model

`src/browser/timeouts.ts` contains pure deadline calculations with no timers,
callbacks, sockets, or process operations. Use one trusted host monotonic clock
throughout a run; page clocks and wall-clock time are unsuitable. Capture the
start before launching a browser and arm the supervisor before any child starts.

Execution deadline = start + validated execution budget. Launch and collection
receive the remaining execution budget. At entry, navigation/readiness deadlines
are the smaller of their phase limit and the execution deadline. A phase never
receives a fresh overall budget. Capture its `StageBudget` once; polling,
redirects, retries, requests, or clock checks must not recompute/reset it.
Zero remaining time means expired and the operation must not start.

Cleanup starts immediately after every outcome. Allow at most 2 seconds from
cleanup entry, additionally capped at execution deadline + 2 seconds. Force
termination after that; allow at most 1 further second, capped at execution
deadline + 3 seconds, to verify no browser descendants remain. An early failure
does not justify waiting until the overall execution deadline to start cleanup.

The model validates finite monotonic timestamps and supported phase durations.
Inputs to `budgetForStage` must be an unmodified model returned by
`createTimeoutModel`; arbitrary deserialized models are unsupported. The future
orchestrator must still connect deadlines to cancellation and an external
supervisor. `Promise.race` alone leaves work running. CPU/memory/process/file
limits require separate OS controls. The timeout helpers do not fix the existing
report-file reader's lack of a read deadline.

## Test plan and acceptance evidence

All fixture HTML/scripts must be original and local. Browser tests must run in
the isolated fixture-only environment, without DNS or external network access.
No listed browser test below has run; the only implemented new tests cover pure
deadline arithmetic in `tests/browser-timeouts.test.ts`.

| Area | Controlled test | Required evidence before acceptance |
| --- | --- | --- |
| Successful navigation | Original document and explicit readiness marker | Exact bounded observations; complete coverage; verified cleanup |
| Determinism | Repeat with fresh contexts and fixed viewport/locale/timezone | Identical observations, no cookies/storage crossing runs |
| Redirects | Same-origin and separately granted origins; cycles/unlisted endpoints | Only exact listed destinations served; failed chains never complete |
| URL handling | Malformed schemes, credentials, alternate IPs, IPv6 and metadata targets | Rejection before launch; fixed redacted errors; zero connections |
| Requests | Fetch/XHR, images, frames, scripts, styles, form submits, redirects | Every request kind checked; attempts counted; no fallback network |
| Other channels | WebSockets, workers, service workers, beacons, WebRTC, speculative/background traffic | App-level rejection plus OS egress evidence; no escape |
| Downloads/popups | Download response, anchor download, new windows | No artifacts or persistent contexts; explicit failure/incomplete status |
| Permissions | Geolocation, camera, microphone, notifications, clipboard attempts | Denied; no prompts or inherited grants |
| Launch failure | Bad executable and process failure after spawn | Partial process tree cleaned without relying on an available session |
| Navigation deadline | Never-ending fixture navigation and redirect loop | Fixed deadline not extended by activity; cleanup verified |
| Readiness deadline | DOM loads but marker never appears | Readiness timeout with incomplete coverage |
| Collection deadline | Script stalls renderer during observation | Overall supervisor deadline works even if worker stops responding |
| Cleanup failure | Browser or driver ignores cooperative close | Bounded escalation and independent process-tree verification |
| Resources | Too many attempts, oversized DOM, oversized responses, large title/lang | Hard bounds; no misleading truncated success |
| Redaction | Secrets in paths, query, fragment, headers, title, and raw errors | Only explicitly allowed bounded fields; no raw error leakage |
| DNS/rebinding | Only relevant after separate live-mode approval | Gateway address pinning, reconnect/redirect checks, direct-egress denial |
| Platforms | Each explicitly supported OS/browser combination | Process-tree and egress controls verified per platform |

Use request counters on controlled fixture/denial endpoints and process inventory
from the external supervisor, not just policy-function mocks. Distinguish
test-only fixture responses from real DNS/network enforcement. A skipped or
environment-dependent test is unavailable evidence, not a pass. Store sanitized
results describing the exact platform, browser/adapter versions, controls, and
coverage. Define an executable browser-test command only after the dependency
and isolation decisions are approved.

## Blocking decisions

Phase 2A installed the approved `playwright-core@1.64.0` and verified the expected
cached Chromium metadata without launching it. Installed license/notices were
reviewed; no advisory scan was run. The non-executing adapter always refuses
launch because the OS boundary and independent supervisor remain unverified.
Browser launch, isolated contexts, actual interception, observation collection,
runtime deadline/cleanup enforcement, and all browser integration tests remain
blocked. No browser was downloaded and no system-browser fallback was introduced.

The dependency is not the only gate: choose and verify the OS egress boundary,
browser sandbox, resource controls, and external process supervisor before
exposing hostile targets. Windows behavior and the report-file read deadline
remain unresolved. Existing offline preparation tests cannot establish these
guarantees.
