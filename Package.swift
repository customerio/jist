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
        .target(
            name: "Jist",
            path: "ios/Sources/Jist",
            swiftSettings: [.swiftLanguageMode(.v6)]
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
