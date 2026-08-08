# Savewave

<p align="center">
  <img src="public/savewave-dark.png" width="120" alt="Savewave logo">
</p>

Savewave is a privacy-focused public-media resolver and downloader built with React, Express, `yt-dlp`, and Vitest. It follows one focused flow: **Paste -> Resolve -> Preview -> Save**.

## What it supports

| Platform | Supported public media |
| :--- | :--- |
| YouTube | Videos, Shorts, and audio |
| Instagram | Reels, posts, photos, videos, and carousels |
| Facebook | Videos, Reels, and post media |
| Threads | Post videos and images |
| X / Twitter | Videos and images |
| SoundCloud | Audio streams |
| Spotify | Metadata plus strict audio-source matching |
| Direct URLs | Common video, audio, and image formats |

Private, login-gated, and Story media is intentionally rejected. Savewave does not accept cookies or browser sessions. Platform support can change when a source changes its public delivery system.

## Privacy model

- No account or application database.
- No permanent server-side media storage.
- Bounded download history stored locally in IndexedDB.
- Final download targets are validated before the browser opens them.

## Spotify matching

Savewave does not download audio from Spotify. It reads public track metadata, searches public audio sources, scores title, artist, version, channel, and duration signals, and returns a result only above a strict confidence threshold. No Spotify API key or Premium account is required.

## Local development

Requirements: Node.js 20 or newer, npm, and a working `yt-dlp` runtime.

```bash
npm install
npm run build
npm test
npm start
```

Open `http://localhost:3000`.

## Project structure

```text
public/
  app.jsx          React interface source
  app.js           compiled browser bundle
  style.css        components, motion, and responsive rules
  theme.css        design tokens and theme foundations
src/services/
  resolver/        source detection, providers, validation, and normalization
tests/
  integration/     API behavior
  unit/            resolver, security, SEO, and provider behavior
server.js           Express application and download endpoints
```

`public/app.js` and `public/dist.css` are deployable build artifacts and should be regenerated after changing their source files.

## Commands

- `npm start` - start the Express application.
- `npm run build` - rebuild production CSS and JavaScript.
- `npm test` - run the complete Vitest suite.

## Responsible use

Only download media you are authorized to save. You are responsible for following source terms and applicable law.

## Security and contributing

See [SECURITY.md](SECURITY.md) for private vulnerability reporting and [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT License](LICENSE) (c) 2026 Savewave / [Kuber Bassi](https://kuberbassi.com)
