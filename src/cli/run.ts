import { assertAuditResult, ValidationError } from '../schema.js';
import { terminalText } from '../diagnostics.js';
import { FileInputError, HtmlInputError } from './input.js';
import { MAX_STATIC_INPUT_FILES, HtmlParseError } from '../static/parse-html.js';
import { auditHtmlSources, assertStaticAuditReport, serializeStaticReport, staticReportExitCode, StaticAuditError } from '../static/report.js';

export interface CliIO {
  readFile(path: string): Promise<string>;
  readHtml?(path: string): Promise<string>;
  stdout(message: string): void;
  stderr(message: string): void;
}
const help = 'Dastresi — static HTML CLI\nUsage: dastresi --help | --version | validate <audit.json> | audit --html <file.html> [--html <file.html> ...] --format json\nSource declarations only; no browser execution or WCAG conformance assessment.\n';

/** 0 = clean/validation/help; 1 = execution/data error; 2 = usage; 3 = failures; 4 = review. */
export async function runCli(args: readonly string[], io: CliIO, version: string): Promise<number> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) {
    io.stdout(help);
    return 0;
  }
  if (args.length === 1 && args[0] === '--version') {
    io.stdout(`${terminalText(version)}\n`);
    return 0;
  }
  if (args[0] === 'audit') {
    const files: string[] = [];
    let format = false;
    let valid = true;
    for (let index = 1; index < args.length; index += 2) {
      const flag = args[index];
      const value = args[index + 1];
      if (flag === '--html' && value?.trim() && !value.startsWith('-')) files.push(value);
      else if (flag === '--format' && value === 'json' && !format) format = true;
      else { valid = false; break; }
    }
    if (!valid || !format || !files.length || files.length > MAX_STATIC_INPUT_FILES) {
      io.stderr('Usage error: expected audit --html <file.html> (one to eight files) --format json.\n');
      return 2;
    }
    try {
      if (!io.readHtml) throw new Error('HTML reader unavailable');
      const inputs: string[] = [];
      for (const file of files) inputs.push(await io.readHtml(file));
      const report = await auditHtmlSources(inputs);
      const output = serializeStaticReport(report);
      const code = staticReportExitCode(report);
      io.stdout(output);
      return code;
    } catch (error) {
      const message = error instanceof HtmlInputError || error instanceof HtmlParseError || error instanceof StaticAuditError
        ? error.message : 'Unable to produce static audit report';
      io.stderr(`Error: ${terminalText(message)}\n`);
      return 1;
    }
  }
  if (args.length !== 2 || args[0] !== 'validate' || !args[1]?.trim() || args[1].startsWith('-')) {
    io.stderr(`Usage error: expected validate <audit.json>, audit --html <file.html> --format json, --help, or --version.\n`);
    return 2;
  }
  try {
    const content = await io.readFile(args[1]);
    let data: unknown;
    try { data = JSON.parse(content); } catch { throw new SyntaxError('Input is not valid JSON'); }
    if (typeof data === 'object' && data !== null && 'format' in data && data.format === 'dastresi-static') {
      assertStaticAuditReport(data);
      io.stdout(`Valid static audit data: ${data.sources.length} source(s), ${data.status}. This is not a conformance assessment.\n`);
      return 0;
    }
    assertAuditResult(data);
    io.stdout(`Valid audit data: ${data.results.length} result(s), ${data.errors.length} execution error(s). This is not a conformance assessment.\n`);
    return 0;
  } catch (error) {
    const message = error instanceof ValidationError || error instanceof SyntaxError || error instanceof FileInputError
      ? error.message
      : 'Unable to read audit data';
    io.stderr(`Error: ${terminalText(message)}\n`);
    return 1;
  }
}
