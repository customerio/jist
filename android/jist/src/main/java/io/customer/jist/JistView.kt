package io.customer.jist

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import uniffi.jist_core.JistMode

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
    name: String,
    templates: Map<String, List<JistTemplate>>,
    data: Map<String, JistValue>,
    theme: Map<String, JistValue>,
    mode: JistMode = JistMode.AUTO,
    formatDate: ((String, String) -> String)? = null,
    onAction: ((JistActionEvent) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    // Resolve: pick the template matching this renderer's supported version
    val resolved = remember(templates) {
        templates.mapNotNull { (key, versions) ->
            versions.firstOrNull { it.version == SUPPORTED_VERSION }?.let { key to it }
        }.toMap()
    }

    val template = resolved[name] ?: return

    val isDark = when (mode) {
        JistMode.DARK -> true
        JistMode.LIGHT -> false
        JistMode.AUTO -> isSystemInDarkTheme()
    }

    val resolver = remember(theme, isDark) { JistThemeResolver(theme, isDark) }

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
