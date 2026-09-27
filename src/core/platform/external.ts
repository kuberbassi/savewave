import { Capacitor, registerPlugin } from '@capacitor/core';

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
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}
