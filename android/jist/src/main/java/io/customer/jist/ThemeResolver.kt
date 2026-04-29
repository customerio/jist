package io.customer.jist

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.intOrNull

class JistThemeResolver(
    private val theme: JsonObject,
    private val isDark: Boolean
) {
    fun resolve(
        type: String,
        variant: String? = null,
        group: String,
        property: String,
        state: String? = null
    ): JsonPrimitive? {
        if (state != null) {
            if (isDark) {
                if (variant != null) {
                    dig(listOf("modes", "dark", type, variant, "states", state, group, property))?.let { return it }
                }
                dig(listOf("modes", "dark", type, "states", state, group, property))?.let { return it }
            }
            if (variant != null) {
                dig(listOf(type, variant, "states", state, group, property))?.let { return it }
            }
            dig(listOf(type, "states", state, group, property))?.let { return it }
        }

        if (isDark) {
            if (variant != null) {
                dig(listOf("modes", "dark", type, variant, group, property))?.let { return it }
            }
            dig(listOf("modes", "dark", type, group, property))?.let { return it }
        }
        if (variant != null) {
            dig(listOf(type, variant, group, property))?.let { return it }
        }
        return dig(listOf(type, group, property))
    }

    fun resolve(
        type: String,
        variant: String? = null,
        property: String
    ): JsonPrimitive? {
        if (isDark) {
            if (variant != null) {
                dig(listOf("modes", "dark", type, variant, property))?.let { return it }
            }
            dig(listOf("modes", "dark", type, property))?.let { return it }
        }
        if (variant != null) {
            dig(listOf(type, variant, property))?.let { return it }
        }
        return dig(listOf(type, property))
    }

    fun resolveColor(
        type: String,
        variant: String? = null,
        group: String,
        property: String,
        state: String? = null,
        fallback: Color
    ): Color {
        val hex = resolve(type, variant, group, property, state)?.contentOrNull ?: return fallback
        return parseHexColor(hex) ?: fallback
    }

    fun resolveFloat(
        type: String,
        variant: String? = null,
        group: String,
        property: String,
        state: String? = null,
        fallback: Float
    ): Float {
        return resolve(type, variant, group, property, state)?.floatOrNull ?: fallback
    }

    fun resolveFloat(
        type: String,
        variant: String? = null,
        property: String,
        fallback: Float
    ): Float {
        return resolve(type, variant, property)?.floatOrNull ?: fallback
    }

    fun resolveInt(
        type: String,
        variant: String? = null,
        group: String,
        property: String
    ): Int? {
        return resolve(type, variant, group, property)?.intOrNull
    }

    private fun dig(path: List<String>): JsonPrimitive? {
        var current: JsonElement = theme
        for (key in path) {
            current = (current as? JsonObject)?.get(key) ?: return null
        }
        return current as? JsonPrimitive
    }

    companion object {
        fun parseHexColor(hex: String): Color? {
            val h = hex.trimStart('#')
            return when (h.length) {
                6 -> {
                    val rgb = h.toLongOrNull(16) ?: return null
                    Color(
                        red = ((rgb shr 16) and 0xFF) / 255f,
                        green = ((rgb shr 8) and 0xFF) / 255f,
                        blue = (rgb and 0xFF) / 255f
                    )
                }
                8 -> {
                    val rgba = h.toLongOrNull(16) ?: return null
                    Color(
                        red = ((rgba shr 24) and 0xFF) / 255f,
                        green = ((rgba shr 16) and 0xFF) / 255f,
                        blue = ((rgba shr 8) and 0xFF) / 255f,
                        alpha = (rgba and 0xFF) / 255f
                    )
                }
                else -> null
            }
        }

        fun fontWeight(value: Float): FontWeight {
            return when {
                value < 200 -> FontWeight.Thin
                value < 300 -> FontWeight.ExtraLight
                value < 400 -> FontWeight.Light
                value < 500 -> FontWeight.Normal
                value < 600 -> FontWeight.Medium
                value < 700 -> FontWeight.SemiBold
                value < 800 -> FontWeight.Bold
                value < 900 -> FontWeight.ExtraBold
                else -> FontWeight.Black
            }
        }
    }
}
