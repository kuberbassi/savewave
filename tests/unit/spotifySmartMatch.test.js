import { describe, it, expect } from 'vitest';
const { scoreCandidate, titleCoverage } = require('../../src/services/resolver/smartMatch/scoreCandidate');
const { normalizeTitle, normalizeArtist, stripFeaturedArtists } = require('../../src/services/resolver/smartMatch/normalizers');
const { SEARCH_OPTIONS } = require('../../src/services/resolver/smartMatch/spotifyMatcher');

describe('Spotify Smart Match Confidence Engine (30 Requirements Test Suite)', () => {
  const baseSpotifyTrack = {
    title: 'Starboy',
    artist: 'The Weeknd',
    primaryArtist: 'The Weeknd',
    artists: ['The Weeknd', 'Daft Punk'],
    album: 'Starboy',
    duration: 230,
    isrc: 'USUM71607007'
  };

  // 1. exact title + artist + duration
  it('1. exact title + artist + duration should score VERY HIGH (>= 90)', () => {
    const cand = {
      title: 'Starboy',
      uploader: 'The Weeknd - Topic',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.score).toBeGreaterThanOrEqual(90);
    expect(res.confidenceLabel).toBe('VERY HIGH');
    expect(res.pass).toBe(true);
  });

  // 2. same title, wrong artist
  it('2. same title, wrong artist should be REJECTED (< 80)', () => {
    const cand = {
      title: 'Starboy',
      uploader: 'Random Cover Channel',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.pass).toBe(false);
  });

  // 3. correct song vs remix
  it('3. correct song vs unwanted remix should penalize and reject', () => {
    const cand = {
      title: 'Starboy (Kygo Remix)',
      uploader: 'The Weeknd',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.penalties).toContain("Contains unwanted 'remix' (-60)");
  });

  // 4. correct song vs live version
  it('4. correct song vs unwanted live version should penalize', () => {
    const cand = {
      title: 'Starboy (Live at O2 Arena)',
      uploader: 'The Weeknd',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.penalties).toContain("Contains unwanted 'live' (-60)");
  });

  // 5. correct song vs slowed version
  it('5. correct song vs slowed version should penalize', () => {
    const cand = {
      title: 'Starboy (Slowed + Reverb)',
      uploader: 'Slowed Central',
      duration: 280
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.pass).toBe(false);
  });

  // 6. correct song vs sped-up version
  it('6. correct song vs sped-up version should penalize', () => {
    const cand = {
      title: 'Starboy (Sped Up)',
      uploader: 'Speed Audio',
      duration: 180
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.pass).toBe(false);
  });

  // 7. correct song vs cover
  it('7. correct song vs cover should penalize (-60)', () => {
    const cand = {
      title: 'Starboy (Acoustic Cover)',
      uploader: 'John Doe Covers',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.penalties).toContain("Contains unwanted 'cover' (-60)");
  });

  // 8. correct song vs instrumental
  it('8. correct song vs instrumental should penalize (-60)', () => {
    const cand = {
      title: 'Starboy (Instrumental)',
      uploader: 'Karaoke King',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.penalties).toContain("Contains unwanted 'instrumental' (-60)");
  });

  // 9. correct song vs karaoke
  it('9. correct song vs karaoke should penalize (-70)', () => {
    const cand = {
      title: 'Starboy (Karaoke Version)',
      uploader: 'SingAlong',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.penalties).toContain("Contains unwanted 'karaoke' (-70)");
  });

  // 10. official audio vs random upload
  it('10. official audio should receive bonus (+6)', () => {
    const cand = {
      title: 'Starboy (Official Audio)',
      uploader: 'The Weeknd',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.bonuses).toContain('Official Audio Tag (+6)');
  });

  // 11. Topic channel result
  it('11. Topic channel should receive Topic bonus (+8)', () => {
    const cand = {
      title: 'Starboy',
      uploader: 'The Weeknd - Topic',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.bonuses).toContain('Official Topic Channel (+8)');
  });

  // 12. music video with slightly different duration
  it('12. duration diff <= 4s should score +15 bonus', () => {
    const cand = {
      title: 'Starboy (Official Music Video)',
      uploader: 'TheWeekndVEVO',
      duration: 233
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.bonuses).toContain('Duration diff <= 4s (+15)');
  });

  // 13. same song name from two different artists
  it('13. same song name from wrong artist should fail confidence gate', () => {
    const cand = {
      title: 'Starboy',
      uploader: 'Panic! At The Disco',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.pass).toBe(false);
  });

  // 14. feat. artist normalization
  it('14. normalizeArtist should handle feat. ft. & featuring', () => {
    expect(normalizeArtist('The Weeknd feat. Daft Punk')).toBe('the weeknd daft punk');
    expect(normalizeArtist('The Weeknd ft. Daft Punk')).toBe('the weeknd daft punk');
  });

  it('normalizes common artist homoglyphs and preserves Cyrillic names', () => {
    expect(normalizeArtist('KUβER βΔSSI')).toBe('kuber bassi');
    expect(normalizeArtist('фрози')).toBe('фрози');
  });

  // 15. multi-artist Spotify track
  it('15. multi-artist track matching all artists gets bonus', () => {
    const cand = {
      title: 'Starboy ft. Daft Punk',
      uploader: 'The Weeknd - Topic',
      duration: 230
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.bonuses).toContain('All Artists Matched (+10)');
  });

  // 16. Spotify track whose official title itself contains "Remix"
  it('16. Spotify track with Remix in title should NOT penalize Remix candidate', () => {
    const remixTrack = { ...baseSpotifyTrack, title: 'Starboy (Kygo Remix)' };
    const cand = {
      title: 'Starboy (Kygo Remix Official Audio)',
      uploader: 'The Weeknd - Topic',
      duration: 230
    };
    const res = scoreCandidate(remixTrack, cand);
    expect(res.penalties).not.toContain("Contains unwanted 'remix' (-60)");
  });

  // 17. Spotify track whose official title itself contains "Live"
  it('17. Spotify track with Live in title should NOT penalize Live candidate', () => {
    const liveTrack = { ...baseSpotifyTrack, title: 'Starboy - Live' };
    const cand = {
      title: 'Starboy (Live at Wembley)',
      uploader: 'The Weeknd - Topic',
      duration: 230
    };
    const res = scoreCandidate(liveTrack, cand);
    expect(res.penalties).not.toContain("Contains unwanted 'live' (-60)");
  });

  // 18. Spotify track whose official title contains "Acoustic"
  it('18. Spotify track with Acoustic should NOT penalize Acoustic candidate', () => {
    const acousticTrack = { ...baseSpotifyTrack, title: 'Starboy (Acoustic)' };
    const cand = {
      title: 'Starboy Acoustic Version',
      uploader: 'The Weeknd - Topic',
      duration: 230
    };
    const res = scoreCandidate(acousticTrack, cand);
    expect(res.penalties).not.toContain("Contains unwanted 'acoustic' (-30)");
  });

  // 19. Spotify track whose official title contains "Remastered"
  it('19. Spotify track with Remastered should NOT penalize Remastered candidate', () => {
    const remasterTrack = { ...baseSpotifyTrack, title: 'Starboy - Remastered 2020' };
    const cand = {
      title: 'Starboy (2020 Remastered)',
      uploader: 'The Weeknd - Topic',
      duration: 230
    };
    const res = scoreCandidate(remasterTrack, cand);
    expect(res.penalties).not.toContain("Contains unwanted 'remastered' (-30)");
  });

  // 20. duration difference > 10 seconds
  it('20. duration diff > 10s should penalize (-40)', () => {
    const cand = {
      title: 'Starboy',
      uploader: 'The Weeknd',
      duration: 245
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.penalties).toContain('Duration diff > 10s (15s) (-40)');
  });

  // 21. exact ISRC match
  it('21. exact ISRC match should award +100 bonus', () => {
    const cand = {
      title: 'Starboy',
      uploader: 'The Weeknd',
      duration: 230,
      isrc: 'USUM71607007'
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.bonuses).toContain('Exact ISRC (+100)');
  });

  // 22. wrong ISRC
  it('22. wrong ISRC should penalize (-80)', () => {
    const cand = {
      title: 'Starboy',
      uploader: 'The Weeknd',
      duration: 230,
      isrc: 'WRONGISRC123'
    };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.penalties).toContain('Wrong ISRC (-80)');
  });

  // 23. two nearly equal candidates
  it('23. prefers official Topic channel candidate over third party', () => {
    const candA = { title: 'Starboy', uploader: 'The Weeknd - Topic', duration: 230 };
    const candB = { title: 'Starboy', uploader: 'Music Uploader', duration: 230 };
    const scoreA = scoreCandidate(baseSpotifyTrack, candA).score;
    const scoreB = scoreCandidate(baseSpotifyTrack, candB).score;
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  // 24. new/low-popularity track
  it('24. new/low-popularity track matches based on exact title and artist without view count dependency', () => {
    const obscureTrack = { title: 'Indie Song', artist: 'Obscure Band', primaryArtist: 'Obscure Band', duration: 180 };
    const cand = { title: 'Indie Song', uploader: 'Obscure Band - Topic', duration: 180 };
    const res = scoreCandidate(obscureTrack, cand);
    expect(res.pass).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(80);
  });

  // 25. no valid candidate
  it('25. returns pass = false when no candidate meets confidence threshold', () => {
    const cand = { title: 'Totally Unrelated Song', uploader: 'Unknown', duration: 500 };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.pass).toBe(false);
  });

  // 26. candidate with matching title but wrong version
  it('26. matching title but Nightcore version should be rejected', () => {
    const cand = { title: 'Starboy (Nightcore Version)', uploader: 'Nightcore Channel', duration: 190 };
    const res = scoreCandidate(baseSpotifyTrack, cand);
    expect(res.pass).toBe(false);
  });

  // 27. candidate with punctuation differences
  it('27. punctuation differences should normalize and match', () => {
    expect(normalizeTitle("Starboy - (Explicit!)")).toBe("starboy explicit");
  });

  // 28. Unicode/non-English titles
  it('28. Unicode accents in title should normalize correctly', () => {
    expect(normalizeTitle("永遠に光れ (Everlasting Shine)")).toBe("永遠に光れ everlasting shine");
  });

  // 29. artist name punctuation differences
  it('29. artist punctuation differences should normalize and match', () => {
    expect(normalizeArtist("AC/DC")).toBe("ac dc");
  });

  // 30. track with "(feat. X)" formatting differences
  it('30. track with feat. formatting should normalize primary artist', () => {
    expect(normalizeArtist("Taylor Swift (feat. Bon Iver)")).toBe("taylor swift bon iver");
  });

  it('rejects a low-overlap title even when artist and duration look plausible', () => {
    const candidate = { title: 'Starboy Documentary Interview', uploader: 'The Weeknd', duration: 230 };
    const result = scoreCandidate({ ...baseSpotifyTrack, title: 'Starboy After Hours' }, candidate);
    expect(titleCoverage('Starboy After Hours', candidate.title)).toBeLessThan(0.65);
    expect(result.pass).toBe(false);
  });

  it('rejects a clean upload when the Spotify track is explicit', () => {
    const candidate = { title: 'Starboy Clean Version', uploader: 'The Weeknd - Topic', duration: 230 };
    const result = scoreCandidate({ ...baseSpotifyTrack, explicit: true }, candidate);
    expect(result.penalties).toContain('Clean version does not match explicit track (-80)');
    expect(result.pass).toBe(false);
  });

  it('keeps usable search entries when another result is inaccessible', () => {
    expect(SEARCH_OPTIONS.flatPlaylist).toBe(true);
    expect(SEARCH_OPTIONS.ignoreErrors).toBe(true);
    expect(SEARCH_OPTIONS.skipDownload).toBe(true);
  });

  it('does not treat a featured-artist credit as missing song-title words', () => {
    const track = {
      title: 'Scissor Redemption (feat. なみちえ)',
      artist: 'Taku Iwasaki, Namichie',
      primaryArtist: 'Taku Iwasaki',
      artists: ['Taku Iwasaki', 'Namichie'],
      duration: 142
    };
    const candidate = { title: 'Scissor Redemption', uploader: 'Taku Iwasaki - Topic', duration: 143 };
    expect(stripFeaturedArtists(track.title)).toBe('Scissor Redemption');
    expect(scoreCandidate(track, candidate).pass).toBe(true);
  });

  it('normalizes accented artist aliases consistently', () => {
    expect(normalizeArtist("L'Orchestra Cinématique")).toBe(normalizeArtist("L'Orchestra Cinematique"));
  });

  it('accepts an official Topic upload owned by another credited artist', () => {
    const track = {
      title: 'Brawl Stars Menu Theme Cinematic/Orchestra',
      artist: 'Kevin Jaret Hernandez Martinez, Hatkuvi',
      primaryArtist: 'Kevin Jaret Hernandez Martinez',
      artists: ['Kevin Jaret Hernandez Martinez', 'Hatkuvi'],
      duration: 182
    };
    const candidate = { title: track.title, uploader: 'Hatkuvi - Topic', duration: 183 };
    expect(scoreCandidate(track, candidate).pass).toBe(true);
  });

  it('recognizes equivalent soundtrack descriptor titles with exact artist and duration', () => {
    const track = { title: 'Gravity Falls - Symphonic Version', artist: 'Imperial Orchestra', primaryArtist: 'Imperial Orchestra', duration: 138 };
    const candidate = { title: 'Gravity Falls | Imperial Orchestra | Cinema Medley 3', uploader: 'Imperial Orchestra', duration: 138 };
    expect(scoreCandidate(track, candidate).pass).toBe(true);
  });
});
