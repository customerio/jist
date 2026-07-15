// swift-tools-version: 5.9
import PackageDescription

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
        // C module for the UniFFI-generated bindings. The actual symbols come
        // from libjist_core.a (built from core/ — see core/build-all.sh),
        // staged into ios/Libs/ for local development. Distribution builds
        // will ship an XCFramework instead.
        .target(
            name: "JistCoreFFI",
            path: "Sources/JistCoreFFI"
        ),
        .target(
            name: "Jist",
            dependencies: ["JistCoreFFI"],
            linkerSettings: [
                .unsafeFlags(["-LLibs"]),
                .linkedLibrary("jist_core")
            ]
        ),
        .testTarget(
            name: "JistTests",
            dependencies: [
                "Jist",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ],
            exclude: ["__Snapshots__"]
        )
    ]
)
