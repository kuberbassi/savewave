package com.kuberbassi.savewave.media

import android.content.ContentValues
import android.app.Activity
import android.os.Environment
import android.provider.MediaStore
import android.system.Os
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLException
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yausername.youtubedl_android.YoutubeDLResponse
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URI
import java.text.Normalizer
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@TauriPlugin
class SavewaveMediaPlugin(private val activity: Activity) : Plugin(activity) {
    companion object {
        private const val TAG = "SavewaveMedia"
        private const val ENGINE_UPDATE_INTERVAL_MS = 24L * 60L * 60L * 1000L
        private const val ENGINE_UPDATE_ATTEMPTS = 2
    }
    private val executor = Executors.newFixedThreadPool(2)
    private val jobs = ConcurrentHashMap<String, JSObject>()
    private val engineReady = CountDownLatch(1)
    private val ffmpegLock = Any()
    @Volatile private var engineInitializing = true
    @Volatile private var ffmpegInitialized = false
    @Volatile private var engineAvailable = false
    @Volatile private var engineVersion: String? = null
    @Volatile private var engineError: String? = null

    override fun load(webView: android.webkit.WebView) {
        executor.execute {
            try {
                YoutubeDL.getInstance().init(activity.application)
                configurePythonTrustStore()
                engineVersion = installedExtractorVersion()
                refreshExtractorIfNeeded()
                engineAvailable = true
                engineVersion = installedExtractorVersion()
            } catch (error: Exception) {
                engineAvailable = false
                engineError = error.message ?: "Engine initialization failed"
            } finally {
                engineInitializing = false
                engineReady.countDown()
            }
        }
    }

    @Command fun getCapabilities(invoke: Invoke) = invoke.resolve(JSObject().apply {
        put("platform", "android"); put("sources", JSObject().apply {
            listOf("youtube", "instagram", "facebook", "threads", "twitter", "direct").forEach { put(it, JSObject().apply { put("media", true); put("video", true); put("audio", true) }) }
            put("soundcloud", JSObject().apply { put("audio", true) })
            put("spotify", JSObject().apply { put("audio", true); put("smartMatch", true) })
            put("unknown", JSObject())
        })
    })

    @Command fun getEngineStatus(invoke: Invoke) = invoke.resolve(JSObject().apply {
        put("available", engineAvailable)
        put("initializing", engineInitializing)
        put("version", "1.0.7")
        put("engineVersion", engineVersion ?: "bundled")
        put("updateAvailable", false)
        engineError?.let { put("error", it) }
    })

    @Command fun resolveMedia(invoke: Invoke) {
        executor.execute {
            try {
                val request = invoke.getArgs().getJSONObject("request")
                val url = validatedUrl(request.getString("url"))
                validateRemoteHost(url)
                requireEngine()
                if (isSpotifyTrack(url)) {
                    invoke.resolve(resolveSpotify(url))
                    return@execute
                }
                if (isInstagramUrl(url)) {
                    resolveInstagramGallery(url)?.let { gallery ->
                        invoke.resolve(JSObject().apply {
                            put("success", true); put("platform", "instagram"); put("title", gallery.title); put("creator", gallery.creator)
                            put("thumbnail", gallery.images.first()); put("type", "image"); put("qualityLabel", "${gallery.images.size} original images"); put("sourceUrl", url)
                        })
                        return@execute
                    }
                }
                val response = executeExtractor(YoutubeDLRequest(url).apply {
                    addOption("--dump-single-json"); addOption("--skip-download"); addOption("--no-playlist")
                    addOption("--no-warnings"); addOption("--socket-timeout", 15); addOption("--retries", 2)
                })
                if (response.exitCode != 0) error(extractionMessage(response.err))
                val info = JSONObject(response.out)
                invoke.resolve(JSObject().apply {
                    put("success", true); put("platform", info.optString("extractor", "web")); put("title", info.optString("title", "Media"))
                    put("creator", info.optString("uploader", "Unknown creator")); put("thumbnail", info.optString("thumbnail").takeIf(String::isNotBlank)); put("duration", info.optDouble("duration").takeUnless(Double::isNaN))
                    put("type", request.optString("mode", "video")); put("qualityLabel", "Best available"); put("sourceUrl", url)
                })
            } catch (error: Exception) {
                Log.e(TAG, "Media resolution failed", error)
                invoke.reject("SOURCE_UNAVAILABLE", error.message ?: "This media is unavailable.")
            }
        }
    }

