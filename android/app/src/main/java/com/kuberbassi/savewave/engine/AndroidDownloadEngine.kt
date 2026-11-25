package com.kuberbassi.savewave.engine

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import com.kuberbassi.savewave.bridge.ResolvedMedia
import com.kuberbassi.savewave.bridge.SavewaveRustBridge
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.util.UUID

data class EngineInitState(
    val ready: Boolean = false,
    val initializing: Boolean = true,
    val version: String = "bundled",
    val error: String? = null,
)

class AndroidDownloadEngine(private val context: Context) {
    @Volatile
    private var activeProcessId: String? = null

    fun instagramCookieFile(): File = File(context.filesDir, "instagram-session.txt")

    suspend fun initialize(): EngineInitState = withContext(Dispatchers.IO) {
        try {
            YoutubeDL.getInstance().init(context.applicationContext)
            runCatching { FFmpeg.getInstance().init(context.applicationContext) }
            // Silently auto-update yt-dlp at most once every 24h without blocking startup
            val prefs = context.getSharedPreferences("savewave_engine", Context.MODE_PRIVATE)
            val lastCheck = prefs.getLong("last_ytdlp_update_ms", 0L)
            val now = System.currentTimeMillis()
            if (now - lastCheck > 86_400_000L) {
                prefs.edit().putLong("last_ytdlp_update_ms", now).apply()
                Thread {
                    runCatching { YoutubeDL.getInstance().updateYoutubeDL(context.applicationContext) }
                }.start()
            }
            val ver = runCatching {
                YoutubeDL.getInstance().version(context.applicationContext) ?: "bundled"
            }.getOrDefault("bundled")
            EngineInitState(ready = true, initializing = false, version = ver)
        } catch (e: Exception) {
            EngineInitState(
                ready = false,
                initializing = false,
                error = e.message ?: "Engine initialization failed",
            )
        }
    }

    suspend fun updateEngineBinary(): String = withContext(Dispatchers.IO) {
        val status = YoutubeDL.getInstance().updateYoutubeDL(context.applicationContext)
        status?.name ?: "ALREADY_UP_TO_DATE"
    }

    suspend fun resolveMedia(rawUrl: String, mode: String): Result<ResolvedMedia> =
        withContext(Dispatchers.IO) {
            val detected = SavewaveRustBridge.detectSource(rawUrl)
            if (detected.unavailable) {
                return@withContext Result.failure(IllegalStateException("UNSUPPORTED_SOURCE:This source is not currently supported by Savewave."))
            }
            val validated = SavewaveRustBridge.validateUrl(rawUrl)
            if (validated.isFailure) {
                return@withContext Result.failure(validated.exceptionOrNull()!!)
            }
            val url = detected.canonicalUrl

            // Spotify is resolved 100% natively in Rust (savewave-core)!
            if (detected.source == "spotify") {
                return@withContext SavewaveRustBridge.resolveSpotify(url)
            }

            if (detected.source == "direct") {
                val filename = url.substringAfterLast('/').substringBefore('?').ifBlank { "direct-media" }
                val lower = filename.lowercase()
                val type = when {
                    lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") -> "image"
                    lower.endsWith(".mp3") || lower.endsWith(".m4a") || lower.endsWith(".wav") || lower.endsWith(".flac") -> "audio"
                    else -> "video"
                }
                return@withContext Result.success(
                    ResolvedMedia(
                        platform = "direct",
                        title = SavewaveRustBridge.sanitizeFilename(filename),
                        creator = "Direct Link",
                        thumbnail = if (type == "image") url else null,
                        duration = null,
                        mediaType = type,
                        qualityLabel = "Original direct file",
                        sourceUrl = url,
                    )
                )
            }

            try {
                val req = YoutubeDLRequest(url).apply {
                    addOption("--dump-single-json")
                    addOption("--no-warnings")
                    addOption("--no-playlist")
                    addOption("--skip-download")
                    addOption("--socket-timeout", "15")
                    addOption("--force-ipv4")
                    if (detected.source == "instagram" && instagramCookieFile().exists()) {
                        addOption("--cookies", instagramCookieFile().absolutePath)
                    }
                }
                val resp = YoutubeDL.getInstance().execute(req)
                val info = JSONObject(resp.out)
                val title = info.optString("title", "Untitled media").trim()
                val creator = info.optString("uploader")
                    .ifBlank { info.optString("channel") }
                    .ifBlank { info.optString("artist") }
                    .ifBlank { detected.source }
                val thumbnail = info.optString("thumbnail").takeIf { it.isNotBlank() && it != "null" }
                val duration = if (info.has("duration") && !info.isNull("duration")) info.optDouble("duration").toLong() else null
                val height = info.optInt("height", 0)
                val quality = if (mode == "audio") {
                    "Best available audio"
                } else if (height > 0) {
                    "Up to ${height}p (Auto Best)"
                } else {
                    "Best available quality"
                }

                Result.success(
                    ResolvedMedia(
                        platform = detected.source,
                        title = title,
                        creator = creator,
                        thumbnail = thumbnail,
                        duration = duration,
                        mediaType = mode,
                        qualityLabel = quality,
                        sourceUrl = url,
                    )
                )
            } catch (e: Exception) {
                val classified = SavewaveRustBridge.classifyError(e.message ?: "")
                if (detected.source == "instagram" &&
                    (classified.code == "AUTH_REQUIRED" || classified.code == "SOURCE_FORBIDDEN")
                ) {
                    instagramCookieFile().delete()
                }
                Result.failure(IllegalStateException("${classified.code}:${classified.message}"))
            }
        }

