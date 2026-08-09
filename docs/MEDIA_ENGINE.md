# Media Engine Rules

## Quality policy

Savewave exposes only Video and Audio when relevant. It does not expose resolution, bitrate, FPS, codec, or container menus.

Video selects `bestvideo*+bestaudio/best`. FFmpeg prefers MP4 when the selected codecs fit safely and uses MKV as a lossless fallback. Streams are not re-encoded merely to force an extension.

Audio selects `bestaudio/best`, extracts the audio stream, and uses its natural audio format. Savewave does not force MP3 or perform avoidable lossy-to-lossy conversion.

## Provider behavior

- YouTube: individual videos and Shorts; video or audio; playlists are intentionally not expanded.
- Instagram: public posts, Reels, single images, and ordered image/video carousels, bounded to 20 post items. Image-only carousels use the public embed documents because the video extractor intentionally rejects image entries. Savewave verifies that every carousel item resolves before saving and names them `Post title (1).jpg`, `Post title (2).jpg`, and so on without overwriting existing files.
- Facebook: publicly resolvable videos, Reels, and multi-item post media, bounded to 20 items.
- Threads: publicly resolvable images and videos, bounded to 20 items.
- X/Twitter: publicly resolvable images and videos, bounded to 20 items.
- SoundCloud: publicly resolvable audio.
- Spotify: public track metadata plus strict external-source Smart Match on desktop and Android; Spotify does not provide the downloaded audio.
- Direct media: supported public HTTP(S) media links only.

Private, deleted, region-blocked, login-gated, cookie-only, paid, or DRM-protected media returns a normalized rejection instead of attempting a bypass.

## Spotify Smart Match

The matcher searches multiple artist/title query shapes and scores title identity, credited artists, duration, album/ISRC where available, source authority, and version markers. Unexpected remix, live, cover, karaoke, instrumental, slowed, sped-up, nightcore, reaction, and tutorial candidates receive strong penalties.

Raw scores are internal ranking values and are not percentages. The UI reports only `Verified high-confidence match`. Insufficient or ambiguous evidence returns `Could not confidently match this Spotify track.`

Android performs the same conservative workflow without a Spotify API key or account: public oEmbed metadata identifies the track and artist, three bounded YouTube query shapes produce deduplicated candidates, and title, credited artist, source authority, and unexpected-version markers determine acceptance. It intentionally rejects an uncertain result instead of returning a random song.

The checked-in playlist benchmark can be run without downloading media:

```bash
npm run test:spotify-playlist -- PLAYLIST_ID
```

Live provider checks are supplementary; ordinary CI uses mocks and deterministic fixtures.

The ignored native Instagram live test resolves and downloads the seven-image regression carousel used during development:

```bash
cargo test --manifest-path src-tauri/Cargo.toml gallery::tests::resolves_known_public_seven_image_carousel_live -- --ignored --exact
```
