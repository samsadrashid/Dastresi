import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateRule } from '../src/rule.js';
import { assertRuleResult } from '../src/schema.js';
import { parseHtml } from '../src/static/parse-html.js';
import { documentTitleRule, documentLanguageRule, imageAlternativeRule, explicitLabelRule, MAX_STATIC_RULE_FINDINGS } from '../src/static/rules/index.js';
import { fixtures } from './static-rule-fixtures.js';

const rules = { title: documentTitleRule, language: documentLanguageRule, image: imageAlternativeRule, label: explicitLabelRule };
for (const name of Object.keys(rules) as (keyof typeof rules)[]) {
  for (const [position, [source, expected]] of fixtures[name].entries()) {
    test(`${name} independent fixture ${position}: ${expected}`, async () => {
      const parsed = parseHtml(source);
      const result = await evaluateRule(rules[name], parsed);
      assert.equal(result.outcome, expected);
      assertRuleResult(JSON.parse(JSON.stringify(result)));
      assert.deepEqual(await evaluateRule(rules[name], parsed), result);
      if (result.outcome === 'fail' || result.outcome === 'needs-review') {
        for (const finding of result.findings) {
          assert.equal(finding.ruleId, result.ruleId);
          assert.equal(finding.ruleVersion, result.ruleVersion);
          for (const item of finding.evidence) {
            const offsets = /UTF-16 \[(\d+), (\d+)\)/.exec(item.location)!;
            assert.ok(offsets);
            assert.ok(parsed.nodes.some((node) => [node.location, ...(node.kind === 'element' ? [node.startTag, ...node.attributes.map((a) => a.location)] : [])]
              .some((span) => span?.startOffset === Number(offsets[1]) && span.endOffset === Number(offsets[2]))));
          }
        }
      }
    });
  }
}

test('exact CRLF, Unicode and attribute evidence without leaking source', async () => {
  const source = '<!doctype html>\r\n<html lang="">\n<title>😀é</title><img data-odd="secret" alt="">';
  const result = await evaluateRule(documentLanguageRule, parseHtml(source));
  assert.equal(result.outcome, 'fail');
  if (result.outcome !== 'fail') return;
  const start = source.indexOf('lang=');
  assert.equal(result.findings[0]!.evidence[0]!.location, `source:line 2, column 7; UTF-16 [${start}, ${start + 7})`);
  assert.equal(source.slice(start, start + 7), 'lang=""');
  assert.ok(!JSON.stringify(result).includes('secret'));
  const image = await evaluateRule(imageAlternativeRule, parseHtml(source));
  assert.equal(image.outcome, 'needs-review');
  if (image.outcome === 'needs-review') {
    const offset = source.indexOf('alt=');
    assert.ok(image.findings[0]!.evidence[0]!.location.endsWith(`[${offset}, ${offset + 6})`));
    assert.equal(source.slice(offset, offset + 6), 'alt=""');
  }
});
test('missing title uses actual doctype evidence, never implicit head spans', async () => {
  const result = await evaluateRule(documentTitleRule, parseHtml('<!doctype html><p>Content'));
  assert.equal(result.outcome, 'fail');
  if (result.outcome === 'fail') assert.equal(result.findings[0]!.evidence[0]!.location, 'source:line 1, column 1; UTF-16 [0, 15)');
});
test('all native labelable targets and decoded unusual IDs', async () => {
  for (const tag of ['button', 'input', 'meter', 'output', 'progress', 'select', 'textarea']) {
    const source = `<label for="😀&amp;é">Caption</label><${tag} id="😀&amp;é"></${tag}>`;
    assert.equal((await evaluateRule(explicitLabelRule, parseHtml(source))).outcome, 'pass');
  }
});
test('mixed broken and ambiguous labels require review with distinct findings', async () => {
  const result = await evaluateRule(explicitLabelRule, parseHtml('<label for="absent">A</label><label for="x">B</label><input id="x"><input id="x">'));
  assert.equal(result.outcome, 'needs-review');
  if (result.outcome === 'needs-review') {
    assert.equal(result.findings.length, 2);
    assert.match(result.findings[0]!.id, /:unresolved:/);
    assert.match(result.findings[1]!.id, /:ambiguous:/);
  }
});
test('nested templates and main document have separate ID scopes', async () => {
  const source = '<input id="x"><template><label for="x">A</label><template><input id="x"></template></template>';
  const result = await evaluateRule(explicitLabelRule, parseHtml(source));
  assert.equal(result.outcome, 'needs-review');
  if (result.outcome === 'needs-review') assert.match(result.findings[0]!.id, /:unresolved:/);
});
test('malformed table recovery cannot turn implicit elements into label targets', async () => {
  const result = await evaluateRule(explicitLabelRule, parseHtml('<label for="x">A</label><table id="x"><tr><td>Cell'));
  assert.equal(result.outcome, 'fail');
});
test('diagnostics never echo untrusted names, values, paths or terminal controls', async () => {
  const source = '<img alt="" data-secret="/Users/private/token\u001b[31m"><label for="\u001b[31m">Secret</label>';
  for (const rule of Object.values(rules)) {
    const result = await evaluateRule(rule, parseHtml(source));
    assert.ok(!JSON.stringify(result).includes('private'));
    assert.ok(!JSON.stringify(result).includes('Secret'));
    assert.ok(!JSON.stringify(result).includes('\\u001b'));
  }
});
test('finding overflow rejects explicitly instead of returning partial success', async () => {
  await assert.rejects(evaluateRule(imageAlternativeRule, parseHtml('<img>'.repeat(MAX_STATIC_RULE_FINDINGS + 1))), /Static rule finding limit exceeded/);
});
test('root attributes adopted by malformed parser recovery require review', async () => {
  assert.equal((await evaluateRule(documentLanguageRule, parseHtml('<html><body><html lang="en">'))).outcome, 'needs-review');
});
