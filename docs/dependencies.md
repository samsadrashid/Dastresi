# Dependency review

## Latest verification status — 2026-10-25

Clean locked installation, production build/type-check and the corrected full
suite passed; the suite recorded 176 passed, 0 failed, 0 skipped in both the
workspace and a fresh 60-file reconstruction. Clean CLI/report checks passed in
the earlier verification run. OSV returned no advisory matches for all 26 queried
exact locked package versions on 2026-10-25, including the 20 optional platform
packages. The dated lookup is not proof of vulnerability-free software or a
publisher signature/provenance check; embedded components outside the lockfile
need separate coverage. It is not a new npm audit result.

Attribution review is complete for the proposed source-only distribution, without
certifying complete legal compliance. Nineteen optional-platform legal texts
remain unavailable locally; no package contents or obligations are inferred from
the lookup. npm distribution remains deferred. See the
[current verification summary](../README.md#verification-status).

The chronological installation and Phase 6B–6E records below retain their original
results, including DNS failures. Their pending statuses describe those phases,
not the latest state. Phase 6G was read-only and did not rerun installation,
build/tests, CLI checks or advisory queries.

Reviewed 2026-10-25. Phase 2A adds one approved runtime npm dependency. Exact direct versions
and the complete transitive graph are recorded in `package-lock.json`, including
integrity hashes. No dependency source has been copied into project source files.

| Package | Version | Role | Declared license |
| --- | --- | --- | --- |
| `parse5` | 8.0.1 | Runtime: inert, source-aware HTML parsing | MIT |
| `entities` | 8.1.0 | Transitive runtime dependency of parse5; entity decoding | BSD-2-Clause |
| `playwright-core` | 1.64.0 | Runtime: trusted cached-browser path and metadata preflight; future browser adapter API | Apache-2.0 |
| `typescript` | 7.0.2 | Development: strict type checking and compilation | Apache-2.0 |
| `@types/node` | 24.19.2 | Development: types for Node filesystem, streams, test runner, and process APIs | MIT |
| `undici-types` | 7.24.6 | Transitive development dependency of Node types; HTTP type declarations | MIT |
| `@typescript/typescript-*` | 7.0.2 | Optional platform-specific native compiler binaries selected by TypeScript | Apache-2.0 |

TypeScript 7 uses a native compiler. The lockfile records optional platform
packages for supported operating systems; only the compatible binary is installed
locally. These are compiler implementation dependencies, not audit dependencies.

Node's built-in test runner and argument handling avoid adding a test framework,
CLI framework or schema library. The small schema is
implemented locally with explicit runtime assertions and negative test cases.

`playwright-core@1.64.0` declares Node >=20 and no dependencies, optional
dependencies, or install scripts. Node 24 satisfies that declared requirement.
The installed LICENSE and NOTICE were inspected; preserve dependency notices
when redistributing it. Chromium's own third-party licenses are separate.

The exact approved npm install used lifecycle scripts disabled, browser downloads
skipped, TLS verification enabled, and the official npm registry. The first
restricted request failed DNS resolution; the explicitly approved network-enabled
retry succeeded. Only the new runtime dependency and lockfile entry were added;
existing dependency entries did not change. An offline `npm ci` then reproduced
the install from cached integrity-checked archives. No Chromium download occurred.
No online vulnerability/advisory scan was run.

Sources for review:

- [TypeScript repository](https://github.com/microsoft/TypeScript)
- [TypeScript license](https://github.com/microsoft/TypeScript/blob/main/LICENSE)
- [Node type declarations](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node)
- [DefinitelyTyped license](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE)
- [Undici repository and license](https://github.com/nodejs/undici)

License identifiers above were checked against registry metadata and installed
package metadata. Review bundled notices and native compiler third-party material
before redistribution. This inventory does not choose Dastresi's project license.

## Installation and security

Use `npm ci` with Node 24 and npm 11. `.npmrc` enables strict TLS, pins saved
versions, includes development tools even under a production environment, and
disables install scripts. Do not disable certificate verification. If inherited
environment settings disable TLS, set `NODE_TLS_REJECT_UNAUTHORIZED=1` for npm.

During foundation setup, npm registry requests timed out while TLS-verified curl
requests worked. A temporary local bridge outside the repository fetched official
registry metadata and archives through curl. Lockfile archive URLs were normalized
to `https://registry.npmjs.org/`; the bridge is not a project dependency or required
configuration. A clean cache-backed install verifies archive integrity afterward.

For future updates, inspect maintenance, release notes, licenses, lockfile changes,
and advisories; rerun `npm run check`. Use `npm audit` where registry connectivity
permits. An advisory scan is a point-in-time signal, not a security guarantee.
Do not execute dependency lifecycle scripts without reviewing their need.

## Phase 6B evidence update — 2026-10-25

The table above now includes the installed parser graph. The lockfile contains
26 packages: six non-platform packages and 20 optional native TypeScript packages.
Seven packages are installed here; the other 19 platform packages were inspected
through lockfile metadata only. Installed versions match locked versions.
Top-level declarations do not describe all bundled material: preserve Playwright
LICENSE, NOTICE, ThirdPartyNotices.txt and lib/*.LICENSE sidecars when distributing
its code, and TypeScript/native-compiler LICENSE and NOTICE.txt when distributing
them. Their notices require further distribution-specific review.

Strict-TLS npm audit failed with ENOTFOUND for registry.npmjs.org; the OSV batch
request failed DNS resolution for api.osv.dev. No clean advisory result is claimed.
Two project-cache archives (parse5 and entities) matched lockfile SHA-512 values;
the other 24 expected archives were absent from that cache. Registry signature
and provenance verification was unavailable. Earlier installation history above
is retained as history, not independently reverified by this audit.
See [release-readiness audit](phase-6b-release-readiness.md) for exact package
names, license evidence levels, bundled-notice obligations and remaining gates.

## Phase 6C licensing preparation

Dastresi's own license is now [MIT](../LICENSE), Copyright (c) 2026 Samsad.
This does not relicense dependency code. The 14 local upstream legal texts listed
in Phase 6B were rechecked against their recorded hashes and remain unchanged.
The seven installed versions and license declarations still match the lockfile.
See [third-party notices](third-party-notices.md) for the evidence inventory and
remaining redistribution review. No consolidated compliance claim is made.

At the end of Phase 6C, the lockfile was intentionally not modified: its root
license remained `UNLICENSED`, while the manifest declared `MIT`. That historical
mismatch was subsequently corrected by the authorized Phase 6D update below. Dependency versions, graph,
URLs and integrity values are unchanged. Current advisory verification remains
unavailable as recorded in Phase 6B; it was not retried in this offline review.
No clean installation was verified in this phase.


## Phase 6D root metadata reconciliation — 2026-10-25

The only lockfile change is packages[""].license: UNLICENSED to MIT. Root name,
version and license now match the manifest. All 26 non-root package entries,
including all 26 integrity values, dependency relationships, optional dependency
declarations, platform restrictions, versions and registry URLs, are unchanged.
No package-manager update, installation or network operation was performed.
The [local provenance audit](provenance.md#phase-6d-local-provenance-audit--2026-10-25)
records the evidence and limits; it does not authenticate dependency publishers.
Third-party redistribution review, current advisory verification and clean
installation remain pending; no consolidated notice bundle was generated.

## Phase 6E distribution recommendation — 2026-10-25

The [distribution review](phase-6e-distribution-review.md) rechecks the exact
current graph and all 14 local legal-file hashes. It recommends a source-only
repository, excluding dependency/compiler/browser binaries and generated output;
this recommendation is not artifact approval. Source archive and npm payloads
are evaluated separately. npm and OSV advisory attempts again failed DNS, so
security status remains unverified. No consolidated notice bundle, installation
or release artifact was created. Existing distribution-specific legal gaps remain
for any future inclusion of third-party software.
