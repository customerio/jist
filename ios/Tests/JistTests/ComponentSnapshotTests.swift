import XCTest
import SwiftUI
import CoreText
import Jist
import SnapshotTesting

#if os(macOS)
import AppKit
#else
import UIKit
#endif

@MainActor
final class ComponentSnapshotTests: XCTestCase {

    /// Deterministic date formatter that always returns a fixed string.
    private let formatDate: (String, String) -> String = { _, _ in "Apr 1, 2026" }

    /// Path to the shared fixtures directory, resolved relative to this source file.
    private static let sharedDir: URL = {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // JistTests
            .deletingLastPathComponent() // Tests
            .deletingLastPathComponent() // ios
            .deletingLastPathComponent() // project root
            .appendingPathComponent("shared")
    }()

    /// Path to the component test fixtures directory.
    private static let testsDir: URL = {
        sharedDir.appendingPathComponent("tests")
    }()

    override func setUp() {
        super.setUp()
        Self.registerFonts()
        // Uncomment to record new reference snapshots, then set back to false.
        // isRecording = true
    }

    /// Registers all bundled font files with Core Text so UIFont/NSFont can resolve them
    /// by family name -- the same path used by JistThemeResolver at runtime.
    /// Safe to call multiple times; CTFontManagerRegisterFontsForURL is idempotent.
    private static func registerFonts() {
        let extensions = ["ttf", "otf"]
        guard let urls = Bundle.module.urls(forResourcesWithExtension: nil, subdirectory: nil) else { return }
        for url in urls where extensions.contains(url.pathExtension.lowercased()) {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    // MARK: - Placeholder Images

    /// Generates a solid-color PNG in a temp file and returns its file URL.
    private static func createPlaceholderPNG(width: Int, height: Int, hex: String) -> URL {
        let hexClean = hex.replacingOccurrences(of: "#", with: "")
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("jist-component-placeholder-\(width)x\(height)-\(hexClean).png")

        if FileManager.default.fileExists(atPath: url.path) { return url }

        #if os(macOS)
        let image = NSImage(size: NSSize(width: width, height: height))
        image.lockFocus()
        (NSColor(hex: hex) ?? .gray).setFill()
        NSBezierPath.fill(NSRect(x: 0, y: 0, width: width, height: height))
        image.unlockFocus()

        guard let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let png = rep.representation(using: .png, properties: [:]) else {
            fatalError("Failed to create placeholder PNG")
        }
        try! png.write(to: url)
        #else
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
        let data = renderer.pngData { ctx in
            (UIColor(hex: hex) ?? .gray).setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        }
        try! data.write(to: url)
        #endif

        return url
    }

    private static let imagePlaceholder = createPlaceholderPNG(width: 400, height: 200, hex: "#94a3b8")

    // MARK: - Main Test

    func testAllComponentFixtures() throws {
        let fixtureFiles = try FileManager.default.contentsOfDirectory(
            at: Self.testsDir,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "json" }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }

        XCTAssertFalse(fixtureFiles.isEmpty, "No fixture files found in \(Self.testsDir.path)")

        let decoder = JSONDecoder()

        for fixtureURL in fixtureFiles {
            let component = fixtureURL.deletingPathExtension().lastPathComponent
            let fileData = try Data(contentsOf: fixtureURL)

            guard let fixtureJSON = try JSONSerialization.jsonObject(with: fileData) as? [String: Any] else {
                XCTFail("Invalid JSON in \(fixtureURL.lastPathComponent)")
                continue
            }

            for (caseName, caseValue) in fixtureJSON.sorted(by: { $0.key < $1.key }) {
                guard let caseDict = caseValue as? [String: Any] else {
                    XCTFail("\(component).\(caseName): case value is not a dictionary")
                    continue
                }

                guard let nodeJSON = caseDict["node"] as? [String: Any] else {
                    XCTFail("\(component).\(caseName): missing 'node'")
                    continue
                }

                // Decode node
                let nodeData = try JSONSerialization.data(withJSONObject: nodeJSON)
                let node = try decoder.decode(JistNode.self, from: nodeData)
                _ = node // validates decoding

                // Build wrapper template: layout(vertical) with node as single child
                let wrapperJSON: [String: Any] = [
                    "version": "1",
                    "root": [
                        "type": "layout",
                        "direction": "vertical",
                        "children": [nodeJSON]
                    ]
                ]
                let wrapperData = try JSONSerialization.data(withJSONObject: wrapperJSON)
                let template = try decoder.decode(JistTemplate.self, from: wrapperData)

                // Decode data
                var caseData: [String: JistValue] = [:]
                if let dataJSON = caseDict["data"] {
                    let dataBytes = try JSONSerialization.data(withJSONObject: dataJSON)
                    caseData = try decoder.decode([String: JistValue].self, from: dataBytes)
                }

                // For image nodes, replace URLs with local placeholder
                let nodeType = nodeJSON["type"] as? String
                if nodeType == "image", let nameKey = nodeJSON["name"] as? String {
                    caseData[nameKey] = .string(Self.imagePlaceholder.absoluteString)
                }

                // Decode theme
                var caseTheme: [String: JistValue] = [:]
                if let themeJSON = caseDict["theme"] as? [String: Any], !themeJSON.isEmpty {
                    let themeBytes = try JSONSerialization.data(withJSONObject: themeJSON)
                    caseTheme = try decoder.decode([String: JistValue].self, from: themeBytes)
                }

                let registry: [String: [JistTemplate]] = ["test": [template]]

                for mode: JistMode in [.light, .dark] {
                    let colorScheme: ColorScheme = mode == .dark ? .dark : .light
                    let modeLabel = mode == .dark ? "dark" : "light"
                    let snapshotName = "\(component)-\(caseName)-\(modeLabel)"

                    let view = JistView(
                        name: "test",
                        templates: registry,
                        data: caseData,
                        theme: caseTheme,
                        mode: mode,
                        formatDate: formatDate,
                        onAction: nil
                    )
                    .frame(width: 390)
                    .padding()
                    .background(mode == .dark ? Color.black : Color.white)
                    .environment(\.colorScheme, colorScheme)

                    assertComponentSnapshot(
                        view: view,
                        mode: mode,
                        snapshotName: snapshotName,
                        context: "\(component).\(caseName).\(modeLabel)"
                    )
                }
            }
        }
    }

    // MARK: - Snapshot Helper

    private func assertComponentSnapshot<V: View>(
        view: V,
        mode: JistMode,
        snapshotName: String,
        context: String,
        file: StaticString = #filePath,
        testName: String = #function,
        line: UInt = #line
    ) {
        #if os(macOS)
        let hostingView = NSHostingView(rootView: view)
        hostingView.frame = NSRect(x: 0, y: 0, width: 390, height: 400)

        let window = NSWindow(
            contentRect: NSRect(x: -10000, y: -10000, width: 390, height: 400),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.contentView = hostingView
        window.orderBack(nil)

        // Let AsyncImage load the local placeholder files
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 1.0))

        // Re-layout now that images have loaded
        let fittingSize = hostingView.fittingSize
        let finalSize = NSSize(width: 390, height: max(fittingSize.height, 50))
        hostingView.frame.size = finalSize

        let image = renderViewAt1x(hostingView, size: finalSize)

        assertSnapshot(
            of: image,
            as: .image(precision: 0.99, perceptualPrecision: 0.98),
            named: snapshotName,
            file: file,
            testName: testName,
            line: line
        )

        window.contentView = nil
        #else
        let viewController = UIHostingController(rootView: view)
        viewController.view.frame = CGRect(x: 0, y: 0, width: 390, height: 0)
        viewController.view.backgroundColor = mode == .dark ? .black : .white

        // Let AsyncImage load the local placeholder files
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 1.0))

        let fittingSize = viewController.view.systemLayoutSizeFitting(
            CGSize(width: 390, height: UIView.layoutFittingCompressedSize.height),
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        )
        viewController.view.frame.size = CGSize(width: 390, height: max(fittingSize.height, 50))

        assertSnapshot(
            of: viewController,
            as: .image(precision: 0.99, perceptualPrecision: 0.98),
            named: snapshotName,
            file: file,
            testName: testName,
            line: line
        )
        #endif
    }
}

