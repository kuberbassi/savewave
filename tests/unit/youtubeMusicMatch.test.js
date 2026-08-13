const { parseYouTubeMusicResults, durationSeconds } = require('../../src/services/resolver/smartMatch/youtubeMusic');
const { resolveSpotifySource, searchStages } = require('../../src/core/spotify/search-runtime.js');
const { evaluateCandidate } = require('../../src/core/spotify/matcher.js');
const { confidentMatch } = require('../../src/core/spotify/matcher.js');

function run(text, browseId, pageType) {
  return { text, navigationEndpoint: { browseEndpoint: { browseId, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType } } } } };
}

describe('structured YouTube Music SmartMatch', () => {
  const track = { title: 'Tum Hi Ho', primaryArtist: 'Arijit Singh', artists: ['Arijit Singh', 'Mithoon'], album: 'Aashiqui 2', duration: 262 };

  it('builds bounded song-first stages with a generic final fallback', () => {
    expect(searchStages(track).map((stage) => stage.filter)).toEqual(['songs', 'songs', 'videos', 'generic']);
    expect(searchStages({ ...track, isrc: 'INS181300012' })[0]).toMatchObject({ filter: 'songs', query: 'INS181300012' });
  });

  it('parses structured song artists, album, duration and URL', () => {
    const renderer = {
      playlistItemData: { videoId: 'abc123' },
      flexColumns: [
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Tum Hi Ho' }] } } },
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [
          run('Arijit Singh', 'UCartist', 'MUSIC_PAGE_TYPE_ARTIST'), { text: ' • ' },
          run('Aashiqui 2', 'MPREalbum', 'MUSIC_PAGE_TYPE_ALBUM'), { text: ' • ' }, { text: '4:22' }
        ] } } }
      ]
    };
    const results = parseYouTubeMusicResults({ contents: [{ musicResponsiveListItemRenderer: renderer }] }, 'songs');
    expect(results[0]).toMatchObject({ videoId: 'abc123', resultType: 'song', artists: ['Arijit Singh'], album: 'Aashiqui 2', duration: 262, verified: true });
    expect(durationSeconds('1:02:03')).toBe(3723);
  });

  it('parses Android YouTube Music responses when subtitle runs omit navigation endpoints', () => {
    const renderer = {
      playlistItemData: { videoId: 'w1_vQbgQh9M' },
      flexColumns: [
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'Let Me Be', navigationEndpoint: { watchEndpoint: { videoId: 'w1_vQbgQh9M' } } }] } } },
        { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [
          { text: 'Mickey Singh' }, { text: ' • ' }, { text: 'Let Me Be' }, { text: ' • ' }, { text: '3:18' }
        ] } } }
      ]
    };
    expect(parseYouTubeMusicResults({ contents: [{ musicResponsiveListItemRenderer: renderer }] }, 'songs')[0]).toMatchObject({
      videoId: 'w1_vQbgQh9M', resultType: 'song', title: 'Let Me Be', artists: ['Mickey Singh'], album: 'Let Me Be', duration: 198
    });
  });

  it('keeps the high-confidence song selected while checking for a bounded fallback', async () => {
    const calls = [];
    const match = await resolveSpotifySource(track, { search: async (stage) => {
      calls.push(stage.name);
      return [{ videoId: 'correct', url: 'https://www.youtube.com/watch?v=correct', resultType: 'song', title: track.title, artists: track.artists, album: track.album, duration: 262, verified: true }];
    } });
    expect(match?.candidate.videoId).toBe('correct');
    expect(calls).toEqual(['all-artists-song', 'primary-artist-song', 'music-video']);
  });

  it('rejects wrong recordings before ranking', () => {
    expect(evaluateCandidate(track, { videoId: 'live', resultType: 'song', title: 'Tum Hi Ho Live', artists: ['Arijit Singh'], duration: 262 }).rejectionReasons).toContain('VERSION_CONFLICT');
    expect(evaluateCandidate(track, { videoId: 'wrong', resultType: 'song', title: 'Tum Hi Ho', artists: ['Another Artist'], duration: 262 }).rejectionReasons).toContain('ARTIST_MISMATCH');
  });

  it('accepts near-tied structured song IDs for the same recording without uploader fields', () => {
    const first = { videoId: 'one', resultType: 'song', title: track.title, artists: track.artists, duration: 262 };
    const second = { videoId: 'two', resultType: 'song', title: track.title, artists: track.artists, duration: 263 };
    expect(confidentMatch(track, [first, second])?.candidate).toBe(first);
  });

  it('uses an exact YouTube Music video to corroborate a near-tied generic result', () => {
    const musicVideo = { videoId: 'music', resultType: 'video', title: 'Tum Hi Ho', artists: ['Arijit Singh'], duration: 262 };
    const generic = { videoId: 'generic', resultType: 'generic-video', title: 'Tum Hi Ho', artists: ['Arijit Singh'], duration: 262 };
    expect(confidentMatch(track, [musicVideo, generic])?.candidate).toBe(musicVideo);
  });

  it('does not treat two ownerless generic results as independent corroboration', () => {
    const first = { videoId: 'one', resultType: 'generic-video', title: 'Tum Hi Ho', artists: ['Arijit Singh'], duration: 262 };
    const second = { videoId: 'two', resultType: 'generic-video', title: 'Tum Hi Ho', artists: ['Arijit Singh'], duration: 262 };
    expect(confidentMatch(track, [first, second])).toBeNull();
  });

  it('retains only verified same-recording candidates as download fallbacks', async () => {
    const calls = [];
    const match = await resolveSpotifySource(track, { search: async (stage) => {
      calls.push(stage.filter);
      if (stage.filter === 'songs') return [{ videoId: 'song', url: 'https://youtube.test/song', resultType: 'song', title: track.title, artists: track.artists, duration: 262 }];
      if (stage.filter === 'videos') return [
        { videoId: 'video', url: 'https://youtube.test/video', resultType: 'video', title: track.title, artists: track.artists, duration: 264 },
        { videoId: 'cover', url: 'https://youtube.test/cover', resultType: 'video', title: `${track.title} Cover`, artists: ['Other Artist'], duration: 262 }
      ];
      return [];
    } });
    expect(match?.candidate.videoId).toBe('song');
    expect(match?.alternatives?.map((candidate) => candidate.videoId)).toEqual(['video']);
    expect(calls).toContain('videos');
    expect(calls).not.toContain('generic');
  });
});
