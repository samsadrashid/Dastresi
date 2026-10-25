import { chromium } from 'playwright-core';
import { constants } from 'node:fs';
import { access, open, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export type BrowserMetadataCode = 'browser-missing' | 'browser-incompatible' | 'unsupported-platform';
export class BrowserMetadataError extends Error {
  constructor(public readonly code: BrowserMetadataCode) {
    super(code === 'browser-missing' ? 'Expected cached Chromium is unavailable'
      : code === 'unsupported-platform' ? 'Browser metadata verification supports macOS ARM64 only'
      : 'Installed package or cached Chromium metadata does not match the approved version');
    this.name = 'BrowserMetadataError';
  }
}
export interface BrowserCompatibility {
  readonly packageVersion: '1.64.0';
  readonly browserRevision: '1248';
  readonly browserVersion: '156.0.8078.4';
  readonly platform: 'darwin';
  readonly architecture: 'arm64';
  readonly verification: 'metadata-only';
}
/** Explicitly not an integrity, launch, protocol, sandbox, or security guarantee. */
export function matchBrowserMetadata(evidence: {
  packageVersion: unknown; browserRevision: unknown; expectedVersion: unknown;
  installedVersion: unknown; platform: unknown; architecture: unknown; binaryArm64: boolean;
}): BrowserCompatibility {
  if (evidence.platform !== 'darwin' || evidence.architecture !== 'arm64') throw new BrowserMetadataError('unsupported-platform');
  if (evidence.packageVersion !== '1.64.0' || evidence.browserRevision !== '1248'
    || evidence.expectedVersion !== '156.0.8078.4' || evidence.installedVersion !== '156.0.8078.4'
    || !evidence.binaryArm64) throw new BrowserMetadataError('browser-incompatible');
  return Object.freeze({
    packageVersion: '1.64.0', browserRevision: '1248', browserVersion: '156.0.8078.4',
    platform: 'darwin', architecture: 'arm64', verification: 'metadata-only',
  });
}

/** Uses installed-package host configuration only. No page-provided path or fallback. */
export async function checkCachedChromium(): Promise<BrowserCompatibility> {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new BrowserMetadataError('unsupported-platform');
  try {
    const require = createRequire(import.meta.url);
    const packageFile = require.resolve('playwright-core/package.json');
    const metadata = JSON.parse(await readFile(packageFile, 'utf8')) as { version?: unknown };
    const manifest = JSON.parse(await readFile(join(dirname(packageFile), 'browsers.json'), 'utf8')) as {
      browsers?: { name?: unknown; revision?: unknown; browserVersion?: unknown }[];
    };
    const expected = manifest.browsers?.find((entry) => entry.name === 'chromium');
    const executable = chromium.executablePath();
    // Require the approved full Chromium layout. Do not discover or launch a system browser.
    const suffix = join('chromium-1248', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (!executable.endsWith('/' + suffix)) throw new BrowserMetadataError('browser-incompatible');
    try {
      await access(executable, constants.X_OK);
      if (!(await stat(executable)).isFile()) throw new BrowserMetadataError('browser-missing');
    } catch { throw new BrowserMetadataError('browser-missing'); }
    const plist = await readFile(join(dirname(dirname(executable)), 'Info.plist'), 'utf8');
    const versions = [...plist.matchAll(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/g)];
    const handle = await open(executable, 'r');
    const header = Buffer.alloc(8);
    let binaryArm64 = false;
    try {
      const { bytesRead } = await handle.read(header, 0, 8, 0);
      binaryArm64 = bytesRead === 8 && header.toString('hex') === 'cffaedfe0c000001';
    } finally { await handle.close(); }
    return matchBrowserMetadata({
      packageVersion: metadata.version, browserRevision: expected?.revision, expectedVersion: expected?.browserVersion,
      installedVersion: versions.length === 1 ? versions[0]?.[1] : undefined,
      platform: process.platform, architecture: process.arch, binaryArm64,
    });
  } catch (error) {
    if (error instanceof BrowserMetadataError) throw error;
    throw new BrowserMetadataError('browser-incompatible');
  }
}
