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
import io.customer.jist.JistView
import kotlinx.serialization.json.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.io.File

class ComponentSnapshotTests {

    @get:Rule
    val paparazzi = Paparazzi(
        deviceConfig = DeviceConfig.PIXEL_5,
        renderingMode = SessionParams.RenderingMode.SHRINK
    )

    @Before
    fun setUp() {
        val placeholder = Bitmap.createBitmap(400, 200, Bitmap.Config.ARGB_8888).apply {
            eraseColor(AndroidColor.parseColor("#94a3b8"))
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

    private val sharedTestsDir: File by lazy {
        val candidate = File(System.getProperty("user.dir")).resolve("../shared/tests")
        if (candidate.isDirectory) candidate
        else File(System.getProperty("user.dir")).resolve("../../shared/tests")
    }

    @Test
    fun componentFixtures() {
        sharedTestsDir.listFiles { f -> f.extension == "json" }?.sorted()?.forEach { file ->
            val component = file.nameWithoutExtension
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
                val template = JistJson.decodeFromJsonElement<JistTemplate>(templateJson)

                val data = caseObj["data"]!!.jsonObject.toMap()
                val theme = caseObj["theme"]!!.jsonObject

                for (mode in listOf(JistMode.Light, JistMode.Dark)) {
                    val modeName = if (mode == JistMode.Light) "light" else "dark"
                    val bg = if (mode == JistMode.Light) Color.White else Color.Black

                    paparazzi.snapshot(name = "${component}_${caseName}_${modeName}") {
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