    @Command fun downloadMedia(invoke: Invoke) {
        val request = try { invoke.getArgs().getJSONObject("request") }
        catch (error: Exception) { Log.e(TAG, "Invalid download request", error); invoke.reject("INVALID_URL", "Unsupported media link."); return }
        val url = try { validatedUrl(request.getString("url")) }
        catch (error: Exception) { Log.e(TAG, "Invalid download URL", error); invoke.reject("INVALID_URL", "Unsupported media link."); return }
        val mode = request.optString("mode", "video")
        val jobId = UUID.randomUUID().toString()
        jobs[jobId] = progress(jobId, "downloading", 0.0)
        invoke.resolve(JSObject().apply { put("jobId", jobId); put("state", "downloading") })
        executor.execute {
            val directory = File(activity.cacheDir, "savewave/$jobId").apply { mkdirs() }
            try {
                validateRemoteHost(url)
                requireEngine()
                if (isInstagramUrl(url)) {
                    resolveInstagramGallery(url)?.let { gallery ->
                        gallery.images.forEachIndexed { index, imageUrl ->
                            if (jobs[jobId]?.optString("state") == "cancelled") return@execute
                            val image = downloadImage(imageUrl, directory, "${safeStem(gallery.title)} (${index + 1}).jpg")
                            saveToMediaStore(image, "image")
                            jobs[jobId] = progress(jobId, "downloading", ((index + 1.0) / gallery.images.size) * 100.0)
                        }
                        jobs[jobId] = progress(jobId, "completed", 100.0).apply { put("filename", "${safeStem(gallery.title)} (${gallery.images.size} images)") }
                        return@execute
                    }
                }
                requireFfmpeg()
                val output = File(directory, "%(title).140B.%(ext)s").absolutePath
                val ytdlp = YoutubeDLRequest(url).apply {
                    addOption("--no-playlist"); addOption("--newline"); addOption("-o", output)
                    if (mode == "audio") { addOption("-f", "bestaudio/best"); addOption("--extract-audio"); addOption("--audio-format", "best") }
                    else { addOption("-f", "bestvideo*+bestaudio/best"); addOption("--merge-output-format", "mp4/mkv") }
                }
                val response = executeExtractor(ytdlp, jobId) { percent: Float, eta: Long, _: String ->
                    if (jobs[jobId]?.optString("state") != "cancelled") {
                        jobs[jobId] = progress(jobId, "downloading", percent.toDouble()).apply { put("eta", eta) }
                    }
                }
                if (response.exitCode != 0) error(extractionMessage(response.err))
                if (jobs[jobId]?.optString("state") == "cancelled") return@execute
                jobs[jobId] = progress(jobId, "processing", 98.0)
                val result = directory.listFiles()?.firstOrNull { it.isFile && !it.name.endsWith(".part") } ?: error("missing output")
                saveToMediaStore(result, mode)
                jobs[jobId] = progress(jobId, "completed", 100.0).apply { put("filename", result.name) }
            } catch (error: Exception) {
                Log.e(TAG, "Media download failed", error)
                if (jobs[jobId]?.optString("state") != "cancelled") {
                    jobs[jobId] = progress(jobId, "error", null).apply {
                        put("errorCode", "DOWNLOAD_FAILED")
                        put("errorMessage", error.message ?: "Download failed")
                    }
                }
            }
            finally { directory.deleteRecursively(); trimFinishedJobs() }
        }
    }

    @Command fun cancelDownload(invoke: Invoke) {
        val id = invoke.getArgs().getString("jobId")
        if (!jobs.containsKey(id)) { invoke.reject("DOWNLOAD_FAILED", "Download failed."); return }
        YoutubeDL.getInstance().destroyProcessById(id); jobs[id] = progress(id, "cancelled", null); trimFinishedJobs(); invoke.resolve()
    }

    @Command fun getDownloadProgress(invoke: Invoke) { val id = invoke.getArgs().getString("jobId"); jobs[id]?.let(invoke::resolve) ?: invoke.reject("DOWNLOAD_FAILED", "Download failed.") }

    private fun validatedUrl(value: String): String {
        val uri = URI(value)
        val host = uri.host ?: throw IllegalArgumentException()
        if (uri.scheme !in listOf("http", "https") || uri.userInfo != null || host.equals("localhost", true)) throw IllegalArgumentException()
        return value
    }

