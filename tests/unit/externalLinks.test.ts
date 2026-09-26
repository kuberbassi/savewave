import { afterEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ android: vi.fn(), tauri: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: () => ({ openExternal: calls.android }),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: calls.tauri }));

import { openExternal } from '../../src/core/platform/external';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('footer external links', () => {
  it('sends GitHub and the personal website through the Electron bridge', async () => {
    const desktop = { openExternal: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal('window', { savewaveDesktop: desktop });
    await openExternal('https://github.com/kuberbassi/savewave');
    await openExternal('https://kuberbassi.com');
    expect(desktop.openExternal).toHaveBeenCalledTimes(2);
    expect(desktop.openExternal).toHaveBeenNthCalledWith(1, 'https://github.com/kuberbassi/savewave');
    expect(desktop.openExternal).toHaveBeenNthCalledWith(2, 'https://kuberbassi.com/');
    expect(calls.tauri).not.toHaveBeenCalled();
  });

  it('does not open an untrusted link', async () => {
    const desktop = { openExternal: vi.fn() };
    vi.stubGlobal('window', { savewaveDesktop: desktop });
    await expect(openExternal('https://github.com.evil.test/')).rejects.toThrow('not allowed');
    expect(desktop.openExternal).not.toHaveBeenCalled();
  });
});
