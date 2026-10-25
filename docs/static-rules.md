# Static declaration rules

`src/static/rules/index.ts` exports `documentTitleRule`, `documentLanguageRule`,
`imageAlternativeRule`, `explicitLabelRule`, and `staticDeclarationRules`.
Call `evaluateRule(rule, parseHtml(source))`. These are source checks, not WCAG
conformance, rendered-page, accessible-name, or interaction assessments. They
perform no I/O, execute no scripts, and preserve the non-executing browser boundary.

| Rule | Pass | Fail | Needs review / outside scope |
| --- | --- | --- | --- |
| Document title | One authored HTML title in the main document head with nonempty decoded text | Missing or whitespace-only title | Multiple titles or a title outside head; SVG titles and template titles do not declare the document title |
| Root language | Authored root HTML element has nonempty lang | Missing or whitespace-only lang | Duplicate attributes on root or language without an authored attribute span; implicit root is not applicable |
| Image alternative | Every authored HTML img has nonempty alt | No definitive failures inferred | Missing, exactly empty, whitespace-only, or ambiguous alt requires review; decoration, visibility, other naming mechanisms, and alternative quality are not inferred |
| Explicit label | Exact ID resolves once to an authored native labelable target | Empty reference, unresolved reference, or nonlabelable native target | Multiple matching IDs, malformed whitespace references, custom elements, ambiguous source, and all template associations require review |

For titles, language, and image alternatives, whitespace-only means empty after
JavaScript `String.trim()` (including Unicode whitespace). Attribute names follow parse5 HTML ASCII case normalization. Language
values are not case-normalized or syntax-validated; even an invalid language tag
can pass declaration presence. The actual content language is never inferred.
Nonempty titles can be useless or misleading. Empty image alternatives can be
correct. No rule infers otherwise.

Label references and decoded ID values use exact case-sensitive matching, without
trimming. Only the exactly empty string is an empty reference. Non-ASCII
whitespace can be a valid ID and is matched exactly. ASCII whitespace in any
nonempty reference requires review. ID indexes
are separate for the document and every template-content fragment. Duplicate IDs
matter only when the specific label reference matches them. Labels without `for`
are outside this explicit-association check, including implicit wrapping labels.
Native targets are button, input except type=hidden, meter, output, progress,
select, and textarea. Input type keywords are case-insensitive without trimming;
invalid type keywords retain the HTML text-input fallback assumption. Custom
element runtime form association cannot be established statically.

Template image declarations are inspected as inert authored declarations; label
associations in templates always require review because instantiation can change
their context. Noscript markup remains text under the parser's scriptingEnabled
assumption. Parser recovery is retained. Duplicate attributes on a relevant start
tag conservatively require review, even if the duplicate appears unrelated.
These checks do not diagnose every malformed HTML construct.

Evidence uses authored start-tag, attribute, or node spans only. Missing title
findings anchor the whole-document absence observation to the first authored node
(e.g. doctype), never an implicit head. Direct title evaluation throws an execution error when no authored span is
available. The static report workflow records that case as `not-executed` coverage
and an incomplete report; missing evidence is not proof of inapplicability. No applicable images or explicit labels return not-applicable. Locations are
`source:line L, column C; UTF-16 [start, end)` without filenames or snippets.
Finding IDs contain rule, classification, source offset, and ordinal; they are
repeatable for unchanged input, not persistent identities across edits.

The schema has one outcome per rule, not per finding. Any review case makes the
aggregate needs-review, including when other declarations are clearly broken.
The explanation counts definite source issues and review observations separately;
review status does not imply that no definite source issue was found.
Without review cases, any definite defect makes the aggregate fail. All inspected
declarations must meet the limited check to pass. Pass evidence gives the count
and a representative authored span; findings identify individual source issues.
Finding severity is a provisional moderate priority, not proof of user impact;
high confidence refers to source observations. `evaluateRule` propagates errors; the static report workflow fails without
emitting JSON if a required rule throws or returns invalid data.

Traversal/index construction is iterative and respects the parser's existing
size/node/depth/error limits. At most 1,000 findings per rule may be returned;
exceeding this throws a fixed error instead of returning partial success.
No new parser CPU/memory isolation or deadline is claimed. The parser still
constructs its tree before traversal; future worker isolation remains separate.

Tests start from original fixture/expected-outcome tables and check positive,
negative, ambiguous, implicit-node, template, duplicate-ID, Unicode, source-span,
determinism, JSON schema round-trip, output privacy, and finding-limit behavior.
They establish these source checks, not browser semantics or general accessibility
accuracy. No browser is executed.

Public requirements and terminology:

- [WCAG Page Titled](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html)
- [WCAG Language of Page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html)
- [WCAG Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html)
- [HTML label element](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)

These references supply requirements and terminology; implementation, fixtures,
and expected outcomes are original. References are not fetched by the rules.
