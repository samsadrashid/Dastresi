import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { extname } from 'node:path';
import { HTML_PARSER_LIMITS } from '../static/parse-html.js';

export const MAX_REPORT_BYTES = 10 * 1024 * 1024;

/** Messages are fixed text: never expose paths, OS errors, or input contents. */
export class FileInputError extends Error {
  constructor(reason: 'size' | 'type' | 'read') {
    super(reason === 'size' ? 'JSON report exceeds the 10 MiB limit'
      : reason === 'type' ? 'JSON report must be a regular file; symlinks and special files are unsupported'
      : 'Unable to read JSON report');
    this.name = 'FileInputError';
  }
}

export async function readReport(file: string): Promise<string> {
  return readBounded(file, MAX_REPORT_BYTES, (reason) => new FileInputError(reason), false);
}

export class HtmlInputError extends Error {
  constructor(reason: 'size' | 'type' | 'read' | 'encoding' | 'extension') {
    super(reason === 'size' ? 'HTML source exceeds the 1 MiB limit'
      : reason === 'type' ? 'HTML input must be a regular file; symlinks and special files are unsupported'
      : reason === 'encoding' ? 'HTML input must be UTF-8 text without NUL characters'
      : reason === 'extension' ? 'HTML input must be an explicit local .html or .htm file' : 'Unable to read HTML input');
    this.name = 'HtmlInputError';
  }
}
export async function readHtml(file: string): Promise<string> {
  if (!['.html', '.htm'].includes(extname(file).toLowerCase()) || /^[a-z][a-z0-9+.-]*:\/\//i.test(file)) throw new HtmlInputError('extension');
  return readBounded(file, HTML_PARSER_LIMITS.maxSourceBytes, (reason) => new HtmlInputError(reason), true);
}

/** Shared handle checks/read budget; no unbounded read after path validation. */
async function readBounded(file: string, maximum: number, failure: (reason: 'size' | 'type' | 'read') => Error, utf8: boolean): Promise<string> {
  try {
    const before = await lstat(file);
    if (!before.isFile()) throw failure('type');
    // NOFOLLOW rejects a final-component symlink introduced after lstat.
    // NONBLOCK avoids waiting for a FIFO introduced in the same race on POSIX.
    const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) throw failure('type');
      if (opened.size > maximum) throw failure('size');
      // One extra byte detects growth beyond the cap; no unbounded read follows.
      const buffer = Buffer.alloc(maximum + 1);
      let total = 0;
      while (total < buffer.length) {
        const { bytesRead } = await handle.read(buffer, total, Math.min(64 * 1024, buffer.length - total), total);
        if (bytesRead === 0) break;
        total += bytesRead;
        if (total > maximum) throw failure('size');
      }
      if ((await handle.stat()).size > maximum) throw failure('size');
      if (!utf8) return buffer.toString('utf8', 0, total);
      let source: string;
      try { source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, total)); }
      catch { throw new HtmlInputError('encoding'); }
      if (source.includes('\0')) throw new HtmlInputError('encoding');
      return source;
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof FileInputError || error instanceof HtmlInputError) throw error;
    throw failure('read');
  }
}
