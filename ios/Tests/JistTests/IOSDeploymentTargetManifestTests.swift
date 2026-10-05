import Foundation
import XCTest

final class IOSDeploymentTargetManifestTests: XCTestCase {
    private let expectedManifestMarkers: [String: String] = [
        "Jist.podspec": "spec.ios.deployment_target = \"15.0\"",
        "Package.swift": ".iOS(.v15)",
    ]

    func testOwnedIOSManifests_whenValidated_useIOS15DeploymentTarget() throws {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let discoveredManifests = try FileManager.default
            .contentsOfDirectory(at: repositoryRoot, includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent == "Package.swift" || $0.pathExtension == "podspec" }
            .map(\.lastPathComponent)

        XCTAssertEqual(Set(discoveredManifests), Set(expectedManifestMarkers.keys))

        for (relativePath, marker) in expectedManifestMarkers {
            let contents = try String(
                contentsOf: repositoryRoot.appendingPathComponent(relativePath),
                encoding: .utf8
            )
            XCTAssertTrue(
                contents.contains(marker),
                "Expected \(relativePath) to declare the iOS 15 deployment target with \(marker)"
            )
        }
    }
}
