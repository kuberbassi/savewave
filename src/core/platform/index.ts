import type { MediaEngine } from './types';
import { NativeMediaEngine } from './native';
import { AndroidMediaEngine } from './android';
import { WebMediaEngine } from './web';
export function detectRuntime(): 'web' | 'desktop' | 'android' {
  if (!(window as any).__TAURI_INTERNALS__) return 'web';
  return /android/i.test(navigator.userAgent) ? 'android' : 'desktop';
}
export function createMediaEngine(): MediaEngine { const runtime = detectRuntime(); return runtime === 'web' ? new WebMediaEngine() : runtime === 'android' ? new AndroidMediaEngine() : new NativeMediaEngine('desktop'); }
export * from './capabilities';
export * from '../sources/detectSource';
export * from '../media/errors';
export * from '../media/state';