    private fun validateRemoteHost(value: String) {
        val host = URI(value).host ?: throw IllegalArgumentException("Invalid media host")
        if (InetAddress.getAllByName(host).any { address ->
                address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress ||
                    address.isSiteLocalAddress || address.isMulticastAddress
            }) error("Private network media links are unsupported")
    }

    private fun progress(id: String, state: String, percent: Double?) = JSObject().apply { put("jobId", id); put("state", state); if (percent != null) put("percent", percent) }

    private fun requireEngine() {
        if (engineInitializing && !engineReady.await(20, TimeUnit.SECONDS)) error("Engine initialization timed out")
        if (!engineAvailable) error(engineError ?: "The local engine is unavailable")
    }

    private fun refreshExtractorIfNeeded() {
        val preferences = activity.getSharedPreferences("savewave_engine", Activity.MODE_PRIVATE)
        val lastUpdate = preferences.getLong("last_successful_update", 0L)
        val installedVersion = engineVersion ?: installedExtractorVersion()
        val engineIsObsolete = versionAgeDays(installedVersion)?.let { it > 90 } ?: true
        if (!engineIsObsolete && System.currentTimeMillis() - lastUpdate < ENGINE_UPDATE_INTERVAL_MS) return

        val libraryPreferences = activity.getSharedPreferences("youtubedl-android", Activity.MODE_PRIVATE)
        val recordedVersion = libraryPreferences.getString("dlpVersion", null)
        val recordedVersionName = libraryPreferences.getString("dlpVersionName", null)
        var lastError: Exception? = null
        repeat(ENGINE_UPDATE_ATTEMPTS) { attempt ->
            try {
                // youtubedl-android compares only its saved release tag, not the
                // executable on disk. If Android restored preferences but not the
                // downloaded file, it can otherwise keep an obsolete bundled copy.
                libraryPreferences.edit()
                    .remove("dlpVersion")
                    .remove("dlpVersionName")
                    .commit()
                YoutubeDL.getInstance().updateYoutubeDL(activity.application, YoutubeDL.UpdateChannel.STABLE)
                engineVersion = installedExtractorVersion()
                if (versionAgeDays(requireNotNull(engineVersion))?.let { it > 90 } != false) {
                    error("The downloaded media engine is still obsolete")
                }
                preferences.edit().putLong("last_successful_update", System.currentTimeMillis()).apply()
                return
            } catch (error: Exception) {
                lastError = error
                Log.w(TAG, "Extractor update attempt ${attempt + 1} failed", error)
            }
        }
        libraryPreferences.edit().apply {
            if (recordedVersion == null) remove("dlpVersion") else putString("dlpVersion", recordedVersion)
            if (recordedVersionName == null) remove("dlpVersionName") else putString("dlpVersionName", recordedVersionName)
        }.apply()
        if (!engineIsObsolete) {
            Log.w(TAG, "Extractor update unavailable; continuing with recent engine $installedVersion", lastError)
            return
        }
        throw IllegalStateException(
            "The media engine could not be updated. Check your connection and reopen Savewave.",
            lastError
        )
    }

    private fun configurePythonTrustStore() {
        val certificate = File(
            activity.noBackupFilesDir,
            "youtubedl-android/packages/python/usr/etc/tls/cert.pem"
        )
        if (!certificate.isFile || certificate.length() == 0L) {
            error("The Android certificate store is unavailable")
        }
        Os.setenv("SSL_CERT_FILE", certificate.absolutePath, true)
        Os.setenv("REQUESTS_CA_BUNDLE", certificate.absolutePath, true)
    }

    private fun extractionMessage(stderr: String): String {
        val summary = stderr.lineSequence()
            .map(String::trim)
            .lastOrNull { it.startsWith("ERROR:") }
            ?.removePrefix("ERROR:")
            ?.trim()
        return summary?.take(240)?.ifBlank { null } ?: "The source rejected extraction"
    }

    private fun installedExtractorVersion(): String {
        val response = YoutubeDL.getInstance().execute(
            YoutubeDLRequest(emptyList()).apply { addOption("--version") }
        )
        return response.out.lineSequence().map(String::trim).firstOrNull(String::isNotBlank)
            ?: error("The media engine did not report its version")
    }

