# Release Guide

## Required checks

```bash
npm ci
npm run lint
npm test
npm run build
npm run prepare:sidecars
cd src-tauri
cargo test --locked
```

## Windows

Build the NSIS installer:

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npx.cmd tauri build --bundles nsis
```

The resulting setup file contains Savewave plus private yt-dlp and FFmpeg application dependencies. End users install one setup file and should not manage sidecars themselves.

Tagged releases are automated by `.github/workflows/release.yml`: a `vMAJOR.MINOR.PATCH` tag runs all checks, builds the NSIS installer, creates a SHA-256 checksum, and attaches both to GitHub Releases. The tag, `package.json`, `src-tauri/tauri.conf.json`, and `public/client-version.json` versions must match.

Production distribution requires an Authenticode code-signing certificate. Unsigned builds may trigger Windows SmartScreen even when their checksum and source are valid.

## Release notification

1. Build, test, checksum, and publish the Windows installer on GitHub Releases.
2. Confirm the public asset downloads successfully.
3. Update `public/client-version.json` with the new semantic version and HTTPS installer/changelog links.
4. Deploy the website. Older desktop and Android clients will show the update notice on each fresh launch until updated.

The manifest is notification-only and must never be updated before its installer exists. Savewave does not silently download or execute updates. If automatic installation is added later, use Tauri's signed updater with a protected CI private key and a matching embedded public key; never commit signing secrets.

## Android

Android requires Java 17+, Android command-line tools, the SDK/NDK, Rust Android targets, Tauri Android initialization, plugin registration, and physical-device validation. APK/AAB signing credentials must be supplied through environment variables or CI secrets.

Android uses the same notification-only `public/client-version.json` manifest as desktop, fetched from the repository's raw `main` branch. Release links are accepted only over HTTPS from the Savewave site or GitHub. Publish and verify the signed APK/AAB before increasing the manifest version.

Users install an update by opening the newer APK over the existing app. Android preserves app data when the application ID and signing key are unchanged and the new APK has a higher `versionCode`; uninstalling first is neither required nor recommended.

The manual `Android Release` GitHub workflow builds an ARM64 release APK only when these repository secrets exist: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_STORE_PASSWORD`, and `ANDROID_KEY_PASSWORD`.

Generate the keystore once, keep two offline backups, and never replace it: future upgrades must be signed by the same key. The workflow decodes it only into the temporary runner directory, injects signing through environment variables, verifies the APK signature, creates a SHA-256 checksum, and uploads both artifacts. Publishing remains a separate deliberate step.

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
