package com.kuberbassi.savewave.bridge

import org.json.JSONObject

data class SourceDetection(
    val source: String,
    val unavailable: Boolean,
    val canonicalUrl: String,
)

data class MatchOption(
    val sourceUrl: String,
    val title: String,
    val creator: String,
    val duration: Long?,
    val score: Double,
)

data class ResolvedMedia(
    val platform: String,
    val title: String,
    val creator: String,
    val thumbnail: String?,
    val duration: Long?,
    val mediaType: String,
    val qualityLabel: String,
    val sourceUrl: String,
    val selectionRequired: Boolean = false,
    val matchOptions: List<MatchOption> = emptyList(),
)

data class ErrorClassification(
    val code: String,
    val message: String,
)

data class ReleaseInfo(
    val version: String,
    val downloadUrl: String,
    val releaseUrl: String,
    val summary: String,
    val updateAvailable: Boolean,
)

object SavewaveRustBridge {
    init {
        System.loadLibrary("savewave_core")
    }

    @JvmStatic external fun nativeDetectSource(url: String): String
    @JvmStatic external fun nativeValidateUrl(url: String): String
    @JvmStatic external fun nativeResolveSpotify(url: String): String
    @JvmStatic external fun nativeClassifyError(rawError: String): String
    @JvmStatic external fun nativeSanitizeFilename(rawName: String): String
    @JvmStatic external fun nativeFetchReleaseInfo(): String

    fun detectSource(url: String): SourceDetection {
        val json = JSONObject(nativeDetectSource(url))
        return SourceDetection(
            source = json.optString("source", "unknown"),
            unavailable = json.optBoolean("unavailable", false),
            canonicalUrl = json.optString("canonicalUrl", url.trim()),
        )
    }

    fun validateUrl(url: String): Result<String> {
        val json = JSONObject(nativeValidateUrl(url))
        return if (json.optBoolean("valid", false)) {
            Result.success(json.optString("url", url.trim()))
        } else {
            Result.failure(IllegalArgumentException(json.optString("message", "Invalid URL")))
        }
    }

    fun resolveSpotify(url: String): Result<ResolvedMedia> {
        val json = JSONObject(nativeResolveSpotify(url))
        if (!json.optBoolean("ok", false)) {
            val code = json.optString("code", "MATCH_CONFIDENCE_LOW")
            val message = json.optString("message", "Could not confidently match this Spotify track.")
            return Result.failure(IllegalStateException("$code:$message"))
        }
        val m = json.getJSONObject("media")
        val options = mutableListOf<MatchOption>()
        val optArr = m.optJSONArray("matchOptions")
        if (optArr != null) {
            for (i in 0 until optArr.length()) {
                val o = optArr.getJSONObject(i)
                options.add(
                    MatchOption(
                        sourceUrl = o.optString("sourceUrl"),
                        title = o.optString("title"),
                        creator = o.optString("creator"),
                        duration = if (o.has("duration") && !o.isNull("duration")) o.getLong("duration") else null,
                        score = o.optDouble("score", 0.0),
                    )
                )
            }
        }
        return Result.success(
            ResolvedMedia(
                platform = m.optString("platform", "spotify"),
                title = m.optString("title"),
                creator = m.optString("creator"),
                thumbnail = m.optString("thumbnail").takeIf { it.isNotBlank() && it != "null" },
                duration = if (m.has("duration") && !m.isNull("duration")) m.getLong("duration") else null,
                mediaType = m.optString("type", "audio"),
                qualityLabel = m.optString("qualityLabel", "Verified high-confidence match"),
                sourceUrl = m.optString("sourceUrl"),
                selectionRequired = m.optBoolean("selectionRequired", false),
                matchOptions = options,
            )
        )
    }

    fun classifyError(raw: String): ErrorClassification {
        val json = JSONObject(nativeClassifyError(raw))
        return ErrorClassification(
            code = json.optString("code", "DOWNLOAD_FAILED"),
            message = json.optString("message", "Download failed."),
        )
    }

    fun sanitizeFilename(raw: String): String = nativeSanitizeFilename(raw)

    fun fetchReleaseInfo(): ReleaseInfo? {
        val raw = nativeFetchReleaseInfo()
        if (raw.isBlank() || raw == "null") return null
        val json = JSONObject(raw)
        return ReleaseInfo(
            version = json.optString("version"),
            downloadUrl = json.optString("downloadUrl"),
            releaseUrl = json.optString("releaseUrl"),
            summary = json.optString("summary"),
            updateAvailable = json.optBoolean("updateAvailable", false),
        )
    }
}
