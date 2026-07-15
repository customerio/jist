package io.customer.jist.example

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.android.ide.common.rendering.api.SessionParams
import io.customer.jist.JistMode
import io.customer.jist.JistTemplate
import io.customer.jist.JistTheme
import io.customer.jist.JistValue
import io.customer.jist.JistView
import io.customer.jist.LocalJistImageProvider
import io.customer.jist.objectValue
import uniffi.jist_core.parseDataJson
import uniffi.jist_core.parseRegistryJson
import org.junit.Rule
import org.junit.Test

class SnapshotTests {

    @get:Rule
    val paparazzi = Paparazzi(
        deviceConfig = DeviceConfig.PIXEL_5,
        renderingMode = SessionParams.RenderingMode.SHRINK
    )

    private val placeholderBitmap: ImageBitmap by lazy {
        Bitmap.createBitmap(200, 200, Bitmap.Config.ARGB_8888).apply {
            eraseColor(AndroidColor.parseColor("#c7d2fe"))
        }.asImageBitmap()
    }

    private val imageProvider: (String) -> ImageBitmap? = { _ -> placeholderBitmap }

    private fun loadResource(name: String): String =
        javaClass.classLoader!!.getResourceAsStream(name)!!.bufferedReader().readText()

    // Paparazzi's layoutlib cannot load ResourceFont (Font(resId)) — only AndroidAssetFont
    // (Font(path, assetManager, weight)) works. We build the FontFamily map here using assets/fonts/,
    // which mirrors the res/font/ files copied alongside them.
    private val fonts: Map<String, FontFamily> by lazy {
        val assets = paparazzi.context.assets
        fun assetFont(path: String, weight: FontWeight): Font? =
            runCatching { assets.open(path).close(); Font(path, assets, weight) }.getOrNull()

        buildMap {
            listOfNotNull(
                assetFont("fonts/abril_fatface.ttf", FontWeight.Normal)
            ).takeIf { it.isNotEmpty() }?.let { put("Abril Fatface", FontFamily(it)) }

            listOfNotNull(
                assetFont("fonts/dm_sans_regular.ttf", FontWeight.Normal),
                assetFont("fonts/dm_sans_medium.ttf", FontWeight.Medium),
                assetFont("fonts/dm_sans_semibold.ttf", FontWeight.SemiBold),
                assetFont("fonts/dm_sans_bold.ttf", FontWeight.Bold),
            ).takeIf { it.isNotEmpty() }?.let { put("DM Sans", FontFamily(it)) }
        }
    }

    // All parsing goes through jist-core (Rust) — the same parser as iOS/web.

    private val allTemplates: Map<String, List<JistTemplate>> by lazy {
        parseRegistryJson(loadResource("templates.json"))
    }

    private val allData: Map<String, JistValue> by lazy {
        parseDataJson(loadResource("data.json"))
    }

    private val theme: Map<String, JistValue> by lazy {
        parseDataJson(loadResource("theme.json"))
    }

    private fun snapshot(templateKey: String, mode: JistMode) {
        val bg = if (mode == JistMode.LIGHT) Color.White else Color.Black
        paparazzi.snapshot {
            CompositionLocalProvider(LocalJistImageProvider provides imageProvider) {
                JistTheme(fonts = fonts) {
                    Box(modifier = Modifier.background(bg).padding(16.dp)) {
                        JistView(
                            name = templateKey,
                            templates = allTemplates,
                            data = allData[templateKey]!!.objectValue!!,
                            theme = theme,
                            mode = mode,
                            formatDate = { _, _ -> "Apr 1, 2026" }
                        )
                    }
                }
            }
        }
    }

    // -- basic --

    @Test fun basic_light() = snapshot("basic", JistMode.LIGHT)
    @Test fun basic_dark() = snapshot("basic", JistMode.DARK)

    // -- image --

    @Test fun image_light() = snapshot("image", JistMode.LIGHT)
    @Test fun image_dark() = snapshot("image", JistMode.DARK)

    // -- cta --

    @Test fun cta_light() = snapshot("cta", JistMode.LIGHT)
    @Test fun cta_dark() = snapshot("cta", JistMode.DARK)

    // -- action --

    @Test fun action_light() = snapshot("action", JistMode.LIGHT)
    @Test fun action_dark() = snapshot("action", JistMode.DARK)

    // -- hero --

    @Test fun hero_light() = snapshot("hero", JistMode.LIGHT)
    @Test fun hero_dark() = snapshot("hero", JistMode.DARK)

    // -- inbox --

    @Test fun inbox_light() = snapshot("inbox", JistMode.LIGHT)
    @Test fun inbox_dark() = snapshot("inbox", JistMode.DARK)

    // -- profile --

    @Test fun profile_light() = snapshot("profile", JistMode.LIGHT)
    @Test fun profile_dark() = snapshot("profile", JistMode.DARK)

    // -- stats --

    @Test fun stats_light() = snapshot("stats", JistMode.LIGHT)
    @Test fun stats_dark() = snapshot("stats", JistMode.DARK)

    // -- card --

    @Test fun card_light() = snapshot("card", JistMode.LIGHT)
    @Test fun card_dark() = snapshot("card", JistMode.DARK)

    // -- announcement --

    @Test fun announcement_light() = snapshot("announcement", JistMode.LIGHT)
    @Test fun announcement_dark() = snapshot("announcement", JistMode.DARK)
}

