# Savewave Maintenance Guide

Simple guide for tracking `yt-dlp` updates, diagnosing broken extractors, and releasing updated Savewave builds.

---

## 1. Tracking yt-dlp Updates

Platform changes (YouTube, Instagram, Facebook, X) occur frequently. Track upstream fixes using:

1. **GitHub Release Watch** *(Active)*:
   - Keep watching the [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) repository (**Watch** → **Custom** → **Releases**).
2. **Automated CI Tests**:
   - Integration tests (`npm test`) run on GitHub Actions to detect extractor failures.
3. **Dependabot**:
   - Automatic PRs when `yt-dlp-exec` updates in `package.json`.

---

## 2. Diagnosing Broken Links

When a link fails to resolve or download:

```bash
# Test the link locally with verbose output
npx yt-dlp --verbose "https://example.com/video-link"
```

Check logs for common causes:
- **Bot Detection**: `confirm you're not a bot`
- **JS Signature Error**: `n-sig` extraction failed (requires `yt-dlp` update)
- **Restricted Content**: `private video`, `login required`, or `age restricted`

---

## 3. Updating Savewave Builds

When `yt-dlp` releases a fix:

### Windows Build
```bash
# 1. Download latest sidecar binaries
npm run prepare:sidecars

# 2. Run quality checks
npm run check

# 3. Build installer
npm run tauri:build
```

### Android Build
```bash
# Build updated APK
npm run tauri:build -- --target aarch64-linux-android
```
