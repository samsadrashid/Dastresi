# Phase 6E distribution and third-party notice review

Review date: 2026-10-25. Recommendation: **initial source repository only**, with
an optional source archive later from the same approved snapshot. Defer npm and
all vendored/native-binary distributions. This is a recommendation, not authority
to host, commit, create an archive, publish, or treat compliance as established.

## Baseline rechecked

The working directory and Git root are the independent Dastresi repository.
Branch main is still unborn; tracked/staged lists are empty, all project files
are untracked, and dist/ plus node_modules/ are ignored. Every existing file was
preserved. No parent repository was inspected.

Manifest and lockfile root both say dastresi 0.1.0, MIT. Root LICENSE is present
with Copyright (c) 2026 Samsad and the standard MIT grant. Branding remains:
Dastresi — Accessibility should never be a barrier. private=true remains enabled.
The current lockfile was read directly, not inferred from prior inventories.

## Three distribution targets

| Target | Proposed or observed payload | Dependency use and inclusion | Notice implications / outstanding work |
| --- | --- | --- | --- |
| Git-hosted source repository — recommended first | The explicit reviewed file list below, plus only separately authorized new Git history | Runtime declarations: parse5, entities and playwright-core. Development needs TypeScript, a matching native compiler, Node types and undici-types. Dependencies are fetched separately by the developer; no dependency source/binary is included in the proposed tree | Include Dastresi LICENSE and notice/evidence documentation. Preserve existing third-party attributions. No bundled-dependency notice bundle is proposed for this source-only payload; verify the final tree contains no vendored software before approval |
| Source archive — later, same source scope | Exactly the approved source file list, without .git or workspace artifacts | Same external runtime/build requirements and pinned source lockfile; no node_modules, build output, compiler or browser bundled | Same source-review boundary, but the archive itself must later be inspected against the allowlist. No archive was created; a whole-workspace zip is inappropriate |
| npm CLI package — deferred | Final offline dry run lists 147 files: LICENSE/README/package metadata, source, tests/fixtures, docs, tsconfig and all existing dist output including compiled tests/maps. package-lock.json, .npmrc and .gitignore are not listed | pack reports bundled=[]: declared production dependencies are separate npm installs, not embedded in this package. Development compiler/type packages are for maintainers, not runtime CLI execution. Consumer resolution need not reproduce the repository lockfile | Needs an explicit payload/build policy, clean packing/consumer testing and review of any inlining/vendoring. Retain own LICENSE; separately installed dependencies must retain upstream legal texts. If dependencies become bundled, preserve all applicable upstream notices. private=true still prevents npm publication; no publication is authorized |

The dry run was `npm pack --dry-run --ignore-scripts --offline --json` with strict
TLS and the project-local cache. It exited 0 and created no tarball. It inspected
already-existing build output, not a clean-source packing scenario. The initial
dry run listed 146 files; the final rerun listed 147 after adding this review,
including 90 generated dist files and this review itself. No archive exists. The compiled
CLI entry and its run module were present in that candidate payload; that is not
installation verification. There is no files allowlist or prepack build in the
current manifest. No packaging changes were made to address these future gates.

Production versus actual static execution: parse5/entity decoding are used by the
parser. playwright-core remains a production declaration for offline browser
metadata/preflight APIs; the current static audit CLI does not import or launch
it. All declarations are retained unchanged. TypeScript and a compatible native
compiler build source; @types/node and undici-types provide development types.

## Exact current dependency graph

26 locked packages: three production packages, three non-platform development
packages and 20 optional development compiler platform packages. Seven packages
are installed. Nineteen platform packages are unavailable locally and were not
installed or represented as inspected archives. No fresh registry metadata was
retrieved for those packages during this review. Their declarations below come
from the current lockfile, not independently verified registry/package contents.
None is included as software in the proposed source manifest.

