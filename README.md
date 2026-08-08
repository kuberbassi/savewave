# Savewave — Universal Media Downloader

<p align="center">
  <img src="public/savewave-dark.png" width="120" alt="Savewave logo" />
</p>

Savewave is a privacy-focused media resolver and downloader built with React,
Express, `yt-dlp`, and Vitest.

## Principles

- No accounts or database.
- No permanent server-side media storage.
- Automatic source detection and compatible quality selection.
- Download history stays in the browser and is always bounded.

## Supported sources

| Platform | Supported public media |
| :--- | :--- |
| YouTube | Videos, Shorts, audio |
| Instagram | Public Reels, posts, photos, and carousels |
| Facebook | Public videos, Reels, and post media |
| Threads | Post videos and images |
| X / Twitter | Videos and images |
| SoundCloud | Audio streams |
| Spotify | Public metadata plus verified audio-source matching |
| Direct URLs | Common video, audio, and image formats |

Private, login-gated, and Story media is intentionally rejected. Savewave does
not accept account cookies or browser sessions.

## Quick start

```bash
npm install
npm test
npm start
```

Open `http://localhost:3000`.

## Spotify matching

Spotify audio is not downloaded from Spotify. Savewave reads public track
metadata, searches public audio sources, scores title/artist/version/channel
signals, and returns a match only when it passes the strict confidence gate.
No Spotify API key or Premium account is required.

## Commands

- `npm start` — start the Express application.
- `npm run build` — rebuild production CSS and JavaScript.
- `npm test` — run all Vitest suites.

## License

[MIT License](LICENSE) © 2026 Savewave / [Kuber Bassi](https://kuberbassi.com)
