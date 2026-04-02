package io.customer.jist.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import io.customer.jist.JistActionEvent
import io.customer.jist.JistMode
import io.customer.jist.JistTemplate
import io.customer.jist.JistView
import kotlinx.serialization.json.*
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val templates = loadTemplates()
        val dataEntries = loadData()
        val theme = loadTheme()

        setContent {
            ExampleScreen(templates, dataEntries, theme)
        }
    }

    private fun loadTemplates(): Map<String, JistTemplate> {
        val json = resources.openRawResource(R.raw.templates).bufferedReader().readText()
        val obj = Json.parseToJsonElement(json).jsonObject
        val config = Json { ignoreUnknownKeys = true }
        return obj.filterKeys { !it.startsWith("$") }
            .mapValues { config.decodeFromJsonElement<JistTemplate>(it.value) }
    }

    private fun loadData(): Map<String, JsonObject> {
        val json = resources.openRawResource(R.raw.data).bufferedReader().readText()
        return Json.parseToJsonElement(json).jsonObject
            .mapValues { it.value.jsonObject }
    }

    private fun loadTheme(): JsonObject {
        val json = resources.openRawResource(R.raw.theme).bufferedReader().readText()
        return Json.parseToJsonElement(json).jsonObject
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExampleScreen(
    templates: Map<String, JistTemplate>,
    dataEntries: Map<String, JsonObject>,
    theme: JsonObject
) {
    var isDarkMode by remember { mutableStateOf(false) }
    val actionLog = remember { mutableStateListOf<String>() }
    val templateOrder = listOf("basic", "image", "cta", "action")

    val colorScheme = if (isDarkMode) darkColorScheme() else lightColorScheme()

    MaterialTheme(colorScheme = colorScheme) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Jist Templates") },
                    actions = {
                        TextButton(onClick = { isDarkMode = !isDarkMode }) {
                            Text(if (isDarkMode) "Light Mode" else "Dark Mode")
                        }
                    }
                )
            },
            containerColor = if (isDarkMode) Color(0xFF121212) else Color(0xFFF2F2F7)
        ) { padding ->
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                items(templateOrder) { key ->
                    val template = templates[key] ?: return@items
                    val data = dataEntries[key] ?: return@items

                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isDarkMode) Color(0xFF1C1C1E) else Color.White
                        ),
                        elevation = CardDefaults.cardElevation(
                            defaultElevation = if (isDarkMode) 0.dp else 2.dp
                        )
                    ) {
                        JistView(
                            template = template,
                            data = data,
                            theme = theme,
                            mode = if (isDarkMode) JistMode.Dark else JistMode.Light,
                            formatDate = { iso, _ -> formatRelative(iso) },
                            onAction = { event ->
                                val parts = mutableListOf("${event.component} \"${event.name}\"")
                                event.meta?.let { parts.add("meta: $it") }
                                actionLog.add(0, parts.joinToString(" — "))
                            },
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }

                if (actionLog.isNotEmpty()) {
                    item {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isDarkMode) Color(0xFF2A2A2C) else Color(0xFFE8E8ED)
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    "Action Log",
                                    style = MaterialTheme.typography.titleMedium
                                )
                                Spacer(Modifier.height(8.dp))
                                actionLog.forEach { entry ->
                                    Text(
                                        entry,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatRelative(iso: String): String {
    return try {
        val then = Instant.parse(iso)
        val now = Instant.now()
        val seconds = ChronoUnit.SECONDS.between(then, now)
        when {
            seconds < 60 -> "${seconds}s ago"
            seconds < 3600 -> "${seconds / 60}m ago"
            seconds < 86400 -> "${seconds / 3600}h ago"
            seconds < 2592000 -> "${seconds / 86400}d ago"
            else -> {
                val date = then.atZone(ZoneId.systemDefault()).toLocalDate()
                java.time.format.DateTimeFormatter.ofLocalizedDate(java.time.format.FormatStyle.MEDIUM)
                    .format(date)
            }
        }
    } catch (_: Exception) {
        iso
    }
}
