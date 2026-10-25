# Originality and provenance

## Current release-review context — 2026-10-25

The proposed source-only attribution review is complete, without certifying
complete legal compliance or independent authorship. The reference repository
remains unidentified and nineteen optional-platform legal texts are unavailable
locally. The Phase 6D audit below retains its original findings and then-pending
verification gates. Later clean installation/build/tests, earlier clean CLI checks
and the dated OSV lookup are summarized in
[README verification status](../README.md#verification-status); Phase 6G did not
rerun those checks. The earlier pending installation and advisory-query statuses
are superseded.
Human snapshot approval remains required and npm distribution remains deferred.

Foundation development declaration (preserved from the earlier record):

> Dastresi's architecture, implementation, wording, synthetic fixtures, and
> evaluation approach are developed independently. No external accessibility
> project implementation, instructions, test suite, fixtures, or report templates
> were used to create this foundation.

This is the recorded development declaration, not an independently established
comparison result. The Phase 6D evidence and limitations below qualify what this
repository audit can establish.

Future rule requirements should be derived from public technical standards.
Write new examples and expected-outcome rationales. Keep a per-rule record of the
standard version, relevant section, interpretation, limitations, and review date.
Do not equate a narrow automated observation with full criterion conformance.

## Public reference register

Reviewed 2026-10-25:

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): planned accessibility requirements
  baseline. No WCAG checks are implemented in this phase.
- [Understanding conformance](https://www.w3.org/WAI/WCAG22/Understanding/conformance):
  distinction between automated results and broader human evaluation.
- [ACT overview](https://www.w3.org/WAI/standards-guidelines/act/): context for
  documenting applicability and limitations; no ACT implementations or examples
  are incorporated.
- [TypeScript installation](https://www.typescriptlang.org/download/): project-local
  compiler and lockfile workflow.

Prefer links and original explanations. Before incorporating third-party text,
code, images, or datasets, inspect the applicable terms, record its origin and
version, and preserve required notices. Dependencies are tracked separately in
[dependencies.md](dependencies.md) and `package-lock.json`.

Dastresi's original project material is licensed under [MIT](../LICENSE), with
Copyright (c) 2026 Samsad. Third-party material retains its own terms; see
[third-party notice evidence and gaps](third-party-notices.md).


## Phase 6D local provenance audit — 2026-10-25

Scope: only the independent Dastresi working tree and its own Git metadata.
No parent, unrelated repository, external reference checkout, or network source
was inspected. The original research repository's exact name/URL could not be
established from local project records or configuration. It was not guessed;
a targeted search or content comparison against that repository was unavailable.

Git evidence: symbolic branch main is unborn; .git/config contains only a core
section, with no remotes. Ref and all-commit listings are empty, and enumeration
of the Git object database found no objects of any type. HEAD does not resolve
to a commit. The index file is absent, and tracked/staged file lists are empty.
There is no copied commit history or original commit metadata present in this
Git database to inspect. That finding does not prove that working-tree content
was never copied or that earlier external research did not influence it.

At inspection there were 59 authored files, 90 generated dist files, 879 files
under ignored dependencies/cache, and 18 Git metadata/template files. File
contents were inventoried and UTF-8 text was scanned for provenance wording and
GitHub repository identifiers. Nine non-UTF-8/binary files were not semantically
reviewed. Two local symlinks were inspected; neither points outside Dastresi.
Counts describe the inspection snapshot, not an invariant of the cache/build.

Authored GitHub identifiers referred to the documented parser/entity/compiler/
Node-type/Undici sources. Ignored dependency/cache text contained many additional
upstream references. They are not evidence identifying the research reference
repository. Standard Git templates and npm diagnostics are not proof of inherited
project content. Negative tests use terms such as inherited to exercise schema
validation; those words are not evidence of inherited authorship metadata.

| Classification | Finding |
| --- | --- |
| Confirmed reference to the research repository | None established; its exact identity is unavailable locally, so this is not a verified targeted absence claim |
| Confirmed copied history | No commits, refs or Git objects are present; no copied history was found in the current database |
| Confirmed copied implementation/fixtures | None established by this bounded audit; there was no reference corpus to compare |
| Suspicious similarity | No concrete candidate established; no byte-identical complete authored files internally or against local dependency files. Sub-file reuse and semantic similarity remain unverified |
| Legitimate third-party material | Dependency manifests, source, bundled legal notices and public standards links; standard MIT license wording is intentionally reused and does not establish copied implementation |

Full-file hash comparisons are limited: distinct files can contain identical
subsections, and a clean text search cannot establish independent authorship.
Generated output mirrors this project's source by design. Dependency source and
legal attributions are expected under node_modules; no attribution was deleted,
relabelled as Dastresi-owned, or treated as evidence of copying the unidentified
research repository. No source, fixture or Git history was removed or rewritten.
Provenance inspection made no changes to ignored files; required verification
regenerates ignored build output and may update project-local npm cache logs.
This provenance record was qualified to match the evidence.

The Phase 6D maintenance change reconciled packages[""].license in the lockfile
from UNLICENSED to MIT. Root name/version/license now match package.json.
All 26 non-root package entries are structurally identical before and after,
including versions, relationships, optional/platform declarations, resolved URLs,
licenses and integrity values. The sorted, compact JSON SHA-256 of those entries
is 354a997d4592f26f523f83bd5e05cc1bd1345c682cbd3691e17581f8b5fdda41.
Only the one root license string changed in the lockfile bytes; no package-manager
update, dependency install, or network access was needed.

Third-party gaps remain: 19 optional compiler package archives/legal texts are
unavailable locally, bundled component obligations remain distribution-specific,
and source-only versus vendored/binary release scope is undecided. No consolidated
notice bundle or complete compliance claim was produced. Advisory verification,
clean installation, and release-snapshot approval remain pending; this audit does
not substitute for publisher signature/provenance verification.

Verification: npm run check completed with scoped NODE_TLS_REJECT_UNAUTHORIZED=1
and the project-local npm cache: type-check/build passed, 176 tests passed,
0 failed and 0 skipped. No dependency installation or browser launch occurred.
