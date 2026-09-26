# Spotify matcher benchmark

## Exported-library corpus

- Date: 2026-09-22
- Input: 1,377 rows from Hindi, Global, Mood, and FNF exports
- Unique tracks: 1,374
- Initial automatic matches: 1,252 (91.1%)
- Initial choices: 15
- Initial safe rejections: 107
- Average accepted confidence: 97.4

The corpus exposed a repeatable title-normalization gap for unquoted Spotify soundtrack suffixes such as `- From Movie` and `(From Movie)`. A narrowly scoped normalization fix recovered 22 of the 122 difficult cases at an average confidence score of 96.8. Seventeen of those recoveries were from the Hindi corpus.

After the fix, the combined result is 1,274 automatic matches (92.7%), 12 choices, and 88 safe rejections. Automatic or choice coverage is 93.6%.

## Popular and localized-track follow-up

A second corpus-driven matcher upgrade added exact-title containment for bilingual catalog titles, shared-base comparison for explicitly requested versions, official-channel ownership recognition, bounded duration drift for otherwise exact structured songs, and an official-audio fallback search.

A final safety guard requires requested remix, live, acoustic, cover, instrumental, karaoke, slowed, sped-up, nightcore, clean, demo, extended, edit, and anniversary markers to remain present in the matched candidate. This prevented a remix from being incorrectly replaced by its original recording.

The stable validation recovered 28 more automatic matches, including Stereo Love, Beggin, Hotel California remaster/live, Lonely, Patola, translated Japanese titles, soundtrack entries, and an FNF track. Estimated whole-corpus automatic coverage is now 1,302 of 1,374 tracks (94.8%), with the original confidence threshold preserved. Some remaining empty searches are upstream/transient discovery failures rather than scoring failures.

These figures measure discovery and matcher confidence, not listening-confirmed correctness. No confidence threshold was reduced. Version conflicts, weak artist evidence, duration conflicts, and genuinely ambiguous candidates continue to be rejected or shown as choices.

## Reproduction

Run `scripts/benchmark-spotify-corpus.js` with one or more compatible CSV or `Artist - Title` text exports. Use `SPOTIFY_BENCHMARK_CONCURRENCY` to control bounded network concurrency.
