package io.customer.jist

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.font.FontFamily

/**
 * Composition local that holds the app-level font map.
 * Key: family name as it appears in the theme (e.g. "DM Sans", "Abril Fatface").
 * Value: the Compose [FontFamily] to use for that name.
 * Default is an empty map — all text falls back to the system font.
 */
internal val LocalJistFonts = staticCompositionLocalOf<Map<String, FontFamily>> { emptyMap() }

/**
 * Provides custom fonts to all [JistView] calls within [content].
 *
 * Supply a map from **font family name** (the human-readable name you use in the Jist theme,
 * e.g. `"DM Sans"` or `"Abril Fatface"`) to a Compose [FontFamily]. Jist resolves each
 * `fontFamily` CSS stack from the theme against this map — the first name in the stack that
 * matches a key wins. Name matching is case-insensitive and whitespace-normalised.
 *
 * You only need to call `JistTheme` once, typically around your root composable. Every
 * `JistView` in the subtree automatically inherits the fonts you register here.
 *
 * ```kotlin
 * val dmSans = FontFamily(
 *     Font(R.font.dm_sans_regular, FontWeight.Normal),
 *     Font(R.font.dm_sans_medium, FontWeight.Medium),
 *     Font(R.font.dm_sans_semibold, FontWeight.SemiBold),
 *     Font(R.font.dm_sans_bold, FontWeight.Bold),
 * )
 * val abrilFatface = FontFamily(Font(R.font.abril_fatface, FontWeight.Normal))
 *
 * JistTheme(fonts = mapOf("DM Sans" to dmSans, "Abril Fatface" to abrilFatface)) {
 *     // JistView calls here automatically use the fonts above
 * }
 * ```
 *
 * @param fonts Map from font family name to [FontFamily]. Omit or pass an empty map to use
 * the system font for all Jist text.
 */
@Composable
fun JistTheme(
    fonts: Map<String, FontFamily> = emptyMap(),
    content: @Composable () -> Unit
) {
    val stableFonts = remember(fonts) { fonts }
    CompositionLocalProvider(LocalJistFonts provides stableFonts) {
        content()
    }
}
