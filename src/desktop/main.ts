import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import type {
  DownloadProgress,
  DownloadRequest,
  EngineStatus,
  MediaMode,
  PlatformCapabilities,
  ReleaseInfo,
  ResolvedMedia,
} from '../core/media/types';
import { sanitizeFilename } from '../core/media/filename';
import { classifyErrorText, messageForError } from '../core/media/errors';
import { parseDownloadRequest, parseJobId, parseMediaMode, parseRemoteUrl } from '../core/media/contracts';
import { automaticFormatArguments, createDownloadPolicy } from '../core/media/quality';
import { canonicalMediaUrl, detectSource, isUnavailableSource } from '../core/sources/detectSource';
import { DESKTOP_CHANNELS } from './bridge';
import { imageExtension, isTrustedSocialImage, resolveSocialImages } from './socialImages';
import { launchWindowsInstaller, stageWindowsUpdate, trustedInstaller } from './updater';

const executeFile = promisify(execFile);
const CURRENT_VERSION = '1.0.13';
const RELEASE_MANIFEST = 'https://raw.githubusercontent.com/kuberbassi/savewave/main/public/client-version.json';
const TRUSTED_EXTERNAL_HOSTS = new Set(['github.com', 'savewave.kuberbassi.com', 'kuberbassi.com', 'www.kuberbassi.com']);

type ResolverResult = {
  success: boolean;
  platform: ResolvedMedia['platform'];
  type: ResolvedMedia['type'];
  title: string;
  creator: string;
  thumbnail?: string | null;
  duration?: number | null;
  qualityLabel: string;
  download?: { directUrl?: string };
  selectionRequired?: boolean;
  matchOptions?: ResolvedMedia['matchOptions'];
};

type DesktopJob = {
  progress: DownloadProgress;
  process?: { kill(): boolean };
  tempDirectory: string;
};

const jobs = new Map<string, DesktopJob>();

function runtimeBinary(name: 'yt-dlp' | 'ffmpeg'): string {
  if (app.isPackaged) return path.join(process.resourcesPath, `${name}.exe`);
  const developmentName = name === 'ffmpeg'
    ? 'ffmpeg-x86_64-pc-windows-msvc.exe'
    : 'yt-dlp-x86_64-pc-windows-msvc.exe';
  return path.join(app.getAppPath(), 'src-tauri', 'binaries', developmentName);
}

function versionIsNewer(candidate: string, installed: string): boolean {
  const parse = (value: string) => value.replace(/^v/, '').split('.').map(Number);
  const next = parse(candidate);
  const current = parse(installed);
  if (next.some(Number.isNaN) || current.some(Number.isNaN)) return false;
  for (let index = 0; index < Math.max(next.length, current.length); index += 1) {
    const difference = (next[index] || 0) - (current[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

async function validatePublicUrl(value: string): Promise<void> {
  const { validateRemoteUrl } = require('../services/resolver/utils/ssrfGuard') as {
    validateRemoteUrl(url: string): Promise<{ valid: boolean; reason?: string }>;
  };
  const result = await validateRemoteUrl(value);
  if (!result.valid) throw new Error(result.reason || 'INVALID_URL');
}

async function engineStatus(): Promise<EngineStatus> {
  try {
    const [{ stdout: ytDlpVersion }, { stdout: ffmpegVersion }] = await Promise.all([
      executeFile(runtimeBinary('yt-dlp'), ['--version'], { timeout: 10_000 }),
      executeFile(runtimeBinary('ffmpeg'), ['-version'], { timeout: 10_000 }),
    ]);
    return {
      available: true,
      version: CURRENT_VERSION,
      engineVersion: ytDlpVersion.trim(),
      ffmpegVersion: ffmpegVersion.split(/\r?\n/, 1)[0]?.trim(),
      updateAvailable: false,
    };
  } catch {
    return { available: false, version: CURRENT_VERSION };
  }
}

async function releaseInfo(): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(RELEASE_MANIFEST, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!response.ok) return null;
    const release = await response.json() as Omit<ReleaseInfo, 'updateAvailable'>;
    const downloadUrl = release.windowsDownloadUrl || release.downloadUrl;
    for (const value of [downloadUrl, release.releaseUrl, release.changelogUrl]) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !TRUSTED_EXTERNAL_HOSTS.has(url.hostname)) return null;
    }
    return { ...release, downloadUrl, updateAvailable: versionIsNewer(release.version, CURRENT_VERSION) };
  } catch {
    return null;
  }
}

