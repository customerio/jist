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
        .target(name: "Jist"),
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
