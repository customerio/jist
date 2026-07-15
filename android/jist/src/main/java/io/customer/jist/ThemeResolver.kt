package io.customer.jist

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import uniffi.jist_core.fontWeightBucketFfi
import uniffi.jist_core.parseHexColorFfi

/**
 * Thin Compose adapter over the jist-core (Rust) `ThemeResolver`.
 *
 * The cascades (state → dark → variant → base, both grouped and group-less),
 * hex-color parsing, and font-weight bucketing all live in
 * core/jist-core/src/theme_resolver.rs — shared with iOS. This file only maps
 * Rust results onto Compose types.
 */
class JistThemeResolver(
    theme: Map<String, JistValue>,
    val isDark: Boolean
) {
    private val core = uniffi.jist_core.ThemeResolver(theme, isDark)

    fun resolve(
        type: String,
        variant: String? = null,
        group: String,
        property: String,
        state: String? = null
    ): JistValue? = core.resolve(type, variant, group, property, state)

    /** Group-less variant: resolves `type.variant.property` (e.g. `button.minWidth`). */
    fun resolve(
        type: String,
        variant: String? = null,
        property: String
    ): JistValue? = core.resolveProperty(type, variant, property)

    fun resolveColor(
        type: String,
        variant: String? = null,
        group: String,
        property: String,
        state: String? = null,
        fallback: Color
    ): Color {
        val c = core.resolveColor(type, variant, group, property, state) ?: return fallback
        return Color(
            red = c.r.toFloat(),
            green = c.g.toFloat(),
            blue = c.b.toFloat(),
            alpha = c.a.toFloat()
        )
    }

    fun resolveFloat(
        type: String,
        variant: String? = null,
        group: String,
        property: String,
        state: String? = null,
        fallback: Float
    ): Float = core.resolveNumber(type, variant, group, property, state, fallback.toDouble()).toFloat()

    /** Group-less variant of resolveFloat (e.g. `button.minWidth`). */
    fun resolveFloat(
        type: String,
        variant: String? = null,
        property: String,
        fallback: Float
    ): Float = resolve(type, variant, property)?.numberValue?.toFloat() ?: fallback

    fun resolveInt(
        type: String,
        variant: String? = null,
        group: String,
        property: String
    ): Int? = core.resolveInt(type, variant, group, property)?.toInt()

    companion object {
        /** Parses `#RRGGBB` / `#RRGGBBAA` via jist-core's shared hex parser. */
        fun parseHexColor(hex: String): Color? {
            val c = parseHexColorFfi(hex) ?: return null
            return Color(
                red = c.r.toFloat(),
                green = c.g.toFloat(),
                blue = c.b.toFloat(),
                alpha = c.a.toFloat()
            )
        }

        /**
         * Buckets come from jist-core; this `when` only maps the shared
         * bucket onto Compose's platform weight enum.
         */
        fun fontWeight(value: Float): FontWeight = when (fontWeightBucketFfi(value.toDouble()).toInt()) {
            100 -> FontWeight.Thin
            200 -> FontWeight.ExtraLight
            300 -> FontWeight.Light
            400 -> FontWeight.Normal
            500 -> FontWeight.Medium
            600 -> FontWeight.SemiBold
            700 -> FontWeight.Bold
            800 -> FontWeight.ExtraBold
            else -> FontWeight.Black
        }
    }
}