| Package | Exact version | Category | Declared license | Current evidence |
| --- | --- | --- | --- | --- |
| `@types/node` | 24.19.2 | development | MIT | Installed metadata and legal text |
| `@typescript/typescript-aix-ppc64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-darwin-arm64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Installed metadata and legal text |
| `@typescript/typescript-darwin-x64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-freebsd-arm64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-freebsd-x64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-arm` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-arm64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-loong64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-mips64el` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-ppc64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-riscv64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-s390x` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-linux-x64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-netbsd-arm64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-netbsd-x64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-openbsd-arm64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-openbsd-x64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-sunos-x64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-win32-arm64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `@typescript/typescript-win32-x64` | 7.0.2 | development, optional native compiler | Apache-2.0 | Lockfile declaration only; unavailable locally |
| `entities` | 8.1.0 | production | BSD-2-Clause | Installed metadata and legal text |
| `parse5` | 8.0.1 | production | MIT | Installed metadata and legal text |
| `playwright-core` | 1.64.0 | production | Apache-2.0 | Installed metadata and legal text |
| `typescript` | 7.0.2 | development | Apache-2.0 | Installed metadata and legal text |
| `undici-types` | 7.24.6 | development | MIT | Installed metadata and legal text |

Relationships were rechecked: parse5 requires entities ^8.0.0, locked to 8.1.0;
@types/node requires undici-types >=7.24.0 <7.24.7, locked to 7.24.6; TypeScript's
20 optional native dependencies are each exactly 7.0.2. Playwright has no declared
npm dependencies, but contains inlined components described in its legal sidecars.

## Local license evidence and distribution-specific gaps

All 14 files in docs/third-party-notices.md were reread and their bytes matched
the recorded SHA-256 hashes. All seven installed package versions and license
declarations matched the lockfile. The following are evidence-based preservation
requirements if the relevant third-party software is actually redistributed;
they are not a definitive legal opinion or proof of complete compatibility.

- MIT: parse5 8.0.1, @types/node 24.19.2 and undici-types 7.24.6 retain copyright,
  permission notice and disclaimer. Original holders include Ivan Nikulin,
  Microsoft Corporation, and Matteo Collina/Undici contributors respectively.
- BSD-2-Clause: entities 8.1.0 LICENSE names Felix Böhm. Source redistribution
  retains copyright, conditions and disclaimer; binary redistribution reproduces
  them in accompanying documentation/materials. Its complete disclaimer must not
  be replaced with a package-name/license-identifier table.
- Apache-2.0: playwright-core 1.64.0, typescript 7.0.2 and the installed native
  compiler 7.0.2 include license/attribution obligations. Inspected section 4
  requires a license copy, relevant notices/attributions, and prominent changed-file
  notices where applicable. Retain applicable upstream NOTICE content rather than
  treating Dastresi's MIT grant as a replacement.
- Playwright includes LICENSE, NOTICE, ThirdPartyNotices.txt and three legal
  sidecars: lib/utilsBundle.js.LICENSE, lib/serverRegistry.js.LICENSE and
  lib/webp_codec.LICENSE. The inlined code and its licenses are not fully described
  by the npm lockfile graph. TypeScript/native compiler NOTICE.txt contains Unicode,
  DOM, WebGL and other bundled-material terms. Their full texts remain intact;
  the source-only proposal deliberately does not redistribute those packages.

| Uncertainty | Exact affected material | Proposed source-only impact | Resolution needed for broader distribution |
| --- | --- | --- | --- |
| Missing optional package texts | Each of the 19 unavailable @typescript/typescript-* 7.0.2 entries listed above | Those binaries/sources are excluded, so absence alone does not imply they must be copied into this source release. Installation/cross-platform evidence remains incomplete | Obtain the applicable platform packages separately under approval; inspect actual legal texts before including their software |
| Bundled component terms and provenance | playwright-core 1.64.0 and typescript/native compiler 7.0.2 legal sidecars/NOTICE | Their packages are external to the proposed source payload; retain evidence links and do not vendor them silently | Create a component-specific inventory and preserve relevant complete legal texts if redistributing those packages or inlining their code |
| Final artifact not yet approved | The complete source file list below | Recommendation defines a candidate scope, not a verified released artifact | Approve exact source scope, scan the eventual snapshot and retain existing attributions; archive-specific verification only when archive creation is authorized |
| Current advisory/signature verification | All 26 locked packages plus bundled components not captured by that graph | Unresolved supply-chain risk still affects developers installing dependencies | Successful authoritative exact-version queries, relevant signature/provenance checks and review of any finding before release |

No dependency directory was copied. No consolidated third-party notice bundle
was generated. No claim that all distribution obligations have been discharged
is made. Chromium is neither included nor executed. A source release references
third-party packages; a vendored/native binary release contains different material
and requires a different legal-file review.

## Current advisory attempts — 2026-10-25

```sh
NODE_TLS_REJECT_UNAUTHORIZED=1 npm --cache=./node_modules/.cache/dastresi-npm --update-notifier=false --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=10000 audit --json
```

Actual result: exit 1; getaddrinfo ENOTFOUND registry.npmjs.org at the official npm
bulk advisory endpoint. No successful advisory data was returned.

A second authoritative request generated an OSV query for every exact locked
package/version and sent it with:

```sh
curl --silent --show-error --fail-with-body --proto =https --tlsv1.2 --connect-timeout 5 --max-time 12 --request POST --header 'Content-Type: application/json' --data-binary @- https://api.osv.dev/v1/querybatch
```

Actual result: exit 6; Could not resolve host: api.osv.dev. Both attempts used
normal certificate verification; no global settings changed and no insecure
flag was used. Status remains UNVERIFIED, not zero vulnerabilities. No retry,
package install or audit fix was attempted. Prior cached/keyword searches do not
substitute for a successful current graph query. Even a clean query would not
prove security or comprehensively audit embedded components.

## Provenance boundary

The current provenance document correctly distinguishes the original development
declaration from the bounded local audit. The research reference repository's
identity is not established. No identity was guessed, no external comparison was
performed, and no claim of proven independent authorship is made. Standard MIT
wording and legitimate dependency notices are not evidence of copied implementation.
No provenance cleanup, source/history rewrite or attribution removal occurred.

## Proposed initial source-release manifest

Explicit candidate allowlist, including this review: **60 files**. All existing
untracked authored files are proposed for inclusion after review; none is rejected
merely for being untracked. This is not a staging list executed by a tool and not
an archive. Root configuration contains no registry credential in the inspected
.npmrc. Original fixtures are synthetic test inputs. Historical audit documents
are included for their evidence and caveats, not as proof of a completed release.

| File | Inclusion rationale |
| --- | --- |
| `.gitignore` | Exclude local/generated artifacts from later reviewed Git snapshots |
| `.npmrc` | Project install policy: strict TLS, disabled scripts, exact saves and dev tool availability |
| `LICENSE` | Approved MIT grant: Copyright (c) 2026 Samsad |
| `README.md` | Identity, usage, support constraints and limitations |
| `docs/architecture.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/browser-runner-plan.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/browser-security.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/data-contracts.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/dependencies.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/phase-1-review.md` | Dated audit/planning history, retained with its qualifications; this report is planning, not approval |
| `docs/phase-5-validation.md` | Dated audit/planning history, retained with its qualifications; this report is planning, not approval |
| `docs/phase-6b-release-readiness.md` | Dated audit/planning history, retained with its qualifications; this report is planning, not approval |
| `docs/phase-6e-distribution-review.md` | Dated audit/planning history, retained with its qualifications; this report is planning, not approval |
| `docs/provenance.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/static-report.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/static-rules.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `docs/third-party-notices.md` | Architecture, coverage, security, provenance or license evidence documentation |
| `package-lock.json` | Exact version/integrity/optional-platform resolution for source development |
| `package.json` | Package metadata, scripts, declared runtime/build dependencies |
| `src/browser/compatibility.ts` | Preserve offline contracts and fail-closed adapter; this does not enable browsing |
| `src/browser/contracts.ts` | Preserve offline contracts and fail-closed adapter; this does not enable browsing |
| `src/browser/inspect.ts` | Preserve offline contracts and fail-closed adapter; this does not enable browsing |
| `src/browser/nonexecuting-adapter.ts` | Preserve offline contracts and fail-closed adapter; this does not enable browsing |
| `src/browser/prepare.ts` | Preserve offline contracts and fail-closed adapter; this does not enable browsing |
| `src/browser/timeouts.ts` | Preserve offline contracts and fail-closed adapter; this does not enable browsing |
| `src/cli/input.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/cli/main.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/cli/run.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/diagnostics.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/rule.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/schema.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/static/parse-html.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/static/report.ts` | Original maintained implementation required to build or inspect the toolkit |
| `src/static/rules/index.ts` | Original maintained implementation required to build or inspect the toolkit |
| `tests/browser-adapter.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/browser-preparation.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/browser-timeouts.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/cli.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/data.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/fixtures/static/declarations.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/static/issues.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/static/recovery.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/validation/ambiguous-declarations.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/validation/bom-document.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/validation/implicit-structure.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/validation/inert-content.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/validation/international-form.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/validation/mixed-labels.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/fixtures/validation/recovered-table.html` | Original regression HTML fixture; needed for the documented evaluation corpus |
| `tests/input.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/rule.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/schema.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/static-cli.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/static-input-hardening.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/static-parser.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/static-report.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/static-rule-fixtures.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/static-rules.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tests/static-validation.test.ts` | Original test or expected-result data needed for reproducible verification |
| `tsconfig.json` | Strict NodeNext/ES2023 build configuration |

