package probe

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull

// Platform-free port of main's ThemeResolver cascade + hex parsing — the same
// logic slice the Rust core carries, minus the Compose Color/FontWeight
// mapping (which stays platform-side in both architectures). This makes the
// KMP probe an apples-to-apples size comparison with jist-core.

data class Rgba(val r: Float, val g: Float, val b: Float, val a: Float)

class JistThemeCore(
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

    fun resolveFloat(type: String, variant: String? = null, group: String, property: String, fallback: Float): Float =
        resolve(type, variant, group, property)?.floatOrNull ?: fallback

    private fun dig(path: List<String>): JsonPrimitive? {
        var current: JsonElement = theme
        for (key in path) {
            current = (current as? JsonObject)?.get(key) ?: return null
        }
        return current as? JsonPrimitive
    }

    companion object {
        fun parseHexColor(hex: String): Rgba? {
            val h = hex.trim().removePrefix("#")
            if (h.any { it.code > 127 }) return null
            return when (h.length) {
                6 -> h.toLongOrNull(16)?.let {
                    Rgba(((it shr 16) and 0xFF) / 255f, ((it shr 8) and 0xFF) / 255f, (it and 0xFF) / 255f, 1f)
                }
                8 -> h.toLongOrNull(16)?.let {
                    Rgba(((it shr 24) and 0xFF) / 255f, ((it shr 16) and 0xFF) / 255f, ((it shr 8) and 0xFF) / 255f, (it and 0xFF) / 255f)
                }
                else -> null
            }
        }

        fun fontWeightBucket(value: Float): Int = when {
            value < 200f -> 100; value < 300f -> 200; value < 400f -> 300
            value < 500f -> 400; value < 600f -> 500; value < 700f -> 600
            value < 800f -> 700; value < 900f -> 800; else -> 900
        }
    }
}

/// Public parse entry points mirroring jist-core's FFI surface.
object JistParser {
    fun parseTemplate(json: String): JistTemplate = JistJson.decodeFromString(JistTemplate.serializer(), json)
    fun parseRegistry(json: String): Map<String, List<JistTemplate>> {
        val obj = JistJson.parseToJsonElement(json) as JsonObject
        return obj.filterKeys { !it.startsWith("$") }.mapValues { (_, v) ->
            (v as kotlinx.serialization.json.JsonArray).map { JistJson.decodeFromJsonElement(JistTemplate.serializer(), it) }
        }
    }
}
