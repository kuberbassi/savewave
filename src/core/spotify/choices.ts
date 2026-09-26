const STORAGE_KEY = 'savewave:spotify-choices:v1';
const TRACK_ID = /open\.spotify\.com\/track\/([A-Za-z0-9]{22})/;
type ChoiceMap = Record<string, string>;

export function spotifyTrackId(url: string): string | null { return String(url || '').match(TRACK_ID)?.[1] || null; }

function readChoices(): ChoiceMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function rememberSpotifyChoice(url: string, sourceUrl: string): void {
  const trackId = spotifyTrackId(url);
  if (!trackId || !/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]+/.test(sourceUrl)) return;
  try {
    const choices = readChoices();
    const bounded = Object.fromEntries([...Object.entries(choices), [trackId, sourceUrl]].slice(-50));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch { /* Local persistence is optional; the current explicit choice still applies. */ }
}

export function recallSpotifyChoice<T extends { sourceUrl: string }>(url: string, options: T[]): T | null {
  const trackId = spotifyTrackId(url);
  if (!trackId) return null;
  const remembered = readChoices()[trackId];
  return options.find((option) => option.sourceUrl === remembered) || null;
}
