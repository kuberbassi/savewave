# Savewave Quality Baseline

This document records what the quality sprint proves and what still requires packaged or installed-product evidence. Update it when a gate, supported platform, or provider claim changes.

## September 26 code-quality review

The maintained core is substantially better than a throwaway AI-generated prototype: it has explicit platform contracts, URL/input validation, bounded download jobs, a shared Spotify matcher, and a deterministic lint/typecheck/test gate. The 16-suite, 128-test gate exercised the current shared logic after this update. That is evidence of discipline, not proof that every provider or installed client works.

The main maintainability liabilities are still real: the legacy Tauri/Rust/Kotlin rollback tree remains beside Electron/Capacitor; `public/app.jsx` and the Android media plugin are large multi-responsibility files; provider behavior depends on external sites; and deterministic tests cannot prove installed upgrades. The old Windows release workflow and README still described Tauri even though Electron was the intended release client. This sprint corrected that release-path drift, brought native Android update checking online, added checksum-verified Windows update staging and URL tests, and refreshed the user/release documentation. The rollback tree has not been deleted because installed upgrade and parity evidence is still a release gate.

Do not call the product "flawless" or "fully verified" until a v1.0.12-to-v1.0.13 Windows installer upgrade, a same-key Android APK upgrade, saved-output checks, and representative live provider transfers pass on installed clients. Simplicity here means one authoritative shared policy layer and small native adapters, not chasing a file-count metric or deleting rollback code before proof.

## Product scope

- Primary clients: Windows desktop and Android APK.
- Shared product language: TypeScript.
- Target shells: Electron on Windows and Capacitor on Android.
- Android-native boundary: engine initialization/execution, process cancellation, lifecycle, and MediaStore publication only.
- Website: installation and product information; it is not a remote media proxy.

## Deterministic local gates

Run from the repository root on Windows:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:coverage
npm.cmd run build
npm.cmd run check:release
npm.cmd run build:electron
npm.cmd run capacitor:sync
cargo test --manifest-path src-tauri\Cargo.toml
cd android
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

Android Gradle Plugin 8 requires Java 11 or newer. If Windows resolves an older system Java, set `JAVA_HOME` to Android Studio's bundled `jbr` and `ANDROID_HOME` to the installed Android SDK for that terminal before running Gradle. Do not downgrade Android tooling to accommodate Java 8.

`npm.cmd run check` combines the TypeScript check, lint, JavaScript/TypeScript tests, production web build, and release-version consistency. Rust remains a transitional gate until Tauri is removed.

Use `npm.cmd run check:fast` while editing. The complete `npm.cmd run check` additionally enforces risk-focused coverage thresholds and verifies that committed browser assets were already regenerated. Native packaging and installed-client checks remain separate because they require platform toolchains or physical devices.

## Platform gates

- Windows: prepare sidecars, build the packaged application, and run representative resolve/download/cancel/save scenarios from the installed package.
- Android: compile/package the APK in pull-request CI, then run representative resolve/download/cancel/MediaStore/lifecycle scenarios on an installed APK before release.
- Provider live tests remain separate from deterministic CI because upstream outages and markup changes are not deterministic source failures.

## Current deterministic baseline

Verified locally on 2026-09-21:

- `npm.cmd run check` passed: TypeScript typecheck, ESLint, 12 Vitest files / 108 behavior-focused tests, risk-focused coverage thresholds, fresh generated browser assets, production web build, and release consistency.
- High-risk shared-core coverage measured 88.07% lines, 88.88% functions, 78.6% statements, and 67.55% branches; enforced minima are 75% lines/functions/statements and 65% branches.
- Release metadata remains synchronized at `1.0.12` / Android version code `1000012`.
- Rust compatibility tests passed: 16 passed and 2 provider-live tests ignored.
- The transitional Kotlin media module compiled successfully.
- The Electron main/preload production build and NSIS packaging passed. Development and packaged runtime smoke checks found the bundled engines; the packaged process exited successfully.
- Capacitor sync passed. The functional native media bridge passed four focused unit tests and Android lint, and the generated project assembled three ABI-specific debug APKs successfully: about 68 MB arm64, 61 MB ARMv7, and 71 MB x86_64 instead of a roughly 213 MB universal APK.
- The production-only npm dependency audit reported zero vulnerabilities.
- Full npm audit still reports a development-only moderate advisory inherited through Capacitor CLI -> `xcode` -> `uuid`; the suggested automatic remediation is a forced CLI downgrade and has not been applied without compatibility validation.

No Android device or emulator was attached during Sprint 2. These results prove deterministic builds, native bridge compilation, and desktop engine availability—not installed Android or live-provider parity.

## Time-sensitive live evidence

- 2026-09-21: a three-track Spotify fixture probe produced three automatic matches with shared-core parity, averaging about 3.1 seconds. The sample has no labelled expected YouTube recording, so correctness and wrong-match rate remain explicitly unverified.
- 2026-09-21: the Capacitor APK builds with the shared TypeScript Spotify pipeline and a bounded native generic-search transport. No installed Android runtime was available, so native HTTP compatibility with Spotify/YouTube Music remains pending.
- 2026-09-21: the obsolete server-only Spotify scoring stack and its implementation-coupled tests were removed. The remaining shared matcher suite tests externally meaningful acceptance, rejection, authority, ambiguity, and identity behavior used by both primary clients.
- 2026-09-21: Electron IPC and Capacitor responses gained shared runtime contracts for commands, resolved media, jobs, progress, capabilities, engine state, and release information. This is deterministic boundary validation, not installed-client proof.
- 2026-09-21: the Android Instagram path stopped forcing `--no-playlist`. Shared policy permits at most 20 Instagram items, ordered output names are retained, every completed Android output is published, and other providers remain single-item. Android unit/lint/APK gates pass; public post/Reel/carousel transfers still require the manual installed-device matrix.

## Provider evidence matrix

| Source | Deterministic fixtures | Packaged Windows | Installed Android | Notes |
| --- | --- | --- | --- | --- |
| YouTube | Existing resolver/argument coverage | Pending refresh | Pending refresh | Video, audio, Shorts; no playlist expansion |
| Instagram | Disabled in current product scope | Disabled | Disabled | Recognize links only to reject clearly |
| Facebook | Disabled in current product scope | Disabled | Disabled | Recognize links only to reject clearly |
| Threads | Existing resolver coverage | Pending refresh | Pending refresh | Public media only |
| X/Twitter | Disabled in current product scope | Disabled | Disabled | Recognize links only to reject clearly |
| SoundCloud | Existing resolver coverage | Pending refresh | Pending refresh | Public audio only |
| Spotify | Matcher fixtures and playlist benchmark | Pending live refresh | Pending parity refresh | External-source Smart Match; no Spotify audio extraction |
| Direct media | Existing resolver/security coverage | Pending refresh | Pending refresh | Public HTTP(S) media only |

“Pending” is not a passing result. Update a cell only with dated packaged/installed evidence.
