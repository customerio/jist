// swift-tools-version: 6.0
import PackageDescription

// This manifest lives at the repo root so `github.com/customerio/jist` resolves as a Swift package.
// Targets point into `ios/` explicitly; SwiftPM compiles only the `Jist` target, so consumer
// binaries reference iOS code only (the rest of the monorepo is checked out but never built).
let package = Package(
    name: "Jist",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(name: "Jist", targets: ["Jist"])
    ],
    dependencies: [
        .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.17.0")
    ],
    targets: [
        // C module for the UniFFI-generated jist-core bindings. Symbols come
        // from libjist_core.a (built from core/ — see core/build-all.sh),
        // staged in ios/Libs for local development. Distribution builds will
        // ship an XCFramework instead.
        .target(
            name: "JistCoreFFI",
            path: "ios/Sources/JistCoreFFI"
        ),
        .target(
            name: "Jist",
            dependencies: ["JistCoreFFI"],
            path: "ios/Sources/Jist",
            swiftSettings: [.swiftLanguageMode(.v6)],
            linkerSettings: [
                .unsafeFlags(["-Lios/Libs"]),
                .linkedLibrary("jist_core")
            ]
        ),
        .testTarget(
            name: "JistTests",
            dependencies: [
                "Jist",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ],
            path: "ios/Tests/JistTests",
            exclude: ["__Snapshots__"],
            resources: [.process("Fonts")],
            swiftSettings: [.swiftLanguageMode(.v6)]
        )
    ]
)
