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
    targets: [
        .target(name: "Jist")
    ]
)
