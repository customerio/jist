package io.customer.jist

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import uniffi.jist_core.JistNode
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import java.time.format.FormatStyle

private const val MAX_TEMPLATE_DEPTH = 10

private val LocalJistTextAlign = compositionLocalOf { TextAlign.Start }

private fun tightTextStyle(fontSize: TextUnit, fontWeight: FontWeight, color: Color) = TextStyle(
    fontSize = fontSize,
    fontWeight = fontWeight,
    color = color,
    platformStyle = PlatformTextStyle(includeFontPadding = false),
    lineHeightStyle = LineHeightStyle(
        alignment = LineHeightStyle.Alignment.Proportional,
        trim = LineHeightStyle.Trim.Both
    )
)

// MARK: - Node Dispatcher

@Composable
internal fun JistNodeView(
    node: JistNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    when (node) {
        is JistNode.Layout -> JistLayoutView(node.v1, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Action -> JistActionView(node.v1, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Heading -> JistHeadingView(node.v1, data, resolver, modifier)
        is JistNode.Text -> JistTextView(node.v1, data, resolver, modifier)
        is JistNode.Date -> JistDateView(node.v1, data, resolver, formatDate, modifier)
        is JistNode.Button -> JistButtonView(node.v1, data, resolver, onAction, modifier)
        is JistNode.Image -> JistImageView(node.v1, data, resolver, modifier)
        is JistNode.DynamicLayout -> JistDynamicLayoutView(node.v1, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Template -> JistTemplateView(node.v1, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Unknown -> { }
    }
}

// MARK: - Layout

@Composable
private fun JistLayoutView(
    node: JistLayoutNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    val isVertical = node.direction == "vertical"
    val isStretch = node.align == null || node.align == "stretch"
    val gap = (node.gap ?: 0.0).toFloat()
    val marginMod = marginModifier(node.margin)

    if (isVertical) {
        val textAlign = when (node.align) {
            "center" -> TextAlign.Center
            "end" -> TextAlign.End
            else -> TextAlign.Start
        }
        CompositionLocalProvider(LocalJistTextAlign provides textAlign) {
            Column(
                verticalArrangement = verticalArrangement(node.justify, gap),
                horizontalAlignment = horizontalAlignment(node.align),
                modifier = modifier.then(marginMod)
            ) {
                node.children.forEach { child ->
                    JistNodeView(child, data, resolver, formatDate, onAction, Modifier.fillMaxWidth(), templates, templateDepth)
                }
            }
        }
    } else {
        val parentAlign = LocalJistTextAlign.current
        val effectiveJustify = node.justify ?: when (parentAlign) {
            TextAlign.Center -> "center"
            TextAlign.End -> "end"
            else -> null
        }
        Row(
            horizontalArrangement = horizontalArrangement(effectiveJustify, gap),
            verticalAlignment = verticalAlignment(node.align),
            modifier = modifier.then(marginMod)
        ) {
            val needsWeight = effectiveJustify == null || effectiveJustify == "start"
            node.children.forEach { child ->
                val childMod = when {
                    needsWeight && child is JistNode.Layout -> Modifier.weight(1f)
                    else -> Modifier
                }
                JistNodeView(child, data, resolver, formatDate, onAction, childMod, templates, templateDepth)
            }
        }
    }
}

private fun verticalArrangement(justify: String?, gap: Float): Arrangement.Vertical {
    val spacing = gap.dp
    return when (justify) {
        "end" -> Arrangement.spacedBy(spacing, Alignment.Bottom)
        "center" -> Arrangement.spacedBy(spacing, Alignment.CenterVertically)
        "space-between" -> Arrangement.SpaceBetween
        "space-around" -> Arrangement.SpaceAround
        "space-evenly" -> Arrangement.SpaceEvenly
        else -> Arrangement.spacedBy(spacing)
    }
}

private fun horizontalArrangement(justify: String?, gap: Float): Arrangement.Horizontal {
    val spacing = gap.dp
    return when (justify) {
        "end" -> Arrangement.spacedBy(spacing, Alignment.End)
        "center" -> Arrangement.spacedBy(spacing, Alignment.CenterHorizontally)
        "space-between" -> Arrangement.SpaceBetween
        "space-around" -> Arrangement.SpaceAround
        "space-evenly" -> Arrangement.SpaceEvenly
        else -> Arrangement.spacedBy(spacing)
    }
}

private fun horizontalAlignment(align: String?): Alignment.Horizontal {
    return when (align) {
        "end" -> Alignment.End
        "center" -> Alignment.CenterHorizontally
        else -> Alignment.Start
    }
}

private fun verticalAlignment(align: String?): Alignment.Vertical {
    return when (align) {
        "start" -> Alignment.Top
        "end" -> Alignment.Bottom
        "center" -> Alignment.CenterVertically
        else -> Alignment.CenterVertically
    }
}

private fun marginModifier(margin: JistSpacing?): Modifier {
    margin ?: return Modifier
    return Modifier.padding(
        start = (margin.left ?: 0.0).dp,
        top = (margin.top ?: 0.0).dp,
        end = (margin.right ?: 0.0).dp,
        bottom = (margin.bottom ?: 0.0).dp
    )
}

// MARK: - Action

@Composable
private fun JistActionView(
    node: JistActionNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    Box(
        modifier = modifier
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                onAction?.invoke(
                    JistActionEvent(
                        component = "action",
                        name = node.name,
                        data = data[node.name],
                        meta = node.meta
                    )
                )
            }
            .semantics { role = Role.Button }
    ) {
        Column {
            node.children.forEach { child ->
                JistNodeView(child, data, resolver, formatDate, onAction, templates = templates, templateDepth = templateDepth)
            }
        }
    }
}

// MARK: - Heading

@Composable
private fun JistHeadingView(
    node: JistHeadingNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    modifier: Modifier = Modifier
) {
    val name = node.name ?: "heading"
    val variant = node.variant ?: "h3"
    val text = data[name]?.stringValue ?: ""

    Text(
        text = text,
        textAlign = LocalJistTextAlign.current,
        style = tightTextStyle(
            fontSize = resolver.resolveFloat("heading", variant, "text", "fontSize", fallback = defaultHeadingSize(variant)).sp,
            fontWeight = JistThemeResolver.fontWeight(
                resolver.resolveFloat("heading", variant, "text", "fontWeight", fallback = 600f)
            ),
            color = resolver.resolveColor("heading", variant, "text", "color", fallback = Color.Black)
        ),
        modifier = modifier.semantics { heading() }
    )
}

private fun defaultHeadingSize(variant: String): Float = when (variant) {
    "h2" -> 20f
    "h4" -> 14f
    else -> 16f
}

// MARK: - Text

@Composable
private fun JistTextView(
    node: JistTextNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    modifier: Modifier = Modifier
) {
    val name = node.name ?: "text"
    val text = data[name]?.stringValue ?: ""
    val maxLines = resolver.resolveInt("text", node.variant, "text", "maxLines")

    Text(
        text = text,
        textAlign = LocalJistTextAlign.current,
        style = tightTextStyle(
            fontSize = resolver.resolveFloat("text", node.variant, "text", "fontSize", fallback = 14f).sp,
            fontWeight = JistThemeResolver.fontWeight(
                resolver.resolveFloat("text", node.variant, "text", "fontWeight", fallback = 400f)
            ),
            color = resolver.resolveColor("text", node.variant, "text", "color", fallback = Color.DarkGray)
        ),
        maxLines = maxLines ?: Int.MAX_VALUE,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier
    )
}

// MARK: - Date

@Composable
private fun JistDateView(
    node: JistDateNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    modifier: Modifier = Modifier
) {
    val name = node.name ?: "date"
    val iso = data[name]?.stringValue ?: ""

    val display = when {
        iso.isEmpty() -> ""
        formatDate != null -> formatDate(iso, name)
        else -> defaultFormatDate(iso)
    }

    Text(
        text = display,
        textAlign = LocalJistTextAlign.current,
        style = tightTextStyle(
            fontSize = resolver.resolveFloat("date", node.variant, "text", "fontSize", fallback = 12f).sp,
            fontWeight = JistThemeResolver.fontWeight(
                resolver.resolveFloat("date", node.variant, "text", "fontWeight", fallback = 400f)
            ),
            color = resolver.resolveColor("date", node.variant, "text", "color", fallback = Color.Gray)
        ),
        modifier = modifier
    )
}

private fun defaultFormatDate(iso: String): String {
    return try {
        val instant = Instant.parse(iso)
        val date = instant.atZone(ZoneId.systemDefault()).toLocalDate()
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
    } catch (_: Exception) {
        iso
    }
}

// MARK: - Button

@Composable
private fun JistButtonView(
    node: JistButtonNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier
) {
    val buttonData = data[node.name]?.objectValue ?: return
    val label = buttonData["label"]?.stringValue ?: return

    val bgColor = resolver.resolveColor("button", node.variant, "background", "color", fallback = Color(0xFF4F46E5))
    val textColor = resolver.resolveColor("button", node.variant, "text", "color", fallback = Color.White)
    val radius = resolver.resolveFloat("button", node.variant, "border", "radius", fallback = 6f)
    val borderWidth = resolver.resolveFloat("button", node.variant, "border", "width", fallback = 0f)
    val borderColor = resolver.resolveColor("button", node.variant, "border", "color", fallback = Color.Transparent)
    val shape = RoundedCornerShape(radius.dp)

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .clip(shape)
            .background(bgColor)
            .then(
                if (borderWidth > 0) Modifier.border(borderWidth.dp, borderColor, shape)
                else Modifier
            )
            .clickable {
                onAction?.invoke(
                    JistActionEvent(
                        component = "button",
                        name = node.name,
                        data = data[node.name],
                        meta = node.meta
                    )
                )
            }
            .padding(
                start = resolver.resolveFloat("button", node.variant, "padding", "left", fallback = 16f).dp,
                top = resolver.resolveFloat("button", node.variant, "padding", "top", fallback = 8f).dp,
                end = resolver.resolveFloat("button", node.variant, "padding", "right", fallback = 16f).dp,
                bottom = resolver.resolveFloat("button", node.variant, "padding", "bottom", fallback = 8f).dp
            )
            .semantics { role = Role.Button }
    ) {
        Text(
            text = label,
            style = tightTextStyle(
                fontSize = resolver.resolveFloat("button", node.variant, "text", "fontSize", fallback = 14f).sp,
                fontWeight = JistThemeResolver.fontWeight(
                    resolver.resolveFloat("button", node.variant, "text", "fontWeight", fallback = 500f)
                ),
                color = textColor
            )
        )
    }
}

// MARK: - Dynamic Layout

@Composable
private fun JistDynamicLayoutView(
    node: JistDynamicLayoutNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    val items = data[node.name]?.arrayValue ?: return
    val template = node.templateNode ?: return
    val isVertical = (node.direction ?: "vertical") == "vertical"
    val gap = (node.gap ?: 0.0).toFloat()
    val marginMod = marginModifier(node.margin)

    if (isVertical) {
        Column(
            verticalArrangement = verticalArrangement(node.justify, gap),
            horizontalAlignment = horizontalAlignment(node.align),
            modifier = modifier.then(marginMod)
        ) {
            items.forEach { item ->
                val itemData = item.objectValue ?: emptyMap()
                JistNodeView(template, itemData, resolver, formatDate, onAction, Modifier.fillMaxWidth(), templates, templateDepth)
            }
        }
    } else {
        Row(
            horizontalArrangement = horizontalArrangement(node.justify, gap),
            verticalAlignment = verticalAlignment(node.align),
            modifier = modifier.then(marginMod)
        ) {
            items.forEach { item ->
                val itemData = item.objectValue ?: emptyMap()
                JistNodeView(template, itemData, resolver, formatDate, onAction, templates = templates, templateDepth = templateDepth)
            }
        }
    }
}

// MARK: - Template

@Composable
private fun JistTemplateView(
    node: JistTemplateNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    if (templateDepth >= MAX_TEMPLATE_DEPTH) return
    val template = templates?.get(node.name) ?: return
    JistNodeView(template.root, data, resolver, formatDate, onAction, modifier, templates, templateDepth + 1)
}

// MARK: - Image

@Composable
private fun JistImageView(
    node: JistImageNode,
    data: Map<String, JistValue>,
    resolver: JistThemeResolver,
    modifier: Modifier = Modifier
) {
    val url = data[node.name]?.stringValue ?: return
    val altText = data["title"]?.stringValue ?: ""

    val contentScale = when (node.objectFit) {
        "cover" -> ContentScale.Crop
        "fill" -> ContentScale.FillBounds
        else -> ContentScale.Fit
    }

    var imageMod = modifier
    if (node.isFillWidth) imageMod = imageMod.fillMaxWidth()
    node.widthValue?.let { imageMod = imageMod.requiredWidth(it.dp) }
    node.height?.let { imageMod = imageMod.height(it.dp) }
    imageMod = imageMod.clip(RoundedCornerShape((node.borderRadius ?: 0.0).dp))

    AsyncImage(
        model = url,
        contentDescription = altText,
        contentScale = contentScale,
        modifier = imageMod
    )
}
