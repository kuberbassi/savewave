import { describe, expect, it, vi } from 'vitest';
import { runDownload, withAbort, type MediaEngine, type ResolvedMedia } from '../../src/core';

const media: ResolvedMedia = {
  success: true, platform: 'instagram', title: 'Post', creator: 'Creator',
  type: 'video', qualityLabel: 'Best available', sourceUrl: 'https://instagram.com/p/example',
};

function engine(progress: Array<Record<string, unknown>>, failures: string[] = []): MediaEngine {
  let downloadIndex = 0;
  let pollIndex = 0;
  return {
    getPlatform: () => 'desktop',
    getCapabilities: vi.fn(), getEngineStatus: vi.fn(), getReleaseInfo: vi.fn(), resolveMedia: vi.fn(),
    downloadMedia: vi.fn(async () => {
      const code = failures[downloadIndex++];
      if (code) throw Object.assign(new Error(code), { code });
      return { jobId: `job_${downloadIndex}`, state: 'downloading' as const };
    }),
    getDownloadProgress: vi.fn(async () => progress[Math.min(pollIndex++, progress.length - 1)] as never),
    cancelDownload: vi.fn(async () => undefined),
  };
}

describe('shared download controller', () => {
  it('polls a job to completion and reports native progress', async () => {
    const runtime = engine([
      { jobId: 'job_1', state: 'downloading', percent: 40 },
      { jobId: 'job_1', state: 'completed', percent: 100, filenames: ['01.jpg', '02.jpg'] },
    ]);
    const seen: number[] = [];
    const result = await runDownload({ engine: runtime, media, originalUrl: media.sourceUrl, mode: 'video', pollIntervalMs: 50, onProgress: (value) => seen.push(value.percent || 0) });
    expect(result.filenames).toEqual(['01.jpg', '02.jpg']);
    expect(seen).toEqual([40, 100]);
  });

  it('uses a bounded fallback after a retryable source failure', async () => {
    const runtime = engine([{ jobId: 'job_2', state: 'completed', percent: 100 }], ['SOURCE_UNAVAILABLE']);
    const result = await runDownload({
      engine: runtime,
      media: { ...media, fallbackSourceUrls: ['https://cdn.example/fallback.mp4'] },
      originalUrl: media.sourceUrl, mode: 'video', pollIntervalMs: 50,
    });
    expect(result.state).toBe('completed');
    expect(runtime.downloadMedia).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable failures', async () => {
    const runtime = engine([], ['SOURCE_FORBIDDEN']);
    await expect(runDownload({ engine: runtime, media: { ...media, fallbackSourceUrls: ['https://cdn.example/fallback.mp4'] }, originalUrl: media.sourceUrl, mode: 'video' }))
      .rejects.toMatchObject({ code: 'SOURCE_FORBIDDEN' });
    expect(runtime.downloadMedia).toHaveBeenCalledTimes(1);
  });

  it('owns cancellation and cancels the active native job once', async () => {
    const runtime = engine([{ jobId: 'job_1', state: 'downloading', percent: 5 }]);
    const controller = new AbortController();
    const pending = runDownload({ engine: runtime, media, originalUrl: media.sourceUrl, mode: 'video', signal: controller.signal, pollIntervalMs: 100 });
    await vi.waitFor(() => expect(runtime.getDownloadProgress).toHaveBeenCalled());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(runtime.cancelDownload).toHaveBeenCalledTimes(1);
  });

  it('bounds polling when a native job never terminates', async () => {
    const runtime = engine([{ jobId: 'job_1', state: 'downloading', percent: 5 }]);
    await expect(runDownload({ engine: runtime, media, originalUrl: media.sourceUrl, mode: 'video', pollIntervalMs: 50, maximumPolls: 2 }))
      .rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(runtime.getDownloadProgress).toHaveBeenCalledTimes(2);
  });

  it('rejects a late resolver reply after its owner aborts', async () => {
    const controller = new AbortController();
    let finish!: (value: string) => void;
    const operation = new Promise<string>((resolve) => { finish = resolve; });
    const guarded = withAbort(operation, controller.signal);
    controller.abort();
    finish('stale result');
    await expect(guarded).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
