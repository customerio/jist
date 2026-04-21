package io.customer.jist

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

private const val SUPPORTED_VERSION = "1"

/**
 * Renders a Jist template tree into native Jetpack Compose views.
 *
 * Fonts are resolved from [JistTheme] — wrap your root composable with `JistTheme` to supply
 * custom fonts. Omitting `JistTheme` causes all text to render in the system font.
 *
 * ```kotlin
 * JistView(
 *     name = "basic",
 *     templates = allTemplates,
 *     data = data,
 *     theme = theme,
 *     formatDate = { iso, name -> "2 hours ago" },
 *     onAction = { event -> Log.d("Jist", event.name) }
 * )
 * ```
 */
@Composable
fun JistView(
    name: String,
    templates: Map<String, List<JistTemplate>>,
    data: Map<String, JsonElement>,
    theme: JsonObject,
    mode: JistMode = JistMode.Auto,
    formatDate: ((String, String) -> String)? = null,
    onAction: ((JistActionEvent) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val fonts = LocalJistFonts.current
    val fontCache = remember(theme, fonts) { buildFontCache(theme, fonts) }

    val resolved = remember(templates) {
        templates.mapNotNull { (key, versions) ->
            versions.firstOrNull { it.version == SUPPORTED_VERSION }?.let { key to it }
        }.toMap()
    }

    val template = resolved[name] ?: return

    val isDark = when (mode) {
        JistMode.Dark -> true
        JistMode.Light -> false
        JistMode.Auto -> isSystemInDarkTheme()
    }

    val resolver = remember(theme, isDark) { JistThemeResolver(theme, isDark) }

    CompositionLocalProvider(LocalJistFontCache provides fontCache) {
        JistNodeView(
            node = template.root,
            data = data,
            resolver = resolver,
            formatDate = formatDate,
            onAction = onAction,
            modifier = modifier,
            templates = resolved
        )
    }
}

