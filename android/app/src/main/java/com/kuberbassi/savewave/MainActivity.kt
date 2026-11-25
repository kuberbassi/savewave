package com.kuberbassi.savewave

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import com.kuberbassi.savewave.ui.SavewaveApp
import com.kuberbassi.savewave.ui.theme.SavewaveTheme

class MainActivity : ComponentActivity() {
    private val incomingSharedUrl = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runCatching { enableEdgeToEdge() }
        handleShareIntent(intent)
        setContent {
            SavewaveTheme {
                SavewaveApp(sharedUrl = incomingSharedUrl.value)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShareIntent(intent)
    }

    private fun handleShareIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()
            if (!text.isNullOrEmpty()) {
                val url = Regex("https?://\\S+|spotify:track:[A-Za-z0-9]{22}").find(text)?.value ?: text
                incomingSharedUrl.value = url
            }
        }
    }
}
