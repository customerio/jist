package io.customer.jist.example

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.android.ide.common.rendering.api.SessionParams
import io.customer.jist.JistMode
import io.customer.jist.JistTemplate
import io.customer.jist.JistThemeResolver
import io.customer.jist.JistValue
import io.customer.jist.JistView
import io.customer.jist.LocalJistImageProvider
import io.customer.jist.objectValue
import uniffi.jist_core.parseDataJson
import uniffi.jist_core.parseTemplateJson
import kotlinx.serialization.json.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class ComponentSnapshotTests {

    @get:Rule
    val paparazzi = Paparazzi(
        deviceConfig = DeviceConfig.PIXEL_5,
        renderingMode = SessionParams.RenderingMode.SHRINK
    )

    private val placeholderBitmap: ImageBitmap by lazy {
        Bitmap.createBitmap(400, 200, Bitmap.Config.ARGB_8888).apply {
            eraseColor(AndroidColor.parseColor("#94a3b8"))
        }.asImageBitmap()
    }

    private val imageProvider: (String) -> ImageBitmap? = { _ -> placeholderBitmap }

    private val sharedTestsDir: File by lazy {
        val cwd = System.getProperty("user.dir")!!
        val candidate = File(cwd).resolve("../shared/tests")
        if (candidate.isDirectory) candidate
        else File(cwd).resolve("../../shared/tests")
    }

    @Test
    fun buttonInteractionStates() {
        // Theme parsing goes through jist-core (Rust), same as production.
        val fixture = parseDataJson(File(sharedTestsDir, "button.json").readText())
        val statesCase = fixture["states"]!!.objectValue!!
        val theme = statesCase["theme"]!!.objectValue!!

        for ((stateName, state) in listOf("default" to null, "hover" to "hover", "active" to "active", "disabled" to "disabled")) {
            for (mode in listOf(JistMode.LIGHT, JistMode.DARK)) {
                val modeName = if (mode == JistMode.LIGHT) "light" else "dark"
                val bg = if (mode == JistMode.LIGHT) Color.White else Color.Black
                val isDark = mode == JistMode.DARK
                val resolver = JistThemeResolver(theme, isDark)

                paparazzi.snapshot(name = "button_state_${stateName}_${modeName}") {
                    Box(modifier = Modifier.background(bg).padding(16.dp)) {
                        ButtonStatePreview(resolver = resolver, variant = null, state = state, label = stateName.replaceFirstChar { it.uppercase() })
                    }
                }
            }
        }
    }

    @Test
    fun componentFixtures() {
        sharedTestsDir.listFiles { f -> f.extension == "json" }?.sorted()?.forEach { file ->
            val component = file.nameWithoutExtension
            // kotlinx is used here only as test tooling to slice the fixture
            // document; everything handed to the renderer is parsed by
            // jist-core (Rust), same as production.
            val fixture = Json.parseToJsonElement(file.readText()).jsonObject

            for ((caseName, caseElement) in fixture) {
                val caseObj = caseElement.jsonObject
                val nodeElement = caseObj["node"]!!

                val wrappedRoot = buildJsonObject {
                    put("type", "layout")
                    put("direction", "vertical")
                    putJsonArray("children") { add(nodeElement) }
                }
                val templateJson = buildJsonObject {
                    put("version", "1")
                    put("root", wrappedRoot)
                }
                val template: JistTemplate = parseTemplateJson(templateJson.toString())

                val data: Map<String, JistValue> = parseDataJson(caseObj["data"]!!.jsonObject.toString())
                val theme: Map<String, JistValue> = parseDataJson(caseObj["theme"]!!.jsonObject.toString())

                for (mode in listOf(JistMode.LIGHT, JistMode.DARK)) {
                    val modeName = if (mode == JistMode.LIGHT) "light" else "dark"
                    val bg = if (mode == JistMode.LIGHT) Color.White else Color.Black

                    paparazzi.snapshot(name = "${component}_${caseName}_${modeName}") {
                        CompositionLocalProvider(LocalJistImageProvider provides imageProvider) {
                            Box(modifier = Modifier.background(bg).padding(16.dp)) {
                                JistView(
                                    name = "test",
                                    templates = mapOf("test" to listOf(template)),
                                    data = data,
                                    theme = theme,
                                    mode = mode,
                                    formatDate = { _, _ -> "Apr 1, 2026" }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ButtonStatePreview(
    resolver: JistThemeResolver,
    variant: String?,
    state: String?,
    label: String
) {
    val bgColor = resolver.resolveColor("button", variant, "background", "color", state = state, fallback = Color(0xFF4F46E5))
    val textColor = resolver.resolveColor("button", variant, "text", "color", state = state, fallback = Color.White)
    val radius = resolver.resolveFloat("button", variant, "border", "radius", fallback = 6f)

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .clip(RoundedCornerShape(radius.dp))
            .background(bgColor)
            .padding(
                start = resolver.resolveFloat("button", variant, "padding", "left", fallback = 16f).dp,
                top = resolver.resolveFloat("button", variant, "padding", "top", fallback = 8f).dp,
                end = resolver.resolveFloat("button", variant, "padding", "right", fallback = 16f).dp,
                bottom = resolver.resolveFloat("button", variant, "padding", "bottom", fallback = 8f).dp
            )
    ) {
        Text(
            text = label,
            style = TextStyle(
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = textColor
            )
        )
    }
}
