import { openUrl } from '@tauri-apps/plugin-opener';

const allowedExternalHosts = new Set(['github.com', 'kuberbassi.com', 'www.kuberbassi.com']);

export async function openExternal(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !allowedExternalHosts.has(url.hostname.toLowerCase())) throw new Error('External link is not allowed.');
  await openUrl(url.toString());
}
