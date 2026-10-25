import { parse, defaultTreeAdapter, type DefaultTreeAdapterTypes, type ParserError, type ErrorCodes, type Token } from 'parse5';
import { types } from 'node:util';
import { terminalText } from '../diagnostics.js';

/** Reserved for a future explicit-file CLI; this module accepts one string. */
export const MAX_STATIC_INPUT_FILES = 8;
export interface HtmlParserLimits {
  readonly maxSourceBytes: number;
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxParserErrors: number;
  readonly maxDiagnosticBytes: number;
}
/** Hard ceilings. Overrides may only lower these values. */
export const HTML_PARSER_LIMITS: HtmlParserLimits = Object.freeze({
  maxSourceBytes: 1024 * 1024, maxNodes: 50_000, maxDepth: 256,
  maxParserErrors: 100, maxDiagnosticBytes: 32 * 1024,
});
export type HtmlParseErrorCode = 'invalid-input' | 'invalid-limits' | 'source-limit'
  | 'node-limit' | 'depth-limit' | 'parser-error-limit' | 'diagnostic-limit' | 'parser-failed';
const messages: Record<HtmlParseErrorCode, string> = {
  'invalid-input': 'HTML source must be a string',
  'invalid-limits': 'Invalid HTML parser limits',
  'source-limit': 'HTML source size limit exceeded',
  'node-limit': 'HTML node limit exceeded',
  'depth-limit': 'HTML tree depth limit exceeded',
  'parser-error-limit': 'HTML parser error limit exceeded',
  'diagnostic-limit': 'HTML diagnostic output limit exceeded',
  'parser-failed': 'Unable to parse HTML source',
};
export class HtmlParseError extends Error {
  constructor(public readonly code: HtmlParseErrorCode) {
    super(messages[code]);
    this.name = 'HtmlParseError';
  }
}

/** Half-open UTF-16 JavaScript string offsets; never UTF-8 byte offsets. */
export interface SourceSpan {
  readonly startLine: number; readonly startCol: number; readonly startOffset: number;
  readonly endLine: number; readonly endCol: number; readonly endOffset: number;
}
export interface HtmlAttribute {
  readonly name: string; readonly value: string;
  readonly namespace: string | null; readonly prefix: string | null;
  readonly location: SourceSpan | null;
}
interface NodeBase {
  readonly id: number;
  readonly parentId: number | null;
  /** Document root is depth 0; template fragments count as nodes and depth. */
  readonly depth: number;
  readonly location: SourceSpan | null;
}
export type HtmlElement = NodeBase & {
  readonly kind: 'element'; readonly tagName: string; readonly namespace: string;
  readonly attributes: readonly HtmlAttribute[];
  readonly startTag: SourceSpan | null; readonly endTag: SourceSpan | null;
};
export type HtmlNode = HtmlElement | (NodeBase & (
  | { readonly kind: 'document'; readonly mode: DefaultTreeAdapterTypes.Document['mode'] }
  | { readonly kind: 'document-fragment' }
  | { readonly kind: 'text' | 'comment'; readonly value: string }
  | { readonly kind: 'doctype'; readonly name: string; readonly publicId: string; readonly systemId: string }
));
export interface HtmlDiagnostic {
  readonly code: ErrorCodes;
  readonly message: string;
  readonly location: SourceSpan;
}
/** In-memory source data, not an audit report. Do not log/serialize it as a diagnostic. */
export interface ParsedHtml {
  readonly source: string;
  readonly sourceBytes: number;
  readonly scriptingEnabled: true;
  readonly nodes: readonly HtmlNode[];
  readonly parserErrors: readonly HtmlDiagnostic[];
  /** UTF-8 size of JSON.stringify(parserErrors), including array punctuation. */
  readonly diagnosticBytes: number;
  readonly limits: HtmlParserLimits;
}

