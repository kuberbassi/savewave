# Installed-client manual test matrix

Run this matrix on the packaged Windows installer and an installed ARM64 Android APK before removing the Tauri rollback implementation or publishing a release. Record the date, device/OS, app version, engine version, URL category, result, and a redacted diagnostic export for every failure. Never put private links, cookies, tokens, usernames, or full local paths in the record.

## Unsupported-source honesty

On both installed clients, paste one Instagram post, one Instagram Reel, one Facebook media link, and one X photo or video link. Each must be labelled unavailable, must not start extraction or download, and must not appear in the supported-source grid. Existing direct media links from unrelated hosts must still work.

Use public content you are authorized to save for the remaining provider checks.

## Provider parity

On both Windows and Android, test one public representative URL for YouTube video, YouTube audio, Threads, SoundCloud, direct media, and Spotify. For each source verify Resolve, Preview, Save, progress, cancellation, filename, Downloads visibility, and a useful error for an unavailable URL. Play every saved audio/video and open every saved image.

Spotify additionally requires:

- an obvious exact match;
- a track with multiple credited artists;
- remix/live/acoustic/version conflicts;
- a near tie that opens the two-option chooser and does not download before selection;
- remembered choice reuse only when that source remains an eligible option.

## Lifecycle and upgrades

- Launch cold, minimize/restore, rotate Android, resize Windows, navigate tabs during idle work, and close during an active job.
- Confirm cancellation affects only its own job.
- Install over the previous public version and confirm settings/history behavior matches release notes.
- Confirm uninstall removes application state but does not delete completed Downloads.
- Verify update and changelog links open only the expected Savewave/GitHub HTTPS pages.
- Check keyboard-only chooser/modal operation, visible focus, screen-reader labels, progress announcements, reduced motion, and narrow Android layout.

## Release decision

Do not mark a row passed from a build, unit test, mocked response, or source inspection. A failed mandatory row blocks release. If an upstream provider is temporarily unavailable, record it as `BLOCKED - UPSTREAM`, rerun later, and do not relabel it as passed.
