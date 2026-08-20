# Release Checklist

Use this checklist for every Savewave release. A release is complete only after the version metadata, changelog, builds, published assets, and update paths have all been checked.

## 1. Update every version location

Use the same `MAJOR.MINOR.PATCH` value in:

- `package.json`
- `package-lock.json` (both root package entries)
- `src-tauri/Cargo.toml`
- the `savewave` package entry in `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- generated `src-tauri/gen/android/app/tauri.properties` (`versionName` and increasing `versionCode`, checked when the local Android project has been initialized)
- `src-tauri/android/savewave-media/src/main/java/com/kuberbassi/savewave/media/SavewaveMediaPlugin.kt`
- `public/config.js` (the web/footer fallback)
- `src/core/platform/android.ts`
- `src/core/platform/web.ts`
- `public/client-version.json`, including every release download and changelog URL
- `CHANGELOG.md`, with user-visible fixes and exact artifact names

Do not edit generated `public/core.js` by hand. `npm run build` regenerates it, and the release check verifies its embedded version.

## 2. Update release-sensitive dependencies

- Check the latest stable yt-dlp release before publishing.
- Update the pinned desktop sidecar version and checksum together.
- Update Android's minimum yt-dlp version when the release depends on a newer extractor.
- Rebuild and verify both platforms because desktop and Android use separate yt-dlp installations.

## 3. Run the mandatory checks

From the repository root in PowerShell:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd test
npm.cmd run check
npm.cmd run prepare:sidecars
Push-Location src-tauri
cargo test --locked
Pop-Location
```

`npm run check` fails if a known version location, changelog entry, generated browser bundle, Android version code, or release URL is stale.

## 4. Test real downloads

- Windows: install the produced `.exe`, launch it, and complete one real video plus audio download.
- Android: install the signed APK over the previous version on a physical ARM64 phone and complete the same download.
- Confirm HTTP 403/429 errors are reported accurately and retry behavior does not corrupt output.
- Confirm the app footer displays the release version on desktop, web, and Android.
- Confirm the update notice points to the newly published asset.

Automated tests reduce mistakes but cannot guarantee every source, network, device, or future YouTube change will work.

## 5. Publish and verify

1. Commit the complete release change.
2. Push the release commit and tag `vMAJOR.MINOR.PATCH`.
3. Wait for Windows Release, Android Release, CI, and Pages workflows to pass.
4. Verify the GitHub release contains the Windows installer, signed Android APK, and both SHA-256 files.
5. Download the public assets and verify their checksums/signatures.
6. Verify `public/client-version.json` is live only after those assets exist.
7. Confirm the GitHub release notes and `CHANGELOG.md` describe the same release.

Record any test that could not be run. Never describe a release as fully verified when a platform or physical-device check was skipped.