    private fun versionAgeDays(version: String): Long? {
        val date = Regex("\\d{4}\\.\\d{2}\\.\\d{2}").find(version)?.value ?: return null
        return try {
            ChronoUnit.DAYS.between(LocalDate.parse(date.replace('.', '-')), LocalDate.now())
        } catch (_: Exception) {
            null
        }
    }

    private fun executeExtractor(request: YoutubeDLRequest): YoutubeDLResponse = try {
        YoutubeDL.getInstance().execute(request)
    } catch (error: YoutubeDLException) {
        throw IllegalStateException(extractionMessage(error.message.orEmpty()), error)
    }

    private fun executeExtractor(
        request: YoutubeDLRequest,
        processId: String,
        callback: (Float, Long, String) -> Unit
    ): YoutubeDLResponse = try {
        YoutubeDL.getInstance().execute(request, processId, callback)
    } catch (error: YoutubeDLException) {
        throw IllegalStateException(extractionMessage(error.message.orEmpty()), error)
    }

    private fun requireFfmpeg() {
        if (ffmpegInitialized) return
        synchronized(ffmpegLock) {
            if (!ffmpegInitialized) {
                FFmpeg.getInstance().init(activity.application)
                ffmpegInitialized = true
            }
        }
    }

    private data class SpotifyTrack(val title: String, val artists: List<String>, val thumbnail: String?, val duration: Double?) {
        val artist: String get() = artists.first()
    }
    private data class SearchCandidate(val id: String, val title: String, val artist: String, val uploader: String, val duration: Double?, val verified: Boolean)
    private data class InstagramGallery(val title: String, val creator: String, val images: List<String>)

    private fun isSpotifyTrack(url: String): Boolean {
        val uri = try { URI(url) } catch (_: Exception) { return false }
        return uri.host?.lowercase() == "open.spotify.com" && Regex("^/track/[A-Za-z0-9]{22}/?$").matches(uri.path ?: "")
    }

    private fun isInstagramUrl(url: String): Boolean = try {
        val host = URI(url).host?.lowercase() ?: ""
        host == "instagram.com" || host.endsWith(".instagram.com")
    } catch (_: Exception) { false }

    private fun resolveInstagramGallery(url: String): InstagramGallery? {
        val response = executeExtractor(YoutubeDLRequest(url).apply {
            addOption("--dump-single-json"); addOption("--skip-download"); addOption("--no-warnings"); addOption("--socket-timeout", 12); addOption("--retries", 2)
        })
        val childIds = Regex("\\[Instagram]\\s+([A-Za-z0-9_-]+):\\s+No video formats found")
            .findAll(response.err).map { it.groupValues[1] }.distinct().take(20).toList()
        if (childIds.isEmpty()) return null
        val pages = childIds.map { id -> jpegCandidates(fetchText("https://www.instagram.com/p/$id/embed/captioned/")) }
        val occurrences = pages.flatMap { it.keys }.groupingBy { it }.eachCount()
        val images = pages.map { candidates ->
            candidates.filterKeys { occurrences[it] == 1 }.maxByOrNull { imageQuality(it.value) }?.value
                ?: error("An Instagram carousel item could not be resolved")
        }
        val info = try { JSONObject(response.out) } catch (_: Exception) { JSONObject() }
        val title = info.optString("title", "Instagram post").ifBlank { "Instagram post" }
        val creator = info.optString("uploader", info.optString("channel", "Instagram creator")).ifBlank { "Instagram creator" }
        return InstagramGallery(title, creator, images)
    }

    private fun fetchText(url: String): String {
        val connection = URI(url).toURL().openConnection() as HttpURLConnection
        connection.connectTimeout = 12_000; connection.readTimeout = 20_000
        connection.setRequestProperty("User-Agent", "Mozilla/5.0")
        try {
            if (connection.responseCode !in 200..299) error("Public Instagram media is unavailable")
            return connection.inputStream.bufferedReader().use { it.readText() }
        } finally { connection.disconnect() }
    }

    private fun jpegCandidates(html: String): Map<String, String> {
        val normalizedHtml = html.replace("\\/", "/").replace("\\u0026", "&").replace("&amp;", "&")
        val candidates = linkedMapOf<String, String>()
        Regex("https://[^\\s\\\"'<>]+?\\.jpg(?:\\?[^\\s\\\"'<>]*)?").findAll(normalizedHtml).forEach { match ->
            val value = match.value.trimEnd('\\', ')', ',')
            val parsed = try { URI(value) } catch (_: Exception) { return@forEach }
            val host = parsed.host?.lowercase() ?: return@forEach
            if (!(host == "cdninstagram.com" || host.endsWith(".cdninstagram.com") || host == "fbcdn.net" || host.endsWith(".fbcdn.net"))) return@forEach
            val name = parsed.path.substringAfterLast('/'); if (name.isBlank()) return@forEach
            if (imageQuality(value) > imageQuality(candidates[name] ?: "")) candidates[name] = value
        }
        return candidates
    }

