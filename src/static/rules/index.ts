import type { Rule } from '../../rule.js';
import type { Evidence, Finding, RuleOutcome } from '../../schema.js';
import type { HtmlAttribute, HtmlElement, ParsedHtml, SourceSpan } from '../parse-html.js';

const HTML = 'http://www.w3.org/1999/xhtml';
const VERSION = '1';
/** Explicit failure rather than a truncated or partially successful evaluation. */
export const MAX_STATIC_RULE_FINDINGS = 1000;
type Evaluation = Exclude<RuleOutcome, { outcome: 'not-applicable' }>;
type Issue = { code: string; span: SourceSpan; review: boolean; message: string };
const attribute = (node: HtmlElement, name: string): HtmlAttribute | undefined =>
  node.attributes.find((item) => item.name === name && item.namespace === null && item.prefix === null);
const authored = (node: HtmlElement): boolean => node.startTag !== null;
const evidence = (span: SourceSpan, observation: string): Evidence => ({ observation,
  location: `source:line ${span.startLine}, column ${span.startCol}; UTF-16 [${span.startOffset}, ${span.endOffset})` });

/** Linear indexes; fragments define independent ID-reference tree scopes. */
function index(document: ParsedHtml) {
  const elements: HtmlElement[] = [];
  const scopes = new Map<number, number>();
  const ids = new Map<number, Map<string, HtmlElement[]>>();
  const text = new Map<number, string[]>();
  for (const node of document.nodes) {
    const scope = node.kind === 'document' || node.kind === 'document-fragment'
      ? node.id : scopes.get(node.parentId!)!;
    scopes.set(node.id, scope);
    if (node.kind === 'text') {
      const values = text.get(node.parentId!) ?? [];
      values.push(node.value); text.set(node.parentId!, values);
    }
    if (node.kind !== 'element') continue;
    elements.push(node);
    const id = attribute(node, 'id');
    if (id) {
      const scopeIds = ids.get(scope) ?? new Map<string, HtmlElement[]>();
      const matches = scopeIds.get(id.value) ?? [];
      matches.push(node); scopeIds.set(id.value, matches); ids.set(scope, scopeIds);
    }
  }
  return { elements, scopes, ids, text };
}
function duplicate(document: ParsedHtml, node: HtmlElement): boolean {
  return !!node.startTag && document.parserErrors.some((error) => error.code === 'duplicate-attribute'
    && error.location.startOffset >= node.startTag!.startOffset && error.location.startOffset < node.startTag!.endOffset);
}
function finish(id: string, references: readonly string[], issues: Issue[], span: SourceSpan, count: number): Evaluation {
  if (!issues.length) return { outcome: 'pass', explanation: 'The inspected source declarations meet this limited check.',
    evidence: [evidence(span, `${count} source declaration(s) inspected; semantic suitability is not established.`)] };
  if (issues.length > MAX_STATIC_RULE_FINDINGS) throw new Error('Static rule finding limit exceeded');
  const findings: Finding[] = issues.map((issue, position) => ({
    id: `${id}:${issue.code}:${issue.span.startOffset}:${position}`, ruleId: id, ruleVersion: VERSION,
    title: issue.message, impact: 'This source declaration may prevent the intended information or association from being available.',
    recommendation: 'Inspect and correct this declaration in its document context.',
    verification: 'Recheck the authored declaration, then verify its meaning and behavior in the rendered page.',
    severity: 'moderate', confidence: 'high', evidence: [evidence(issue.span, issue.message)], references: [...references],
  }));
  const reviewCount = issues.filter((issue) => issue.review).length;
  return { outcome: reviewCount ? 'needs-review' : 'fail',
    explanation: `${issues.length - reviewCount} definite source issue(s); ${reviewCount} review observation(s). `
      + (reviewCount ? 'Aggregate needs-review can include definite issues; inspect all findings.' : 'Source declaration failure only; no conformance judgment.'), findings };
}
function create(id: string, description: string, applicability: string, reference: string,
  applicable: (document: ParsedHtml) => boolean, evaluate: (document: ParsedHtml) => Evaluation): Rule<ParsedHtml> {
  return { id, version: VERSION, description, applicability,
    limitations: ['Static declaration check only; no WCAG conformance, rendered visibility, accessible-name, or semantic suitability judgment.',
      'Parser recovery is retained; duplicate attributes on relevant start tags require review. Template contents remain inert.'],
    references: [reference], applies: (document) => ({ applicable: applicable(document),
      explanation: applicable(document) ? applicability : 'No authored source anchor or in-scope declaration; this check was not performed.' }), evaluate };
}
const titleReference = 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html';
const languageReference = 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html';
const imageReference = 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html';
const labelReference = 'https://html.spec.whatwg.org/multipage/forms.html#the-label-element';
const anchor = (document: ParsedHtml): SourceSpan | undefined => document.nodes.find((node) => node.location !== null)?.location ?? undefined;
const root = (document: ParsedHtml): HtmlElement | undefined => index(document).elements.find((node) =>
  node.namespace === HTML && node.tagName === 'html' && node.parentId === 0 && authored(node));

