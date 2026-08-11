# Savewave Architecture

## Product boundary

Savewave has two deliberately separate surfaces:

- The GitHub Pages website is a lightweight installation and product-information page.
- Installed Tauri applications contain the Paste -> Resolve -> Preview -> Save workflow and execute media work locally.

No extraction request is routed through the website. Savewave has no account system, remote user database, media proxy, or cloud media storage.

## Layers

```text
React interface
    |
Shared TypeScript core
    |-- source detection
    |-- capability model
    |-- media/error/progress contracts
    |-- quality and filename policy
    |-- Spotify normalization and scoring
    |-- bounded on-device history
    |
Platform MediaEngine adapter
    |-- Desktop: Tauri invoke
    `-- Android: Tauri mobile plugin invoke
            |
Native execution
    |-- Rust desktop commands + managed sidecars
    `-- Kotlin Android engine + MediaStore
```

The UI never constructs shell commands or directly accesses native filesystems. All native operations use the `MediaEngine` contract in `src/core/platform/types.ts`.

## Desktop lifecycle

1. Tauri loads `public/native.html` and the shared application bundle.
2. The app checks its bundled yt-dlp engine.
3. In parallel, it requests the small HTTPS `client-version.json` manifest. Failure is non-blocking; a newer valid semantic version shows explicit download and changelog actions.
4. Source detection and capability checks run locally.
5. Rust validates the HTTP(S) URL and invokes yt-dlp with structured arguments.
6. Metadata is normalized for the preview.
7. A job-scoped process downloads the selected streams to isolated temporary storage.
8. FFmpeg merges or remuxes only when required.
9. The completed file moves to the OS Downloads directory.
10. Bounded history metadata is stored inside the local application WebView database.

Cancellation kills only the selected job and cleans its temporary directory.

## Android lifecycle and resource policy

1. The Android activity applies system-bar insets and uses the same charcoal system chrome as the app.
2. The bundled extractor initializes asynchronously once for the activity; resolve and save jobs wait on a bounded readiness latch, while FFmpeg initializes lazily on the first save that needs it. Extraction uses a fixed two-thread executor rather than an unbounded pool.
3. The release manifest is fetched once per fresh launch with an eight-second timeout and the same HTTPS host allowlist as desktop.
4. An immediate startup shell prevents a blank frame, off-screen sections use deferred rendering, UI polling slows while the app is backgrounded, and decorative animations pause completely.
5. Only an explicit Resolve or Save action starts extraction. Savewave declares no background-service, wake-lock, boot, broad-storage, accessibility, overlay, contact, location, microphone, or camera permission.
6. Destroying the activity cancels active extractor processes, stops executor work, clears temporary job files, and releases bounded in-memory job state.
7. Completed files are published through scoped `MediaStore` into `Downloads/Savewave` with an extension-appropriate MIME type.

Android intentionally does not run a permanent resident service. A download can continue while the activity remains alive, but the app does not attempt to keep itself awake indefinitely after Android destroys it.

## Security boundaries

- Raw user input is never interpolated into a command string.
- Only bundled yt-dlp and FFmpeg sidecars may execute.
- External UI links are restricted to an explicit HTTPS host allowlist.
- `file:`, `data:`, `javascript:`, credential-bearing, localhost, loopback, and `.local` targets are rejected.
- Android additionally resolves destinations before extraction and rejects unspecified, loopback, link-local, site-local, and multicast addresses.
- Private, authenticated, cookie-only, paid, and DRM-protected media is outside the product boundary.
- Release-manifest links must use HTTPS and are restricted to the Savewave website or GitHub before being returned to the UI.
- Update checks are notification-only; Savewave never silently downloads or executes an installer or APK.

## Maintenance

Normal maintenance should consist mainly of yt-dlp compatibility updates, Tauri updates, Android SDK updates, and release signing. Provider-specific extraction logic should remain in yt-dlp rather than being duplicated in Savewave.
