# Release Checklist

Use this checklist for every Savewave release. A release is complete only after the version metadata, changelog, builds, published assets, and update paths have all been checked.

For the normal one-click release, first write a `## Unreleased - short summary` section with at least one bullet in `CHANGELOG.md`. Commit and push any unrelated work separately. Then double-click `release-next.cmd` (or run `powershell -ExecutionPolicy Bypass -File scripts/release.ps1`). The command calculates the next patch version, updates every active version field, builds and tests both clients, commits, publishes the tag, waits for both installer workflows and four assets, pushes `main` only after the assets exist, then checks CI and Pages. Use `scripts/release.ps1 -CheckOnly` to check the changelog without changing anything or `-Version 1.1.0` for an explicit version. It never stages unrelated untracked files. If it stops, read its error before retrying; a tag may already exist.

## 1. Update every version location

Use the same `MAJOR.MINOR.PATCH` value in:

- `package.json`
- `package-lock.json` (both root package entries)
- `android/app/build.gradle` (`versionName` and monotonically increasing `versionCode`)
- `android/app/src/main/java/com/kuberbassi/savewave/SavewaveMediaPlugin.java`
- `public/config.js` (the web/footer fallback)
- `src/desktop/main.ts`
- `src/core/platform/web.ts`
- `public/client-version.json`, including every release download and changelog URL
- `CHANGELOG.md`, with user-visible fixes and exact artifact names

Do not edit generated `public/core.js` by hand. `npm run build` regenerates it, and the release check verifies its embedded version.

## 2. Update release-sensitive dependencies

- Check the latest stable yt-dlp release before publishing.
- Update the pinned desktop sidecar version and checksum together.
- Review the separately bundled Android engine when the release depends on a newer extractor.
- Rebuild and verify both platforms because desktop and Android use separate yt-dlp installations.

## 3. Run the mandatory checks

From the repository root in PowerShell:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd test
npm.cmd run check
npm.cmd run build:electron
npm.cmd run capacitor:sync
npm.cmd run prepare:sidecars
npm.cmd run electron:pack -- --publish never
Push-Location android
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
Pop-Location
```

`npm run check` fails if a known version location, changelog entry, generated browser bundle, Android version code, or release URL is stale.

## 4. Test installed clients

Complete [the installed-client matrix](MANUAL_TEST_MATRIX.md), including a real public Instagram Reel download and rejection of Instagram posts, Facebook, and X/Twitter links on both installed clients.

Locally rebuilt installers and debug APKs with the same version as a published release can validate a feature, but are not auto-update or signed in-place-upgrade evidence. Never replace an already-published asset with a different binary at the same version. The release command changes every version location after the owner writes `CHANGELOG.md`; record any manual matrix rows that were skipped.

- Windows: install the produced `.exe`, launch it, and complete one real video plus audio download.
- Android: install the signed APK over the previous version on a physical ARM64 phone and complete the same download.
- Confirm HTTP 403/429 errors are reported accurately and retry behavior does not corrupt output.
- Confirm the app footer displays the release version on desktop, web, and Android.
- Confirm Windows automatically downloads the versioned GitHub release installer, verifies its checksum, installs over the existing build, and reopens with data preserved. Test from an older installed version.
- Confirm Android opens the signed APK and the system installer upgrades it in place with data preserved. Silent Android installation is not expected.

Automated tests reduce mistakes but cannot guarantee every source, network, device, or future YouTube change will work.

## 5. Publish and verify

1. Commit the complete release change.
2. Push the tag `vMAJOR.MINOR.PATCH` to build and publish both platform assets.
3. Verify both release workflows and all four assets, then push `main` so Pages publishes a manifest with working links. Wait for CI and Pages.
4. Verify the GitHub release contains the Windows installer, signed Android APK, and both SHA-256 files.
5. Download the public assets and verify their checksums/signatures.
6. Verify `public/client-version.json` is live only after those assets exist.
7. Confirm the GitHub release notes and `CHANGELOG.md` describe the same release.

Record any test that could not be run. Never describe a release as fully verified when a platform or physical-device check was skipped.