export const documentTitleRule = create('static-document-title', 'Document title declaration',
  'A parsed document; unavailable authored evidence is an execution error.', titleReference, () => true, (document) => {
    const sourceAnchor = anchor(document);
    if (!sourceAnchor) throw new Error('Document title cannot be evaluated without authored source evidence');
    const view = index(document);
    const titles = view.elements.filter((node) => node.namespace === HTML && node.tagName === 'title'
      && authored(node) && view.scopes.get(node.id) === 0);
    const span = titles[0]?.startTag ?? sourceAnchor;
    const issues: Issue[] = [];
    if (!titles.length) issues.push({ code: 'missing', span, review: false, message: 'Document title declaration is missing.' });
    else if (titles.length > 1) issues.push({ code: 'multiple', span, review: true, message: 'Multiple document title declarations require review.' });
    else {
      const title = titles[0]!;
      const parent = document.nodes[title.parentId!];
      if (parent?.kind !== 'element' || parent.tagName !== 'head') issues.push({ code: 'placement', span, review: true, message: 'Title outside the document head requires review.' });
      else if (!(view.text.get(title.id) ?? []).join('').trim()) issues.push({ code: 'empty', span, review: false, message: 'Document title declaration is empty.' });
    }
    return finish('static-document-title', [titleReference], issues, span, titles.length);
  });

export const documentLanguageRule = create('static-document-language', 'Root document language declaration',
  'An authored root HTML element.', languageReference, (document) => !!root(document), (document) => {
    const node = root(document)!;
    const lang = attribute(node, 'lang');
    const span = lang?.location ?? node.startTag!;
    const issues: Issue[] = [];
    if (duplicate(document, node) || (lang && !lang.location)) issues.push({ code: 'ambiguous', span, review: true, message: 'Root language declaration has ambiguous authored evidence.' });
    else if (!lang) issues.push({ code: 'missing', span, review: false, message: 'Root lang declaration is missing.' });
    else if (!lang.value.trim()) issues.push({ code: 'empty', span, review: false, message: 'Root lang declaration is empty.' });
    return finish('static-document-language', [languageReference], issues, span, 1);
  });

const images = (document: ParsedHtml) => index(document).elements.filter((node) => node.namespace === HTML && node.tagName === 'img' && authored(node));
export const imageAlternativeRule = create('static-image-alternative', 'Image alternative declaration',
  'Authored HTML img elements, including inert template content.', imageReference, (document) => images(document).length > 0, (document) => {
    const nodes = images(document);
    const issues: Issue[] = [];
    for (const node of nodes) {
      const alt = attribute(node, 'alt');
      const span = alt?.location ?? node.startTag!;
      if (duplicate(document, node) || (alt && !alt.location)) issues.push({ code: 'ambiguous', span, review: true, message: 'Image alternative declaration has ambiguous authored evidence.' });
      else if (!alt) issues.push({ code: 'missing', span, review: true, message: 'Image alt declaration is missing; inspect intent and other naming mechanisms.' });
      else if (!alt.value.trim()) issues.push({ code: alt.value === '' ? 'empty' : 'whitespace', span, review: true,
        message: alt.value === '' ? 'Empty image alternative requires decorative-intent review.' : 'Whitespace-only image alternative requires review.' });
    }
    return finish('static-image-alternative', [imageReference], issues, nodes[0]!.startTag!, nodes.length);
  });

const labels = (document: ParsedHtml) => index(document).elements.filter((node) => node.namespace === HTML && node.tagName === 'label' && authored(node) && attribute(node, 'for'));
export const explicitLabelRule = create('static-explicit-label', 'Explicit label association',
  'Authored HTML labels with a for attribute; implicit labels are outside scope.', labelReference,
  (document) => labels(document).length > 0, (document) => {
    const view = index(document);
    const nodes = labels(document);
    const issues: Issue[] = [];
    for (const node of nodes) {
      const ref = attribute(node, 'for')!;
      const span = ref.location ?? node.startTag!;
      const scope = view.scopes.get(node.id)!;
      const matches = view.ids.get(scope)?.get(ref.value) ?? [];
      const target = matches[0];
      let code = ''; let message = ''; let review = false;
      if (!ref.location || duplicate(document, node)) { code = 'ambiguous'; message = 'Explicit label reference has ambiguous authored evidence.'; review = true; }
      else if (ref.value === '') { code = 'missing'; message = 'Explicit label reference is empty.'; }
      else if (/[\t\n\f\r ]/.test(ref.value)) { code = 'malformed'; message = 'Whitespace in the exact label reference requires review.'; review = true; }
      else if (matches.length > 1) { code = 'ambiguous'; message = 'Explicit label reference matches multiple IDs.'; review = true; }
      else if (!target) { code = 'unresolved'; message = 'Explicit label reference does not resolve in this source tree.'; }
      else if (!authored(target) || !attribute(target, 'id')?.location || duplicate(document, target)) { code = 'ambiguous'; message = 'Label target has ambiguous authored evidence.'; review = true; }
      else if (target.namespace === HTML && target.tagName.includes('-')) { code = 'custom'; message = 'Custom-element labelability requires runtime review.'; review = true; }
      else if (target.namespace !== HTML || !['button', 'input', 'meter', 'output', 'progress', 'select', 'textarea'].includes(target.tagName)
        || (target.tagName === 'input' && attribute(target, 'type')?.value.toLowerCase() === 'hidden')) {
        code = 'nonlabelable'; message = 'Explicit label target is not a native labelable element.';
      }
      if (scope !== 0) { review = true; code ||= 'template'; message ||= 'Template label association requires review after instantiation.'; }
      if (code) issues.push({ code, span, review, message });
    }
    return finish('static-explicit-label', [labelReference], issues, nodes[0]!.startTag!, nodes.length);
  });

export const staticDeclarationRules: readonly Rule<ParsedHtml>[] = Object.freeze([
  documentTitleRule, documentLanguageRule, imageAlternativeRule, explicitLabelRule,
]);