Explicit exclusions (retain locally; nothing is deleted):

| Excluded class/path | Reason |
| --- | --- |
| node_modules/ and all nested caches, npm debug logs, native binaries and legal sidecars there | External package installs; machine/cache state is not part of the proposed source payload. This exclusion does not waive notices for any future artifact that actually includes those packages |
| dist/ | Generated outputs, compiled tests, declarations and source maps can be rebuilt; exclude from this source-first artifact |
| .git/ from a source archive | Repository-local internals do not belong in the archive; a Git-hosted repository will instead have only separately authorized reviewed history |
| coverage/, *.tsbuildinfo, .DS_Store | Generated or machine-specific artifacts; excluded if present |
| Temporary test/build directories, package tarballs, advisory output scratch files | Local verification artifacts, not maintained source; no release archive was created here |
| Credentials, .env/private configuration, host-specific files or unrelated work if discovered | Must be separately reviewed and withheld from a public artifact; no deletion or guessed inclusion is authorized |

The current repository contains no separate maintained scratch file proposed for
removal. Do not run a recursive zip or blanket add on the working directory.
Compare the eventual approved snapshot/archive against this explicit allowlist,
check for secrets and unexpected material, and regenerate any plan only through
review if additional files appear. .gitignore is not an archive or npm allowlist.

## Verification and remaining decisions

Executed npm run check using scoped NODE_TLS_REJECT_UNAUTHORIZED=1, project-local
cache and disabled notifier: **176 tests passed, 0 failed, 0 skipped**; TypeScript
type-check and production build passed. All 14 upstream legal-file hashes were
verified. npm pack dry-run succeeded as described above; no tarball was generated.
No clean installation was performed or claimed. No dependency/version/lockfile,
runtime, parser/rule/schema/report contract, branding, Git index or history change
was made. Ignored build output and project-local npm logs may be regenerated by
verification commands.

Before clean-install verification and a reviewed snapshot: approve the source-only
scope and exact candidate file set; restore authoritative advisory access and
review results; verify the intended dependencies/platform toolchain with a
separately authorized clean install. Before a public snapshot/archive: complete
artifact-specific attribution review, provenance caveats and secret/material
review, then obtain explicit approval for the initial commit and any later release.
Npm packaging remains a separate deferred task. No current legal-compliance,
security-clearance, clean-install, release or publication claim is made.
