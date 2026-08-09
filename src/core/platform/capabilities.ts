import type { MediaSource, PlatformCapabilities, PlatformType, SourceCapability } from '../media/types';
const none: SourceCapability = {};
const full = { video: true, audio: true, media: true };
export function capabilitiesFor(platform: PlatformType): PlatformCapabilities {
  const native = platform !== 'web';
  return { platform, sources: {
    youtube: native ? full : none, instagram: native ? { media: true } : none, facebook: native ? { media: true } : none,
    threads: native ? { media: true } : none, twitter: native ? { media: true } : none,
    soundcloud: native ? { audio: true } : none, spotify: native ? { audio: true, smartMatch: true } : none,
    direct: { video: true, audio: true, media: true }, unknown: none
  }};
}
export function supports(capabilities: PlatformCapabilities, source: MediaSource, mode: 'video' | 'audio'): boolean {
  const value = capabilities.sources[source];
  return Boolean(value && (value.media || value[mode] || (mode === 'audio' && value.smartMatch)));
}
