package io.customer.jist

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.TextUnitType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.floatOrNull
import androidx.compose.foundation.Image
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

private const val MAX_TEMPLATE_DEPTH = 10

private val LocalJistTextAlign = compositionLocalOf { TextAlign.Start }

val LocalJistImageProvider = staticCompositionLocalOf<((String) -> ImageBitmap?)?> { null }

// Keyed by raw fontFamily string from the theme; value is the resolved FontFamily.
// staticCompositionLocalOf is used because this map only changes when the theme or JistTheme
// fonts change — recomposition is never needed at the individual node level.
internal val LocalJistFontCache = staticCompositionLocalOf<Map<String, FontFamily>> { emptyMap() }

/**
 * Walks the theme JSON collecting all fontFamily CSS stacks, then resolves each stack against
 * [fonts] with case-insensitive name matching. Returns a map keyed by raw stack string so
 * [LocalJistFontCache] lookups remain O(1) at render time.
 *
 * Resolution order within a stack mirrors CSS font-family: names are tried left to right;
 * the first name that matches a key in [fonts] wins.
 */
internal fun buildFontCache(theme: JsonObject, fonts: Map<String, FontFamily>): Map<String, FontFamily> {
    if (fonts.isEmpty()) return emptyMap()
    // Normalise keys once: lowercase, collapse whitespace.
    val normalized = fonts.entries.associate { (k, v) -> k.trim().lowercase() to v }

    val cache = mutableMapOf<String, FontFamily>()

    fun resolve(stack: String): FontFamily? {
        for (name in stack.split(",")) {
            normalized[name.trim().lowercase()]?.let { return it }
        }
        return null
    }

    fun collect(element: JsonElement) {
        when (element) {
            is JsonObject -> element.forEach { (key, value) ->
                if (key == "fontFamily") {
                    (value as? JsonPrimitive)?.contentOrNull
                        ?.takeIf { it.isNotEmpty() }
                        ?.let { stack ->
                            if (stack !in cache) {
                                resolve(stack)?.let { cache[stack] = it }
                            }
                        }
                } else {
                    collect(value)
                }
            }
            else -> {}
        }
    }

    collect(theme)
    return cache
}

private fun tightTextStyle(
    fontSize: TextUnit,
    fontWeight: FontWeight,
    color: Color,
    fontFamily: FontFamily? = null,
    letterSpacing: TextUnit = TextUnit.Unspecified,
    lineHeight: TextUnit = TextUnit.Unspecified
) = TextStyle(
    fontSize = fontSize,
    fontWeight = fontWeight,
    color = color,
    fontFamily = fontFamily,
    letterSpacing = letterSpacing,
    lineHeight = lineHeight,
    platformStyle = PlatformTextStyle(includeFontPadding = false),
    lineHeightStyle = LineHeightStyle(
        alignment = LineHeightStyle.Alignment.Proportional,
        trim = LineHeightStyle.Trim.None
    )
)

// MARK: - Node Dispatcher

