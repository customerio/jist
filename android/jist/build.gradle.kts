plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("io.customer.android.publish-module")
}

android {
    namespace = "io.customer.jist"
    compileSdk = 35

    defaultConfig {
        minSdk = 21
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        // The Android floor is minSdk 21. Calling an API above the floor without a
        // version guard must fail the build, not just warn.
        abortOnError = true
        error += "NewApi"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    testImplementation("junit:junit:4.13.2")
}

// Maven Central coordinates: io.customer.android:jist (group comes from the shared plugin).
customerIoPublish {
    artifactId = "jist"
    artifactName = "Customer.io Jist (Android)"
    description = "Customer.io Jist — native Android renderer for JSON-template inbox messages."
    url = "https://github.com/customerio/jist"
}
