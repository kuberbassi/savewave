package com.kuberbassi.savewave.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class HistoryItem(
    val id: String,
    val title: String,
    val creator: String,
    val platform: String,
    val mediaType: String,
    val timestamp: Long,
    val filename: String?,
)

class HistoryStore(context: Context) {
    private val prefs = context.getSharedPreferences("savewave_history_v2", Context.MODE_PRIVATE)
    private val key = "items"
    private val maxItems = 50

    fun list(): List<HistoryItem> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return runCatching {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                HistoryItem(
                    id = o.optString("id"),
                    title = o.optString("title"),
                    creator = o.optString("creator"),
                    platform = o.optString("platform"),
                    mediaType = o.optString("mediaType"),
                    timestamp = o.optLong("timestamp"),
                    filename = o.optString("filename").takeIf { it.isNotBlank() && it != "null" },
                )
            }
        }.getOrDefault(emptyList())
    }

    fun add(item: HistoryItem): List<HistoryItem> {
        val updated = (listOf(item) + list()).take(maxItems)
        save(updated)
        return updated
    }

    fun clear() {
        prefs.edit().remove(key).apply()
    }

    private fun save(items: List<HistoryItem>) {
        val arr = JSONArray()
        for (item in items) {
            arr.put(
                JSONObject().apply {
                    put("id", item.id)
                    put("title", item.title)
                    put("creator", item.creator)
                    put("platform", item.platform)
                    put("mediaType", item.mediaType)
                    put("timestamp", item.timestamp)
                    put("filename", item.filename ?: JSONObject.NULL)
                }
            )
        }
        prefs.edit().putString(key, arr.toString()).apply()
    }
}
