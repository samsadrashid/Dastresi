# Data contract version 1

The authoritative executable schemas are the TypeScript types and assertion
functions in `src/schema.ts`. There are no generated JSON Schema files yet.
Unknown fields are rejected at every JSON object level. All text fields must
contain non-whitespace text. Validators throw `ValidationError` with a field path.
Field paths in diagnostics are escaped and bounded. Serialized fields must be
enumerable own data properties on plain objects (standard or null prototype).
Inherited fields and accessors do not qualify. Arrays must be dense, plain arrays
with enumerable own data elements and no extra properties. Serialization hooks,
symbols, custom prototypes, and proxies are unsupported. These constraints
preserve validation across JSON round trips without invoking application getters.

## Audit result

- `schemaVersion`: literal string `1`.
- `target`: HTTP(S) `url` without embedded credentials and a nonempty named `state`.
- `startedAt`, `finishedAt`: canonical UTC ISO timestamps with milliseconds.
  Finish must not precede start.
- `results`: completed rule results, at most one per rule identifier for this state.
- `errors`: `{ ruleId, message }` entries for rules that could not finish.
  Error rule identifiers must be unique and cannot also have completed results.

An empty results list is valid data, not evidence that anything passed.

```json
{
  "schemaVersion": "1",
  "target": { "url": "https://example.test/", "state": "initial" },
  "startedAt": "2026-10-25T00:00:00.000Z",
  "finishedAt": "2026-10-25T00:00:01.000Z",
  "results": [],
  "errors": []
}
```

## Rule result

Every result has `ruleId`, `ruleVersion`, `outcome`, and `explanation`.

| Outcome | Required additional data | Meaning |
| --- | --- | --- |
| `pass` | Nonempty `evidence` | The evaluated condition passed within the rule's scope |
| `fail` | Nonempty `findings` | The evaluated condition failed |
| `needs-review` | Nonempty `findings` | An observation needs human determination |
| `not-applicable` | None | The documented applicability condition did not hold |

Payloads from another outcome are rejected. Finding rule identifiers and versions
must match their result, and finding IDs must be unique within that result.
Finding identity is scoped to its rule result; cross-run matching is not defined.

## Finding and evidence

A finding contains nonempty `id`, `ruleId`, `ruleVersion`, `title`, `impact`,
`recommendation`, and `verification` text. `severity` is one of `low`, `moderate`,
`high`, `critical`; `confidence` is `low`, `medium`, or `high`.

`evidence` contains at least one `{ observation, location }` object. Locations
are descriptive strings in this foundation; no selector stability is promised.
`references` contains at least one absolute HTTP(S) URL without credentials.
References are not fetched or checked for correctness by the validator.

Rule implementation versions are nonempty opaque strings, not enforced semantic
versions. Schema changes require an explicit versioning decision. Metadata is
validated separately by `assertRule`; the audit stores rule identity but does not
yet embed a registry snapshot or complete coverage manifest.

## Static local-source report

`src/static/report.ts` defines the separate `dastresi-static` format at version
`1`, documented in [static-report.md](static-report.md). It reuses the original
rule/finding validators without changing the HTTP-target `AuditResult` above.
The existing `validate` command accepts either format.
