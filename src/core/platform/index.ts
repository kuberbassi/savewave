import { Capacitor } from '@capacitor/core';
import type { MediaEngine } from './types';
import { NativeMediaEngine } from './native';
import { AndroidMediaEngine } from './android';
import { ElectronMediaEngine } from './electron';
import { CapacitorMediaEngine } from './capacitor';
import { WebMediaEngine } from './web';
export function detectRuntime(): 'web' | 'desktop' | 'android' {
  if (window.savewaveDesktop) return 'desktop';
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') return 'android';
  const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  if (!runtimeWindow.__TAURI_INTERNALS__) return 'web';
  return /android/i.test(navigator.userAgent) ? 'android' : 'desktop';
}
export function createMediaEngine(): MediaEngine {
  const runtime = detectRuntime();
  if (runtime === 'web') return new WebMediaEngine();
  if (runtime === 'android') {
    return Capacitor.isNativePlatform() ? new CapacitorMediaEngine() : new AndroidMediaEngine();
  }
  return window.savewaveDesktop ? new ElectronMediaEngine() : new NativeMediaEngine('desktop');
}
export * from './capabilities';
export * from '../sources/detectSource';
export * from '../media/errors';
export * from '../media/state';
