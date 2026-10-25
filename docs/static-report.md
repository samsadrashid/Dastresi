# Static auditing and local-source report

Build, then run against explicitly supplied local HTML:

```sh
npm run build
node dist/src/cli/main.js audit --html ./tests/fixtures/static/declarations.html --format json
node dist/src/cli/main.js audit --html ./first.html --html ./second.html --format json
node dist/src/cli/main.js validate ./saved-report.json
```

For an npm invocation, use `npm --silent start -- audit --html ./first.html
--format json` (on one line). Plain `npm start` writes script banners to stdout;
use silent mode or the direct Node invocation above for machine-readable JSON.

Only `json` is supported; `--format json` is required. Flag order is flexible.
Each `--html` accepts one path. One to eight inputs are allowed; repeated paths
are audited as separate ordered sources. No directory search, glob expansion,
stdin, configuration, plugins, browser, or external resource fetching is added.
Paths beginning with `-` must be supplied with a directory prefix such as `./`.

The additive report format is `dastresi-static`, schemaVersion `1`. Existing
`AuditResult`, `RuleResult`, and `Finding` contracts remain unchanged. The local
report uses no fabricated HTTP target. Its output shape is:

```text
{
  format: "dastresi-static",
  schemaVersion: "1",
  status: "completed" | "incomplete",
  coverage: {
    mode: "static-source",
    renderedPage: "not-executed",
    limitations: [fixed versioned descriptions of unsupported assessments]
  },
  sources: [{
    id: "source-1", kind: "local-html", bytes: 123, parserErrors: 0,
    checks: [
      { status: "executed", result: <existing RuleResult> },
      ...all four rules in their fixed order...
    ]
  }]
}
```

`bytes` is UTF-8 source size including a supplied BOM. A leading BOM is an
encoding marker and does not alter document recovery; original offsets are kept. IDs map to explicit input
argument order and disambiguate evidence across files; there are no filenames,
absolute paths, raw HTML, timestamps, or source-derived titles/attribute values.
The four checks are title, language, image alternative, and explicit label.
Findings retain authored UTF-16 evidence, original identity, and public references
within their source envelope. IDs are scoped to each source and rule result.
See [static-rules.md](static-rules.md) for exact behaviors and limitations.

`completed` means every required static check returned a validated result,
including genuine `not-applicable` cases such as no authored images. It does not
mean pass, accessibility, or full coverage. An input without an authored title
anchor instead gets this check entry:

```json
{
  "status": "not-executed",
  "ruleId": "static-document-title",
  "ruleVersion": "1",
  "reason": "missing-authored-evidence"
}
```

That report is `incomplete` and exits 1. Missing evidence is never presented as
proof of title inapplicability by the workflow. The language rule remains scoped
to authored roots: no authored root is genuine non-applicability for that check.
Coverage always states rendered-page checks are not executed: layout, contrast,
visibility, accessibility tree, complete accessible names, keyboard interaction,
and browser behavior are outside this workflow. No WCAG conformance is claimed.
Aggregate `needs-review` remains distinct from failure and nonexecution; mixed
ambiguous and definitive findings follow the existing rule aggregation policy.
A needs-review rule can contain definite source issues: its explanation reports
separate counts. Exit 4 means no rule has an aggregate fail outcome, not that
there are no definite issues. Inspect all findings rather than using exit 3 as
the only signal for action.

| Exit | Meaning for audit |
| --- | --- |
| 0 | Completed with only pass/not-applicable results |
| 1 | Input, parser-limit, rule, schema, output-limit error, or incomplete required static coverage |
| 2 | Invalid command usage, including more than eight inputs |
| 3 | Completed, at least one failing rule (takes precedence over review) |
| 4 | Completed, review required and no failing rules |

Help/version and structurally valid `validate` inputs still exit 0. Validation
checks structure, not success: an incomplete or failing saved report can be valid.
Errors have fixed/sanitized bounded stderr text and do not include OS details or
paths. For input, parser, required-rule, schema, and output-size failures, stdout
is empty; no earlier-file or partially serialized result is emitted. Incomplete
coverage is the explicit exception: the valid incomplete report goes to stdout,
with exit 1 and no stderr. Callers must inspect both status and exit code.

Malformed HTML is recovered using parse5's documented parser settings, within
existing parser limits. `parserErrors` records the recovery count, not source
snippets or a claim that malformed HTML is accessible. A recoverable parse error
is not a parser execution failure. Exceeding parser or finding limits is fatal.

Input is UTF-8 `.html` or `.htm` (case-insensitive extension), without NUL bytes;
other encodings and binary input are rejected. Extension is an explicit input
policy, not content-type detection. Source size is capped at 1 MiB before full
loading. The shared report reader retains lstat/opened-handle identity checks,
NOFOLLOW/NONBLOCK where available, bounded reads with one growth-detection byte,
post-read size verification, and cleanup on every path. Final-component symlinks,
FIFOs, devices, and directories are unsupported. Ancestor symlinks remain allowed.
Windows behavior and hostile replacement races retain the limitations documented
in [architecture.md](architecture.md); there is no file-read deadline or snapshot
guarantee for concurrently changed files.

JSON is compact, fixed-order, newline-terminated, and bounded to 10 MiB including
the newline before stdout is called. Serialization allocates the full string
before checking its size; this is an output bound, not a hard heap bound. The
existing per-rule cap of 1,000 findings and parser resource ceilings remain.
Parsing still constructs the full parse5 tree before bounded traversal; there is
no worker cancellation, hard CPU/memory boundary, or OS sandbox. Browser security
controls and the non-executing adapter are unchanged.

`assertStaticAuditReport` requires the versioned coverage declarations, ordered
source IDs, all four ordered/version-matched rule entries, coherent completion
status, and valid nested rule/finding data. It rejects unknown fields, inherited
fields, accessors, proxies, serialization hooks and sparse arrays. Validation is
structural; it cannot prove that a supplied saved report truthfully describes the
original file. Determinism applies to identical ordered input and implementation
configuration; no cross-version byte identity or cross-edit finding stability is
promised.

Output bounds and all-or-nothing emission refer to preparation before writing.
An OS pipe or stream failure can interrupt delivery; consumers must reject
truncated JSON and inspect the process exit code. A broken output pipe exits 1
with a fixed diagnostic, without an unhandled stack. If stderr itself fails,
the process exits 1 and cannot guarantee diagnostic delivery.
