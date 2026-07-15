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
import org.junit.Before
import uniffi.jist_core.JistMode
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

    // -- announcement --

    @Test fun announcement_light() = snapshot("announcement", JistMode.LIGHT)
    @Test fun announcement_dark() = snapshot("announcement", JistMode.DARK)
}
