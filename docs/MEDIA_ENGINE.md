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

The matcher uses one shared JavaScript implementation on Web, Desktop, and Android. It searches structured YouTube Music songs first using all credited artists and the exact Spotify title, retries bounded transient failures, then tries a primary-artist song query, YouTube Music videos, and one bounded generic YouTube fallback. The selected URL is handed to the existing yt-dlp audio pipeline.

Candidates are normalized into title, ordered artists, album, duration, explicit state, result type, and video ID. Incompatible versions, explicit/clean conflicts, large duration differences, weak titles, and missing artist identity are rejected before ranking. Remaining candidates use four bounded identity signals: title, artists, duration, and album. Missing optional metadata is neutral rather than positive evidence.

Structured song identity and an exact ISRC, when publicly available, are strong evidence. Verification or an artist-owned channel is only a tie-breaker and cannot override a wrong title, artist, duration, or recording version. Views and popularity are not identity evidence. Insufficient or ambiguous evidence returns `Could not confidently match this Spotify track.`

No Spotify account, API secret, Python process, remote Savewave service, or direct Spotify audio is used. Desktop Rust and the Android plugin provide only HTTP/yt-dlp transport; candidate parsing, ranking, and acceptance remain in shared JavaScript.

The checked-in playlist benchmark can be run without downloading media:

```bash
npm run test:spotify-playlist -- PLAYLIST_ID
```

Live provider checks are supplementary; ordinary CI uses mocks and deterministic fixtures.

The ignored native Instagram live test resolves and downloads the seven-image regression carousel used during development:

```bash
cargo test --manifest-path src-tauri/Cargo.toml gallery::tests::resolves_known_public_seven_image_carousel_live -- --ignored --exact
```
