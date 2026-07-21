# Releasing Jist

Jist publishes three packages from this repository. Each package has its own version and release
cadence.

| Package | Registry | Release tag |
| --- | --- | --- |
| Web — `@customerio/jist` | npm | `web-vX.Y.Z` |
| Android — `io.customer.android:jist` | Maven Central | `android-vX.Y.Z` |
| iOS — `Jist` | Swift Package Manager and CocoaPods | `vX.Y.Z` |

Release one platform at a time. The versions do not need to match across platforms.

> **Current availability:** Release Web is live. Release Android and Release iOS are added alongside
> this guide. Before its first run, the iOS CocoaPods publish requires the `COCOAPODS_TRUNK_TOKEN`
> secret to be configured for the repository (a maintainer setup step).

## Before releasing

1. Confirm the change is merged to `main` and required CI checks pass.
2. Review the changes since that platform's previous release and choose the version bump:
   - `patch` for compatible bug fixes.
   - `minor` for compatible new functionality.
   - `major` for breaking changes.

Every release workflow takes the same input: a `patch` / `minor` / `major` bump plus a **dry run**
toggle. You never type a version string — the workflow computes the next version from the platform's
committed version (Web: `web/package.json`, iOS: `Jist.podspec`, Android: its version property),
validates it (the tag is unused and the version is not already published), then tags and publishes.

## Web

1. Open **Actions → Release Web**.
2. Run the workflow from `main` and choose `patch`, `minor`, or `major`. The workflow calculates the
   version from `web/package.json`.
3. Use **dry run** first. Review the package contents and calculated tag.
4. Run the release without dry run.
5. Wait for **Publish Package** to succeed for the new `web-vX.Y.Z` tag.
6. Confirm the new version is visible for `@customerio/jist` on npm.

The publish workflow also publishes the package to GitHub Packages.

## Android

1. Open **Actions → Release Android**.
2. Run the workflow from `main` and choose `patch`, `minor`, or `major`. The workflow calculates the
   version from Android's committed version property.
3. Use **dry run** first. Review the calculated version and proposed `android-vX.Y.Z` tag.
4. Run the release without dry run.
5. Wait for **Publish Android** to complete. A successful tag-triggered release is promoted to Maven
   Central without a separate approval.
6. Confirm that `io.customer.android:jist:X.Y.Z` is visible on Maven Central. Registry propagation may
   take some time after the workflow succeeds.

Smoke-test the published artifact in a sample application:

```kotlin
dependencies {
    implementation("io.customer.android:jist:X.Y.Z")
}
```

Only `google()` and `mavenCentral()` should be required.

## iOS

1. Open **Actions → Release iOS**.
2. Run the workflow from `main` and choose `patch`, `minor`, or `major`. The workflow calculates the
   version from `Jist.podspec`.
3. Use **dry run** first. Review the calculated version and proposed `vX.Y.Z` tag.
4. Run the release without dry run. Creating the tag makes the version available to Swift Package
   Manager.
5. Wait for **Publish iOS** to publish the same version to the CocoaPods trunk.
6. Confirm that both consumer paths resolve the new version.

Swift Package Manager:

```swift
.package(url: "https://github.com/customerio/jist.git", from: "X.Y.Z")
```

CocoaPods:

```ruby
pod 'Jist', 'X.Y.Z'
```

Do not announce an iOS release as complete until both Swift Package Manager and CocoaPods have been
verified. The Git tag makes the Swift Package Manager release available before the CocoaPods publish
job finishes.

## If a release fails

Do not move or delete a release tag, and do not attempt to overwrite a version already accepted by a
registry.

| Failure point | Action |
| --- | --- |
| Before a tag was created | Fix the problem and run the release workflow again. The same version can be reused while it remains unpublished. |
| After tagging, before registry acceptance | Re-run the publish workflow for the existing tag. Do not create a replacement tag for the same version. |
| Android artifact is staged but not released | Inspect the staging validation, correct recoverable configuration problems, and re-run the publish. |
| A registry already accepted the version | Fix the problem and release a new version, normally a `patch`. |
| SwiftPM works but CocoaPods failed | Re-run **Publish iOS** for the existing immutable `vX.Y.Z` tag. If that version cannot be accepted, release a new `patch`. |

Ask the SDK maintainers for help if the publish workflow cannot publish the exact tagged commit.

## Release completion checklist

A release is complete when:

- The release workflow and publish workflow succeeded.
- The version is visible in the intended registry or registries.
- A consumer smoke test resolves and builds the published package.
