# Foundation architecture

The foundation separates data validation, rule authoring, and command handling.
It provides static declaration rules and a non-executing browser adapter. It has
no reporting engine, automatic correction, AI judgment, or baseline comparison.

The offline Phase 2 preparation layer is documented in
[browser-security.md](browser-security.md). It validates fixture configurations
and reports browser execution as unavailable. It does not change the audit/rule
contracts or existing CLI behavior. Phase 2A supplies a non-executing adapter
that verifies installed/cached browser metadata and always denies launch.

| Module | Responsibility |
| --- | --- |
| `src/schema.ts` | Versioned audit, finding, evidence, and outcome types; strict runtime assertion functions |
| `src/rule.ts` | Generic rule contract, metadata validation, applicability gate, validated evaluation |
| `src/cli/run.ts` | Argument handling and saved JSON validation with injected I/O |
| `src/cli/main.ts` | Node file/stream adapter, package version loading, process exit status |
| `src/cli/input.ts` | Verified regular-file handles and bounded report reads |
| `src/diagnostics.ts` | Escaped, bounded terminal-safe diagnostic text |
| `src/static/parse-html.ts` | Inert HTML parsing and bounded, source-aware node projection |
| `src/static/report.ts` | Versioned local-source report, strict validation, bounded JSON and static orchestration |
| `src/static/rules/index.ts` | Four source declaration rules using the existing rule contract |
| `src/browser/prepare.ts` | Offline fixture authorization and planned-budget validation |
| `src/browser/inspect.ts` | Explicit not-executed results and uncollected coverage |
| `src/browser/contracts.ts` | Future adapter/session/supervisor interfaces and security requirements |
| `src/browser/timeouts.ts` | Pure deadline arithmetic; no runtime cancellation or process control |
| `src/browser/compatibility.ts` | Installed package/cache metadata checks; no browser launch |
| `src/browser/nonexecuting-adapter.ts` | Fail-closed adapter and explicit boundary-unverified results |
| `tests/` | Original fixtures, contract tests, static declaration rule tests, and CLI integration tests |

Data flows from untrusted JSON through runtime validation before the CLI reads
typed fields. Unknown object fields are rejected so misspellings and accidental
schema drift do not silently pass. Assertions validate without mutating input.
Objects must have the standard or null prototype and enumerable own data
properties; accessors, custom serialization hooks, symbols, and proxies are
unsupported. Arrays must be plain, dense arrays without extra properties or
accessors. Accepted contracts retain validity through JSON serialization/parsing
provided the caller does not mutate the data or built-in prototypes afterward.

A future runner can provide any context type to a rule. It must record execution
errors separately from completed rule outcomes. `evaluateRule` propagates thrown
errors and never converts an unavailable input or exception into a pass. Static orchestration is documented in [static-report.md](static-report.md);
the original HTTP-target audit contract remains unchanged.

## Static HTML parsing

`parseHtml(source, limits?)` uses installed parse5 8.0.1 to parse one complete
HTML document from an in-memory string. It performs no file/resource loading,
script execution, browser invocation, project-config loading, or plugin loading.
The parser adds no CLI commands or report-schema changes. This is authored-source
analysis, not rendered DOM, layout, accessibility-tree, or interaction analysis.

The immutable result retains the original `source` unchanged and exposes a flat,
document-order preorder node list with numeric IDs, parent IDs, depth, node kind,
element namespaces/attributes, text/comment values, and available source spans.
The raw parse5 tree and its cyclic parent pointers are private. Document children
and template-content fragments are traversed explicitly with an iterative stack;
fragments count as nodes and contribute to depth. This representation contains
untrusted source data and must not be logged wholesale as a diagnostic.

Locations use half-open JavaScript UTF-16 string offsets: use
`source.slice(startOffset, endOffset)`, never byte-buffer slicing. Parser line and
column values are preserved. No newline, Unicode, or entity normalization is
applied to the original source. A leading decoded UTF-8 BOM is treated as an
encoding marker: the private parser input substitutes one ignored space to retain
all original UTF-16 offsets and columns. The original source/byte count is kept;
an interior BOM remains text. Decoded node/attribute values can differ from
their original slices. Implicit elements have null source/tag spans, not invented
positions; an authored node may also lack an explicit end tag. Duplicate
attributes follow parse5 recovery: the first retained value/location is exposed
and a duplicate-attribute diagnostic records the parser observation.