async function checkAndInstallUpdate(): Promise<void> {
  if (!app.isPackaged || process.env.SAVEWAVE_DISABLE_AUTO_UPDATE === '1') return;
  const release = await releaseInfo();
  if (!release?.updateAvailable || !trustedInstaller(release.downloadUrl, release.version)) return;
  try {
    const installer = await stageWindowsUpdate(release);
    await launchWindowsInstaller(installer);
    app.quit();
  } catch (error) {
    console.warn('Automatic update unavailable; continuing with installed version:', error);
  }
}

async function resolveMedia(url: string, mode: MediaMode): Promise<ResolvedMedia> {
  if (isUnavailableSource(detectSource(url))) throw new Error('UNSUPPORTED_SOURCE');
  await validatePublicUrl(url);
  url = canonicalMediaUrl(url);
  // The bundled CommonJS resolver otherwise derives yt-dlp's path from the
  // flattened Electron bundle directory, which does not contain the binary.
  process.env.YTDLP_BINARY_PATH = runtimeBinary('yt-dlp');
  if (mode === 'video' && ['instagram', 'twitter'].includes(detectSource(url))) {
    try {
      const post = await resolveSocialImages(url, runtimeBinary('yt-dlp'));
      if (post) return {
        success: true, platform: detectSource(url), title: post.title, creator: post.creator,
        thumbnail: post.images[0], type: 'image', qualityLabel: `${post.images.length} original image${post.images.length === 1 ? '' : 's'}`,
        sourceUrl: url,
      };
    } catch { /* Continue through the normal video extractor. */ }
  }
  const { resolveMedia: resolve } = require('../services/resolver/resolveMedia') as {
    resolveMedia(value: string, mediaMode: MediaMode): Promise<ResolverResult>;
  };
  const result = await resolve(url, mode);
  const sourceUrl = result.platform === 'spotify' ? result.download?.directUrl : url;
  if (!sourceUrl && !result.selectionRequired) throw new Error('NO_MEDIA_FOUND');
  return {
    success: true,
    platform: result.platform,
    title: result.title,
    creator: result.creator,
    thumbnail: result.thumbnail,
    duration: result.duration,
    type: result.type,
    qualityLabel: result.qualityLabel,
    sourceUrl: sourceUrl || '',
    selectionRequired: result.selectionRequired,
    matchOptions: result.matchOptions?.length ? result.matchOptions : undefined,
  };
}

function downloadArguments(request: DownloadRequest, outputDirectory: string, tempDirectory: string): string[] {
  const title = sanitizeFilename(request.title || 'media');
  const policy = createDownloadPolicy(request.mode, detectSource(request.url));
  const common = [
    ...(policy.maxItems > 1 ? ['--yes-playlist', '--playlist-end', String(policy.maxItems)] : ['--no-playlist']),
    '--newline',
    '--continue',
    '--socket-timeout', String(policy.socketTimeoutSeconds),
    '--retries', String(policy.retries),
    '--fragment-retries', String(policy.fragmentRetries),
    '--extractor-retries', String(policy.extractorRetries),
    '--file-access-retries', '3',
    '--retry-sleep', '1',
    '--force-ipv4',
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--no-overwrites',
    '--paths', outputDirectory,
    '--paths', `temp:${tempDirectory}`,
    '--ffmpeg-location', runtimeBinary('ffmpeg'),
    '--print', 'after_move:savewave-file:%(filepath)s',
    '-o', policy.maxItems > 1 ? `${title}-%(playlist_index)02d-%(id)s.%(ext)s` : `${title}-%(id)s.%(ext)s`,
  ];
  return [...common, ...automaticFormatArguments(request.mode, detectSource(request.url)), canonicalMediaUrl(request.url)];
}

