import { Capacitor, registerPlugin } from '@capacitor/core';
import { openUrl } from '@tauri-apps/plugin-opener';

const allowedExternalHosts = new Set(['github.com', 'kuberbassi.com', 'www.kuberbassi.com']);
const androidLinks = registerPlugin<{ openExternal(options: { url: string }): Promise<void> }>('SavewaveMedia');

export async function openExternal(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !allowedExternalHosts.has(url.hostname.toLowerCase())) throw new Error('External link is not allowed.');
  if (window.savewaveDesktop) {
    await window.savewaveDesktop.openExternal(url.toString());
    return;
  }
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await androidLinks.openExternal({ url: url.toString() });
    return;
  }
  if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
    return;
  }
  await openUrl(url.toString());
}
