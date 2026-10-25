# Phase 5 validation and release review

Historical audit record. Phase 6C subsequently approved the project MIT grant
and `Copyright (c) 2026 Samsad`; see [LICENSE](../LICENSE). Statements below
about pending project licensing and verification describe the earlier audit
state. Later clean-install/test results and the dated OSV lookup are summarized
in [current verification status](../README.md#verification-status). Source-only
attribution review is complete without certifying complete legal compliance;
provenance/legal limitations and human snapshot approval remain. The recorded
results below are unchanged; see also the [notice review](third-party-notices.md).

Reviewed 2026-10-25 against the actual parser, rules, rule/audit validators, static
report, CLI entrypoint/argument handling/bounded reader, tests, and documentation.
The independent Git root was confirmed. Existing work was preserved; this review
adds original fixtures/tests and small corrective changes only. There were no
network checks, installs, dependency updates, browser launches, or Git mutations.

## Findings and fixes

| Severity | Finding | Correction and evidence |
| --- | --- | --- |
| Medium, fixed | Exact non-ASCII whitespace ID references were falsely failed as empty by String.trim | Label references now test exactly empty string; ASCII whitespace requires review. NBSP and em-space references resolve exactly. The international-form CLI fixture failed with exit 3 before the fix and now exits 0. |
| Medium, fixed | Direct title-rule evaluation returned not-applicable solely because evidence was unavailable | Direct evaluation throws a fixed execution error; the existing workflow records not-executed/incomplete. Empty and whitespace-only source tests cover the direct API and CLI boundary. |
| Medium, fixed | A leading decoded UTF-8 BOM became document text in parse5 and changed recovery, losing authored-root coverage | The private parser input uses an ignored one-code-unit leading space; original source, UTF-8 size, offsets and columns remain unchanged. Normal BOM documents now pass the limited checks; BOM-only input remains incomplete and interior BOM text is retained. |
| Medium, fixed | A closed stdout pipe produced an unhandled Node stack, potentially disclosing implementation paths | Entry point handles output stream errors with exit 1 and fixed text; an actual subprocess with a closed pipe verifies this. Before the fix, the reproducer emitted a 1,079-character unhandled stack. |
| Low, mitigated | Review aggregation wording obscured definite defects in mixed results | Existing conservative needs-review precedence is retained, but explanations now separately count definite source issues and review observations. Documentation warns that exit 4 can contain definite issues. No per-finding status or schema change was introduced. |

Four of the initial eleven independent regression tests failed against the
pre-fix implementation: the international fixture, Unicode ID matching, direct
title evidence semantics, and mixed-summary visibility. They pass after the
corrections. The BOM and broken-pipe defects were separately reproduced before
fixing, then covered by regressions. These observations are not population-wide
false-positive/negative rates or proof of full accessibility accuracy.

## Original fixture expectations

Fixtures are under `tests/fixtures/validation/`. Outcomes below are ordered title,
language, image alternative, explicit label. P = pass, R = needs-review,
NA = not-applicable. All are completed static reports, not conformance claims.

| Fixture | Expected outcomes / exit | Rationale |
| --- | --- | --- |
| international-form.html | P, P, P, P / 0 | A realistic named input uses an entity-decoded NBSP ID; exact association must survive Unicode whitespace. |
| bom-document.html | P, P, P, P / 0 | A leading UTF-8 encoding marker must not change document recovery or lose authored evidence. |
| mixed-labels.html | P, P, R, R / 4 | An unresolved reference and duplicate target coexist; empty image alt needs intent review. The label summary retains one definite issue and one ambiguous observation. |
| recovered-table.html | P, P, NA, P / 0 | Omitted optional table tags create implicit tbody structure with no authored span. The authored label/input association remains valid. |
| implicit-structure.html | P, NA, NA, NA / 0 | The authored title remains usable through inserted head structure; no authored root exists for the deliberately root-scoped language check. |
| inert-content.html | P, P, R, R / 4 | Noscript markup is text, SVG title is not the document title, empty alt needs review, and template label association needs instantiation review. |
| ambiguous-declarations.html | R, R, P, NA / 4 | Multiple titles and duplicate root attributes must not become definite passes or failures by relying on parser recovery. |

Additional generated cases cover ASCII whitespace references, em-space IDs,
BOM-only/empty/whitespace-only input, multiple files with incomplete coverage and
failures, all CLI exits, and output stream failure. Every finding in the fixture
corpus is checked against an actual parser node/tag/attribute location, including
line, column, and UTF-16 offsets. CLI JSON is schema-validated and compared across
runs and against the in-memory workflow. Source IDs are positional and deterministic
for unchanged ordering; they are not identities across reordered file lists.

## Security and aggregation verification

The full suite verifies actual file handling for missing files, directories,
final-component symlinks, FIFOs and ordinary files; 1 MiB input and eight-file
limits; invalid UTF-8/NUL; parser/finding limits; saved report validation; and
10 MiB output overflow with empty stdout. Dedicated controlled race simulations
verify the HTML read budget is at most 1 MiB plus one byte, replacement identity
is rejected before reads, and handles close after errors. Simulations verify code
behavior, not elimination of every OS/filesystem race. POSIX special-file tests
ran in this environment; Windows remains unverified.

Operational/pre-emission failure returns exit 1 and no JSON. Required static
coverage missing authored title evidence instead returns a valid incomplete
report and exit 1, even if another source contains a completed failing rule.
Completed failing rules exit 3; review-only aggregate results exit 4; only pass/NA
results exit 0. Usage errors exit 2. Structural `validate` intentionally exits 0
for valid incomplete/failing saved reports; that is not audit success.

A receiver can still lose bytes during an OS pipe failure. The producer exits 1;
consumers must parse the entire JSON and inspect the exit status. No OS-level
atomic stdout guarantee is claimed. Output size is checked after serialization,
so the bound does not cap serialization heap allocation.

Missing evidence is not used to manufacture title applicability or authored
spans. Parser-inserted nodes do not count as authored declarations. Rendering,
visibility, accessible names, alternative quality, content-language correctness,
keyboard behavior, and WCAG conformance remain outside coverage. The declared
NA for an implicit root is the narrow authored-root check's scope, not evidence
that page language is satisfactory.

## Verification results

Executed with child-scoped strict TLS and the project-local npm cache:

```sh
NODE_TLS_REJECT_UNAUTHORIZED=1 npm --cache=./node_modules/.cache/dastresi-npm --update-notifier=false run check
```

Final result: TypeScript type-check passed; production build passed; **176 tests
passed, 0 failed, 0 skipped**. Tests include actual CLI subprocesses, the existing
file-writing integration tests and output-overflow tests, plus explicitly labeled
controlled reader-race simulations. No browser integration tests were executed.
No current vulnerability scan, package signature/provenance verification, fresh
license inventory audit, or independent cross-platform run was performed.

## Remaining limitations and release recommendation

- Medium: aggregate review can contain definite source issues. Separate counts and
  documentation mitigate the ambiguity, but the existing finding schema still
  lacks a machine-readable outcome per finding. Consumers must not equate exit 4
  with absence of definite issues. No broad schema change is required for this
  documented local preview; any future per-finding outcome needs separate design.
- Medium: no hard parser/serialization memory or CPU boundary, worker cancellation,
  read deadline, concurrent-file snapshot guarantee, or hostile-input service
  isolation exists. This is local tooling; do not deploy it as an untrusted-input
  service on the strength of these tests.
- Low: conservative duplicate-attribute review can include unrelated duplicates;
  finding guidance/priority is generic and human interpretation remains necessary.
- Unverified: Windows/POSIX differences, exhaustive malformed-input fuzzing,
  independent rendered behavior, and current dependency advisories.

Recommendation: **GO for a reviewed, constrained local preview; NO-GO for a public
open-source release yet.** The project still has no chosen project license and
remains private/UNLICENSED. Its files are untracked with no committed release
snapshot. Licensing, a reproducible reviewed release snapshot, and current
supply-chain review remain separate release decisions; none was silently performed.
No high/critical issue was identified within the tested static scope; this is not
a claim that none exists.

Changed implementation: `src/static/rules/index.ts`, `src/static/parse-html.ts`,
`src/cli/main.ts`. Updated original expectations: `tests/static-rule-fixtures.ts`.
Added `tests/static-validation.test.ts`, `tests/static-input-hardening.test.ts`,
and the seven fixture files above. Updated `docs/static-rules.md`,
`docs/static-report.md`, `docs/architecture.md`, `README.md`, and this review.
Schemas, dependencies/lockfile, bounded reader, static report contract and browser
adapter are preserved.