    private fun imageQuality(url: String): Long = Regex("[sp](\\d{2,4})x(\\d{2,4})").findAll(url)
        .mapNotNull { it.groupValues[1].toLongOrNull()?.times(it.groupValues[2].toLongOrNull() ?: return@mapNotNull null) }.maxOrNull() ?: url.length.toLong()

    private fun downloadImage(url: String, directory: File, filename: String): File {
        val parsed = URI(url); val host = parsed.host?.lowercase() ?: error("Invalid image host")
        if (!(host == "cdninstagram.com" || host.endsWith(".cdninstagram.com") || host == "fbcdn.net" || host.endsWith(".fbcdn.net"))) error("Invalid image host")
        val connection = parsed.toURL().openConnection() as HttpURLConnection
        connection.connectTimeout = 12_000; connection.readTimeout = 45_000
        try {
            if (connection.responseCode !in 200..299 || !connection.contentType.orEmpty().startsWith("image/")) error("Image download failed")
            if (connection.contentLengthLong > 50L * 1024 * 1024) error("Image is too large")
            val target = File(directory, filename)
            connection.inputStream.use { input -> target.outputStream().use { output -> input.copyTo(output) } }
            if (target.length() !in 1..(50L * 1024 * 1024)) error("Invalid image download")
            return target
        } finally { connection.disconnect() }
    }

    private fun safeStem(value: String): String = value.replace(Regex("""[<>:"/\\|?*\x00-\x1F]"""), " ")
        .replace(Regex("\\s+"), " ").trim().trimEnd('.', ' ').take(120).ifBlank { "Instagram post" }

    private fun resolveSpotify(url: String): JSObject {
        val track = spotifyMetadata(url)
        val candidates = linkedMapOf<String, SearchCandidate>()
        val queries = listOf(
            "${track.artist} Topic ${track.title}",
            "${track.artist} ${track.title} official audio",
            "${track.artist} ${track.title} topic",
            "${track.title} ${track.artist}"
        )
        var earlyMatch: Pair<SearchCandidate, Int>? = null
        for (query in queries) {
            searchYoutube(query).forEach { candidates.putIfAbsent(it.id, it) }
            val rankedSoFar = candidates.values.map { it to scoreSpotify(track, it) }.sortedByDescending { it.second }
            val leader = rankedSoFar.firstOrNull()
            val runner = rankedSoFar.getOrNull(1)
            if (leader != null && leader.second >= 80) {
                val authoritative = isAuthoritativeOwner(track, leader.first) && normalizedTitle(leader.first.title) == normalizedTitle(track.title) && durationClose(track, leader.first)
                val corroborated = runner != null && corroboratesSameRecording(track, leader.first, runner.first)
                if (authoritative || corroborated) { earlyMatch = leader; break }
            }
        }
        val ranked = candidates.values.map { it to scoreSpotify(track, it) }.sortedByDescending { it.second }
        val best = earlyMatch ?: ranked.firstOrNull() ?: error("No matching public audio was found")
        val runnerUp = ranked.getOrNull(1)
        val decisive = runnerUp == null || best.second - runnerUp.second >= 5
        val authoritativeExact = isAuthoritativeOwner(track, best.first) && normalizedTitle(best.first.title) == normalizedTitle(track.title) && durationClose(track, best.first)
        val corroborated = runnerUp != null && corroboratesSameRecording(track, best.first, runnerUp.first)
        if (best.second < 80 || (!decisive && !authoritativeExact && !corroborated)) error("Could not confidently match this Spotify track")
        return JSObject().apply {
            put("success", true); put("platform", "spotify"); put("title", track.title); put("creator", track.artists.joinToString(", "))
            put("thumbnail", track.thumbnail); put("type", "audio"); put("qualityLabel", "Verified high-confidence match")
            put("sourceUrl", "https://www.youtube.com/watch?v=${best.first.id}")
        }
    }

