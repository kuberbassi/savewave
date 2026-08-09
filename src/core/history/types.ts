import type { MediaMode, MediaSource } from '../media/types';
export interface HistoryEntry { id: string; title: string; platform: MediaSource; thumbnail?: string | null; mediaType: MediaMode | 'image'; timestamp: number; localReference?: string; }
