import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import net from 'node:net';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { parseHtml, HtmlParseError, HTML_PARSER_LIMITS, type ParsedHtml, type HtmlElement, type HtmlParserLimits, type SourceSpan } from '../src/static/parse-html.js';

const emptyDocument = '<!doctype html><html><head></head><body></body></html>';
function element(parsed: ParsedHtml, name: string): HtmlElement {
  const found = parsed.nodes.find((node): node is HtmlElement => node.kind === 'element' && node.tagName === name);
  assert.ok(found, `Expected element ${name}`);
  return found;
}
function slice(parsed: ParsedHtml, location: SourceSpan | null): string {
  assert.ok(location);
  return parsed.source.slice(location.startOffset, location.endOffset);
}
function rejects(source: string, limits: Partial<HtmlParserLimits>, code: HtmlParseError['code']): void {
  assert.throws(() => parseHtml(source, limits), (error: unknown) => error instanceof HtmlParseError && error.code === code);
}

test('normal complete HTML exposes deterministic preorder, parents and authored locations', () => {
  const source = '<!doctype html><html lang="en"><head><title>Sample</title></head><body><p>Hello</p></body></html>';
  const parsed = parseHtml(source);
  assert.equal(parsed.source, source);
  assert.equal(parsed.sourceBytes, Buffer.byteLength(source));
  assert.deepEqual(parsed.nodes.map((node) => node.kind === 'element' ? node.tagName : node.kind),
    ['document', 'doctype', 'html', 'head', 'title', 'text', 'body', 'p', 'text']);
  assert.deepEqual(parsed.nodes.map((node) => node.parentId), [null, 0, 0, 2, 3, 4, 2, 6, 7]);
  assert.deepEqual(parsed.nodes.map((node) => node.depth), [0, 1, 1, 2, 3, 4, 2, 3, 4]);
  const paragraph = element(parsed, 'p');
  assert.equal(slice(parsed, paragraph.location), '<p>Hello</p>');
  assert.equal(slice(parsed, paragraph.startTag), '<p>');
  assert.equal(slice(parsed, paragraph.endTag), '</p>');
  assert.deepEqual(parsed.parserErrors, []);
});

test('implicit html/head/body and empty input never receive invented source spans', () => {
  for (const source of ['', '<p>Source fragment interpreted as a document</p>']) {
    const parsed = parseHtml(source);
    assert.equal(parsed.nodes[0]?.location, null);
    for (const name of ['html', 'head', 'body']) {
      const node = element(parsed, name);
      assert.equal(node.location, null);
      assert.equal(node.startTag, null);
      assert.equal(node.endTag, null);
    }
    if (source) assert.equal(slice(parsed, element(parsed, 'p').location), source);
  }
});

test('missing head/body retain an authored html tag without inventing locations for inserted elements', () => {
  const parsed = parseHtml('<!doctype html><html lang="en"><p>Text</p></html>');
  assert.equal(slice(parsed, element(parsed, 'html').startTag), '<html lang="en">');
  assert.equal(element(parsed, 'head').location, null);
  assert.equal(element(parsed, 'body').location, null);
});

test('malformed tables foster-parent content and insert tbody without a source span', () => {
  const parsed = parseHtml('<!doctype html><table><div>Moved</div><tr><td>Cell</table>');
  const moved = element(parsed, 'div');
  assert.equal(moved.parentId, element(parsed, 'body').id);
  assert.equal(slice(parsed, moved.location), '<div>Moved</div>');
  const tbody = element(parsed, 'tbody');
  assert.equal(tbody.parentId, element(parsed, 'table').id);
  assert.equal(tbody.location, null);
  assert.equal(tbody.startTag, null);
  assert.equal(tbody.endTag, null);
  assert.equal(element(parsed, 'tr').parentId, tbody.id);
});

test('template content is visited through an explicit fragment, including nested templates', () => {
  const parsed = parseHtml('<!doctype html><template><template><img alt="Nested"></template></template>');
  const templates = parsed.nodes.filter((node): node is HtmlElement => node.kind === 'element' && node.tagName === 'template');
  const fragments = parsed.nodes.filter((node) => node.kind === 'document-fragment');
  assert.equal(templates.length, 2);
  assert.equal(fragments.length, 2);
  assert.deepEqual(fragments.map((node) => node.parentId), templates.map((node) => node.id));
  assert.ok(fragments.every((node) => node.location === null));
  assert.equal(templates[1]?.parentId, fragments[0]?.id);
  assert.equal(element(parsed, 'img').parentId, fragments[1]?.id);
});

