# Third-party notice evidence and release gaps

Latest status as of 2026-10-25: attribution review is complete for the proposed
60-file source-only distribution. Complete legal compliance is not certified;
nineteen optional-platform legal texts remain unavailable locally. Earlier
Phase 6C–6E inspection and DNS records below are historical evidence, superseded
for verification status by the [current summary](../README.md#verification-status).
No consolidated notice bundle has been generated.

Phase 6C review, 2026-10-25. Dastresi's original material is MIT licensed,
Copyright (c) 2026 Samsad. This inventory does not replace upstream license texts
or relicense third-party code. Third-party copyright holders must remain named
as their own notices require; they must not be replaced with Samsad.

## Verified local evidence

The installed package metadata and license files were inspected. All 14 legal
files below match the SHA-256 values recorded during Phase 6B, and all seven
installed package versions/licenses still match the lockfile. Upstream files
were retained unchanged; no dependency directory or bundle was copied into
Dastresi source. There was no network lookup or installation in this phase.

| Installed package | Version | Declared license | Copyright/notice evidence |
| --- | --- | --- | --- |
| parse5 | 8.0.1 | MIT | Ivan Nikulin; preserve the full upstream LICENSE including its original copyright line |
| entities | 8.1.0 | BSD-2-Clause | Felix Böhm; preserve copyright, both redistribution conditions and the complete disclaimer |
| playwright-core | 1.64.0 | Apache-2.0 | Microsoft Corporation; NOTICE also identifies derived third-party code; preserve LICENSE, NOTICE, ThirdPartyNotices.txt and bundled sidecars |
| typescript | 7.0.2 | Apache-2.0 | Microsoft package metadata; LICENSE and NOTICE.txt include additional upstream attributions and terms |
| @typescript/typescript-darwin-arm64 | 7.0.2 | Apache-2.0 | Native compiler LICENSE and NOTICE.txt match the installed TypeScript legal texts |
| @types/node | 24.19.2 | MIT | Microsoft Corporation; preserve full LICENSE |
| undici-types | 7.24.6 | MIT | Matteo Collina and Undici contributors; preserve full LICENSE |

The installed Apache license texts specify license/attribution preservation and
relevant NOTICE/change notices when applicable. An SPDX declaration alone is
not a complete notice inventory. TypeScript NOTICE.txt includes Unicode, DOM,
WebGL and other material. Playwright's ThirdPartyNotices.txt identifies bundled
legal sidecars; its npm dependency count does not describe this inlined code.
For any approved redistribution, preserve the applicable original legal texts
in full rather than substituting the summaries in this table.

| Upstream legal text retained locally | Verified SHA-256 |
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

## Source-only review and broader redistribution limits

The lockfile includes 20 optional TypeScript platform packages at 7.0.2, declared
Apache-2.0; only darwin-arm64 is installed here. The other 19 archives and legal
texts have not been independently inspected. Do not infer their complete contents
from the installed platform's files. Their absence is expected for this host but
limits this review. Exact names are in the [Phase 6B inventory](phase-6b-release-readiness.md).

The proposed initial distribution is the reviewed 60-file source-only tree,
excluding dependency software and native binaries. Its attribution review is
complete for that scope, without certifying complete legal compliance. Any future
vendored dependencies/native binaries or inlined components require a separate
review of the actual redistributed material and applicable notices. Do not zip
the entire working directory for release.

No consolidated THIRD_PARTY_NOTICES bundle has been generated, and no complete
legal-compliance or license-compatibility conclusion is claimed. Obtain missing
applicable legal texts and review the exact payload before any broader
redistribution or notice assembly.
No missing text was guessed, no license directory was copied indiscriminately,
and no upstream copyright notice was altered. Chromium is neither included nor
authorized for redistribution in this preparation.

## Release gate status

- Resolved in Phase 6D: root manifest and lockfile license metadata now both say
  MIT. Only the lockfile root license string changed; dependency resolutions and
  upstream legal texts are unchanged. Phase 6C intentionally left this mismatch
  untouched under its then-applicable restriction.
- The dated OSV lookup returned no advisory matches for the 26 queried locked
  versions on 2026-10-25. This does not prove vulnerability-free software or
  authenticate publisher signatures/provenance. Prior DNS failures remain in
  historical reports; they are no longer the latest lookup result.
- Clean 60-file reconstruction and locked installation passed, followed by build,
  type-check and 176 passing tests (0 failures/skips). Clean CLI/report checks
  passed in the earlier run. These checks were not rerun during Phase 6G's
  read-only review. Human approval of the final source snapshot remains pending.
- The reference repository remains unidentified; independent authorship cannot
  be conclusively established. No legitimate third-party notice is removed.
- The project remains private in npm metadata. No commit, tag, publication or
  deployment has been performed or authorized by these documentation changes.

## Phase 6E distribution recommendation — 2026-10-25

The [distribution review](phase-6e-distribution-review.md) rechecks the exact
current graph and all 14 local legal-file hashes. It recommends a source-only
repository, excluding dependency/compiler/browser binaries and generated output;
this recommendation is not artifact approval. Source archive and npm payloads
are evaluated separately. npm and OSV advisory attempts again failed DNS, so
security status remains unverified. No consolidated notice bundle, installation
or release artifact was created. Existing distribution-specific legal gaps remain
for any future inclusion of third-party software.
