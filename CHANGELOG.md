# Changelog

## v1.0.6 — Reliable Android engine updates

### Fixed

- Forced Android to reconcile yt-dlp's saved release tag with the executable on disk before each daily update check, preventing restored preferences from pinning an obsolete bundled engine.
- Retried failed engine refreshes and now stops startup with a short actionable message instead of silently using an engine that yt-dlp considers too old.
- Reduced raw extractor failures to their final useful error so warnings no longer fill the mobile error dialog.
- Added a dedicated signed APK URL to the release manifest so Android update notices open the Android installer instead of the Windows setup file.
- Kept the same application ID and release signing flow while increasing Android's version code, allowing the APK to update in place without deleting the installed app.

### Downloads

- `Savewave_1.0.6_x64-setup.exe` — Windows 10/11 64-bit installer.
- `Savewave_1.0.6_x64-setup.exe.sha256` — checksum used to verify that installer.
- `Savewave-android-arm64.apk` — signed Android 10+ ARM64 in-place update.
- `Savewave-android-arm64.apk.sha256` — checksum used to verify the Android installer.

[Full commit history](https://github.com/kuberbassi/savewave/commits/v1.0.6)

## v1.0.5 — Android production startup

### Fixed

- Disabled Android release shrinking after the signed v1.0.4 production APK continued to close during startup on a physical device.
- Kept the native Tauri media plugin and its commands intact across the Rust/Kotlin startup boundary.
- Removed the ineffective same-site APK rewrite so mobile browsers start the versioned GitHub asset download directly.
- Removed the web app manifest so the download website is no longer offered as an installable PWA.
- Let GitHub handle APK downloads normally instead of forcing a cross-origin browser download from the website.

### Downloads

- `Savewave_1.0.5_x64-setup.exe` — Windows 10/11 64-bit installer.
- `Savewave_1.0.5_x64-setup.exe.sha256` — checksum used to verify that installer.
- `Savewave-android-arm64.apk` — signed Android 10+ ARM64 installer.
- `Savewave-android-arm64.apk.sha256` — checksum used to verify the Android installer.

[Full commit history](https://github.com/kuberbassi/savewave/commits/v1.0.5)

## v1.0.4 — Android compatibility

### Fixed

- Preserved the native Android media plugin in optimized release builds to prevent startup crashes.
- Kept APK downloads on Savewave's domain through a same-site CDN proxy instead of navigating mobile users to GitHub.

### Downloads

- `Savewave_1.0.4_x64-setup.exe` — Windows 10/11 64-bit installer.
- `Savewave_1.0.4_x64-setup.exe.sha256` — checksum used to verify that installer.
- `Savewave-android-arm64.apk` — signed Android 10+ ARM64 installer.
- `Savewave-android-arm64.apk.sha256` — checksum used to verify the Android installer.

[Full commit history](https://github.com/kuberbassi/savewave/commits/v1.0.4)

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
- `Savewave-android-arm64.apk` — signed Android 10+ ARM64 installer.
- `Savewave-android-arm64.apk.sha256` — checksum used to verify the Android installer.
- `Source code (zip)` and `Source code (tar.gz)` — GitHub-generated source archives for developers; normal users do not need them.

The source archives and installers do not contain the private Android signing credentials.

[Full commit history](https://github.com/kuberbassi/savewave/commits/v1.0.3)
