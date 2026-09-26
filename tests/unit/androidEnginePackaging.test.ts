import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEngineStatus } from '../../src/core/media/contracts';

describe('Android engine startup', () => {
  it('extracts the native libraries required by youtubedl-android', () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    const gradle = readFileSync('android/app/build.gradle', 'utf8');
    expect(manifest).toContain('android:extractNativeLibs="true"');
    expect(gradle).toMatch(/useLegacyPackaging\s*=\s*true/);
  });

  it('retains the native startup error for the UI', () => {
    expect(parseEngineStatus({ available: false, initializing: false, version: '1.0.12', error: 'Engine initialization failed' }).error)
      .toBe('Engine initialization failed');
  });
});
