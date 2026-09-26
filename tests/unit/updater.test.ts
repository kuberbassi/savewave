import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => 'unused' } }));
import { parseChecksum, trustedInstaller } from '../../src/desktop/updater';

describe('Windows release trust boundary', () => {
  const asset = 'https://github.com/kuberbassi/savewave/releases/download/v1.0.13/Savewave_1.0.13_x64-setup.exe';

  it('accepts only the matching versioned repository asset', () => {
    expect(trustedInstaller(asset, '1.0.13')).toBe(true);
    expect(trustedInstaller(asset, '1.0.14')).toBe(false);
    expect(trustedInstaller(asset.replace('github.com', 'example.com'), '1.0.13')).toBe(false);
    expect(trustedInstaller(asset.replace('/download/', '/latest/download/'), '1.0.13')).toBe(false);
  });

  it('requires an exact checksum filename and SHA-256 digest', () => {
    const digest = 'a'.repeat(64);
    expect(parseChecksum(`${digest}  Savewave_1.0.13_x64-setup.exe\n`, 'Savewave_1.0.13_x64-setup.exe')).toBe(digest);
    expect(parseChecksum(`${digest}  other.exe`, 'Savewave_1.0.13_x64-setup.exe')).toBeNull();
    expect(parseChecksum('bad  Savewave_1.0.13_x64-setup.exe', 'Savewave_1.0.13_x64-setup.exe')).toBeNull();
  });
});
