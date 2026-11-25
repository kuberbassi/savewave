<div align="center">
  <img src="public/pwa-icon-dark.png" width="112" alt="Savewave">

  # SAVEWAVE

  **Paste → Resolve → Save. 100% on your device.**

  No accounts. No servers. No tracking.

  [Download Latest Release](https://github.com/kuberbassi/savewave/releases/latest) · [Website](https://savewave.kuberbassi.com/)

  ![Rust](https://img.shields.io/badge/Core-Rust-DEA584?style=flat-square&logo=rust&logoColor=black)
  ![Tauri v2](https://img.shields.io/badge/Windows-Tauri_v2-24C8DB?style=flat-square&logo=tauri&logoColor=black)
  ![Kotlin](https://img.shields.io/badge/Android-Kotlin_+_Compose-7F52FF?style=flat-square&logo=kotlin&logoColor=white)
  ![yt-dlp](https://img.shields.io/badge/yt--dlp-Auto--Updating-FF0000?style=flat-square)
  ![License](https://img.shields.io/badge/MIT-License-22c55e?style=flat-square)
</div>

---

## How It Works

One shared **Rust core** powers both Windows and Android. No cloud proxies, no backend database — everything runs locally on your machine.

```mermaid
flowchart LR
    URL["Paste / Share Link"] --> CORE["savewave-core (Rust)"]
    CORE -->|"YouTube · IG Reels · SoundCloud · Direct"| YTDLP["Auto-Updating yt-dlp + FFmpeg"]
    CORE -->|"Spotify Track"| SPOT["Spotify Matcher v2 (Odesli + YTM + Transliteration)"]
    SPOT --> YTDLP
    YTDLP --> WIN["Windows (.exe via Tauri v2)"]
    YTDLP --> AND["Android (.apk via Kotlin + Compose)"]
```

### Supported Sources
| Source | What Works |
| :--- | :--- |
| **YouTube** | Best video + audio, Shorts |
| **Spotify** | Smart Match v2 (handles Cyrillic/CJK/Bollywood/short links/regional URLs) |
| **Instagram Reels** | Public Reels + on-device login modal if IG asks |
| **SoundCloud** | Best audio |
| **Direct Links** | `.mp4`, `.mp3`, `.m4a`, `.png`, `.jpg`, `.webp`, etc. |

---

## v2.0 Rust Rewrite — Measured Gains

| Metric | v1 (Electron + JS + Capacitor) | v2 (Rust + Tauri v2 + Kotlin) | Change |
| :--- | :--- | :--- | :--- |
| **Windows Installer** | `181.0 MB` | **`49.6 MB`** | **-72.6% smaller** |
| **Android `arm64` APK** | `64.8 MB` | **`56.1 MB`** | **-13.5% smaller** |
| **Spotify Match Rate** | `93.3%` | **`100.0%`** | **0 failures** |
| **Spotify Avg / P95 Speed** | `3.67s` / `10.59s` | **`1.62s` / `3.02s`** | **2.3× – 3.5× faster** |
| **`yt-dlp` Updates** | Manual release every time | **Auto-updates every 24h in background** | **Zero maintenance** |

---

## Repo Layout

```text
crates/
  savewave-core/         # Shared Rust brain (source detection, Spotify v2, SSRF guard, updater)
  savewave-android-jni/  # JNI bridge -> libsavewave_core.so
src-tauri/               # Windows desktop app (Tauri v2 -> NSIS .exe)
android/                 # Native Android app (Kotlin + Jetpack Compose -> APK)
public/                  # Desktop UI (React + Tailwind) & website
scripts/                 # Sidecar & Android Rust build scripts
```

---

## Build Locally

```bash
# Rust core tests
cargo test -p savewave-core

# Windows .exe installer (Tauri v2 + bundled yt-dlp & FFmpeg)
npm install
npm run tauri:build

# Android APK (Rust .so + Kotlin Compose)
npm run android:rust
cd android && ./gradlew assembleRelease
```

---

Made by **Kuber Bassi** · [kuberbassi.com](https://kuberbassi.com/) · MIT License
