import type { DownloadState } from './types';
const transitions: Record<DownloadState, DownloadState[]> = {
  idle: ['detecting', 'resolving'], detecting: ['idle', 'resolving', 'error'], resolving: ['resolved', 'error', 'cancelled'],
  resolved: ['downloading', 'idle', 'error'], downloading: ['processing', 'completed', 'cancelled', 'error'],
  processing: ['completed', 'cancelled', 'error'], completed: ['idle', 'resolving'], cancelled: ['idle', 'resolving'], error: ['idle', 'resolving']
};
export function canTransition(from: DownloadState, to: DownloadState): boolean { return transitions[from].includes(to); }
export function transition(from: DownloadState, to: DownloadState): DownloadState {
  if (!canTransition(from, to)) throw new Error(`Invalid download transition: ${from} -> ${to}`);
  return to;
}