test('comments, entities, void elements and raw script text stay source data', () => {
  const script = 'globalThis.__dastresiStaticScriptRan = true; const text = "<button>not markup</button>";';
  const parsed = parseHtml('<!doctype html><!--Original comment--><p>A &amp; &#x1f642;</p><br><img alt="A &amp; B"><script>' + script + '</script>');
  assert.ok(parsed.nodes.some((node) => node.kind === 'comment' && node.value === 'Original comment'));
  assert.ok(parsed.nodes.some((node) => node.kind === 'text' && node.value === 'A & 🙂'));
  assert.ok(parsed.nodes.some((node) => node.kind === 'text' && node.value === script));
  assert.equal(element(parsed, 'img').attributes[0]?.value, 'A & B');
  assert.equal(element(parsed, 'br').endTag, null);
  assert.equal(parsed.nodes.some((node) => node.parentId === element(parsed, 'br').id), false);
  assert.equal(parsed.nodes.some((node) => node.kind === 'element' && node.tagName === 'button'), false);
  assert.equal(Object.hasOwn(globalThis, '__dastresiStaticScriptRan'), false);
});

test('explicit scripting-enabled assumption keeps noscript fallback markup as text', () => {
  const parsed = parseHtml('<!doctype html><body><noscript><img alt="Fallback"></noscript></body>');
  assert.equal(parsed.scriptingEnabled, true);
  assert.equal(parsed.nodes.some((node) => node.kind === 'element' && node.tagName === 'img'), false);
  const fallback = parsed.nodes.find((node) => node.kind === 'text' && node.parentId === element(parsed, 'noscript').id);
  assert.ok(fallback && fallback.kind === 'text');
  assert.equal(fallback.value, '<img alt="Fallback">');
  assert.equal(slice(parsed, fallback.location), fallback.value);
});

for (const newline of ['\n', '\r\n']) {
  test(`${newline === '\n' ? 'LF' : 'CRLF'} attribute spans use exact original slices and line/column coordinates`, () => {
    const source = ['<!doctype html>', '<html lang="en">', '<head><title>T</title></head>', '<body>', '<img alt="A &amp; B" src="x">', '</body></html>'].join(newline);
    const parsed = parseHtml(source);
    const image = element(parsed, 'img');
    const alternative = image.attributes.find((attribute) => attribute.name === 'alt')!;
    assert.equal(slice(parsed, alternative.location), 'alt="A &amp; B"');
    assert.equal(alternative.value, 'A & B');
    assert.deepEqual(alternative.location, { startLine: 5, startCol: 6, startOffset: source.indexOf('alt='), endLine: 5, endCol: 21, endOffset: source.indexOf('alt=') + 15 });
    assert.equal(image.location?.startLine, 5);
    assert.equal(image.location?.startCol, 1);
    assert.equal(image.location?.endCol, 30);
    assert.equal(slice(parsed, image.startTag), '<img alt="A &amp; B" src="x">');
    assert.equal(parsed.source, source);
  });
}

test('non-BMP and combining characters retain UTF-16 offsets, not UTF-8 byte positions', () => {
  const source = '<!doctype html><p>😀e\u0301</p><img alt="x">';
  const parsed = parseHtml(source);
  const image = element(parsed, 'img');
  assert.equal(image.location?.startOffset, 26);
  assert.equal(image.location?.startCol, 27);
  assert.equal(source.indexOf('<img'), 26);
  assert.equal(Buffer.byteLength(source.slice(0, 26)), 29);
  assert.equal(slice(parsed, image.location), '<img alt="x">');
  const text = parsed.nodes.find((node) => node.kind === 'text' && node.parentId === element(parsed, 'p').id)!;
  assert.equal(slice(parsed, text.location), '😀e\u0301');
  assert.ok(text.kind === 'text' && text.value === '😀e\u0301');
});

