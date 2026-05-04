package io.customer.jist.example

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import coil3.SingletonImageLoader
import coil3.ImageLoader
import coil3.asImage
import coil3.test.FakeImageLoaderEngine
import com.android.ide.common.rendering.api.SessionParams
import io.customer.jist.JistJson
import io.customer.jist.JistMode
import io.customer.jist.JistTemplate
import io.customer.jist.JistTheme
import io.customer.jist.JistView
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

class SnapshotTests {

    @get:Rule
    val paparazzi = Paparazzi(
        deviceConfig = DeviceConfig.PIXEL_5,
        renderingMode = SessionParams.RenderingMode.SHRINK
    )

    @Before
    fun setUp() {
        // Set up a fake Coil image loader that returns a solid-color placeholder
        // for any image request — no network needed, fully deterministic.
        val placeholder = Bitmap.createBitmap(200, 200, Bitmap.Config.ARGB_8888).apply {
            eraseColor(AndroidColor.parseColor("#e2e8f0"))
        }.asImage()

        val engine = FakeImageLoaderEngine.Builder()
            .default(placeholder)
            .build()

        @OptIn(coil3.annotation.DelicateCoilApi::class)
        SingletonImageLoader.setUnsafe(
            ImageLoader.Builder(paparazzi.context)
                .components { add(engine) }
                .build()
        )
    }

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

    private val allTemplates: Map<String, List<JistTemplate>> by lazy {
        val obj = JistJson.parseToJsonElement(loadResource("templates.json")).jsonObject
        listOf("basic", "image", "cta", "action", "hero", "inbox", "profile", "stats", "announcement").associateWith { key ->
            obj[key]!!.jsonArray.map { JistJson.decodeFromJsonElement(JistTemplate.serializer(), it) }
        }
    }

    private val allData: JsonObject by lazy {
        JistJson.parseToJsonElement(loadResource("data.json")).jsonObject
    }

    private val theme: JsonObject by lazy {
        JistJson.parseToJsonElement(loadResource("theme.json")).jsonObject
    }

    private fun snapshot(templateKey: String, mode: JistMode) {
        val bg = if (mode == JistMode.Light) Color.White else Color.Black
        paparazzi.snapshot {
            JistTheme(fonts = fonts) {
                Box(modifier = Modifier.background(bg).padding(16.dp)) {
                    JistView(
                        name = templateKey,
                        templates = allTemplates,
                        data = allData[templateKey]!!.jsonObject,
                        theme = theme,
                        mode = mode,
                        formatDate = { _, _ -> "Apr 1, 2026" }
                    )
                }
            }
        }
    }

    // -- basic --

    @Test fun basic_light() = snapshot("basic", JistMode.Light)
    @Test fun basic_dark() = snapshot("basic", JistMode.Dark)

    // -- image --

    @Test fun image_light() = snapshot("image", JistMode.Light)
    @Test fun image_dark() = snapshot("image", JistMode.Dark)

    // -- cta --

    @Test fun cta_light() = snapshot("cta", JistMode.Light)
    @Test fun cta_dark() = snapshot("cta", JistMode.Dark)

    // -- action --

    @Test fun action_light() = snapshot("action", JistMode.Light)
    @Test fun action_dark() = snapshot("action", JistMode.Dark)

    // -- hero --

    @Test fun hero_light() = snapshot("hero", JistMode.Light)
    @Test fun hero_dark() = snapshot("hero", JistMode.Dark)

    // -- inbox --

    @Test fun inbox_light() = snapshot("inbox", JistMode.Light)
    @Test fun inbox_dark() = snapshot("inbox", JistMode.Dark)

    // -- profile --

    @Test fun profile_light() = snapshot("profile", JistMode.Light)
    @Test fun profile_dark() = snapshot("profile", JistMode.Dark)

    // -- stats --

    @Test fun stats_light() = snapshot("stats", JistMode.Light)
    @Test fun stats_dark() = snapshot("stats", JistMode.Dark)

    // -- announcement --

    @Test fun announcement_light() = snapshot("announcement", JistMode.Light)
    @Test fun announcement_dark() = snapshot("announcement", JistMode.Dark)
}

