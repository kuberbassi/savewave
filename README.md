<div align="center">
  <img src="public/pwa-icon-dark.png" width="128" alt="Savewave icon">

  # Savewave

  **Paste → Resolve → Preview → Save**

  A privacy-focused media saver for public video, audio, and image links running entirely on your device.

  [Official Website](https://savewave.kuberbassi.com/) · [Changelog](CHANGELOG.md) · [Maintenance Guide](docs/MAINTENANCE.md) · [License](LICENSE)

  ![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Rust](https://img.shields.io/badge/Rust-native_engine-000000?style=flat-square&logo=rust&logoColor=white)
  ![yt-dlp](https://img.shields.io/badge/yt--dlp-local-FF0000?style=flat-square)
  ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
</div>

---

## Overview

Savewave is a clean, local-first media downloader. It automatically detects media sources, extracts best-available quality streams, and saves them directly to your device without accounts, cloud processing, or server uploads.

- **Local Processing**: Extraction runs on-device via bundled `yt-dlp` and `FFmpeg`.
- **Zero Cloud Storage**: No remote user database, account system, or media proxies.
- **Public Content Only**: Supports public URLs (YouTube, Instagram, Facebook, X, SoundCloud, Direct Links, Spotify Smart Match). Private or DRM-gated media is unsupported.

---

## Tech Stack & Architecture

| Layer | Technologies | Responsibility |
| --- | --- | --- |
| **Frontend UI** | React 18, Tailwind CSS | Responsive Paste → Preview → Save interface |
| **Core Logic** | TypeScript, Vitest | Source detection, capability gates, error handling, Spotify match scoring |
| **Desktop App** | Tauri 2, Rust | Safe process lifecycle, URL validation, sidecar management, native saving |
| **Media Engine** | `yt-dlp`, `FFmpeg` | Local public media extraction and stream remuxing |
| **Android App** | Kotlin, `youtubedl-android` | Native Android engine and scoped `MediaStore` saving |

---

## Development Setup

### Prerequisites
- Node.js `22+`
- Rust `stable`

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run typecheck & test suite
npm run check

# 3. Download local sidecars & launch desktop app in dev mode
npm run prepare:sidecars
npm run tauri:dev
```

### Useful Commands

```bash
# Run test suite
npm test

# Run Rust unit tests
cd src-tauri && cargo test

# Build production desktop installer
npm run tauri:build
```

---

## Documentation

- 🏗️ [Architecture](docs/ARCHITECTURE.md) — System boundaries and lifecycle
- ⚙️ [Media Engine Rules](docs/MEDIA_ENGINE.md) — Source detection and extraction policy
- 🛠️ [Maintenance & Updates](docs/MAINTENANCE.md) — Tracking `yt-dlp` upstream updates
- 🚀 [Release Process](docs/RELEASING.md) — Releasing desktop and mobile builds

---

## Developer & Author

Created and maintained by **Kuber Bassi** ([kuberbassi.com](https://kuberbassi.com/) · [@kuberbassi](https://github.com/kuberbassi) · [LinkedIn](https://linkedin.com/in/kuberbassi)).

---

## License

[MIT](LICENSE) © Kuber Bassi.
