plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("app.cash.paparazzi")
}

android {
    namespace = "io.customer.jist"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("test") {
            resources.srcDir("../../shared")
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")
    // JNA loads the jist-core (Rust) native library for the UniFFI bindings.
    // AAR variant for devices; plain JAR for local JVM (Paparazzi) tests.
    implementation("net.java.dev.jna:jna:5.15.0@aar")
    testImplementation("net.java.dev.jna:jna:5.15.0")
    testImplementation("io.coil-kt.coil3:coil-test:3.0.4")
}

// JVM tests (Paparazzi) load the host build of jist-core; build it with
// `cargo build` in core/ first (see core/build-all.sh).
tasks.withType<Test>().configureEach {
    systemProperty("jna.library.path", "${rootDir}/../core/target/debug")
}
