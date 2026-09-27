# Savewave architecture

## Product boundary

Savewave has two equally important installed clients: Windows desktop and Android APK. The website is only an installation and product-information surface. Media resolution and transfer run locally; there is no Savewave account database, media proxy, or cloud media storage.

## Current architecture

```text
React interface
    |
Shared TypeScript core
    |-- source/capability detection
    |-- runtime contracts and safe errors
    |-- download policy and bounded workflow controller
    |-- Spotify metadata, search, scoring, ambiguity, preferences
    |-- bounded local history
    |
MediaEngine adapter
    |-- Windows: Electron isolated preload and allowlisted IPC
    `-- Android: Capacitor plugin contract
            |
Native execution boundary
    |-- Electron/Node launches bundled yt-dlp and FFmpeg
    `-- small Java bridge launches Android engines and publishes through MediaStore
```

The retired Tauri/Rust/Kotlin implementation was removed from the maintained tree. Its source remains recoverable from v1.0.13 Git history; it is not a third supported client. Installed-client upgrade and download validation are still required before claiming full parity.

## Ownership rules

- `src/core`: authoritative product contracts, limits, state, policies, Spotify decisions, and workflow control.
- `public/app.jsx`: interface composition and view state; it calls shared workflows rather than reimplementing them.
- `src/desktop`: Electron window security, IPC input validation, process transport, and OS integration.
- `android/app/src/main/java`: Android engine/process transport, cancellation, lifecycle cleanup, and MediaStore publication.
- `src/services/resolver`: provider metadata adapters used by the shared resolver path.
- Generated browser assets are `public/app.js`, `public/landing.js`, `public/core.js`, `public/dist.css`, and `public/vendor/*`; edit their sources and run the build.
- `dist-electron`, `dist-capacitor`, Android build folders, coverage, and packaged output are disposable build products.

## Reliability boundaries

- Only public HTTP(S) media is supported. Private, cookie-only, paid, authenticated, and DRM media is outside scope.
- User text is never interpolated into shell command strings.
- Runtime payloads are validated before entering application state.
- Downloads are job-scoped, cancellable, bounded, and cleaned on terminal paths.
- Public Instagram Reel URLs are passed to yt-dlp on both installed clients without cookies. Other Instagram paths, Facebook, and X/Twitter links receive an unsupported-source response. A public Reel can still fail if Instagram denies anonymous extraction or changes its API.
- Android publishes completed files to `Downloads/Savewave`; it does not request broad storage access or run a permanent background service.
- Spotify uncertainty produces a safe rejection or explicit two-option choice; popularity is never identity evidence.
- Windows updates are GitHub-release-only: the Electron client validates the versioned asset URL and checks its downloaded bytes against the release SHA-256 file before invoking the one-click installer. A failed check leaves the installed app open.
- Android performs its release check in the native bridge. APK installation remains an explicit Android system action, and in-place upgrades require the same package ID/signing key plus a higher version code.

## What automated checks do not prove

Compilation, deterministic tests, and packaging cannot prove current third-party provider behavior, device lifecycle behavior, accessibility, signing, upgrade safety, or saved-media playback. Those belong to [MANUAL_TEST_MATRIX.md](MANUAL_TEST_MATRIX.md).
