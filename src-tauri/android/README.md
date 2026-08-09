# Android integration

The `savewave-media` Kotlin adapter targets Android 10+ (API 29) so it can use scoped `MediaStore.Downloads` without broad storage permission. It initializes `youtubedl-android` away from the UI thread and lazily initializes FFmpeg on the first applicable save. It reports normalized jobs, supports process-ID cancellation, performs conservative Spotify matching, saves ordered Instagram image carousels, rejects private-network destinations, and cleans app-cache intermediates in `finally`.

After installing the supported Tauri Android prerequisites, run `npm run tauri android init`, include this Android library in the generated Gradle project, and register `SavewaveMediaPlugin`. Build with `npm run tauri android build -- --apk` or `--aab`.

Release signing requires environment-provided keystore path, alias and passwords. Never commit the keystore or credentials. `versionCode` and `versionName` belong in the generated Android app Gradle configuration. Debug APK compilation and lint are verified locally with the Android Studio JDK; public distribution still requires a private release keystore and physical-device release testing.
