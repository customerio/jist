package io.customer.jist

import kotlinx.serialization.*
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*

// MARK: - Template

@Serializable
data class JistTemplate(
    val version: String,
    val root: JistNode
)

// MARK: - Node

@Serializable(with = JistNodeSerializer::class)
sealed class JistNode {
    @Serializable
    data class Layout(
        val direction: String,
        val gap: Float? = null,
        val align: String? = null,
        val justify: String? = null,
        val margin: JistSpacing? = null,
        val children: List<JistNode> = emptyList()
    ) : JistNode()

    @Serializable
    data class Action(
        val name: String,
        val meta: JsonObject? = null,
        val children: List<JistNode> = emptyList()
    ) : JistNode()

    @Serializable
    data class Heading(
        val name: String? = null,
        val variant: String? = null
    ) : JistNode()

    @Serializable
    data class Text(
        val name: String? = null,
        val variant: String? = null
    ) : JistNode()

    @Serializable
    data class Date(
        val name: String? = null,
        val variant: String? = null
    ) : JistNode()

    @Serializable
    data class Button(
        val name: String,
        val variant: String? = null,
        val meta: JsonObject? = null
    ) : JistNode()

    @Serializable
    data class Image(
        val name: String,
        val variant: String? = null,
        val width: JsonPrimitive? = null,
        val height: Float? = null,
        val objectFit: String? = null,
        val borderRadius: Float? = null
    ) : JistNode() {
        val widthValue: Float? get() = width?.floatOrNull
        val isFillWidth: Boolean get() = width?.contentOrNull == "fill"
    }

    @Serializable
    data class DynamicLayout(
        val name: String,
        val direction: String? = null,
        val gap: Float? = null,
        val align: String? = null,
        val justify: String? = null,
        val margin: JistSpacing? = null,
        val template: JistNode
    ) : JistNode()

    @Serializable
    data class Template(
        val name: String
    ) : JistNode()

    data object Unknown : JistNode()
}

// MARK: - Spacing

@Serializable
data class JistSpacing(
    val top: Float? = null,
    val right: Float? = null,
    val bottom: Float? = null,
    val left: Float? = null
)

// MARK: - Action Event

data class JistActionEvent(
    val component: String,
    val name: String,
    val data: JsonElement?,
    val meta: JsonObject?
)

// MARK: - Mode

enum class JistMode { Auto, Light, Dark }

// MARK: - Serializer

internal val JistJson = Json { ignoreUnknownKeys = true }

internal object JistNodeSerializer : KSerializer<JistNode> {
    override val descriptor: SerialDescriptor = JsonElement.serializer().descriptor

    override fun deserialize(decoder: Decoder): JistNode {
        val element = decoder.decodeSerializableValue(JsonElement.serializer())
        return decodeNode(element)
    }

    override fun serialize(encoder: Encoder, value: JistNode) {
        encoder.encodeSerializableValue(JsonElement.serializer(), JsonNull)
    }

    fun decodeNode(element: JsonElement): JistNode {
        if (element !is JsonObject) return JistNode.Unknown
        val type = (element["type"] as? JsonPrimitive)?.contentOrNull ?: return JistNode.Unknown
        return try {
            when (type) {
                "layout" -> JistJson.decodeFromJsonElement<JistNode.Layout>(element)
                "action" -> JistJson.decodeFromJsonElement<JistNode.Action>(element)
                "heading" -> JistJson.decodeFromJsonElement<JistNode.Heading>(element)
                "text" -> JistJson.decodeFromJsonElement<JistNode.Text>(element)
                "date" -> JistJson.decodeFromJsonElement<JistNode.Date>(element)
                "button" -> JistJson.decodeFromJsonElement<JistNode.Button>(element)
                "image" -> JistJson.decodeFromJsonElement<JistNode.Image>(element)
                "dynamicLayout" -> JistJson.decodeFromJsonElement<JistNode.DynamicLayout>(element)
                "template" -> JistJson.decodeFromJsonElement<JistNode.Template>(element)
                else -> JistNode.Unknown
            }
        } catch (_: Exception) {
            JistNode.Unknown
        }
    }
}
