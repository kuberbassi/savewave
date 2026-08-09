# Changelog

## v1.0.3 — Native clients

Savewave now runs media extraction locally through native Windows and Android clients while keeping the public website lightweight.

### Added

- Native Windows application with a single NSIS installer.
- Native Android application for Android 10+ with scoped Downloads storage.
- Local YouTube, Instagram, Facebook, X, SoundCloud, direct-media, and Spotify Smart Match engines.
- Ordered public Instagram carousel downloads with safe filenames.
- On-device bounded history, progress, cancellation, and update notifications.
- Production landing page, SEO metadata, sitemap, robots, LLMS files, security policy, architecture documentation, and release workflows.

### Improved

- Spotify matching now checks title, every credited artist, duration, source ownership, version markers, and independent corroboration.
- Best-source quality selection and suitable output extensions.
- Responsive layouts, mobile safe areas, preview containment, app icon sizing, loading performance, and reduced-motion behavior.
- Clear handling for private, login-gated, paid, cookie-only, and DRM-protected media.

### Security and reliability

- Local-only extraction with no Savewave media upload or remote download database.
- URL validation, private-network rejection, bounded jobs, collision-safe filenames, cleanup, and restricted native permissions.
- Automated TypeScript, JavaScript, Rust, Windows packaging, Android packaging, checksum, and signature checks.

### Downloads

- `Savewave_1.0.3_x64-setup.exe` — Windows 10/11 64-bit installer.
- `Savewave_1.0.3_x64-setup.exe.sha256` — checksum used to verify that installer.
- `Source code (zip)` and `Source code (tar.gz)` — GitHub-generated source archives for developers; normal users do not need them.

The signed Android APK will be attached as `Savewave-android-arm64.apk` after the repository's Android signing secrets are configured. The source archives and Windows installer do not contain those private signing credentials.

[Full commit history](https://github.com/kuberbassi/savewave/commits/v1.0.3)
