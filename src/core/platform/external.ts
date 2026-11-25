import { hasTauriRuntime } from './tauri';

const allowedExternalHosts = new Set(['github.com', 'kuberbassi.com', 'www.kuberbassi.com']);

export async function openExternal(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !allowedExternalHosts.has(url.hostname.toLowerCase())) {
    throw new Error('External link is not allowed.');
  }
  if (hasTauriRuntime()) {
    await window.__TAURI__!.core!.invoke!('open_external', { url: url.toString() });
    return;
  }
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}
