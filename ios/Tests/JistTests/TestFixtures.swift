import Foundation
import Jist

/// Loads shared JSON fixtures from the `shared/` directory at the repo root.
///
/// All parsing goes through jist-core (Rust) via the generated
/// `parseRegistryJson` / `parseDataJson` bindings — the same parser used on
/// Android and (via wasm) the web.
enum TestFixtures {

    /// Path to the shared fixtures directory, resolved relative to this source file.
    private static let sharedDir: URL = {
        URL(fileURLWithPath: #file)
            .deletingLastPathComponent() // JistTests
            .deletingLastPathComponent() // Tests
            .deletingLastPathComponent() // ios
            .deletingLastPathComponent() // project root
            .appendingPathComponent("shared")
    }()

    // MARK: - Raw JSON

    private static func loadJSON(_ filename: String) -> String {
        let url = sharedDir.appendingPathComponent(filename)
        guard let json = try? String(contentsOf: url, encoding: .utf8) else {
            fatalError("Failed to load fixture \(filename) from \(url.path)")
        }
        return json
    }

    // MARK: - Templates

    /// Template keys to test (excludes liveActivity).
    static let templateKeys = ["basic", "image", "cta", "action", "hero", "inbox", "profile", "announcement"]

    /// Parses `templates.json` through jist-core and returns versioned
    /// template arrays keyed by name.
    static func loadTemplates() -> [String: [JistTemplate]] {
        guard let registry = try? parseRegistryJson(json: loadJSON("templates.json")) else {
            fatalError("jist-core failed to parse templates.json")
        }
        return registry
    }

    // MARK: - Data

    /// Parses `data.json` through jist-core and returns the data payload for
    /// each template key.
    static func loadData() -> [String: [String: JistValue]] {
        guard let all = try? parseDataJson(json: loadJSON("data.json")) else {
            fatalError("jist-core failed to parse data.json")
        }
        var result: [String: [String: JistValue]] = [:]
        for key in templateKeys {
            if let entry = all[key]?.objectValue {
                result[key] = entry
            }
        }
        return result
    }

    // MARK: - Theme

    /// Parses `theme.json` through jist-core as a `[String: JistValue]` dictionary.
    static func loadTheme() -> [String: JistValue] {
        guard let theme = try? parseDataJson(json: loadJSON("theme.json")) else {
            fatalError("jist-core failed to parse theme.json")
        }
        return theme
    }
}
