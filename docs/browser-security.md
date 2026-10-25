# Phase 2 offline preparation and security boundary

## Current Phase 2A scope

Offline preparation has been preserved. The user subsequently approved installing
exactly `playwright-core@1.64.0`; it is now installed. Only the approved npm
registry was accessed for installation. No browser was launched, browser request
made, target DNS resolved, or external page opened. This is not a completed browser
runner and cannot collect observations from a page.

`NonExecutingPlaywrightAdapter` implements the existing start contract but never
launches. It checks fixture configuration, cancellation/deadline state, and trusted
installed-package/cache metadata, then rejects with `boundary-unverified`.
`inspectFixturePage` converts this into a versioned `not-executed` result with
uncollected coverage and cleanup marked `not-applicable-no-browser`. Missing,
mismatched, and unsupported browser metadata receive separate fixed error codes.
No caller flag can assert that a boundary is safe and enable launch.

The installed package expects revision 1248, Chromium 156.0.8078.4. The expected
cached full Chromium executable is present on macOS ARM64; its application version
and Mach-O architecture metadata match. This is metadata-only evidence, not binary
authenticity, protocol compatibility, runtime sandbox, or security verification.
Only the approved full macOS ARM64 cache layout is checked; other platforms are
explicitly unsupported. No automatic system-browser fallback exists.

Typed adapter/session interfaces, a pure timeout model, and the detailed future
integration test matrix are in [browser-runner-plan.md](browser-runner-plan.md).
They specify obligations without supplying browser execution or OS enforcement.

`src/browser/prepare.ts` validates configuration and returns an immutable, redacted
summary. `src/browser/inspect.ts` performs that preflight, then reports
`status: not-executed` and `browser-unavailable`. Bad configurations return a
specific preparation error. Navigation/readiness coverage remains `not-run`, and
observations remain `not-collected`. There is no success variant or empty
observation payload that might imply a successful scan. The original audit result
schema and CLI are unchanged; browser preparation has its own versioned result.

## Implemented offline contract

Configuration is accepted only with `mode: fixtures-only`. The target must match
an explicit document fixture or a redirect chain ending in one. Origins are exact
scheme/hostname/port grants; no wildcard or subdomain inheritance is supported.
Only HTTP(S) hosts ending in `.test` qualify. This suffix is a fixture naming
convention, not proof that DNS or a browser cannot reach a real service.

All literal IP addresses are denied, including public IPs, private/loopback ranges,
link-local addresses, metadata addresses, IPv6, and IPv4-mapped IPv6. WHATWG URL
parsing canonicalizes alternate IPv4 representations before this check. Ordinary
DNS names, localhost names, metadata names, credentials, fragments, URL control
characters, and backslashes are rejected. No DNS resolution occurs. Consequently
DNS rebinding is not handled by a browser or resolver in this implementation;
there is simply no connection path. Live URL support is absent.

Fixture entries are document/script/stylesheet strings or explicit absolute
redirect destinations. Every entry and redirect destination needs an exact
origin grant; redirects must reach a listed document, without cycles. Duplicate
fixture URLs, unexpected fields, response headers, permission grants, executable
paths, and caller-provided execution code are unsupported. Inputs must be plain
objects/arrays with own enumerable data fields; getters, proxies, inherited
required fields, and sparse arrays are rejected without executing application
getters. Fixture strings are treated as data and are never evaluated or parsed.

| Budget | Default | Maximum |
| --- | ---: | ---: |
| Navigation | 10,000 ms | 30,000 ms |
| Readiness | 5,000 ms | 15,000 ms |
| Overall execution | 20,000 ms | 60,000 ms |
| Requests | 100 | 500 |
| DOM elements | 10,000 | 50,000 |

Durations/counts must be positive safe integers. The execution budget must cover
the sum of navigation and readiness budgets. These are **validated planned
budgets**, not runtime controls: no timer or browser consumes them yet.

Preparation enforces at most eight origin grants, 32 fixtures, 256 KiB per body,
and 2 MiB of total fixture-body UTF-8 bytes. URLs are limited to 2,048 UTF-16 code
units. Prepared summaries include counts, budgets, and origins only; paths,
queries, fragments, and fixture bodies are omitted. Preparation errors contain
fixed text, never caller values or underlying exception messages. A successful
preflight is not successful navigation, readiness, execution, or coverage.

