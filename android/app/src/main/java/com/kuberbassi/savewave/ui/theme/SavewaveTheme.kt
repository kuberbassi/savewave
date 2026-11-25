package com.kuberbassi.savewave.ui.theme

import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val BrandRed = Color(0xFFE03D27)
val BrandRedDark = Color(0xFFB82A17)
val PanelDark = Color(0xFF0D0D0E)
val PanelSoft = Color(0xFF161618)
val PanelCard = Color(0xFF121215)
val BorderSubtle = Color(0x26FFFFFF)
val TextMuted = Color(0xFFA1A1AA)
val EmeraldReady = Color(0xFF34D399)

val ChamferButtonShape = CutCornerShape(topStart = 8.dp, bottomEnd = 8.dp)
val ChamferCardShape = CutCornerShape(topStart = 12.dp, bottomEnd = 12.dp)

private val SavewaveDarkScheme = darkColorScheme(
    primary = BrandRed,
    onPrimary = Color.White,
    background = PanelDark,
    onBackground = Color.White,
    surface = PanelSoft,
    onSurface = Color.White,
    surfaceVariant = PanelCard,
    onSurfaceVariant = TextMuted,
    outline = BorderSubtle,
)

@Composable
fun SavewaveTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SavewaveDarkScheme,
        content = content,
    )
}
