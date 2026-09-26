import { describe, expect, it } from 'vitest';

const {
  canonicalTitle,
  confidentMatch,
  evaluateCandidate,
  normalize,
  sameRecording,
  scoreCandidate,
  versionMarkers
} = require('../../src/core/spotify/matcher.js');
const { SEARCH_OPTIONS } = require('../../src/services/resolver/smartMatch/spotifyMatcher');

const track = {
  title: 'Starboy', artist: 'The Weeknd', primaryArtist: 'The Weeknd',
  artists: ['The Weeknd', 'Daft Punk'], album: 'Starboy', duration: 230,
  isrc: 'USUM71607007'
};

const official = (overrides = {}) => ({
  title: 'Starboy', uploader: 'The Weeknd - Topic', duration: 230,
  resultType: 'song', ...overrides
});

describe('shared Spotify identity matcher', () => {
  it('accepts an exact official recording with high confidence', () => {
    const result = evaluateCandidate(track, official());
    expect(result.accepted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(confidentMatch(track, [official()])?.candidate.title).toBe('Starboy');
  });

  it.each([
    ['wrong artist', { uploader: 'Random Cover Channel', artists: ['Random Cover Channel'] }, 'ARTIST_MISMATCH'],
    ['remix', { title: 'Starboy Kygo Remix' }, 'VERSION_CONFLICT'],
    ['live version', { title: 'Starboy Live at Wembley' }, 'VERSION_CONFLICT'],
    ['cover', { title: 'Starboy Acoustic Cover' }, 'VERSION_CONFLICT'],
    ['instrumental', { title: 'Starboy Instrumental' }, 'VERSION_CONFLICT'],
    ['karaoke', { title: 'Starboy Karaoke Version' }, 'VERSION_CONFLICT'],
    ['nightcore', { title: 'Starboy Nightcore' }, 'VERSION_CONFLICT'],
    ['long duration mismatch', { duration: 260 }, 'DURATION_MISMATCH'],
    ['wrong ISRC', { isrc: 'GBAYE9999999' }, 'ISRC_CONFLICT'],
    ['unrelated title', { title: 'A Completely Different Song' }, 'TITLE_MISMATCH'],
    ['non-song content', { title: 'Starboy Documentary Interview', resultType: 'generic-video' }, 'NON_SONG_CONTENT']
  ])('rejects %s', (_label, candidate, reason) => {
    const result = evaluateCandidate(track, official(candidate));
    expect(result.accepted).toBe(false);
    expect(result.rejectionReasons).toContain(reason);
  });

  it('rejects a known clean candidate for an explicit track', () => {
    const result = evaluateCandidate({ ...track, explicit: true }, official({ title: 'Starboy Clean Version', explicit: false }));
    expect(result.rejectionReasons).toContain('EXPLICIT_CONFLICT');
  });

  it('accepts requested alternate versions but not other versions', () => {
    for (const title of ['Starboy Remix', 'Starboy Live', 'Starboy Acoustic', 'Starboy Remastered']) {
      expect(evaluateCandidate({ ...track, title }, official({ title })).accepted).toBe(true);
    }
    expect(evaluateCandidate({ ...track, title: 'Starboy Live' }, official({ title: 'Starboy Remix' })).accepted).toBe(false);
    expect(evaluateCandidate({ ...track, title: 'Starboy Remix' }, official()).rejectionReasons).toContain('VERSION_CONFLICT');
  });

  it('treats exact matching ISRC as conclusive only when other evidence is safe', () => {
    expect(evaluateCandidate(track, official({ isrc: track.isrc })).score).toBe(100);
    expect(evaluateCandidate(track, official({ title: 'Starboy Remix', isrc: track.isrc })).accepted).toBe(false);
  });

  it('normalizes punctuation, accents, scripts, and catalogue qualifiers', () => {
    expect(normalize('AC/DC')).toBe('ac dc');
    expect(normalize('Beyonce\u0301')).toBe('beyonce');
    expect(normalize('\u6c38\u9060\u306b\u5149\u308c')).toBe('\u6c38\u9060\u306b\u5149\u308c');
    expect(canonicalTitle('Makhna - From "Drive"')).toBe('Makhna');
    expect(canonicalTitle('Khadke Glassy - From  Jabariya Jodi')).toBe('Khadke Glassy');
    expect(canonicalTitle('Kaun Nachdi (From  Sonu Ke Titu Ki Sweety )')).toBe('Kaun Nachdi');
    expect(canonicalTitle('Malang (Title Track) [From  Malang - Unleash The Madness ]')).toBe('Malang (Title Track)');
    expect(canonicalTitle('Patola (From  Patola ) (feat. Bohemia)', ['Bohemia'])).toBe('Patola');
  });

  it('recognizes exact titles with appended catalog translations', () => {
    const translated = official({ title: 'ただ声一つ - One Voice', artists: ['Rokudenashi'], duration: 230 });
    const localized = { ...track, title: 'ただ声一つ', primaryArtist: 'Rokudenashi', artists: ['Rokudenashi'] };
    expect(evaluateCandidate(localized, translated).evidence.title).toBeGreaterThanOrEqual(0.95);
    expect(evaluateCandidate(localized, translated).accepted).toBe(true);
  });

  it('keeps appended known alternate versions blocked for a plain track', () => {
    expect(evaluateCandidate(track, official({ title: 'Starboy Remix' })).rejectionReasons).toContain('VERSION_CONFLICT');
    expect(evaluateCandidate(track, official({ title: 'Starboy Karaoke Version' })).rejectionReasons).toContain('VERSION_CONFLICT');
  });

  it('matches the shared base title for explicitly requested alternate versions', () => {
    const liveTrack = { ...track, title: 'Hotel California - Live On MTV, 1994', primaryArtist: 'Eagles', artists: ['Eagles'], duration: 434 };
    const liveCandidate = { title: 'Hotel California (Live)', artists: ['Eagles'], uploader: 'Eagles Official', duration: 434, resultType: 'generic-video' };
    const result = evaluateCandidate(liveTrack, liveCandidate);
    expect(result.accepted).toBe(true);
    expect(result.evidence.title).toBeGreaterThanOrEqual(0.95);
  });

  it('recognizes official channel ownership and tolerates bounded catalog duration drift for exact songs', () => {
    const officialChannel = official({ uploader: 'The Weeknd Official Channel', artists: ['The Weeknd'], resultType: 'generic-video' });
    expect(confidentMatch(track, [officialChannel])?.candidate).toBe(officialChannel);
    const drifted = official({ artists: track.artists, duration: track.duration + 10 });
    expect(evaluateCandidate(track, drifted).score).toBeGreaterThanOrEqual(90);
  });

  it('removes a credited feature without erasing unknown title text', () => {
    expect(canonicalTitle('Scissor Redemption (feat. Namichie)', ['Namichie'])).toBe('Scissor Redemption');
    expect(canonicalTitle('Song (feat. Unknown)', ['Known Artist'])).toContain('Unknown');
  });

  it('detects version markers as terms instead of substrings', () => {
    expect(versionMarkers('Song Sped Up')).toContain('sped-up');
    expect(versionMarkers('Song 10th Anniversary Version')).toContain('anniversary');
    expect(versionMarkers('Special delivery audio')).not.toContain('live');
  });

  it('does not let a generic fan upload auto-match on identity alone', () => {
    const candidate = { title: 'Starboy', uploader: 'Unknown Fan', artist: 'The Weeknd', duration: 230 };
    expect(scoreCandidate(track, candidate)).toBeLessThan(80);
    expect(confidentMatch(track, [candidate])).toBeNull();
  });

  it('prefers a structured song over an otherwise equal generic result', () => {
    const generic = official({ resultType: 'generic-video' });
    const song = official({ resultType: 'song' });
    expect(confidentMatch(track, [generic, song])?.candidate.resultType).toBe('song');
  });

  it('allows two credited owners to corroborate the same recording', () => {
    const metadata = { title: 'Tum Hi Ho', primaryArtist: 'Arijit Singh', artists: ['Arijit Singh', 'Mithoon'], duration: 261 };
    const first = { title: 'Tum Hi Ho', uploader: 'Arijit Singh', duration: 261, resultType: 'song' };
    const second = { title: 'Tum Hi Ho', uploader: 'Mithoon - Topic', duration: 262, resultType: 'song' };
    expect(sameRecording(metadata, first, second)).toBe(true);
    expect(sameRecording(metadata, first, { ...second, title: 'Tum Hi Ho Remix' })).toBe(false);
  });

  it('keeps the external search bounded and tolerant of inaccessible entries', () => {
    expect(SEARCH_OPTIONS).toMatchObject({
      playlistEnd: 15, flatPlaylist: true, ignoreErrors: true, skipDownload: true,
      socketTimeout: 12, retries: 2
    });
  });
});
