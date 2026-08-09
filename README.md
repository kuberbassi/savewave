<div align="center">
  <img src="public/pwa-icon-dark.png" width="128" alt="Savewave icon">

  # Savewave

  **Paste -> Resolve -> Preview -> Save**

  A simple, privacy-first media saver with a lightweight download website and on-device native engines.

  [Official website — savewave.kuberbassi.com](https://savewave.kuberbassi.com/) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)

  ![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Rust](https://img.shields.io/badge/Rust-native_engine-000000?style=flat-square&logo=rust&logoColor=white)
  ![yt-dlp](https://img.shields.io/badge/yt--dlp-local-FF0000?style=flat-square)
  ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
</div>

---

## What Savewave is

Savewave keeps one predictable flow and automatically selects the best available source quality. It supports public, non-DRM media only. Private, login-gated, cookie-only, paid, and DRM-protected content is rejected; Savewave does not try to bypass access controls.

The website is intentionally an installation landing page only. It does not contain the resolver or downloader. The unchanged Paste -> Resolve -> Preview -> Save workflow runs inside the installed application, with no cloud extraction server or media upload.

## Platform capabilities

| Capability | Web | Desktop (Tauri) | Android |
| --- | --- | --- | --- |
| Installation/download page | Yes | N/A | N/A |
| Direct media URLs | No | Yes | Native local engine on Android 10+ |
| Public YouTube/social/SoundCloud extraction | No | Local `yt-dlp` | Native local engine; final physical-device matrix pending |
| Spotify Smart Match | No | Public metadata + shared strict scorer + local matched-source extraction | Public metadata + conservative on-device multi-query matching |
| Downloads | Not available | OS Downloads folder | MediaStore Downloads |
| Cookies/private media | No | No | No |
| Cloud extraction/upload | No | No | No |

Android source, the Tauri project, and the native media-plugin bridge are included. Release automation produces signed ARM64 and ARMv7 APKs for Android 10+; the ARMv7 file is intended for older 32-bit Samsung and other Android phones. Real-device resolve, download, cancellation, MediaStore, upgrade, and uninstall validation is still required. There is no iOS target.

## Architecture

Detailed references: [Architecture](docs/ARCHITECTURE.md) · [Media engine rules](docs/MEDIA_ENGINE.md) · [Release guide](docs/RELEASING.md)

```text
shared responsive UI
        |
shared TypeScript media core
  detection · capabilities · errors · naming · quality · history
        |
  +-----+------------------+
  |                        |
web adapter          native adapters
direct URLs          Tauri commands / Android plugin
                           |
                    local yt-dlp + FFmpeg
```

| Technology | Responsibility |
| --- | --- |
| React | Focused Paste -> Preview -> Save interface and responsive state rendering. |
| TypeScript | Shared media contracts, source detection, capability gates, errors, filenames, quality policy, Spotify scoring, and IndexedDB history. |
| Tauri 2 | Small desktop shell, command boundary, bundling, capabilities, and release-notification integration. |
| Rust | URL validation, sidecar argument construction, process lifecycle, progress, cancellation, cleanup, and safe saving. |
| yt-dlp | Local public-media metadata and extraction. |
| FFmpeg | Local format merge/post-processing used by the extraction engine. |
| Kotlin / youtubedl-android | Asynchronous startup, Spotify matching, ordered Instagram galleries, bounded extraction, cancellation, cleanup, and scoped MediaStore saving without broad storage permission. |
| Express | Static web hosting and explicit `410` responses for retired cloud extraction routes. |
| IndexedDB | Bounded on-device application history inside the native WebView. |
| Vitest + Cargo test | Shared-core, web, resolver utility, security, argument, and cancellation tests. |

## Development

Requirements: Node.js 22+, npm, and Rust stable. Native release builds also require the platform's Tauri prerequisites.

```bash
npm install
npm run lint
npm test
npm run build
```

Desktop development:

```bash
npm run prepare:sidecars
npm run tauri:dev
```

`prepare:sidecars` creates architecture-suffixed local `yt-dlp` and FFmpeg binaries under `src-tauri/binaries/`. Those generated executables are ignored by Git. Release installers bundle them as private application dependencies; end users install only one setup file.

Rust checks:

```bash
cd src-tauri
cargo test
```

## Release checklist

1. Run the JavaScript/TypeScript and Rust checks above.
2. Build and smoke-test each desktop target on its native operating system.
3. Publish the installer and release notes on GitHub.
4. Update `public/client-version.json` only after the matching installer is publicly available.
5. Initialize and register the Android plugin, then test install, resolve, cancel, save, and upgrade flows on physical devices.

The Windows and Android apps perform a notification-only version check at launch. A newer version opens no executable automatically: the user explicitly chooses whether to open the installer or changelog. This avoids presenting an unsigned or placeholder automatic updater as secure. Fully automatic installation should only be added after code signing and Tauri updater signing keys are available.

Do not advertise Android as production-ready until its pending integration/device checks pass. Spotify uses public Spotify metadata and rejects low-confidence external matches; correctness still depends on the public metadata Spotify exposes and the candidates available to yt-dlp.

## Privacy and security

- Media processing runs on the user's device in native builds.
- The web deployment has no extraction endpoint and does not proxy media.
- Inputs are restricted to public HTTP(S) URLs; private-network targets are rejected by native validation.
- Sidecars receive structured arguments rather than shell command strings.
- Every native job has isolated temporary storage and a process-scoped cancel handle.
- History stays inside the installed application on that device and is bounded to avoid unbounded growth.

Only download media you own or have permission to save. Platform terms and local law still apply.

## License

[MIT](LICENSE) © Kuber Bassi.