test('duplicate attributes keep the first value/location and record a source-located parser error', () => {
  const source = '<!doctype html><p id="first" ID="second" __proto__="safe" data-odd:name="ok">text</p>';
  const parsed = parseHtml(source);
  const attrs = element(parsed, 'p').attributes;
  assert.equal(attrs.filter((attribute) => attribute.name === 'id').length, 1);
  assert.equal(attrs.find((attribute) => attribute.name === 'id')?.value, 'first');
  assert.equal(slice(parsed, attrs.find((attribute) => attribute.name === 'id')!.location), 'id="first"');
  assert.equal(slice(parsed, attrs.find((attribute) => attribute.name === '__proto__')!.location), '__proto__="safe"');
  assert.equal(slice(parsed, attrs.find((attribute) => attribute.name === 'data-odd:name')!.location), 'data-odd:name="ok"');
  assert.equal(parsed.parserErrors[0]?.code, 'duplicate-attribute');
  assert.deepEqual(parsed.parserErrors[0]?.location, { startLine: 1, startCol: 32, startOffset: 31, endLine: 1, endCol: 32, endOffset: 31 });
  assert.equal(Object.hasOwn(Object.prototype, 'safe'), false);
});

test('SVG case-adjusted and namespaced attributes retain tokenizer source locations', () => {
  const parsed = parseHtml('<!doctype html><svg viewBox="0 0 1 1"><use xlink:href="#sample"></use></svg>');
  const viewBox = element(parsed, 'svg').attributes.find((attribute) => attribute.name === 'viewBox')!;
  assert.equal(slice(parsed, viewBox.location), 'viewBox="0 0 1 1"');
  const href = element(parsed, 'use').attributes[0]!;
  assert.equal(href.prefix, 'xlink');
  assert.equal(slice(parsed, href.location), 'xlink:href="#sample"');
});

test('malformed HTML returns recovery diagnostics without echoing sensitive source', () => {
  const parsed = parseHtml('<!doctype html><p key="/PRIVATE/SECRET');
  assert.ok(parsed.parserErrors.some((error) => error.code === 'eof-in-tag'));
  assert.doesNotMatch(JSON.stringify(parsed.parserErrors), /PRIVATE|SECRET|<p/);
  assert.equal(parsed.diagnosticBytes, Buffer.byteLength(JSON.stringify(parsed.parserErrors)));
});

test('parser-error budgets accept the boundary and reject excess without partial success', () => {
  const source = '<!doctype html>' + '<img x x>'.repeat(100);
  assert.equal(parseHtml(source).parserErrors.length, 100);
  rejects(source + '<img x x>', {}, 'parser-error-limit');
  assert.equal(parseHtml('<!doctype html><img x x><img x x>', { maxParserErrors: 2 }).parserErrors.length, 2);
  rejects('<!doctype html><img x x><img x x><img x x>', { maxParserErrors: 2 }, 'parser-error-limit');
});

test('diagnostic JSON byte budget is exact and every diagnostic message remains bounded', () => {
  const source = '<!doctype html><img x x>';
  const parsed = parseHtml(source);
  const bytes = Buffer.byteLength(JSON.stringify(parsed.parserErrors));
  assert.equal(parseHtml(source, { maxDiagnosticBytes: bytes }).diagnosticBytes, bytes);
  rejects(source, { maxDiagnosticBytes: bytes - 1 }, 'diagnostic-limit');
  assert.equal(parseHtml(emptyDocument, { maxDiagnosticBytes: 2 }).diagnosticBytes, 2);
  assert.ok(parsed.parserErrors.every((error) => error.message.length <= 512));
});

test('1 MiB source ceiling counts UTF-8 bytes and never truncates accepted strings', () => {
  const ascii = ' '.repeat(HTML_PARSER_LIMITS.maxSourceBytes);
  assert.equal(parseHtml(ascii).source, ascii);
  rejects(ascii + ' ', {}, 'source-limit');
  const unicode = 'é'.repeat(HTML_PARSER_LIMITS.maxSourceBytes / 2);
  assert.equal(parseHtml(unicode).sourceBytes, HTML_PARSER_LIMITS.maxSourceBytes);
  rejects(unicode + 'é', {}, 'source-limit');
  rejects('éé', { maxSourceBytes: 3 }, 'source-limit');
});