    private fun spotifyMetadata(url: String): SpotifyTrack {
        val id = URI(url).path.trim('/').substringAfter("track/")
        val endpoint = "https://open.spotify.com/embed/track/$id"
        val connection = URI(endpoint).toURL().openConnection() as HttpURLConnection
        connection.connectTimeout = 8_000; connection.readTimeout = 8_000
        connection.setRequestProperty("User-Agent", "Savewave/1.0")
        try {
            if (connection.responseCode !in 200..299) error("Spotify metadata is unavailable")
            val html = connection.inputStream.bufferedReader().use { it.readText() }
            val encoded = Regex("""(?s)<script[^>]*id=["']__NEXT_DATA__["'][^>]*>(.*?)</script>""").find(html)?.groupValues?.get(1)
                ?: error("Spotify metadata is unavailable")
            val entity = JSONObject(encoded).getJSONObject("props").getJSONObject("pageProps").getJSONObject("state").getJSONObject("data").getJSONObject("entity")
            if (!entity.optBoolean("isPlayable", true)) error("This Spotify track is unavailable")
            val title = entity.optString("title", entity.optString("name")).trim()
            val artistArray = entity.optJSONArray("artists") ?: JSONArray()
            val artists = (0 until artistArray.length()).mapNotNull { artistArray.optJSONObject(it)?.optString("name")?.trim()?.takeIf(String::isNotBlank) }
            if (title.isBlank() || artists.isEmpty()) error("Spotify metadata is incomplete")
            val images = entity.optJSONObject("visualIdentity")?.optJSONArray("image")
            val thumbnail = (0 until (images?.length() ?: 0)).mapNotNull { images?.optJSONObject(it) }
                .maxByOrNull { it.optLong("maxWidth") * it.optLong("maxHeight") }?.optString("url")?.takeIf(String::isNotBlank)
            val duration = entity.optDouble("duration").takeUnless(Double::isNaN)?.div(1000.0)
            return SpotifyTrack(title, artists, thumbnail, duration)
        } finally { connection.disconnect() }
    }

    private fun searchYoutube(query: String): List<SearchCandidate> {
        val request = YoutubeDLRequest("ytsearch20:$query").apply {
            addOption("--dump-single-json"); addOption("--flat-playlist"); addOption("--playlist-end", 20); addOption("--no-warnings"); addOption("--socket-timeout", 12); addOption("--retries", 2)
        }
        val response = executeExtractor(request)
        if (response.exitCode != 0) return emptyList()
        val entries = JSONObject(response.out).optJSONArray("entries") ?: JSONArray()
        return (0 until entries.length()).mapNotNull { index ->
            val item = entries.optJSONObject(index) ?: return@mapNotNull null
            val id = item.optString("id"); val title = item.optString("title")
            if (id.isBlank() || title.isBlank()) return@mapNotNull null
            SearchCandidate(id, title, item.optString("artist"), item.optString("uploader"), item.optDouble("duration").takeUnless(Double::isNaN), item.optBoolean("channel_is_verified"))
        }
    }

    private fun normalized(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKD)
        .lowercase().replace(Regex("\\b(feat(?:uring)?|ft)\\.?\\b"), " ").replace(Regex("[^\\p{L}\\p{N} ]"), " ").replace(Regex("\\s+"), " ").trim()

    private fun normalizedTitle(value: String): String = normalized(value
        .replace(Regex("""(?i)\s*-\s*from\s+[\"“][^\"”]+[\"”]\s*$"""), " ")
        .replace(Regex("""(?i)\s*\(\s*from\s+[\"“][^\"”]+[\"”]\s*\)\s*$"""), " ")
        .replace(Regex("""(?i)\s*\(\s*with\s+[^)]+\)\s*$"""), " "))

    private fun scoreSpotify(track: SpotifyTrack, candidate: SearchCandidate): Int {
        val expectedTitle = normalizedTitle(track.title); val candidateTitle = normalizedTitle(candidate.title)
        val identity = normalized("${candidate.title} ${candidate.artist} ${candidate.uploader}")
        var score = when { candidateTitle == expectedTitle -> 45; candidateTitle.contains(expectedTitle) -> 32; else -> -55 }
        score += if (identity.contains(normalized(track.artist))) 45 else -70
        if (track.artists.size > 1 && track.artists.all { identity.contains(normalized(it)) }) score += 8
        if (track.duration != null && candidate.duration != null) {
            val difference = kotlin.math.abs(track.duration - candidate.duration)
            score += when { difference <= 2 -> 20; difference <= 7 -> 10; difference > 20 -> -70; else -> -30 }
        }
        if (isAuthoritativeOwner(track, candidate)) score += 18
        val unwanted = spotifyVersionMarkers()
        val expectedVersions = unwanted.filter { expectedTitle.contains(it) }
        if (unwanted.any { candidateTitle.contains(it) && it !in expectedVersions }) score -= 70
        return score
    }