function limitsFor(overrides: Partial<HtmlParserLimits>): HtmlParserLimits {
  if (typeof overrides !== 'object' || overrides === null || types.isProxy(overrides)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(overrides))) throw new HtmlParseError('invalid-limits');
  const limits = { ...HTML_PARSER_LIMITS };
  for (const key of Reflect.ownKeys(overrides)) {
    if (typeof key !== 'string' || !Object.hasOwn(limits, key)) throw new HtmlParseError('invalid-limits');
    const descriptor = Object.getOwnPropertyDescriptor(overrides, key)!;
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw new HtmlParseError('invalid-limits');
    const name = key as keyof HtmlParserLimits;
    const value: unknown = descriptor.value;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (name === 'maxDiagnosticBytes' ? 2 : 1)
      || value > HTML_PARSER_LIMITS[name]) throw new HtmlParseError('invalid-limits');
    limits[name] = value;
  }
  return Object.freeze(limits);
}
function span(location: Token.Location | null | undefined): SourceSpan | null {
  if (!location) return null;
  return Object.freeze({
    startLine: location.startLine, startCol: location.startCol, startOffset: location.startOffset,
    endLine: location.endLine, endCol: location.endCol, endOffset: location.endOffset,
  });
}
function projectNode(node: DefaultTreeAdapterTypes.Node, id: number, parentId: number | null, depth: number): HtmlNode {
  const base = { id, parentId, depth, location: span(defaultTreeAdapter.getNodeSourceCodeLocation(node)) };
  if (defaultTreeAdapter.isElementNode(node)) {
    const locations = node.sourceCodeLocation?.attrs;
    const attributes = node.attrs.map((attribute): HtmlAttribute => {
      const key = attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
      // Foreign attributes may have adjusted case (e.g. SVG viewBox), while
      // tokenizer source-location keys retain their ASCII-lowercase spelling.
      const lower = key.replace(/[A-Z]/g, (character) => character.toLowerCase());
      const location: Token.Location | undefined = locations
        ? Object.getOwnPropertyDescriptor(locations, key)?.value ?? Object.getOwnPropertyDescriptor(locations, lower)?.value
        : undefined;
      return Object.freeze({ name: attribute.name, value: attribute.value,
        namespace: attribute.namespace ?? null, prefix: attribute.prefix ?? null, location: span(location) });
    });
    return Object.freeze({ ...base, kind: 'element', tagName: node.tagName, namespace: node.namespaceURI,
      attributes: Object.freeze(attributes), startTag: span(node.sourceCodeLocation?.startTag), endTag: span(node.sourceCodeLocation?.endTag) });
  }
  if (defaultTreeAdapter.isTextNode(node)) return Object.freeze({ ...base, kind: 'text', value: node.value });
  if (defaultTreeAdapter.isCommentNode(node)) return Object.freeze({ ...base, kind: 'comment', value: node.data });
  if (defaultTreeAdapter.isDocumentTypeNode(node)) return Object.freeze({ ...base, kind: 'doctype', name: node.name, publicId: node.publicId, systemId: node.systemId });
  if (node.nodeName === '#document') return Object.freeze({ ...base, kind: 'document', mode: node.mode });
  return Object.freeze({ ...base, kind: 'document-fragment' });
}

/**
 * Parse complete HTML as inert text. scriptingEnabled=true models script-enabled
 * HTML parsing (noscript contents are text), NOT script execution or resource loading.
 * parse5 constructs the full tree before our traversal: these limits are not a
 * hard parser memory/CPU boundary. No workers, browsers, plugins, or file I/O.
 */
export function parseHtml(source: string, overrides: Partial<HtmlParserLimits> = {}): ParsedHtml {
  if (typeof source !== 'string') throw new HtmlParseError('invalid-input');
  const limits = limitsFor(overrides);
  if (source.length > limits.maxSourceBytes) throw new HtmlParseError('source-limit');
  const sourceBytes = Buffer.byteLength(source, 'utf8');
  if (sourceBytes > limits.maxSourceBytes) throw new HtmlParseError('source-limit');
  const parserErrors: HtmlDiagnostic[] = [];
  let diagnosticBytes = 2;
  const onParseError = (error: ParserError) => {
    if (parserErrors.length >= limits.maxParserErrors) throw new HtmlParseError('parser-error-limit');
    const diagnostic = Object.freeze({ code: error.code,
      message: terminalText(`HTML parse error: ${error.code}`), location: span(error)! });
    const size = Buffer.byteLength(JSON.stringify(diagnostic), 'utf8') + (parserErrors.length ? 1 : 0);
    if (diagnosticBytes + size > limits.maxDiagnosticBytes) throw new HtmlParseError('diagnostic-limit');
    diagnosticBytes += size;
    parserErrors.push(diagnostic);
  };
  let document: DefaultTreeAdapterTypes.Document;
  // A leading decoded UTF-8 BOM is an encoding marker, not document text.
  // Use one ignored leading space so every UTF-16 offset/column still refers
  // to the original source; stripping the code unit would shift all evidence.
  const parserSource = source.startsWith('\ufeff') ? ` ${source.slice(1)}` : source;
  try { document = parse(parserSource, { sourceCodeLocationInfo: true, scriptingEnabled: true, onParseError }); }
  catch (error) {
    if (error instanceof HtmlParseError) throw error;
    throw new HtmlParseError('parser-failed');
  }
  const nodes: HtmlNode[] = [];
  const pending: { node: DefaultTreeAdapterTypes.Node; parentId: number | null; depth: number }[] = [
    { node: document, parentId: null, depth: 0 },
  ];
  while (pending.length) {
    const { node, parentId, depth } = pending.pop()!;
    if (depth > limits.maxDepth) throw new HtmlParseError('depth-limit');
    if (nodes.length >= limits.maxNodes) throw new HtmlParseError('node-limit');
    const id = nodes.length;
    nodes.push(projectNode(node, id, parentId, depth));
    const children = 'childNodes' in node ? node.childNodes : [];
    const templateContent = 'content' in node ? node.content : null;
    if (nodes.length + pending.length + children.length + (templateContent ? 1 : 0) > limits.maxNodes) {
      throw new HtmlParseError('node-limit');
    }
    // Reverse pushes yield deterministic document-order preorder. Template content
    // is an explicit fragment whose parent is the template, not a second document.
    if (templateContent) pending.push({ node: templateContent, parentId: id, depth: depth + 1 });
    for (let index = children.length - 1; index >= 0; index--) {
      pending.push({ node: children[index]!, parentId: id, depth: depth + 1 });
    }
  }
  return Object.freeze({ source, sourceBytes, scriptingEnabled: true, nodes: Object.freeze(nodes),
    parserErrors: Object.freeze(parserErrors), diagnosticBytes, limits });
}