async function startDownload(request: DownloadRequest): Promise<DownloadProgress> {
  if (isUnavailableSource(detectSource(request.url))) throw new Error('UNSUPPORTED_SOURCE');
  await validatePublicUrl(request.url);
  if (request.mode === 'video' && ['instagram', 'twitter'].includes(detectSource(request.url))) {
    try {
      const post = await resolveSocialImages(request.url, runtimeBinary('yt-dlp'));
      if (post) return startImageDownload(post.images, request.title || post.title);
    } catch { /* Normal media remains available through yt-dlp. */ }
  }
  const policy = createDownloadPolicy(request.mode, detectSource(request.url));
  const jobId = randomUUID();
  const tempDirectory = path.join(app.getPath('temp'), 'savewave', jobId);
  await mkdir(tempDirectory, { recursive: true });
  const progress: DownloadProgress = { jobId, state: 'downloading', percent: 0 };
  const child = spawn(runtimeBinary('yt-dlp'), downloadArguments(request, app.getPath('downloads'), tempDirectory), {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const job: DesktopJob = { progress, process: child, tempDirectory };
  jobs.set(jobId, job);
  let output = '';
  let errorOutput = '';
  child.stdout.on('data', (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-32_000);
    const percent = [...output.matchAll(/\[download]\s+([\d.]+)%/g)].at(-1)?.[1];
    const filename = [...output.matchAll(/savewave-file:(.+)/g)].at(-1)?.[1]?.trim();
    if (percent) job.progress.percent = Math.min(100, Number(percent));
    if (filename) {
      const safeName = path.basename(filename);
      const filenames = [...new Set([...(job.progress.filenames || []), safeName])].slice(0, policy.maxItems);
      job.progress.filename = safeName;
      job.progress.filenames = filenames;
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    errorOutput = `${errorOutput}${chunk.toString()}`.slice(-32_000);
  });
  child.on('error', () => {
    job.progress = { jobId, state: 'error', errorCode: 'ENGINE_UNAVAILABLE', errorMessage: 'The local media engine could not start.' };
  });
  child.on('close', (code) => {
    job.process = undefined;
    if (job.progress.state === 'cancelled') return;
    if (code === 0) {
      job.progress = { ...job.progress, state: 'completed', percent: 100 };
    } else {
      const errorCode = classifyErrorText(errorOutput);
      job.progress = { jobId, state: 'error', errorCode, errorMessage: messageForError(errorCode) };
    }
    void rm(tempDirectory, { recursive: true, force: true });
  });
  return progress;
}

function startImageDownload(images: string[], title: string): DownloadProgress {
  const jobId = randomUUID();
  const progress: DownloadProgress = { jobId, state: 'downloading', percent: 0 };
  const controller = new AbortController();
  const job: DesktopJob = { progress, tempDirectory: '', process: { kill: () => { controller.abort(); return true; } } };
  jobs.set(jobId, job);
  void (async () => {
    const filenames: string[] = [];
    try {
      for (const [index, image] of images.entries()) {
        if (!isTrustedSocialImage(image)) throw new Error('INVALID_URL');
        const response = await fetch(image, { signal: controller.signal, redirect: 'error', headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('image/')) throw new Error('DOWNLOAD_FAILED');
        if (Number(response.headers.get('content-length') || 0) > 50 * 1024 * 1024) throw new Error('DOWNLOAD_FAILED');
        const data = Buffer.from(await response.arrayBuffer());
        if (!data.length || data.length > 50 * 1024 * 1024) throw new Error('DOWNLOAD_FAILED');
        const filename = `${sanitizeFilename(title).slice(0, 100)}-${String(index + 1).padStart(2, '0')}-${jobId.slice(0, 8)}.${imageExtension(image)}`;
        const file = await open(path.join(app.getPath('downloads'), filename), 'wx');
        filenames.push(filename);
        try { await file.writeFile(data); } finally { await file.close(); }
        job.progress = { jobId, state: 'downloading', percent: Math.round(100 * (index + 1) / images.length), filename, filenames: [...filenames] };
      }
      job.progress = { ...job.progress, state: 'completed', percent: 100 };
    } catch (error) {
      if (controller.signal.aborted) return;
      const errorCode = classifyErrorText(String(error));
      job.progress = { jobId, state: 'error', errorCode, errorMessage: messageForError(errorCode) };
    } finally {
      if (job.progress.state !== 'completed') {
        await Promise.all(filenames.map((filename) => rm(path.join(app.getPath('downloads'), filename), { force: true })));
      }
      job.process = undefined;
    }
  })();
  return progress;
}

function registerHandlers(): void {
  const capabilities: PlatformCapabilities = {
    platform: 'desktop',
    sources: {
      youtube: { video: true, audio: true, media: true },
      instagram: {},
      facebook: {},
      threads: { media: true },
      twitter: {},
      soundcloud: { audio: true },
      spotify: { audio: true, smartMatch: true },
      direct: { video: true, audio: true, media: true },
      unknown: {},
    },
  };
  ipcMain.handle(DESKTOP_CHANNELS.capabilities, () => capabilities);
  ipcMain.handle(DESKTOP_CHANNELS.engineStatus, engineStatus);
  ipcMain.handle(DESKTOP_CHANNELS.releaseInfo, releaseInfo);
  ipcMain.handle(DESKTOP_CHANNELS.resolveMedia, (_event, request: unknown) => {
    const input = request as { url?: unknown; mode?: unknown };
    return resolveMedia(parseRemoteUrl(input?.url) as string, parseMediaMode(input?.mode, 'video'));
  });
  ipcMain.handle(DESKTOP_CHANNELS.downloadMedia, (_event, request: unknown) => startDownload(parseDownloadRequest(request)));
  ipcMain.handle(DESKTOP_CHANNELS.downloadProgress, (_event, rawJobId: unknown) => {
    const jobId = parseJobId(rawJobId);
    return jobs.get(jobId)?.progress ?? Promise.reject(new Error('DOWNLOAD_NOT_FOUND'));
  });
  ipcMain.handle(DESKTOP_CHANNELS.cancelDownload, async (_event, rawJobId: unknown) => {
    const jobId = parseJobId(rawJobId);
    const job = jobs.get(jobId);
    if (!job) throw new Error('DOWNLOAD_NOT_FOUND');
    job.progress = { jobId, state: 'cancelled' };
    job.process?.kill();
    if (job.tempDirectory) await rm(job.tempDirectory, { recursive: true, force: true });
  });
  ipcMain.handle(DESKTOP_CHANNELS.openExternal, async (_event, value: unknown) => {
    const url = new URL(parseRemoteUrl(value) as string);
    if (url.protocol !== 'https:' || !TRUSTED_EXTERNAL_HOSTS.has(url.hostname)) throw new Error('EXTERNAL_URL_REJECTED');
    await shell.openExternal(url.toString());
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: '#111113',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  void window.loadFile(path.join(__dirname, '..', 'public', 'native.html'));
}

registerHandlers();
void app.whenReady().then(async () => {
  if (process.env.SAVEWAVE_ELECTRON_SMOKE === '1') {
    const status = await engineStatus();
    if (!status.available) {
      console.error('Electron engine smoke check failed.');
      app.exit(1);
      return;
    }
    console.log(`Electron engine ready: yt-dlp ${status.engineVersion}; ${status.ffmpegVersion}`);
    if (process.env.SAVEWAVE_ELECTRON_RESOLVE_URL) {
      try {
        const result = await resolveMedia(process.env.SAVEWAVE_ELECTRON_RESOLVE_URL, 'video');
        console.log(`Electron resolve ready: ${result.platform}; ${result.type}`);
      } catch (error) {
        console.error(`Electron resolve failed: ${error instanceof Error ? error.message : String(error)}`);
        app.exit(1);
        return;
      }
    }
    app.quit();
    return;
  }
  createWindow();
  void checkAndInstallUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
