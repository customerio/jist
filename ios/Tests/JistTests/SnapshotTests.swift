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
final class JistSnapshotTests: XCTestCase {

    private var templates: [String: [JistTemplate]]!
    private var dataMap: [String: [String: JistValue]]!
    private var theme: [String: JistValue]!

    /// Deterministic date formatter that always returns a fixed string.
    private let formatDate: (String, String) -> String = { _, _ in "Apr 1, 2026" }

    override func setUp() {
        super.setUp()
        Self.registerFonts()
        templates = TestFixtures.loadTemplates()
        dataMap = TestFixtures.loadData()
        theme = TestFixtures.loadTheme()
        // Uncomment to record new reference snapshots, then set back to false.
        // isRecording = true
    }

    /// Registers all bundled font files with Core Text so UIFont/NSFont can resolve them
    /// by family name — the same path used by JistThemeResolver at runtime.
    /// Safe to call multiple times; CTFontManagerRegisterFontsForURL is idempotent.
    private static func registerFonts() {
        let extensions = ["ttf", "otf"]
        guard let urls = Bundle.module.urls(forResourcesWithExtension: nil, subdirectory: nil) else { return }
        for url in urls where extensions.contains(url.pathExtension.lowercased()) {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    // MARK: - Light Mode

    func testBasicLight() {
        assertTemplateSnapshot("basic", mode: .light)
    }

    func testImageLight() {
        assertTemplateSnapshot("image", mode: .light)
    }

    func testCtaLight() {
        assertTemplateSnapshot("cta", mode: .light)
    }

    func testActionLight() {
        assertTemplateSnapshot("action", mode: .light)
    }

    func testHeroLight() {
        assertTemplateSnapshot("hero", mode: .light)
    }

    func testInboxLight() {
        assertTemplateSnapshot("inbox", mode: .light)
    }

    func testProfileLight() {
        assertTemplateSnapshot("profile", mode: .light)
    }

    func testStatsLight() {
        assertTemplateSnapshot("stats", mode: .light)
    }

    func testCardLight() {
        assertTemplateSnapshot("card", mode: .light)
    }

    func testAnnouncementLight() {
        assertTemplateSnapshot("announcement", mode: .light)
    }

    // MARK: - Dark Mode

    func testBasicDark() {
        assertTemplateSnapshot("basic", mode: .dark)
    }

    func testImageDark() {
        assertTemplateSnapshot("image", mode: .dark)
    }

    func testCtaDark() {
        assertTemplateSnapshot("cta", mode: .dark)
    }

    func testActionDark() {
        assertTemplateSnapshot("action", mode: .dark)
    }

    func testHeroDark() {
        assertTemplateSnapshot("hero", mode: .dark)
    }

    func testInboxDark() {
        assertTemplateSnapshot("inbox", mode: .dark)
    }

    func testProfileDark() {
        assertTemplateSnapshot("profile", mode: .dark)
    }

    func testStatsDark() {
        assertTemplateSnapshot("stats", mode: .dark)
    }

    func testCardDark() {
        assertTemplateSnapshot("card", mode: .dark)
    }

    func testAnnouncementDark() {
        assertTemplateSnapshot("announcement", mode: .dark)
    }

    // MARK: - Placeholder Images

    /// Generates a solid-color PNG in a temp file and returns its file URL.
    /// AsyncImage can load file:// URLs via URLSession, giving us a
    /// deterministic image without network access.
    private static func createPlaceholderPNG(width: Int, height: Int, hex: String) -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("jist-placeholder-\(width)x\(height).png")

        // Only create once per test run
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

    /// 600x400 gray placeholder for the dashboard/media image
    private static let mediaPlaceholder = createPlaceholderPNG(width: 600, height: 400, hex: "#e2e8f0")
    /// 96x96 indigo placeholder for the avatar image
    private static let avatarPlaceholder = createPlaceholderPNG(width: 96, height: 96, hex: "#c7d2fe")

    private static func loadLocalImage(_ url: URL) -> Image? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        #if os(macOS)
        guard let nsImage = NSImage(data: data) else { return nil }
        return Image(nsImage: nsImage)
        #else
        guard let uiImage = UIImage(data: data) else { return nil }
        return Image(uiImage: uiImage)
        #endif
    }

    /// Replaces remote image URLs in test data with local placeholder file URLs.
    private func withPlaceholderImages(_ data: [String: JistValue]) -> [String: JistValue] {
        var result = data
        if result["media"] != nil {
            result["media"] = .string(Self.mediaPlaceholder.absoluteString)
        }
        if result["avatar"] != nil {
            result["avatar"] = .string(Self.avatarPlaceholder.absoluteString)
        }
        if result["icon"] != nil {
            result["icon"] = .string(Self.avatarPlaceholder.absoluteString)
        }
        return result
    }

    // MARK: - Helpers

    private func assertTemplateSnapshot(
        _ key: String,
        mode: JistMode,
        file: StaticString = #filePath,
        testName: String = #function,
        line: UInt = #line
    ) {
        guard templates[key] != nil else {
            XCTFail("Missing template '\(key)'", file: file, line: line)
            return
        }
        guard let data = dataMap[key] else {
            XCTFail("Missing data for '\(key)'", file: file, line: line)
            return
        }

        let colorScheme: ColorScheme = mode == .dark ? .dark : .light
        let snapshotName = "\(key)-\(mode == .dark ? "dark" : "light")"

        let view = JistView(
            name: key,
            templates: templates,
            data: withPlaceholderImages(data),
            theme: theme,
            mode: mode,
            formatDate: formatDate,
            onAction: nil
        )
        .frame(width: 390)
        .padding()
        .background(mode == .dark ? Color.black : Color.white)
        .environment(\.colorScheme, colorScheme)
        .environment(\.jistImageProvider, Self.loadLocalImage)

        #if os(macOS)
        let hostingView = NSHostingView(rootView: view)
        hostingView.frame = NSRect(x: 0, y: 0, width: 390, height: 600)

        let window = NSWindow(
            contentRect: NSRect(x: -10000, y: -10000, width: 390, height: 600),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.contentView = hostingView
        window.orderBack(nil)

        let fittingSize = hostingView.fittingSize
        let finalSize = NSSize(width: 390, height: max(fittingSize.height, 100))
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

        let fittingSize = viewController.view.systemLayoutSizeFitting(
            CGSize(width: 390, height: UIView.layoutFittingCompressedSize.height),
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        )
        viewController.view.frame.size = CGSize(width: 390, height: max(fittingSize.height, 100))

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
/// Renders an NSView into a 1x NSImage regardless of the screen's backing scale factor.
/// This ensures snapshots are identical on Retina (2x) and non-Retina (1x) displays.
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