## Deferred observation contract

When browser execution is separately approved, define and runtime-validate a
distinct success result before collecting data. Proposed minimal fields:

- Final URL redacted to origin only, removing the entire path, query, fragment,
  and credentials. Full URLs must not appear in logs or execution errors.
- Page title, capped at 256 characters, and document-root `lang`, capped at 64.
  These are page-authored content and may contain personal data; collect only
  with explicit authorization and do not add screenshots, text dumps, or cookies.
- DOM metadata limited to numeric counts of elements, forms, links, buttons, and
  inputs. No attributes, text content, field values, IDs, or selectors are planned.
- Explicit navigation/readiness/observation coverage and separate execution errors.
  Truncation, exceeded limits, unsupported states, policy blocks, and cleanup
  failure must yield incomplete/error status rather than success.

No observation collection or runtime schema for a successful browser result is
implemented here. This proposal must be reviewed alongside the browser adapter.

## Browser adapter and operating-system requirements

URL parsing and Playwright request interception are not an egress security boundary.
A later test adapter should fulfill all allowed requests from a fixture map,
abort unmatched requests, disable network access in the context, block service
workers and WebSockets, reject downloads and popups, deny permissions, and use
fresh nonpersistent contexts. It must account for script-initiated requests,
redirects, workers, speculative traffic, and browser background traffic. These
behaviors require real Chromium integration tests; none is claimed here.

Hostile targets require enforcement outside JavaScript and browser routing:

- Run Chromium as an unprivileged user with its sandbox enabled, without host
  credentials, shared profile directories, or sensitive mounts.
- Use a disposable container/VM/network namespace with deny-by-default egress.
  For fixture-only tests, deny all IP egress and DNS. For live browsing, allow
  only an enforcing gateway; prohibit direct browser connections and DNS.
- The gateway must resolve and validate all returned IPv4/IPv6 addresses, reject
  private/reserved/loopback/link-local/metadata destinations, pin the checked
  addresses for connection, validate every redirect/request, and revalidate on
  reconnect. A DNS precheck followed by browser-controlled resolution is unsafe.
- Impose process, memory, CPU, file-descriptor, disk, and response-byte limits.
  Enforce an external wall-clock deadline for the whole browser process tree.
  Cooperative Playwright timeouts do not stop a hung driver or browser.
- Close contexts and Chromium on every outcome; use bounded shutdown followed by
  supervised process-tree termination. Verify no child or browser processes remain.

The current macOS workspace provides no verified, project-controlled container,
network namespace, egress firewall, or process supervisor. No such boundary was
configured or tested. Browser subprocess isolation, actual timeouts, download and
permission handling, cleanup, DNS pinning, and rebinding protection remain
unimplemented. A non-browser deny-network sandbox probe failed with
`sandbox_apply: Operation not permitted`; reading the local Docker image inventory
failed with permission denied on the daemon socket. The presence of Docker,
`sandbox-exec`, and firewall tools does not establish isolation. No additional
permission was sought to alter that boundary, and Chromium was not launched.
Windows and Linux browser behavior remain untested as well.

The existing report-file reader also still lacks a wall-clock read deadline;
Phase 1.1's byte budget is not a duration guarantee.

## Tests and remaining gate

`tests/browser-preparation.test.ts` exercises real preparation functions using
original fixture strings: URL parsing/normalization, IP/name rejection, exact
origin grants, configured redirect chains, fixture kinds and byte limits,
planned budgets, malformed structures, deterministic redacted summaries, and
explicit nonexecution/error results. These tests are neither browser integration
tests nor claims that redirects, subresources, downloads, or scripts were run.

Actual controlled-fixture navigation, authorized/unauthorized redirect behavior,
navigation/readiness deadlines, script-initiated requests, network escape attempts,
downloads, browser cleanup, oversized live DOMs, and captured observations all
remain blocked on isolation and process-supervision work.

The approved exact dependency is installed; see [dependencies.md](dependencies.md).
No browser download is authorized by that dependency installation. Tests of the
non-executing adapter include real installed-package/cache metadata checks and
guards that assert no Playwright launch API is called. These are not browser
integration tests. Metadata reads use trusted local installation/cache files and
have no independent filesystem read deadline; launch-budget checks before and
after them do not turn them into bounded-duration I/O.
