plugins {
    id("com.android.application") version "8.7.3" apply false
    id("com.android.library") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
    id("app.cash.paparazzi") version "1.3.5" apply false
    // Shared Customer.io publishing plugin (from customerio/mobile-ci-tools). The version is used
    // when resolved from Maven Central; it is ignored when overridden via includeBuild (see
    // settings.gradle.kts -PuseLocalPublishPlugin).
    id("io.customer.android.publish-root") version "0.1.0"
    id("io.customer.android.publish-module") version "0.1.0" apply false
}