test('node ceiling counts document/doctype and rejects broad trees without partial success', () => {
  assert.equal(parseHtml(emptyDocument, { maxNodes: 5 }).nodes.length, 5);
  rejects(emptyDocument, { maxNodes: 4 }, 'node-limit');
  const source = '<!doctype html>' + '<br>'.repeat(5);
  assert.equal(parseHtml(source, { maxNodes: 10 }).nodes.length, 10);
  rejects(source, { maxNodes: 9 }, 'node-limit');
  rejects('<!doctype html>' + '<br>'.repeat(1000), { maxNodes: 10 }, 'node-limit');
});

test('depth ceiling includes explicit template fragments and accepts the default boundary', () => {
  assert.equal(Math.max(...parseHtml(emptyDocument, { maxDepth: 2 }).nodes.map((node) => node.depth)), 2);
  rejects(emptyDocument, { maxDepth: 1 }, 'depth-limit');
  const deep = '<!doctype html>' + '<div>'.repeat(254) + '</div>'.repeat(254);
  assert.equal(Math.max(...parseHtml(deep).nodes.map((node) => node.depth)), 256);
  rejects('<!doctype html>' + '<div>'.repeat(255) + '</div>'.repeat(255), {}, 'depth-limit');
  rejects('<!doctype html><body><template><img></template>', { maxDepth: 4 }, 'depth-limit');
});

test('invalid limits, getters, proxies and nonstring inputs are rejected without coercion', () => {
  let calls = 0;
  const getter = () => { calls++; throw new Error('Must not execute'); };
  const accessor = Object.defineProperty({}, 'maxNodes', { get: getter, enumerable: true });
  for (const limits of [{ maxNodes: 0 }, { maxDepth: 1.5 }, { maxParserErrors: NaN }, { maxDiagnosticBytes: 1 },
    { maxSourceBytes: 1024 * 1024 + 1 }, { maxNodes: 50_001 }, { maxDepth: 257 }, { maxParserErrors: 101 },
    { maxDiagnosticBytes: 32 * 1024 + 1 }, { scriptingEnabled: false }, { treeAdapter: {} }, accessor,
    Object.create({ maxNodes: 5 }), new Proxy({}, {})]) {
    rejects(emptyDocument, limits as Partial<HtmlParserLimits>, 'invalid-limits');
  }
  assert.throws(() => parseHtml({ toString: getter } as unknown as string), (error: unknown) => error instanceof HtmlParseError && error.code === 'invalid-input');
  assert.equal(calls, 0);
});

test('repeated parsing is deterministic, acyclic and immutable without returning the parse5 tree', () => {
  const source = '<!doctype html><template><p>A &amp; B</p></template><p>😀</p>';
  const first = parseHtml(source);
  assert.deepEqual(first, parseHtml(source));
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.nodes));
  assert.ok(first.nodes.every(Object.isFrozen));
  assert.equal(first.nodes.some((node) => Object.hasOwn(node, 'parentNode')), false);
});

test('script/resource/config references never trigger script execution, file reads or network calls', () => {
  const deny = () => { throw new Error('Unexpected I/O during inert HTML parsing'); };
  const spies = [mock.method(globalThis, 'fetch', deny), mock.method(net.Socket.prototype, 'connect', deny),
    mock.method(http, 'request', deny), mock.method(https, 'request', deny), mock.method(dns, 'lookup', deny),
    mock.method(fs, 'readFileSync', deny), mock.method(fsPromises, 'readFile', deny)];
  try {
    const parsed = parseHtml('<!doctype html SYSTEM "https://fixtures.invalid/doctype"><html><head><link rel="stylesheet" href="https://fixtures.invalid/style">'
      + '<script src="file:///PRIVATE/config.js"></script></head><body><img src="https://fixtures.invalid/image">'
      + '<iframe src="https://fixtures.invalid/frame"></iframe><script>globalThis.__dastresiStaticScriptRan = true;</script></body></html>');
    assert.equal(element(parsed, 'iframe').attributes[0]?.name, 'src');
    assert.equal(Object.hasOwn(globalThis, '__dastresiStaticScriptRan'), false);
    for (const spy of spies) assert.equal(spy.mock.callCount(), 0);
  } finally { for (const spy of spies) spy.mock.restore(); }
});
