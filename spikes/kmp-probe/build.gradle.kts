// KMP size probe: the same logic slice jist-core (Rust) carries — models +
// parsing + theme cascade — compiled as a Kotlin/Native static framework for
// iOS, to measure the app-size delta Kotlin Multiplatform would cost.
//
// Build:  ../../android/gradlew -p . linkReleaseFrameworkIosArm64
plugins {
    kotlin("multiplatform") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
}

kotlin {
    iosArm64 {
        binaries.framework {
            baseName = "JistKmp"
            isStatic = true
        }
    }
    sourceSets {
        commonMain.dependencies {
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
        }
    }
}