// MARK: - 1x Rendering Helper

#if os(macOS)
private func renderViewAt1x(_ view: NSView, size: NSSize) -> NSImage {
    let width = Int(size.width)
    let height = Int(size.height)
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    rep.size = size

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    view.displayIgnoringOpacity(view.bounds, in: NSGraphicsContext.current!)
    NSGraphicsContext.restoreGraphicsState()

    let image = NSImage(size: size)
    image.addRepresentation(rep)
    return image
}
#endif

// MARK: - Color Hex Helper (test only)

#if os(macOS)
private extension NSColor {
    convenience init?(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard h.count == 6, let val = UInt64(h, radix: 16) else { return nil }
        self.init(
            red: CGFloat((val >> 16) & 0xFF) / 255,
            green: CGFloat((val >> 8) & 0xFF) / 255,
            blue: CGFloat(val & 0xFF) / 255,
            alpha: 1
        )
    }
}
#else
private extension UIColor {
    convenience init?(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard h.count == 6, let val = UInt64(h, radix: 16) else { return nil }
        self.init(
            red: CGFloat((val >> 16) & 0xFF) / 255,
            green: CGFloat((val >> 8) & 0xFF) / 255,
            blue: CGFloat(val & 0xFF) / 255,
            alpha: 1
        )
    }
}
#endif
