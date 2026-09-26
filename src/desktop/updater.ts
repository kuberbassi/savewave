import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { app } from 'electron';
import type { ReleaseInfo } from '../core/media/types';

const MAX_INSTALLER_BYTES = 500 * 1024 * 1024;
const INSTALLER_NAME = /^Savewave_(\d+\.\d+\.\d+)_x64-setup\.exe$/;

export function trustedInstaller(url: string, version: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com'
      && parsed.pathname === `/kuberbassi/savewave/releases/download/v${version}/Savewave_${version}_x64-setup.exe`
      && INSTALLER_NAME.test(path.posix.basename(parsed.pathname));
  } catch { return false; }
}

export function parseChecksum(value: string, filename: string): string | null {
  const line = value.trim().split(/\r?\n/).find((entry) => entry.endsWith(`  ${filename}`));
  const hash = line?.slice(0, 64);
  return hash && /^[a-f\d]{64}$/i.test(hash) ? hash.toLowerCase() : null;
}

export async function stageWindowsUpdate(release: ReleaseInfo): Promise<string> {
  if (!trustedInstaller(release.downloadUrl, release.version)) throw new Error('Update URL is not a trusted Savewave release asset.');
  const filename = `Savewave_${release.version}_x64-setup.exe`;
  const checksumResponse = await fetch(`${release.downloadUrl}.sha256`, { signal: AbortSignal.timeout(15_000) });
  if (!checksumResponse.ok) throw new Error('Update checksum is unavailable.');
  const expected = parseChecksum(await checksumResponse.text(), filename);
  if (!expected) throw new Error('Update checksum is invalid.');
  const directory = path.join(app.getPath('userData'), 'updates', release.version);
  const destination = path.join(directory, filename);
  const existing = await readFile(destination).catch(() => null);
  if (existing && createHash('sha256').update(existing).digest('hex') === expected) return destination;
  await mkdir(directory, { recursive: true });
  const temporary = `${destination}.partial`;
  try {
    const response = await fetch(release.downloadUrl, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok || !response.body) throw new Error('Update download failed.');
    const hash = createHash('sha256');
    let size = 0;
    await pipeline(Readable.fromWeb(response.body as never), new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > MAX_INSTALLER_BYTES) callback(new Error('Update is too large.'));
        else { hash.update(chunk); callback(null, chunk); }
      },
    }), createWriteStream(temporary, { flags: 'wx' }));
    if (hash.digest('hex') !== expected) throw new Error('Update failed its SHA-256 verification.');
    await rm(destination, { force: true });
    await rename(temporary, destination);
    return destination;
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function launchWindowsInstaller(installer: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    // electron-builder's one-click NSIS template skips auto-launch when /S is
    // supplied unless force-run is present.
    const child = spawn(installer, ['/S', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
