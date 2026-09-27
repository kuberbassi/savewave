import { Capacitor } from '@capacitor/core';
import type { MediaEngine } from './types';
import { ElectronMediaEngine } from './electron';
import { CapacitorMediaEngine } from './capacitor';
import { WebMediaEngine } from './web';
export function detectRuntime(): 'web' | 'desktop' | 'android' {
  if (window.savewaveDesktop) return 'desktop';
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') return 'android';
  return 'web';
}
export function createMediaEngine(): MediaEngine {
  const runtime = detectRuntime();
  if (runtime === 'web') return new WebMediaEngine();
  if (runtime === 'android') {
    return new CapacitorMediaEngine();
  }
  return new ElectronMediaEngine();
}
export * from './capabilities';
export * from '../sources/detectSource';
export * from '../media/errors';
export * from '../media/state';