`scriptingEnabled: true` is explicit. It models script-enabled HTML parsing, so
`noscript` fallback markup is text rather than active elements. It does not run
scripts. Template fragments are represented as inert source, not active page DOM.

| Limit | Hard ceiling |
| --- | ---: |
| Source, measured as UTF-8 bytes of the input string | 1 MiB (1,048,576 bytes) |
| Nodes, including document, doctype, text, comments and template fragments | 50,000 |
| Depth, with document root at zero | 256 |
| Parser-error diagnostics | 100 |
| Serialized diagnostic array, including JSON punctuation, in UTF-8 | 32 KiB |
| Diagnostic message text | 512 characters |
| Explicit HTML input files in the static CLI | 8 |

Limit overrides may only lower ceilings and must be positive safe integers;
the diagnostic array budget is at least two bytes. Every limit failure throws
`HtmlParseError` with a fixed code/message and returns no partial result. Parser
errors within budget are recoverable observations, not accessibility findings or
conformance claims. Diagnostics contain codes and spans, not source snippets,
absolute paths, arbitrary attribute names, or resource URLs.

Parse5 constructs the full tree before projection. Node/depth limits bound the
returned representation and traversal, not parse5's earlier allocations or CPU
work. The size/error limits do not establish a hard memory/time boundary. There
is no worker, cancellation, execution deadline, or OS isolation in this phase;
untrusted-input resource isolation remains future work. Browser-security controls
and the existing non-executing adapter remain unchanged.

## Rule contract

Rules declare an identifier, implementation version, description, applicability
description, nonempty limitations, and reference URLs. `applies(context)` returns
a boolean applicability decision with an explanation. Inapplicable rules skip
evaluation. Applicable rules return pass, fail, or needs-review from
`evaluate(context)`; results are validated before being returned.

A pass requires evidence. A failure or needs-review outcome requires at least
one finding, with impact, recommendation, verification steps, severity,
confidence, evidence, and references. A needs-review outcome records an unresolved
observation rather than an established violation. Severity describes estimated
impact; confidence describes certainty. Neither is a conformance score.

## Evaluation boundaries

Tests exercise contract correctness and the declared static-rule behavior, not WCAG conformance detection accuracy. They cover
malformed input, cross-field identity checks, applicability decisions, skipped
evaluation, error propagation, CLI streams and exit codes, and the actual built
entrypoint. All example observations are synthetic.

Before browser implementation, define navigation and request policies, isolation,
timeouts, output redaction, and a labeled evaluation corpus. Before production
rules, independently derive applicability, assumptions, and expected outcomes
from public standards and document supported and unsupported cases.

## Security boundaries

The CLI reads only explicitly supplied local JSON reports or HTML sources. It does not fetch
target or reference URLs, render HTML, or execute target content. Network requests
are limited to separately invoked package-management commands.

Do not place secrets in audit data. URL validation excludes embedded credentials
but does not redact query strings, fragments, evidence, or arbitrary text.
Malformed JSON receives a generic message; file errors do not expose filesystem
error details. Schema errors include escaped, bounded field paths. Diagnostic
text escapes C0/C1 controls, ANSI escapes, bidi/invisible formatting characters,
and lone surrogates. Error text is capped at 512 characters, excluding the fixed
CLI prefix and final newline; input values are not echoed.

Report input is limited to 10 MiB (10,485,760 bytes). The reader rejects
non-regular files and final-component symlinks, opens with NOFOLLOW and NONBLOCK
where available, and checks the opened handle's type and device/inode identity
against the initial lstat. All reads use that handle, with a read-buffer allocation
and read budget of 10 MiB plus one byte; the extra byte detects growth. The
opened size is checked before and after reading, and handles close on all paths.
Replacing the pathname after opening cannot redirect reads to another file.

Windows lacks the same POSIX open guarantees; the preliminary type check and
opened identity checks still apply, but the Windows behavior has not been tested.
Ancestor-directory symlinks are allowed. Identity checks and bounded reads do not
provide a transactional snapshot of a concurrently modified file, prevent every
possible device-open side effect in a hostile replacement race, or impose a
deadline on slow/network filesystems. This remains local file tooling, not a
sandbox for adversarial filesystems. No browser behavior is introduced.

## Static declaration rules

The four rules are documented in [static-rules.md](static-rules.md). They accept
`ParsedHtml` through the existing `Rule` interface and `evaluateRule`; the static workflow is documented in [static-report.md](static-report.md). Browser
execution remains deferred.
