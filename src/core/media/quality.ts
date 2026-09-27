import type { MediaMode, MediaSource } from './types';

export interface DownloadPolicy {
  formatSelector: string;
  extractAudio: boolean;
  audioFormat?: 'best';
  mergeOutputFormat?: 'mp4/mkv';
  socketTimeoutSeconds: number;
  retries: number;
  fragmentRetries: number;
  extractorRetries: number;
  maxItems: number;
}

export function createDownloadPolicy(mode: MediaMode, source?: MediaSource): DownloadPolicy {
  const socialSource = source === 'instagram' || source === 'facebook' || source === 'threads' || source === 'twitter';
  const multiItemSource = socialSource && source !== 'instagram';
  const reliability = {
    socketTimeoutSeconds: 20,
    retries: 5,
    fragmentRetries: 5,
    extractorRetries: 3,
    maxItems: multiItemSource ? 20 : 1,
  };
  return mode === 'audio'
    ? { ...reliability, formatSelector: 'bestaudio/best', extractAudio: true, audioFormat: 'best' }
    // Prefer a single available stream for social video; these extractors do
    // not universally expose photo posts as downloadable formats.
    : socialSource
      ? { ...reliability, formatSelector: 'best', extractAudio: false }
      : { ...reliability, formatSelector: 'bestvideo+bestaudio/best', extractAudio: false, mergeOutputFormat: 'mp4/mkv' };
}

export function automaticFormatArguments(mode: MediaMode, source?: MediaSource): string[] {
  const policy = createDownloadPolicy(mode, source);
  return policy.extractAudio
    ? ['-f', policy.formatSelector, '--extract-audio', '--audio-format', policy.audioFormat || 'best']
    : ['-f', policy.formatSelector, ...(policy.mergeOutputFormat ? ['--merge-output-format', policy.mergeOutputFormat] : [])];
}