    private fun spotifyVersionMarkers() = listOf("remix", "live", "slowed", "sped up", "nightcore", "cover", "karaoke", "instrumental", "reaction", "tutorial", "acoustic", "remastered", "lyrics", "lyric video", "8d", "acapella")

    private fun isAuthoritativeOwner(track: SpotifyTrack, candidate: SearchCandidate): Boolean {
        val owner = normalized(candidate.uploader)
        return track.artists.map(::normalized).any { artist -> owner == artist || owner == "$artist topic" || owner == "$artist vevo" }
    }

    private fun durationClose(track: SpotifyTrack, candidate: SearchCandidate): Boolean =
        track.duration == null || candidate.duration == null || kotlin.math.abs(track.duration - candidate.duration) <= 3

    private fun corroboratesSameRecording(track: SpotifyTrack, first: SearchCandidate, second: SearchCandidate): Boolean {
        val firstOwner = normalized(first.uploader); val secondOwner = normalized(second.uploader)
        if (firstOwner.isBlank() || secondOwner.isBlank() || firstOwner == secondOwner || !durationClose(track, first) || !durationClose(track, second)) return false
        val artists = track.artists.map(::normalized)
        val firstIdentity = normalized("${first.title} ${first.artist}"); val secondIdentity = normalized("${second.title} ${second.artist}")
        val expectedTitle = normalizedTitle(track.title)
        if (!normalizedTitle(first.title).contains(expectedTitle) || !normalizedTitle(second.title).contains(expectedTitle)) return false
        // Composer/producer credits are often absent from otherwise identical
        // YouTube uploads. Require the primary performer on both results; do
        // not require every Spotify credit to be repeated in each title.
        val primaryArtist = artists.firstOrNull() ?: return false
        if (!firstIdentity.contains(primaryArtist) || !secondIdentity.contains(primaryArtist)) return false
        val expected = spotifyVersionMarkers().filter { normalized(track.title).contains(it) }
        return spotifyVersionMarkers().none { marker -> marker !in expected && (normalized(first.title).contains(marker) || normalized(second.title).contains(marker)) }
    }

    private fun trimFinishedJobs() {
        if (jobs.size <= 64) return
        jobs.entries.asSequence()
            .filter { it.value.optString("state") in setOf("completed", "cancelled", "error") }
            .take(jobs.size - 48)
            .forEach { jobs.remove(it.key, it.value) }
    }

    override fun onDestroy(activity: AppCompatActivity) {
        jobs.forEach { (id, state) ->
            if (state.optString("state") in setOf("downloading", "processing")) {
                YoutubeDL.getInstance().destroyProcessById(id)
            }
        }
        executor.shutdownNow()
        File(activity.cacheDir, "savewave").deleteRecursively()
        jobs.clear()
    }

    private fun saveToMediaStore(file: File, mode: String) {
        val resolver = activity.contentResolver
        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, file.name)
            put(MediaStore.Downloads.MIME_TYPE, mediaMimeType(file, mode))
            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Savewave")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(collection, values) ?: error("MediaStore insert failed")
        try { resolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } } ?: error("MediaStore output failed"); values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0); resolver.update(uri, values, null, null) }
        catch (error: Exception) { resolver.delete(uri, null, null); throw error }
    }

    private fun mediaMimeType(file: File, mode: String): String = when (file.extension.lowercase()) {
        "opus" -> "audio/ogg"
        "ogg", "oga" -> "audio/ogg"
        "m4a", "mp4" -> if (mode == "audio") "audio/mp4" else "video/mp4"
        "mp3" -> "audio/mpeg"
        "wav" -> "audio/wav"
        "flac" -> "audio/flac"
        "aac" -> "audio/aac"
        "webm" -> if (mode == "audio") "audio/webm" else "video/webm"
        "mkv" -> "video/x-matroska"
        "mov" -> "video/quicktime"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        else -> if (mode == "audio") "audio/*" else if (mode == "image") "image/*" else "video/*"
    }
}
