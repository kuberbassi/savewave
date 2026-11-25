import type { MediaEngine } from './types';
import { TauriMediaEngine, hasTauriRuntime } from './tauri';
import { WebMediaEngine } from './web';

export function detectRuntime(): 'web' | 'desktop' {
  if (hasTauriRuntime()) return 'desktop';
  return 'web';
}

export function createMediaEngine(): MediaEngine {
  if (hasTauriRuntime()) return new TauriMediaEngine();
  return new WebMediaEngine();
}

export * from './capabilities';
export * from '../sources/detectSource';
export * from '../media/errors';
export * from '../media/state';
