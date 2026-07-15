plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("app.cash.paparazzi")
}

android {
    namespace = "io.customer.jist.example"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.customer.jist.example"
        minSdk = 21
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
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

val copySharedResources by tasks.registering(Copy::class) {
    from("../../shared") {
        include("*.json")
    }
    into("src/main/res/raw")
}

tasks.named("preBuild") {
    dependsOn(copySharedResources)
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation(project(":jist"))
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    // Plain JNA JAR for local JVM (Paparazzi) tests; the AAR variant comes
    // in transitively from :jist for device builds.
    testImplementation("net.java.dev.jna:jna:5.15.0")
    // Test-only JSON tooling for slicing shared/tests fixtures. Everything
    // handed to the renderer is parsed by jist-core (Rust).
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}

// JVM tests (Paparazzi) load the host build of jist-core; build it with
// `cargo build` in core/ first (see core/build-all.sh).
tasks.withType<Test>().configureEach {
    systemProperty("jna.library.path", "${rootDir}/../core/target/debug")
}
