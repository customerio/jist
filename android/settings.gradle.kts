pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

// Local dev override: resolve the io.customer.android.publish-* plugins from a sibling
// mobile-ci-tools checkout instead of Maven Central. Enable with -PuseLocalPublishPlugin=true
// (requires customerio/mobile-ci-tools checked out next to this repo).
if (providers.gradleProperty("useLocalPublishPlugin").orNull == "true") {
    includeBuild("../../mobile-ci-tools/gradle-plugins/android-publish")
}

rootProject.name = "jist-android"
include(":jist")
include(":example")
