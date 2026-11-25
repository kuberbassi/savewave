package com.kuberbassi.savewave.ui

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.kuberbassi.savewave.bridge.MatchOption
import com.kuberbassi.savewave.bridge.ResolvedMedia
import com.kuberbassi.savewave.bridge.SavewaveRustBridge
import com.kuberbassi.savewave.bridge.SourceDetection
import com.kuberbassi.savewave.data.HistoryItem
import com.kuberbassi.savewave.data.HistoryStore
import com.kuberbassi.savewave.engine.AndroidDownloadEngine
import com.kuberbassi.savewave.engine.EngineInitState
import com.kuberbassi.savewave.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

private enum class AppTab(val label: String) {
    DOWNLOADER("DOWNLOADER"),
    HISTORY("HISTORY"),
    PRIVACY("PRIVACY"),
}

private data class NoticeModal(
    val title: String,
    val message: String,
    val primaryLabel: String? = null,
    val onPrimary: (() -> Unit)? = null,
    val secondaryLabel: String? = null,
    val onSecondary: (() -> Unit)? = null,
)

@Composable
fun SavewaveApp(sharedUrl: String? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val engine = remember { AndroidDownloadEngine(context) }
    val historyStore = remember { HistoryStore(context) }

    var activeTab by remember { mutableStateOf(AppTab.DOWNLOADER) }
    var engineState by remember { mutableStateOf(EngineInitState()) }
    var urlInput by remember { mutableStateOf(sharedUrl.orEmpty()) }
    var detection by remember { mutableStateOf<SourceDetection?>(null) }
    var mode by remember { mutableStateOf("video") }
    var resolving by remember { mutableStateOf(false) }
    var resolvedMedia by remember { mutableStateOf<ResolvedMedia?>(null) }
    var downloading by remember { mutableStateOf(false) }
    var downloadProgress by remember { mutableFloatStateOf(0f) }
    var history by remember { mutableStateOf(historyStore.list()) }
    var notice by remember { mutableStateOf<NoticeModal?>(null) }
    var showInstagramLogin by remember { mutableStateOf(false) }
    var pendingRetryAfterAuth by remember { mutableStateOf(false) }

    fun updateUrl(next: String) {
        urlInput = next
        resolvedMedia = null
        if (next.isBlank()) {
            detection = null
        } else {
            val det = SavewaveRustBridge.detectSource(next)
            detection = det
            if (det.source == "spotify" || det.source == "soundcloud") {
                mode = "audio"
            } else if (det.source == "instagram" || det.source == "threads") {
                mode = "video"
            }
        }
    }

    LaunchedEffect(sharedUrl) {
        if (!sharedUrl.isNullOrBlank()) {
            updateUrl(sharedUrl)
        }
    }

    LaunchedEffect(Unit) {
        engineState = engine.initialize()
        val release = withContext(Dispatchers.IO) {
            runCatching { SavewaveRustBridge.fetchReleaseInfo() }.getOrNull()
        }
        if (release != null && release.updateAvailable) {
            notice = NoticeModal(
                title = "UPDATE ${release.version} AVAILABLE",
                message = "${release.summary} Install over this app to preserve your downloads and history.",
                primaryLabel = "GET ANDROID UPDATE",
                onPrimary = {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(release.downloadUrl)))
                    notice = null
                },
                secondaryLabel = "RELEASE NOTES",
                onSecondary = {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(release.releaseUrl)))
                    notice = null
                },
            )
        }
    }

    fun triggerResolve() {
        val target = urlInput.trim()
        if (target.isEmpty() || resolving || !engineState.ready) return
        scope.launch {
            resolving = true
            resolvedMedia = null
            val result = engine.resolveMedia(target, mode)
            resolving = false
            result.onSuccess { media ->
                if (media.selectionRequired && media.matchOptions.size >= 2) {
                    val opt1 = media.matchOptions[0]
                    val opt2 = media.matchOptions[1]
                    val desc = { idx: Int, o: MatchOption ->
                        val dur = o.duration?.let { " (${it / 60}:${(it % 60).toString().padStart(2, '0')})" }.orEmpty()
                        "$idx. ${o.title} — ${o.creator}$dur"
                    }
                    notice = NoticeModal(
                        title = "CHOOSE THE CORRECT RECORDING",
                        message = "Savewave found two strong matches:\n\n${desc(1, opt1)}\n${desc(2, opt2)}",
                        primaryLabel = "USE OPTION 1",
                        onPrimary = {
                            resolvedMedia = media.copy(
                                sourceUrl = opt1.sourceUrl,
                                selectionRequired = false,
                                matchOptions = emptyList(),
                                qualityLabel = "Explicitly selected match",
                            )
                            notice = null
                        },
                        secondaryLabel = "USE OPTION 2",
                        onSecondary = {
                            resolvedMedia = media.copy(
                                sourceUrl = opt2.sourceUrl,
                                selectionRequired = false,
                                matchOptions = emptyList(),
                                qualityLabel = "Explicitly selected match",
                            )
                            notice = null
                        },
                    )
                } else {
                    resolvedMedia = media
                }
            }.onFailure { err ->
                val raw = err.message ?: "Extraction failed."
                val code = raw.substringBefore(':', "")
                val msg = raw.substringAfter(':', raw)
                if (code == "AUTH_REQUIRED") {
                    notice = NoticeModal(
                        title = "INSTAGRAM LOGIN REQUIRED",
                        message = "Instagram blocked anonymous access to this Reel. Log in once; your session stays on your device.",
                        primaryLabel = "LOG IN TO INSTAGRAM",
                        onPrimary = {
                            notice = null
                            pendingRetryAfterAuth = true
                            showInstagramLogin = true
                        },
                    )
                } else {
                    notice = NoticeModal(
                        title = if (code == "MATCH_CONFIDENCE_LOW") "MATCH NOT CONFIDENT" else "EXTRACTION ERROR",
                        message = msg,
                    )
                }
            }
        }
    }

    fun triggerDownload() {
        val media = resolvedMedia ?: return
        if (downloading) return
        scope.launch {
            downloading = true
            downloadProgress = 5f
            val res = engine.downloadMedia(media, mode) { pct ->
                downloadProgress = pct
            }
            downloading = false
            res.onSuccess { savedName ->
                downloadProgress = 100f
                history = historyStore.add(
                    HistoryItem(
                        id = UUID.randomUUID().toString(),
                        title = media.title,
                        creator = media.creator,
                        platform = media.platform,
                        mediaType = media.mediaType,
                        timestamp = System.currentTimeMillis(),
                        filename = savedName,
                    )
                )
                notice = NoticeModal(
                    title = "DOWNLOAD COMPLETE",
                    message = "$savedName was saved to Downloads/Savewave.",
                )
            }.onFailure { err ->
                val raw = err.message ?: "Download failed."
                val msg = raw.substringAfter(':', raw)
                notice = NoticeModal(title = "DOWNLOAD ERROR", message = msg)
            }
            downloadProgress = 0f
        }
    }

    if (showInstagramLogin) {
        InstagramAuthDialog(
            cookieFile = engine.instagramCookieFile(),
            onSuccess = {
                showInstagramLogin = false
                if (pendingRetryAfterAuth) {
                    pendingRetryAfterAuth = false
                    triggerResolve()
                }
            },
            onDismiss = {
                showInstagramLogin = false
                pendingRetryAfterAuth = false
            },
        )
    }

    notice?.let { modal ->
        AlertDialog(
            onDismissRequest = { notice = null },
            containerColor = PanelSoft,
            title = {
                Text(
                    text = modal.title,
                    color = BrandRed,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                )
            },
            text = {
                Text(
                    text = modal.message,
                    color = Color.White,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                )
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (modal.secondaryLabel != null && modal.onSecondary != null) {
                        OutlinedButton(
                            onClick = modal.onSecondary,
                            shape = ChamferButtonShape,
                        ) {
                            Text(modal.secondaryLabel, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                        }
                    }
                    if (modal.primaryLabel != null && modal.onPrimary != null) {
                        Button(
                            onClick = modal.onPrimary,
                            shape = ChamferButtonShape,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandRed),
                        ) {
                            Text(modal.primaryLabel, fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Color.White)
                        }
                    } else {
                        Button(
                            onClick = { notice = null },
                            shape = ChamferButtonShape,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandRed),
                        ) {
                            Text("ACKNOWLEDGE", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Color.White)
                        }
                    }
                }
            },
            dismissButton = if (modal.primaryLabel != null) {
                {
                    TextButton(onClick = { notice = null }) {
                        Text("LATER", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = TextMuted)
                    }
                }
            } else null,
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PanelDark)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Brand Red Brutalist Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(BrandRed)
                .padding(horizontal = 18.dp, vertical = 14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "SAVEWAVE",
                    color = Color.Black,
                    fontWeight = FontWeight.Black,
                    fontSize = 22.sp,
                    letterSpacing = (-0.5).sp,
                )
                Text(
                    text = "v2.0.0 • RUST CORE",
                    color = Color.Black.copy(alpha = 0.8f),
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Paste. Resolve. Save. No accounts. No storage.",
                color = Color.Black.copy(alpha = 0.88f),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
        }

        // Tab Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.Black)
                .border(1.dp, BorderSubtle)
        ) {
            AppTab.entries.forEach { tab ->
                val selected = activeTab == tab
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(if (selected) PanelSoft else Color.Black)
                        .clickable { activeTab = tab }
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = tab.label,
                        color = if (selected) BrandRed else TextMuted,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        letterSpacing = 1.sp,
                    )
                }
            }
        }

        // Body
        when (activeTab) {
            AppTab.DOWNLOADER -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Engine Status Strip
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(PanelSoft, ChamferCardShape)
                        .border(1.dp, BorderSubtle, ChamferCardShape)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "LOCAL RUST ENGINE",
                        color = TextMuted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = when {
                            engineState.ready -> "CONNECTED • ${engineState.version}"
                            engineState.initializing -> "INITIALIZING..."
                            else -> "UNAVAILABLE"
                        },
                        color = if (engineState.ready) EmeraldReady else BrandRed,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                // URL Input Card
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(PanelSoft, ChamferCardShape)
                        .border(1.dp, BorderSubtle, ChamferCardShape)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = "UNIVERSAL MEDIA RESOLVER",
                            color = TextMuted,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = detection?.source?.uppercase() ?: "AUTO DETECT",
                            color = BrandRed,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }

                    OutlinedTextField(
                        value = urlInput,
                        onValueChange = { updateUrl(it) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                "Paste YouTube, Spotify, Instagram Reel, SoundCloud...",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 12.sp,
                                color = TextMuted,
                            )
                        },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = BrandRed,
                            unfocusedBorderColor = BorderSubtle,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = PanelDark,
                            unfocusedContainerColor = PanelDark,
                        ),
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedButton(
                            onClick = {
                                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                val clip = cm.primaryClip?.getItemAt(0)?.text?.toString()?.trim()
                                if (!clip.isNullOrEmpty()) updateUrl(clip)
                            },
                            shape = ChamferButtonShape,
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("PASTE", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = Color.White)
                        }
                        if (urlInput.isNotEmpty()) {
                            OutlinedButton(
                                onClick = { updateUrl("") },
                                shape = ChamferButtonShape,
                            ) {
                                Text("CLEAR", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = TextMuted)
                            }
                        }
                        Button(
                            onClick = { triggerResolve() },
                            enabled = !resolving && engineState.ready && urlInput.isNotBlank() && detection?.unavailable != true,
                            shape = ChamferButtonShape,
                            colors = ButtonDefaults.buttonColors(containerColor = BrandRed),
                            modifier = Modifier.weight(1.3f),
                        ) {
                            Text(
                                text = if (resolving) "RESOLVING..." else "RESOLVE",
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = Color.White,
                            )
                        }
                    }

                    if (resolving) {
                        LinearProgressIndicator(
                            modifier = Modifier.fillMaxWidth(),
                            color = BrandRed,
                            trackColor = PanelDark,
                        )
                    }

                    // Mode Toggle
                    val audioOnly = detection?.source == "spotify" || detection?.source == "soundcloud"
                    if (detection?.unavailable == true) {
                        Text(
                            text = "THIS SOURCE IS NOT CURRENTLY SUPPORTED",
                            color = BrandRed,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    } else if (audioOnly) {
                        Text(
                            text = "AUDIO ONLY SOURCE DETECTED (SMART MATCH)",
                            color = BrandRed,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    } else {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(PanelDark)
                                .border(1.dp, BorderSubtle)
                                .padding(4.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            listOf("video" to "VIDEO", "audio" to "AUDIO").forEach { (value, label) ->
                                val active = mode == value
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .background(if (active) BrandRed else Color.Transparent)
                                        .clickable {
                                            mode = value
                                            resolvedMedia = null
                                        }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = label,
                                        color = if (active) Color.White else TextMuted,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                    )
                                }
                            }
                        }
                    }
                }

                // Resolved Media Preview Card
                resolvedMedia?.let { media ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(PanelCard, ChamferCardShape)
                            .border(1.dp, EmeraldReady.copy(alpha = 0.5f), ChamferCardShape)
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = "READY TO SAVE",
                            color = EmeraldReady,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.5.sp,
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (media.thumbnail != null) {
                                AsyncImage(
                                    model = media.thumbnail,
                                    contentDescription = media.title,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(72.dp)
                                        .clip(ChamferButtonShape)
                                        .border(1.dp, BorderSubtle, ChamferButtonShape),
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = media.title,
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    text = media.creator,
                                    color = TextMuted,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Spacer(Modifier.height(4.dp))
                                val durText = media.duration?.takeIf { it > 0 }?.let { " • ${it / 60}:${(it % 60).toString().padStart(2, '0')}" }.orEmpty()
                                Text(
                                    text = "${media.platform.uppercase()} • ${media.mediaType.uppercase()}$durText • ${media.qualityLabel}",
                                    color = BrandRed,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Button(
                                onClick = { triggerDownload() },
                                enabled = !downloading,
                                shape = ChamferButtonShape,
                                colors = ButtonDefaults.buttonColors(containerColor = BrandRed),
                                modifier = Modifier.weight(1f),
                            ) {
                                Text(
                                    text = if (downloading) "SAVING ${downloadProgress.toInt()}%" else "SAVE TO DOWNLOADS",
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = Color.White,
                                )
                            }
                            if (downloading) {
                                OutlinedButton(
                                    onClick = { engine.cancelActiveDownload() },
                                    shape = ChamferButtonShape,
                                ) {
                                    Text("CANCEL", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = BrandRed)
                                }
                            }
                        }

                        if (downloading) {
                            LinearProgressIndicator(
                                progress = { (downloadProgress / 100f).coerceIn(0f, 1f) },
                                modifier = Modifier.fillMaxWidth(),
                                color = BrandRed,
                                trackColor = PanelDark,
                            )
                        }
                    }
                }
            }

            AppTab.HISTORY -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "ON-DEVICE HISTORY (${history.size})",
                        color = TextMuted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    if (history.isNotEmpty()) {
                        OutlinedButton(
                            onClick = {
                                historyStore.clear()
                                history = emptyList()
                            },
                            shape = ChamferButtonShape,
                        ) {
                            Text("CLEAR", fontFamily = FontFamily.Monospace, fontSize = 10.sp, color = Color.White)
                        }
                    }
                }

                if (history.isEmpty()) {
                    Text(
                        text = "No downloads yet.",
                        color = TextMuted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                    )
                } else {
                    val fmt = remember { SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()) }
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(history, key = { it.id }) { item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(PanelSoft, ChamferCardShape)
                                    .border(1.dp, BorderSubtle, ChamferCardShape)
                                    .padding(14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                                    Text(
                                        text = item.title,
                                        color = Color.White,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        text = "${item.platform.uppercase()} • ${item.mediaType.uppercase()} • ${fmt.format(Date(item.timestamp))}",
                                        color = TextMuted,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                    )
                                }
                                Text(
                                    text = "SAVED",
                                    color = EmeraldReady,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                )
                            }
                        }
                    }
                }
            }

            AppTab.PRIVACY -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val cards = listOf(
                    "Native Rust Core" to "Source detection, Spotify Smart Match v2, URL safety checks, and error classification run natively in Rust on your device.",
                    "Zero Cloud Storage" to "No Savewave accounts, databases, or cloud proxies. Everything stays on your phone.",
                    "Scoped MediaStore" to "Completed downloads publish directly to Downloads/Savewave without broad storage permissions.",
                    "On-Device Instagram Auth" to "Instagram login cookies are stored locally in private app storage and auto-purged if expired.",
                )
                cards.forEach { (title, desc) ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(PanelSoft, ChamferCardShape)
                            .border(1.dp, BorderSubtle, ChamferCardShape)
                            .padding(14.dp),
                    ) {
                        Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(desc, color = TextMuted, fontFamily = FontFamily.Monospace, fontSize = 11.sp, lineHeight = 16.sp)
                    }
                }

                Button(
                    onClick = {
                        scope.launch {
                            val result = runCatching { engine.updateEngineBinary() }.getOrDefault("FAILED")
                            notice = NoticeModal("ENGINE UPDATE", "yt-dlp update status: $result")
                        }
                    },
                    shape = ChamferButtonShape,
                    colors = ButtonDefaults.buttonColors(containerColor = BrandRed),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("UPDATE LOCAL YT-DLP ENGINE", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 11.sp)
                }

                OutlinedButton(
                    onClick = {
                        scope.launch {
                            val rel = withContext(Dispatchers.IO) {
                                runCatching { SavewaveRustBridge.fetchReleaseInfo() }.getOrNull()
                            }
                            if (rel != null && rel.updateAvailable) {
                                notice = NoticeModal(
                                    title = "UPDATE ${rel.version} AVAILABLE",
                                    message = rel.summary,
                                    primaryLabel = "GET ANDROID UPDATE",
                                    onPrimary = {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(rel.downloadUrl)))
                                        notice = null
                                    },
                                )
                            } else {
                                notice = NoticeModal("UP TO DATE", "Savewave v2.0.0 is already on the latest version.")
                            }
                        }
                    },
                    shape = ChamferButtonShape,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("CHECK FOR APP UPDATES", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 11.sp)
                }
            }
        }
    }
}