    suspend fun downloadMedia(
        media: ResolvedMedia,
        mode: String,
        onProgress: (Float) -> Unit,
    ): Result<String> = withContext(Dispatchers.IO) {
        val jobId = UUID.randomUUID().toString()
        activeProcessId = jobId
        val tempDir = File(context.cacheDir, "savewave/$jobId").apply { mkdirs() }
        try {
            if (media.platform == "direct") {
                val urlName = media.sourceUrl.substringAfterLast('/').substringBefore('?').ifBlank { "direct-media.bin" }
                val safeName = SavewaveRustBridge.sanitizeFilename(urlName)
                val outFile = File(tempDir, safeName)
                val conn = (java.net.URL(media.sourceUrl).openConnection() as java.net.HttpURLConnection).apply {
                    connectTimeout = 15_000
                    readTimeout = 60_000
                    setRequestProperty("User-Agent", "Savewave/2.0")
                }
                try {
                    if (conn.responseCode !in 200..299) {
                        return@withContext Result.failure(IllegalStateException("DOWNLOAD_FAILED:HTTP ${conn.responseCode}"))
                    }
                    val total = conn.contentLengthLong
                    conn.inputStream.use { input ->
                        outFile.outputStream().use { output ->
                            val buf = ByteArray(16 * 1024)
                            var copied = 0L
                            var read: Int
                            while (input.read(buf).also { read = it } != -1) {
                                output.write(buf, 0, read)
                                copied += read
                                if (total > 0) {
                                    onProgress(((copied * 100f) / total).coerceIn(0f, 99f))
                                }
                            }
                        }
                    }
                } finally {
                    conn.disconnect()
                }
                onProgress(100f)
                val publishedName = publishToDownloads(outFile)
                return@withContext Result.success(publishedName)
            }

            val safeTitle = SavewaveRustBridge.sanitizeFilename(media.title)
            val isSocial = media.platform == "instagram" || media.platform == "threads"
            val req = YoutubeDLRequest(media.sourceUrl).apply {
                addOption("--no-playlist")
                addOption("--newline")
                addOption("--continue")
                addOption("--socket-timeout", "20")
                addOption("--retries", "5")
                addOption("--fragment-retries", "5")
                addOption("--force-ipv4")
                addOption("-o", File(tempDir, "$safeTitle-%(id)s.%(ext)s").absolutePath)
                if (media.platform == "instagram" && instagramCookieFile().exists()) {
                    addOption("--cookies", instagramCookieFile().absolutePath)
                }
                if (mode == "audio" || media.mediaType == "audio") {
                    addOption("-f", "bestaudio/best")
                    addOption("--extract-audio")
                    addOption("--audio-format", "best")
                } else if (isSocial) {
                    addOption("-f", "best")
                } else {
                    addOption("-f", "bestvideo+bestaudio/best")
                    addOption("--merge-output-format", "mp4")
                }
            }

            YoutubeDL.getInstance().execute(req, jobId) { progress, _, _ ->
                if (progress >= 0f) {
                    onProgress(progress.coerceIn(0f, 100f))
                }
            }

            val outputFile = tempDir.listFiles()
                ?.filter { it.isFile && !it.name.endsWith(".part") && !it.name.endsWith(".ytdl") }
                ?.maxByOrNull { it.length() }
                ?: return@withContext Result.failure(IllegalStateException("DOWNLOAD_FAILED:No output file produced."))

            val publishedName = publishToDownloads(outputFile)
            Result.success(publishedName)
        } catch (e: Exception) {
            val classified = SavewaveRustBridge.classifyError(e.message ?: "")
            Result.failure(IllegalStateException("${classified.code}:${classified.message}"))
        } finally {
            activeProcessId = null
            tempDir.deleteRecursively()
        }
    }

    fun cancelActiveDownload() {
        val pid = activeProcessId ?: return
        runCatching { YoutubeDL.getInstance().destroyProcessById(pid) }
        activeProcessId = null
    }

    private fun publishToDownloads(file: File): String {
        val resolver = context.contentResolver
        val mime = when (file.extension.lowercase()) {
            "mp4" -> "video/mp4"
            "mkv" -> "video/x-matroska"
            "webm" -> "video/webm"
            "mp3" -> "audio/mpeg"
            "m4a" -> "audio/mp4"
            "opus", "ogg" -> "audio/ogg"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            else -> "application/octet-stream"
        }
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, file.name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Savewave")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Could not create MediaStore entry.")
        resolver.openOutputStream(uri)?.use { out ->
            file.inputStream().use { input -> input.copyTo(out) }
        }
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return file.name
    }
}
