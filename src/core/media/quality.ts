import type { MediaMode } from './types';
export function automaticFormatArguments(mode: MediaMode): string[] {
  return mode === 'audio'
    ? ['-f', 'bestaudio/best', '--extract-audio', '--audio-format', 'best']
    : ['-f', 'bestvideo*+bestaudio/best', '--merge-output-format', 'mp4/mkv'];
}
