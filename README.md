# Dastresi

Accessibility should never be a barrier.

Created by Samsad, Dastresi is a static HTML accessibility auditing toolkit that
helps developers inspect source declarations, understand their limitations, and
verify corrections.

This repository provides a static HTML audit CLI, four source declaration checks,
source-aware parsing, typed reports, runtime validation, and original tests.
It does not execute browsers or claim WCAG conformance.

This is local developer tooling, not an isolated service for hostile input.
HTML parsing and JSON serialization have no hard CPU/memory boundary; file reads
have no deadline or consistent-snapshot guarantee during concurrent changes.
Parser recovery can affect interpretation. Evidence establishes source declarations
and associations, not their semantic suitability. Windows behavior is unverified.
It also includes [offline browser preparation](docs/browser-security.md): fixture
authorization, planned budgets, and explicit nonexecution results. Phase 2A adds
the approved `playwright-core@1.64.0` dependency and a metadata-checking,
non-executing adapter. Browser launch remains denied because OS egress isolation
and independent process supervision have not been verified.

## Development

Use Node.js 24 and npm 11 (reference versions: Node 24.14.1, npm 11.11.0).

```sh
npm ci
npm run check
npm run build
npm start -- --help
npm start -- --version
npm start -- validate ./audit.json
npm --silent start -- audit --html ./tests/fixtures/static/declarations.html --format json
```

`npm ci` reproduces the lockfile without selecting new versions. The
project disables dependency lifecycle scripts. `typecheck` checks source and test
types without emitting files; `test` builds and runs Node's built-in test runner.
Build output is ignored under `dist/`. No global compiler or test runner is needed.

Use `npm --silent start -- audit ... --format json` when piping or saving a
report. Plain `npm start` adds npm script banners to stdout, so its combined
output is not valid JSON. The direct `node dist/src/cli/main.js audit ...`
invocation also emits only the report on stdout.

CLI exit codes: `0` for help, version, structurally valid saved data, or a completed
static audit with only pass/not-applicable results; `1` for input, execution,
schema, output-limit errors, or incomplete required coverage; `2` for invalid
usage; `3` for completed audits with any failing rule; `4` for completed audits
with review outcomes and no failing rules.
A review outcome can include definite source issues; inspect all findings, not
only exit 3. See [validation and release review](docs/phase-5-validation.md).
Structural validity says nothing about whether an audited page is accessible.
Valid data can contain failures, execution errors, or no evaluated rules.

JSON reports are limited to **10 MiB (10,485,760 bytes)**. Input must be a regular
file; final-component symlinks, directories, FIFOs, and devices are unsupported.
Reads remain bounded if the file grows. Diagnostics escape terminal controls and
limit error text to 512 characters (excluding the fixed prefix and newline).

Static auditing accepts one to eight explicitly supplied UTF-8 `.html`/`.htm`
regular files, each at most **1 MiB**. Repeat `--html` for multiple inputs. No
globs, directories, symlinks, URLs, stdin, config discovery, or resource loading
are supported. Reports use positional source IDs, omit paths/snippets/timestamps,
and are deterministic for identical ordered inputs. JSON stdout is capped at
10 MiB. Operational failures emit no report; missing authored title evidence
produces an explicit incomplete report and exit 1.

See [static CLI/report behavior](docs/static-report.md), [architecture](docs/architecture.md), [data contracts](docs/data-contracts.md),
[provenance](docs/provenance.md), and [dependencies](docs/dependencies.md).

## Repository and licensing status

Dastresi has its own `.git` directory, separate from the ancestor repository.
Use `git rev-parse --show-toplevel` before staging: it must resolve to this
directory. No initial commit has been created. Creating one requires separate
authorization; the independent branch therefore has no history yet.

Dastresi is licensed under the [MIT License](LICENSE).
Copyright (c) 2026 Samsad. `private: true` remains enabled to prevent accidental
npm publication; no release or publication has been performed. Third-party
dependencies retain their own copyrights and licenses. See the
[verified third-party notice inventory and gaps](docs/third-party-notices.md).

## Verification status

### Post-approval testing — 2026-10-25

The snapshot was approved for testing only; publication remains unauthorized.
The unchanged baseline passed all 176 tests. Five additional CLI tests now cover
a 15-document adversarial corpus, Unicode and hyphen-prefixed paths, saved-report
validation and diagnostic privacy, the default node ceiling, and controlled
multi-file changes/read errors. No new production defect was reproduced, and no
runtime code, schemas, dependencies, or manifest entries changed.

Workspace and fresh 60-file source reconstruction checks both passed type-check,
build, and **181 tests, 0 failed, 0 skipped**. The reconstruction used a successful
locked clean installation with strict TLS, an isolated cache, lifecycle scripts
disabled, and no browser download. These tests cover static declarations and
documented limits; they do not establish conformance or comprehensive security.
No external advisory lookup was repeated: the dated OSV evidence below is reused.
The updated snapshot requires another human review before any release action.

### Earlier release verification record

Verified results recorded as of **2026-10-25** for the proposed source-only
release (not an npm package or bundled dependency distribution):

| Check | Recorded result |
| --- | --- |
| Phase 6E source manifest and clean reconstruction | Exactly 60 files, copied byte-for-byte |
| Clean locked `npm ci` | Passed with an isolated cache, strict TLS, lifecycle scripts disabled and no browser download |
| Production build and type-check | Passed using Node 24.14.1 and npm 11.11.0 |
| Full test suite after the temporary-directory setup fix | 176 passed, 0 failed, 0 skipped, in both the workspace and a fresh 60-file reconstruction |
| Clean CLI/report verification | Passed in the earlier Phase 6F verification run, including documented invocation, schema validation, supported exit codes and basic privacy checks |
| Dated OSV lookup | No advisory matches for the 26 queried exact locked versions on 2026-10-25, including optional platform packages |
| Source-only attribution review | Complete for the proposed 60-file distribution; complete legal compliance is not certified |

The three affected test setup files now use `mkdtemp(join(tmpdir(), prefix))`;
no pre-created npm cache parent is required. The final Phase 6G read-only review
did not rerun installation, build/tests, CLI checks or advisory queries. During
this documentation reconciliation, workspace `npm run check` was rerun: type-check
and build passed, with 176 tests passed, 0 failed and 0 skipped. Clean installation,
CLI checks and OSV queries were not rerun for this documentation-only change.
Older phase reports retain the failures and pending statuses recorded at those
times; the post-approval testing status above describes the latest test run.

The OSV result is a dated advisory lookup, not proof that Dastresi is
vulnerability-free. It does not comprehensively cover bundled components outside
the lockfile or authenticate publisher signatures/provenance. Nineteen optional
platform legal texts remain unavailable locally. The reference repository is
still unidentified, so independent authorship cannot be conclusively established.
Source-only attribution review does not certify all legal obligations, and any
future vendored/binary scope needs its own review.

The earlier **READY FOR HUMAN SNAPSHOT REVIEW** recommendation was not permission
to publish. Explicit human approval of the final updated source snapshot remains
required. npm distribution is deferred; `private: true` remains unchanged. No
commit, archive or publication has been performed by this reconciliation.