@Composable
internal fun JistNodeView(
    node: JistNode,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    when (node) {
        is JistNode.Layout -> JistLayoutView(node, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Action -> JistActionView(node, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Heading -> JistHeadingView(node, data, resolver, modifier)
        is JistNode.Text -> JistTextView(node, data, resolver, modifier)
        is JistNode.Date -> JistDateView(node, data, resolver, formatDate, modifier)
        is JistNode.Button -> JistButtonView(node, data, resolver, onAction, modifier)
        is JistNode.Image -> JistImageView(node, data, resolver, modifier)
        is JistNode.DynamicLayout -> JistDynamicLayoutView(node, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Template -> JistTemplateView(node, data, resolver, formatDate, onAction, modifier, templates, templateDepth)
        is JistNode.Unknown -> { }
    }
}

// MARK: - Layout

@Composable
private fun JistLayoutView(
    node: JistNode.Layout,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    val isVertical = node.direction == "vertical"
    val isStretch = node.align == null || node.align == "stretch"
    val gap = node.gap ?: 0f
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
            val usesDistribution = effectiveJustify == "space-between" || effectiveJustify == "space-around" || effectiveJustify == "space-evenly"
            val useBaseline = node.align == "baseline"
            node.children.forEach { child ->
                val baseMod = when {
                    needsWeight && child is JistNode.Layout -> Modifier.weight(1f)
                    usesDistribution && child is JistNode.Layout -> Modifier.width(IntrinsicSize.Max)
                    else -> Modifier
                }
                val childMod = if (useBaseline) baseMod.alignByBaseline() else baseMod
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
        start = (margin.left ?: 0f).dp,
        top = (margin.top ?: 0f).dp,
        end = (margin.right ?: 0f).dp,
        bottom = (margin.bottom ?: 0f).dp
    )
}

// MARK: - Action

@Composable
private fun JistActionView(
    node: JistNode.Action,
    data: Map<String, JsonElement>,
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
                indication = LocalIndication.current
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
    node: JistNode.Heading,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    modifier: Modifier = Modifier
) {
    val name = node.name ?: "heading"
    val variant = node.variant ?: "h3"
    val text = (data[name] as? JsonPrimitive)?.contentOrNull ?: ""

    Text(
        text = text,
        textAlign = LocalJistTextAlign.current,
        style = tightTextStyle(
            fontSize = resolver.resolveFloat("heading", variant, "text", "fontSize", fallback = defaultHeadingSize(variant)).sp,
            fontWeight = JistThemeResolver.fontWeight(
                resolver.resolveFloat("heading", variant, "text", "fontWeight", fallback = 600f)
            ),
            color = resolver.resolveColor("heading", variant, "text", "color", fallback = if (resolver.isDark) Color.White else Color.Black),
            fontFamily = LocalJistFontCache.current[resolver.resolve("heading", variant, "text", "fontFamily")?.contentOrNull ?: ""],
            letterSpacing = resolver.resolve("heading", variant, "text", "letterSpacing")?.floatOrNull
                ?.takeIf { it != 0f }?.sp ?: TextUnit.Unspecified,
            lineHeight = resolver.resolve("heading", variant, "text", "lineHeight")?.floatOrNull
                ?.takeIf { it > 0f }?.let { TextUnit(it, TextUnitType.Em) } ?: TextUnit.Unspecified
        ),
        modifier = modifier
            .padding(  // margin (outer)
                start = resolver.resolveFloat("heading", variant, "margin", "left", fallback = 0f).dp,
                top = resolver.resolveFloat("heading", variant, "margin", "top", fallback = 0f).dp,
                end = resolver.resolveFloat("heading", variant, "margin", "right", fallback = 0f).dp,
                bottom = resolver.resolveFloat("heading", variant, "margin", "bottom", fallback = 0f).dp
            )
            .padding(  // padding (inner)
                start = resolver.resolveFloat("heading", variant, "padding", "left", fallback = 0f).dp,
                top = resolver.resolveFloat("heading", variant, "padding", "top", fallback = 0f).dp,
                end = resolver.resolveFloat("heading", variant, "padding", "right", fallback = 0f).dp,
                bottom = resolver.resolveFloat("heading", variant, "padding", "bottom", fallback = 0f).dp
            )
            .semantics { heading() }
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
    node: JistNode.Text,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    modifier: Modifier = Modifier
) {
    val name = node.name ?: "text"
    val text = (data[name] as? JsonPrimitive)?.contentOrNull ?: ""
    val maxLines = resolver.resolveInt("text", node.variant, "text", "maxLines")

    Text(
        text = text,
        textAlign = LocalJistTextAlign.current,
        style = tightTextStyle(
            fontSize = resolver.resolveFloat("text", node.variant, "text", "fontSize", fallback = 14f).sp,
            fontWeight = JistThemeResolver.fontWeight(
                resolver.resolveFloat("text", node.variant, "text", "fontWeight", fallback = 400f)
            ),
            color = resolver.resolveColor("text", node.variant, "text", "color", fallback = if (resolver.isDark) Color.White else Color.Black),
            fontFamily = LocalJistFontCache.current[resolver.resolve("text", node.variant, "text", "fontFamily")?.contentOrNull ?: ""],
            letterSpacing = resolver.resolve("text", node.variant, "text", "letterSpacing")?.floatOrNull
                ?.takeIf { it != 0f }?.sp ?: TextUnit.Unspecified,
            lineHeight = resolver.resolve("text", node.variant, "text", "lineHeight")?.floatOrNull
                ?.takeIf { it > 0f }?.let { TextUnit(it, TextUnitType.Em) } ?: TextUnit.Unspecified
        ),
        maxLines = maxLines ?: Int.MAX_VALUE,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier
            .padding(  // margin (outer)
                start = resolver.resolveFloat("text", node.variant, "margin", "left", fallback = 0f).dp,
                top = resolver.resolveFloat("text", node.variant, "margin", "top", fallback = 0f).dp,
                end = resolver.resolveFloat("text", node.variant, "margin", "right", fallback = 0f).dp,
                bottom = resolver.resolveFloat("text", node.variant, "margin", "bottom", fallback = 0f).dp
            )
            .padding(  // padding (inner)
                start = resolver.resolveFloat("text", node.variant, "padding", "left", fallback = 0f).dp,
                top = resolver.resolveFloat("text", node.variant, "padding", "top", fallback = 0f).dp,
                end = resolver.resolveFloat("text", node.variant, "padding", "right", fallback = 0f).dp,
                bottom = resolver.resolveFloat("text", node.variant, "padding", "bottom", fallback = 0f).dp
            )
    )
}

// MARK: - Date

@Composable
private fun JistDateView(
    node: JistNode.Date,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    modifier: Modifier = Modifier
) {
    val name = node.name ?: "date"
    val iso = (data[name] as? JsonPrimitive)?.contentOrNull ?: ""

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
            color = resolver.resolveColor("date", node.variant, "text", "color", fallback = if (resolver.isDark) Color.White else Color.Black),
            fontFamily = LocalJistFontCache.current[resolver.resolve("date", node.variant, "text", "fontFamily")?.contentOrNull ?: ""],
            letterSpacing = resolver.resolve("date", node.variant, "text", "letterSpacing")?.floatOrNull
                ?.takeIf { it != 0f }?.sp ?: TextUnit.Unspecified,
            lineHeight = resolver.resolve("date", node.variant, "text", "lineHeight")?.floatOrNull
                ?.takeIf { it > 0f }?.let { TextUnit(it, TextUnitType.Em) } ?: TextUnit.Unspecified
        ),
        modifier = modifier
            .padding(  // margin (outer)
                start = resolver.resolveFloat("date", node.variant, "margin", "left", fallback = 0f).dp,
                top = resolver.resolveFloat("date", node.variant, "margin", "top", fallback = 0f).dp,
                end = resolver.resolveFloat("date", node.variant, "margin", "right", fallback = 0f).dp,
                bottom = resolver.resolveFloat("date", node.variant, "margin", "bottom", fallback = 0f).dp
            )
            .padding(  // padding (inner)
                start = resolver.resolveFloat("date", node.variant, "padding", "left", fallback = 0f).dp,
                top = resolver.resolveFloat("date", node.variant, "padding", "top", fallback = 0f).dp,
                end = resolver.resolveFloat("date", node.variant, "padding", "right", fallback = 0f).dp,
                bottom = resolver.resolveFloat("date", node.variant, "padding", "bottom", fallback = 0f).dp
            )
    )
}

// SimpleDateFormat / DateFormat are relatively expensive to construct and are NOT thread-safe, so
// we cache them per-thread and reuse them instead of allocating on every render. Date nodes are
// formatted during composition (potentially many at once, e.g. while scrolling a list), so per-call
// allocation would cause UI jank. `ThreadLocal.withInitial` is intentionally NOT used (it's a Java 8
// default method that would re-introduce the core-library desugaring requirement); the classic
// `initialValue()` override works on all API levels.

/** Per-thread, reusable ISO-8601 parsers (UTC, with and without fractional seconds). */
private val isoParserCache = object : ThreadLocal<List<SimpleDateFormat>>() {
    override fun initialValue(): List<SimpleDateFormat> =
        listOf("yyyy-MM-dd'T'HH:mm:ss.SSS", "yyyy-MM-dd'T'HH:mm:ss").map { pattern ->
            SimpleDateFormat(pattern, Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
                isLenient = false
            }
        }
}

/** Per-thread, reusable localized output formatter, paired with the locale it was built for. */
private val mediumDateFormatCache = object : ThreadLocal<Pair<Locale, DateFormat>>() {
    override fun initialValue(): Pair<Locale, DateFormat> {
        val locale = Locale.getDefault()
        return locale to DateFormat.getDateInstance(DateFormat.MEDIUM, locale)
    }
}

/** Cached localized medium-date formatter, rebuilt only when the default locale changes. */
private fun mediumDateFormat(): DateFormat {
    val current = Locale.getDefault()
    val cached = mediumDateFormatCache.get()
    if (cached != null && cached.first == current) return cached.second
    val rebuilt = current to DateFormat.getDateInstance(DateFormat.MEDIUM, current)
    mediumDateFormatCache.set(rebuilt)
    return rebuilt.second
}

private fun defaultFormatDate(iso: String): String {
    // Parse the ISO-8601 instant (UTC, optional fractional seconds) without the newer date/time
    // APIs so consumers don't need Android core-library desugaring. Normalize the trailing "Z" away
    // and parse as UTC, then format as a localized medium-style date in the default locale, reusing
    // the cached (per-thread) formatters above to avoid per-render allocation.
    val parsers = isoParserCache.get() ?: return iso
    val normalized = iso.trim().removeSuffix("Z")
    for (parser in parsers) {
        try {
            val date = parser.parse(normalized) ?: continue
            return mediumDateFormat().format(date)
        } catch (_: Exception) {
            // Try the next pattern.
        }
    }
    return iso
}

// MARK: - Button

@Composable
private fun JistButtonView(
    node: JistNode.Button,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier
) {
    val buttonData = data[node.name] as? JsonObject ?: return
    val label = (buttonData["label"] as? JsonPrimitive)?.contentOrNull ?: return
    val isDisabled = (buttonData["disabled"] as? JsonPrimitive)?.booleanOrNull ?: false

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isHovered by interactionSource.collectIsHoveredAsState()

    val state: String? = when {
        isDisabled -> "disabled"
        isPressed -> "active"
        isHovered -> "hover"
        else -> null
    }

    val bgColor = resolver.resolveColor("button", node.variant, "background", "color", state = state, fallback = Color(0xFF4F46E5))
    val textColor = resolver.resolveColor("button", node.variant, "text", "color", state = state, fallback = Color.White)
    val radius = resolver.resolveFloat("button", node.variant, "border", "radius", fallback = 6f)
    val borderWidth = resolver.resolveFloat("button", node.variant, "border", "width", fallback = 0f)
    val borderColor = resolver.resolveColor("button", node.variant, "border", "color", state = state, fallback = Color.Transparent)
    val minW = resolver.resolveFloat("button", node.variant, "minWidth", fallback = 0f)
    val minH = resolver.resolveFloat("button", node.variant, "minHeight", fallback = 0f)
    val shadowBlur = resolver.resolveFloat("button", node.variant, "shadow", "blur", fallback = 0f)
    val shadowColor = resolver.resolveColor("button", node.variant, "shadow", "color", state = state, fallback = Color.Transparent)
    val shape = RoundedCornerShape(radius.dp)

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .padding(  // margin (outer)
                start = resolver.resolveFloat("button", node.variant, "margin", "left", fallback = 0f).dp,
                top = resolver.resolveFloat("button", node.variant, "margin", "top", fallback = 0f).dp,
                end = resolver.resolveFloat("button", node.variant, "margin", "right", fallback = 0f).dp,
                bottom = resolver.resolveFloat("button", node.variant, "margin", "bottom", fallback = 0f).dp
            )
            .then(
                if (minW > 0 || minH > 0) Modifier.sizeIn(
                    minWidth = if (minW > 0) minW.dp else Dp.Unspecified,
                    minHeight = if (minH > 0) minH.dp else Dp.Unspecified
                ) else Modifier
            )
            .then(
                if (shadowBlur > 0) Modifier.shadow(
                    elevation = shadowBlur.dp,
                    shape = shape,
                    ambientColor = shadowColor,
                    spotColor = shadowColor
                ) else Modifier
            )
            .clip(shape)
            .background(bgColor)
            .then(
                if (borderWidth > 0) Modifier.border(borderWidth.dp, borderColor, shape)
                else Modifier
            )
            .hoverable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = !isDisabled,
                role = Role.Button
            ) {
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
    ) {
        Text(
            text = label,
            softWrap = false,
            style = tightTextStyle(
                fontSize = resolver.resolveFloat("button", node.variant, "text", "fontSize", state = state, fallback = 14f).sp,
                fontWeight = JistThemeResolver.fontWeight(
                    resolver.resolveFloat("button", node.variant, "text", "fontWeight", state = state, fallback = 500f)
                ),
                color = textColor,
                fontFamily = LocalJistFontCache.current[resolver.resolve("button", node.variant, "text", "fontFamily", state = state)?.contentOrNull ?: ""],
                letterSpacing = resolver.resolve("button", node.variant, "text", "letterSpacing", state = state)?.floatOrNull
                    ?.takeIf { it != 0f }?.sp ?: TextUnit.Unspecified,
                lineHeight = resolver.resolve("button", node.variant, "text", "lineHeight", state = state)?.floatOrNull
                    ?.takeIf { it > 0f }?.let { TextUnit(it, TextUnitType.Em) } ?: TextUnit.Unspecified
            )
        )
    }
}

// MARK: - Dynamic Layout

@Composable
private fun JistDynamicLayoutView(
    node: JistNode.DynamicLayout,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    formatDate: ((String, String) -> String)?,
    onAction: ((JistActionEvent) -> Unit)?,
    modifier: Modifier = Modifier,
    templates: Map<String, JistTemplate>? = null,
    templateDepth: Int = 0
) {
    val items = data[node.name] as? kotlinx.serialization.json.JsonArray ?: return
    val isVertical = (node.direction ?: "vertical") == "vertical"
    val gap = node.gap ?: 0f
    val marginMod = marginModifier(node.margin)

    if (isVertical) {
        Column(
            verticalArrangement = verticalArrangement(node.justify, gap),
            horizontalAlignment = horizontalAlignment(node.align),
            modifier = modifier.then(marginMod)
        ) {
            items.forEach { item ->
                val itemData = (item as? JsonObject)?.toMap() ?: emptyMap()
                JistNodeView(node.template, itemData, resolver, formatDate, onAction, Modifier.fillMaxWidth(), templates, templateDepth)
            }
        }
    } else {
        Row(
            horizontalArrangement = horizontalArrangement(node.justify, gap),
            verticalAlignment = verticalAlignment(node.align),
            modifier = modifier.then(marginMod)
        ) {
            items.forEach { item ->
                val itemData = (item as? JsonObject)?.toMap() ?: emptyMap()
                JistNodeView(node.template, itemData, resolver, formatDate, onAction, templates = templates, templateDepth = templateDepth)
            }
        }
    }
}

// MARK: - Template

@Composable
private fun JistTemplateView(
    node: JistNode.Template,
    data: Map<String, JsonElement>,
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
    node: JistNode.Image,
    data: Map<String, JsonElement>,
    resolver: JistThemeResolver,
    modifier: Modifier = Modifier
) {
    val url = (data[node.name] as? JsonPrimitive)?.contentOrNull ?: return
    val altText = (data["title"] as? JsonPrimitive)?.contentOrNull ?: ""

    val contentScale = when (node.objectFit) {
        "cover" -> ContentScale.Crop
        "fill" -> ContentScale.FillBounds
        else -> ContentScale.Fit
    }

    val themeRadius = resolver.resolveFloat("image", node.variant, "border", "radius", fallback = 0f)
    val radius = node.borderRadius ?: themeRadius

    val hasFixedWidth = node.widthValue != null
    var imageMod = (if (hasFixedWidth) Modifier else modifier)
        .padding(  // margin (outer)
            start = resolver.resolveFloat("image", node.variant, "margin", "left", fallback = 0f).dp,
            top = resolver.resolveFloat("image", node.variant, "margin", "top", fallback = 0f).dp,
            end = resolver.resolveFloat("image", node.variant, "margin", "right", fallback = 0f).dp,
            bottom = resolver.resolveFloat("image", node.variant, "margin", "bottom", fallback = 0f).dp
        )
        .padding(  // padding (constrains image inside)
            start = resolver.resolveFloat("image", node.variant, "padding", "left", fallback = 0f).dp,
            top = resolver.resolveFloat("image", node.variant, "padding", "top", fallback = 0f).dp,
            end = resolver.resolveFloat("image", node.variant, "padding", "right", fallback = 0f).dp,
            bottom = resolver.resolveFloat("image", node.variant, "padding", "bottom", fallback = 0f).dp
        )
    if (node.isFillWidth) imageMod = imageMod.fillMaxWidth()
    node.widthValue?.let { imageMod = imageMod.requiredWidth(it.dp) }
    node.height?.let { imageMod = imageMod.height(it.dp) }
    imageMod = imageMod.clip(RoundedCornerShape(radius.dp))

    val imageProvider = LocalJistImageProvider.current
    val bitmap = imageProvider?.invoke(url)
    if (bitmap != null) {
        Image(
            painter = BitmapPainter(bitmap),
            contentDescription = altText,
            contentScale = contentScale,
            modifier = imageMod
        )
    } else {
        AsyncImage(
            model = url,
            contentDescription = altText,
            contentScale = contentScale,
            modifier = imageMod
        )
    }
}
