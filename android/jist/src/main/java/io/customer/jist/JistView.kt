package io.customer.jist

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

private const val SUPPORTED_VERSION = "1"

/**
 * Renders a Jist template tree into native Jetpack Compose views.
 *
 * ```kotlin
 * JistView(
 *     template = template,
 *     data = data,
 *     theme = theme,
 *     formatDate = { iso, name -> "2 hours ago" },
 *     onAction = { event -> Log.d("Jist", event.name) }
 * )
 * ```
 */
@Composable
fun JistView(
    template: JistTemplate,
    data: Map<String, JsonElement>,
    theme: JsonObject,
    mode: JistMode = JistMode.Auto,
    formatDate: ((String, String) -> String)? = null,
    onAction: ((JistActionEvent) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    if (template.version != SUPPORTED_VERSION) return

    val isDark = when (mode) {
        JistMode.Dark -> true
        JistMode.Light -> false
        JistMode.Auto -> isSystemInDarkTheme()
    }

    val resolver = remember(theme, isDark) { JistThemeResolver(theme, isDark) }

    JistNodeView(
        node = template.root,
        data = data,
        resolver = resolver,
        formatDate = formatDate,
        onAction = onAction,
        modifier = modifier
    )
}
