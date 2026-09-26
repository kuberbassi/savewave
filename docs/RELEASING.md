# Release Guide

Follow the complete [release checklist](RELEASE_CHECKLIST.md) for every version. It is the source of truth for version files, platform checks, artifacts, and post-publication verification.

## Required checks

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run build:electron
npm.cmd run capacitor:sync
npm.cmd run electron:pack -- --publish never
```

## Windows

Build the NSIS installer:

```powershell
npm.cmd run electron:pack -- --publish never
```

The resulting setup file contains Savewave plus private yt-dlp and FFmpeg application dependencies. End users install one setup file and should not manage sidecars themselves.

Tagged releases are automated by `.github/workflows/release.yml`: a `vMAJOR.MINOR.PATCH` tag runs all checks, builds the Electron NSIS installer, creates a SHA-256 checksum, and attaches both to GitHub Releases. The tag and all version locations in the release checklist must match.

Production distribution requires an Authenticode code-signing certificate. Unsigned builds may trigger Windows SmartScreen even when their checksum and source are valid.

## Release notification

1. Build, test, checksum, and publish the Windows installer on GitHub Releases.
2. Confirm the public asset downloads successfully.
3. Update `public/client-version.json` only after confirming both versioned release assets and the Windows checksum are public.
4. Deploy the website. Older desktop clients will automatically stage and launch the verified one-click installer on startup. A failure leaves the old app usable. Android offers the APK and requires a system install confirmation.

The manifest must never be updated before its installers exist. The Windows updater accepts only the expected versioned GitHub asset path and a matching published SHA-256 file. This guards against transfer corruption but is not equivalent to an Authenticode publisher signature; unsigned installers may still trigger Windows SmartScreen. Keep the GitHub repository and release workflow protected.

## Android

Android requires Java 17+, Android command-line tools, the SDK, Capacitor sync, and physical-device validation. APK signing credentials must be supplied through environment variables or CI secrets.

Android reads the same `public/client-version.json` manifest through its native bridge. The APK link must point to the expected HTTPS GitHub release asset. Publish and verify the signed APK before increasing the manifest version. Android does not permit an ordinary sideloaded app to silently replace itself; the user must confirm installation in the system UI.

Users install an update by opening the newer APK over the existing app. Android preserves app data when the application ID and signing key are unchanged and the new APK has a higher `versionCode`; uninstalling first is neither required nor recommended.

The `Android Release` GitHub workflow builds an ARM64 release APK on a release tag or manual run only when these repository secrets exist: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD`, and `ANDROID_KEY_PASSWORD`.

Generate the keystore once, keep two offline backups, and never replace it: future upgrades must be signed by the same key. The workflow decodes it only into the temporary runner directory, injects signing through environment variables, verifies the APK signature, creates a SHA-256 checksum, and uploads both artifacts. A tag also publishes them to GitHub Releases; a manual workflow run only preserves artifacts.

### Create the Android signing secrets on Windows

The four values are created by the project owner; they are not issued by GitHub, Google, or Spotify. Run this once in PowerShell. Choose strong unique passwords and save them in a password manager.

```powershell
$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
& $keytool -genkeypair -v -keystore "$env:USERPROFILE\Savewave-release.jks" -alias savewave -keyalg RSA -keysize 4096 -validity 10000
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\Savewave-release.jks")) | Set-Clipboard
```

Add the following under **GitHub repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Paste the Base64 text placed on the clipboard by the second command. |
| `ANDROID_KEY_ALIAS` | `savewave` (or the alias supplied to `-alias`). |
| `ANDROID_STORE_PASSWORD` | The keystore password entered during generation. |
| `ANDROID_KEY_PASSWORD` | The key password entered during generation; it may be the same, but a distinct password is preferable. |

Store the `.jks` file and passwords in at least two secure offline locations. Never commit the keystore, Base64 text, or passwords. Losing the key prevents existing Android installations from accepting future upgrades; exposing it allows someone else to sign a malicious update as Savewave.

After adding all four secrets, rerun **Actions → Android Release → Run workflow** for the release tag. Verify the resulting APK signature and checksum before linking it publicly.

Do not advertise an Android release until resolve, download, progress, cancellation, MediaStore saving, upgrade, and uninstall behavior have passed on real devices.
