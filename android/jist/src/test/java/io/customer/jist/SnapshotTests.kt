package io.customer.jist

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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Before
import org.junit.Rule
import org.junit.Test

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

    private val allTemplates: Map<String, JistTemplate> by lazy {
        val obj = JistJson.parseToJsonElement(loadResource("templates.json")).jsonObject
        listOf("basic", "image", "cta", "action").associateWith { key ->
            JistJson.decodeFromJsonElement(JistTemplate.serializer(), obj[key]!!)
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
            Box(modifier = Modifier.background(bg).padding(16.dp)) {
                JistView(
                    template = allTemplates[templateKey]!!,
                    data = allData[templateKey]!!.jsonObject,
                    theme = theme,
                    mode = mode,
                    formatDate = { _, _ -> "Apr 1, 2026" }
                )
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
}
