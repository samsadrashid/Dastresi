# Phase 6B release-readiness audit

Historical audit record. Phase 6C subsequently approved the project MIT grant
and `Copyright (c) 2026 Samsad`; see [LICENSE](../LICENSE). Statements below
about pending project licensing and verification describe the earlier audit
state. Later clean-install/test results and the dated OSV lookup are summarized
in [current verification status](../README.md#verification-status). Source-only
attribution review is complete without certifying complete legal compliance;
provenance/legal limitations and human snapshot approval remain. The recorded
results below are unchanged; see also the [notice review](third-party-notices.md).

Review date: 2026-10-25. Verdict: **CONDITIONAL GO for release preparation;
NO-GO for public distribution until the blockers below are resolved.** This
review does not authorize publication, commits, license grants or installations.

## Blockers and approval gates

1. Project licensing: intended MIT grant cannot be finalized without the exact
   copyright holder and year(s). Package metadata still says UNLICENSED/private;
   no LICENSE or third-party notice artifact has been created.
2. No release snapshot: independent main is unborn, index/tracked-file lists are
   empty, and all project files are untracked. A fresh Git checkout cannot yet
   reproduce this workspace. Review the intended file set and separately authorize
   an initial commit/release snapshot; do not bulk-add ignored directories.
3. Current advisory verification is unavailable. Strict-TLS npm audit failed DNS
   for registry.npmjs.org; OSV failed DNS for api.osv.dev. Exact-version security
   status remains unknown, including bundled components outside the npm graph.
4. Complete the distribution-specific license/notice and provenance review.
   Nineteen optional platform packages have only local lockfile declarations;
   installed Playwright/TypeScript contain additional bundled material. No
   conclusive license compatibility or authenticated provenance claim is made.
5. A clean install on a release snapshot still needs a separately authorized run.
   This audit did not run npm ci/install or remove dependencies. Local clean-output
   builds demonstrate compilation, not independent archive availability/installability.

## Repository hygiene and installation path

The Git root equals the independent Dastresi directory. No parent repository was
inspected. Before changes, tracked and staged lists were empty; all authored files
were untracked, with dist/ and node_modules/ ignored. Ignored inventory at inspection:
90 dist files (341,779 bytes), 877 dependency/cache files (47,497,487 bytes).
Counts are a snapshot; npm subsequently writes project-local diagnostic logs.
A limited credential/private-key pattern scan covered 1,016 text files including
ignored text, with nine binary/unreadable files excluded; no pattern hit was
found. This is not proof that all secrets/personal data are absent.

A historical review contained a real absolute home path; it was removed without
changing the recorded repository-boundary history. The remaining home-path
example in a negative test is synthetic. npm debug/cache files can contain local
paths; dist contains tests and source maps. Exclude node_modules/, caches, .git/
and incidental workspace artifacts from source archives. Decide deliberately
whether release build artifacts include tests/maps. Git ignore rules do not
protect an arbitrary whole-directory zip or define an npm publication allowlist.

Package: dastresi 0.1.0, private=true, license=UNLICENSED, type=module;
bin=dist/src/cli/main.js. Stale foundation-only description was corrected without
changing dependencies or the lockfile. No npm files allowlist/prepack build exists;
this is not an approved npm-package release. The intended Git-source workflow is
Node 24/npm 11, npm ci (with scripts disabled by .npmrc), npm run build, then
npm --silent start -- audit --html <file.html> --format json or the direct Node CLI.
The README orders the check/build before start. Plain npm start adds banners;
README and CLI docs consistently require silent mode for machine-readable JSON.
No clean installation or package-manager linking of the bin was tested here.

## Exact locked graph and license evidence

There are 26 locked packages, including 20 optional TypeScript platform packages;
seven are installed. npm ls --all --json returned exit 0 with no installed-version
mismatch. Optional non-host binaries being absent is expected. All lock entries
carry registry URLs and integrity values. Installed license texts were inspected;
other-platform declarations are not independent verification of their archives.

| Package | Exact version | Declared license | Evidence |
| --- | --- | --- | --- |
| `@types/node` | 24.19.2 | MIT | Installed metadata + license text |
| `@typescript/typescript-aix-ppc64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-darwin-arm64` | 7.0.2 | Apache-2.0 | Installed metadata + license text |
| `@typescript/typescript-darwin-x64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-freebsd-arm64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-freebsd-x64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-arm` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-arm64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-loong64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-mips64el` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-ppc64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-riscv64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-s390x` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-linux-x64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-netbsd-arm64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-netbsd-x64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-openbsd-arm64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-openbsd-x64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-sunos-x64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-win32-arm64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `@typescript/typescript-win32-x64` | 7.0.2 | Apache-2.0 | Lockfile declaration only; archive absent locally |
| `entities` | 8.1.0 | BSD-2-Clause | Installed metadata + license text |
| `parse5` | 8.0.1 | MIT | Installed metadata + license text |
| `playwright-core` | 1.64.0 | Apache-2.0 | Installed metadata + license text |
| `typescript` | 7.0.2 | Apache-2.0 | Installed metadata + license text |
| `undici-types` | 7.24.6 | MIT | Installed metadata + license text |

parse5 depends on entities ^8.0.0, resolved to 8.1.0. Node types depend on
undici-types >=7.24.0 <7.24.7, resolved to 7.24.6. TypeScript pins every optional
platform compiler to 7.0.2. Playwright has no npm dependencies, but its bundled
code is not represented by that zero-dependency assertion.

Local SHA-512 verification matched the cached parse5 and entities tarballs to
lockfile integrity values. The other 24 expected tarballs were absent from the
project-local cache; no mismatch was established. This does not authenticate
publishers, establish registry signatures/provenance, or prove that installed
files match archives. Registry metadata could not be fetched via the web tool.

## Proposed project LICENSE contents — approval required, not a license grant

Confirm the holder spelling/legal identity, authority to license all original
project material, and whether 2026 is the correct copyright year/range. Do not
infer an owner from the workstation username or dependency authors. Proposed
contents, with the bracketed holder awaiting replacement:

```text
MIT License

Copyright (c) 2026 [COPYRIGHT HOLDER TO CONFIRM]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

The standard form is documented by the
[Open Source Initiative](https://opensource.org/license/mit). The proposal above
uses the permissive license body from the locally installed parse5 MIT text;
parse5's own copyright notice must separately remain with redistributed parse5.
This proposal does not license third-party code as Dastresi-owned code.

## Proposed third-party notice contents and unresolved obligations

No notice file was created. If dependencies are redistributed, proposed contents
are the following fixed header, then the complete bytes of each legal file in
the ordered table below, each preceded by a heading containing its relative path:

```text
Dastresi — Third-party notices

Third-party software retains its own copyright and license terms.
The following upstream legal texts are reproduced without modification.
Dastresi's project license does not replace these terms.
```

The following path/hash mapping defines the exact locally available upstream
texts to preserve; do not replace them with SPDX identifiers or summaries:

| Upstream text | SHA-256 of proposed verbatim content |
| --- | --- |
| `node_modules/@types/node/LICENSE` | `c2cfccb812fe482101a8f04597dfc5a9991a6b2748266c47ac91b6a5aae15383` |
| `node_modules/entities/LICENSE` | `cb992345949ccd6e8394b2cd6c465f7b897c864f845937dbf64e8997f389e164` |
| `node_modules/parse5/LICENSE` | `8c535800331e1e4439835555b3f9edc7fe9dee2fab0d8bbbd5a982e8b8343d4d` |
| `node_modules/undici-types/LICENSE` | `a6db8096b2707bc0102d256917d4d33f298ba36d8c3f25de067a2b5bb379db27` |
| `node_modules/typescript/LICENSE` | `a7d00bfd54525bc694b6e32f64c7ebcf5e6b7ae3657be5cc12767bce74654a47` |
| `node_modules/typescript/NOTICE.txt` | `f5c708b59114507b8b27b48181b6883d106bbca0c1634bbee45b5e344237b66b` |
| `node_modules/@typescript/typescript-darwin-arm64/LICENSE` | `a7d00bfd54525bc694b6e32f64c7ebcf5e6b7ae3657be5cc12767bce74654a47` |
| `node_modules/@typescript/typescript-darwin-arm64/NOTICE.txt` | `f5c708b59114507b8b27b48181b6883d106bbca0c1634bbee45b5e344237b66b` |
| `node_modules/playwright-core/LICENSE` | `45873d00a0dd243596deb4aa23b2493b3d1f0671921bf2538ea431d7380220eb` |
| `node_modules/playwright-core/NOTICE` | `6d602191187b35b9b01d2cffa01c8469c2c8d9de8a96f1bf868e0f264f51c81d` |
| `node_modules/playwright-core/ThirdPartyNotices.txt` | `a549d329bad8806fe279f0ecae0fc0270dec7e7c2dc8ec10f90e394f7c32b144` |
| `node_modules/playwright-core/lib/serverRegistry.js.LICENSE` | `3098a6efcbc11752cbdf6075fa65480f5470f78c8d981fab9c0796dc9a41cefe` |
| `node_modules/playwright-core/lib/utilsBundle.js.LICENSE` | `1362b7f413c08083af537384162ab69a323d019fe26e0a2cd78536fafd6b9cbf` |
| `node_modules/playwright-core/lib/webp_codec.LICENSE` | `995c7ee35aceb7666829b7a501ca89c0864e12b493c1174b155774ab1e03d831` |

MIT material requires retained copyright and permission notices. BSD-2-Clause
entities requires its notice, conditions and disclaimer, including reproduction
in documentation/materials for binary redistribution. Apache-2.0 redistribution
requires the license, relevant attributions/NOTICE, and changed-file notices where
applicable; review the [Apache license](https://www.apache.org/licenses/LICENSE-2.0).
The native compiler/TypeScript NOTICE includes Unicode, DOM, WebGL and other
material. Playwright ThirdPartyNotices.txt directs readers to bundled sidecars:
utilsBundle.js.LICENSE (106,591 bytes), serverRegistry.js.LICENSE and
webp_codec.LICENSE. They contain more terms than a single Apache identifier.
Their component-level obligations and unavailable other-platform texts remain
release review work. Chromium itself is not included or authorized for redistribution.

For a source-only repository that references npm packages without redistributing
them, artifact obligations can differ. Approve source-only versus vendored/binary
scope before finalizing the notice plan. This is an evidence inventory and
preservation proposal, not a definitive legal compatibility conclusion.

## Dependency security evidence — 2026-10-25

- Official npm bulk advisory endpoint, strict TLS, retries=0, timeout=10s:
  npm audit --json exited 1 with getaddrinfo ENOTFOUND registry.npmjs.org.
- OSV POST /v1/querybatch for all 26 exact locked versions, normal TLS:
  curl exited 6, Could not resolve host: api.osv.dev. No advisory response arrived.
- GitHub Advisory Database keyword searches: parse5 returned related advisories
  for other packages and a loading error; entities failed to fetch. These are not
  exact-version clearance. No direct affected-package finding was established.
- No install, upgrade, audit fix, signature verification or provenance verification
  was performed. Security status is UNKNOWN, not zero vulnerabilities. npm graph
  auditing alone would also miss some inlined third-party code identified by the
  Playwright notices; prepare a bundled component inventory for release review.

Sources: [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit),
[OSV API](https://google.github.io/osv.dev/api/),
[GitHub query](https://github.com/advisories?query=ecosystem%3Anpm+parse5).
A successful advisory lookup would still be a dated signal, not proof of security.

## Runtime, portability and warnings

The effective declared support floor is Node 24.0.0 and npm 11, constrained to
Node <25 and npm <12; engine-strict enforces those ranges at installation.
Tested: Node 24.14.1, npm 11.11.0, macOS ARM64 only. The dependency-imposed Node
lower bound is 20.19.0 (entities); Playwright requires >=20 and TypeScript/native
packages >=16.20.0. parse5 declares no Node engine in the inspected manifest.
ES2023/NodeNext output and used built-ins (filesystem handles, TextDecoder,
Object.hasOwn, node:test) provide no evidence requiring a later Node than the
supported 24 line. This is not a test of Node 24.0 or permission to lower engines;
no exact minimum-runtime sweep or Node 20 compatibility run was performed.
Native compiler availability also depends on a supported OS/architecture.

Windows and Linux application behavior remain unverified. Regular-file checks,
NOFOLLOW/NONBLOCK where available, opened-handle identity, bounded growth reads,
UTF-8/NUL validation and cleanup were inspected and exercised by the suite.
Ancestor symlinks remain allowed; replacement races and network filesystems have
limitations. No read deadline or consistent snapshot is promised. stdout/stderr
errors have explicit handlers and broken pipes are tested. There are no custom
SIGINT/SIGTERM cleanup handlers; default OS/Node behavior applies, no graceful
cancellation guarantee or signal-propagation test is claimed.

Static-only evidence is about authored declarations/associations. It cannot
establish visibility, accessible-name quality, alternative suitability, actual
content language, rendered behavior or WCAG conformance. Recovery can alter
interpretation. needs-review can include definite source issues. There is no
hard parser CPU/memory boundary or serialization heap cap, and output is checked
only after full serialization. These warnings were added prominently to README;
full detail remains in the architecture and static report/rule documentation.
Do not present this local CLI as an isolated untrusted-input service.

## Verification and change record

npm run check (NODE_TLS_REJECT_UNAUTHORIZED=1, project-local cache, notifier off):
type-check and production build passed; 176 tests passed, 0 failed, 0 skipped.
Existing tests include actual CLI files, output overflow, broken pipes, and
explicitly identified simulated file races; no browser was launched.

Two fresh empty output directories were compiled with the installed tsc using
-p tsconfig.json --outDir <temporary-output>. Each emitted 90 files; matching
relative files were byte-identical, including maps/declarations. Each fresh CLI
returned four pass outcomes for the controlled original fixture. Temporary output
and manifest copies were removed; original dist and dependencies were retained.
This verifies clean output compilation, not a fresh install or checkout.

Other commands: pwd; git rev-parse --show-toplevel; git status --short --branch
--untracked-files=all; git ls-files --stage; git status --short --ignored; node
--version; npm --version; npm ls --all --json; npm audit --json; one OSV curl POST.
All npm commands used scoped strict TLS and a project-local cache; no global
settings changed. Limited pattern scanning included ignored text; binary files
and .git internals were excluded. No parent's files were accessed.

Changes: README.md (prominent limitations), docs/dependencies.md (missing parser
inventory and dated failed advisory evidence), docs/phase-1-review.md (personal
home-path removal), package.json (description only), and this audit report.
No LICENSE/notice artifact, parser/rule/schema/report-contract or dependency
change was made. Git index remains untouched. A future release needs explicit
approval for holder/license details, artifact scope/notices, an initial snapshot,
clean installation/advisory verification, and ultimately publication itself.
