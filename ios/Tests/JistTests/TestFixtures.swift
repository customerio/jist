import Foundation
import Jist

/// Loads shared JSON fixtures from the `shared/` directory at the repo root.
enum TestFixtures {

    /// Path to the shared fixtures directory, resolved relative to this source file.
    private static let sharedDir: URL = {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // JistTests
            .deletingLastPathComponent() // Tests
            .deletingLastPathComponent() // ios
            .deletingLastPathComponent() // project root
            .appendingPathComponent("shared")
    }()

    // MARK: - Raw Data

    private static func loadData(_ filename: String) -> Data {
        let url = sharedDir.appendingPathComponent(filename)
        guard let data = try? Data(contentsOf: url) else {
            fatalError("Failed to load fixture \(filename) from \(url.path)")
        }
        return data
    }

    // MARK: - Templates

    /// Template keys to test (excludes liveActivity).
    static let templateKeys = ["basic", "image", "cta", "action", "hero", "inbox", "profile", "stats", "announcement"]

    /// Parses `templates.json` and returns versioned template arrays keyed by name.
    static func loadTemplates() -> [String: [JistTemplate]] {
        let data = loadData("templates.json")
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            fatalError("templates.json is not a valid JSON object")
        }
        var result: [String: [JistTemplate]] = [:]
        let decoder = JSONDecoder()
        for key in templateKeys {
            guard let versions = json[key] as? [Any] else { continue }
            var templates: [JistTemplate] = []
            for version in versions {
                guard let templateData = try? JSONSerialization.data(withJSONObject: version) else { continue }
                guard let template = try? decoder.decode(JistTemplate.self, from: templateData) else {
                    fatalError("Failed to decode template '\(key)'")
                }
                templates.append(template)
            }
            result[key] = templates
        }
        return result
    }

    // MARK: - Data

    /// Parses `data.json` and returns the data payload for each template key.
    static func loadData() -> [String: [String: JistValue]] {
        let data = loadData("data.json")
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            fatalError("data.json is not a valid JSON object")
        }
        var result: [String: [String: JistValue]] = [:]
        let decoder = JSONDecoder()
        for key in templateKeys {
            guard let value = json[key] else { continue }
            guard let entryData = try? JSONSerialization.data(withJSONObject: value) else { continue }
            guard let entry = try? decoder.decode([String: JistValue].self, from: entryData) else {
                fatalError("Failed to decode data for '\(key)'")
            }
            result[key] = entry
        }
        return result
    }

    // MARK: - Theme

    /// Parses `theme.json` as a flat `[String: JistValue]` dictionary.
    static func loadTheme() -> [String: JistValue] {
        let data = loadData("theme.json")
        let decoder = JSONDecoder()
        guard let theme = try? decoder.decode([String: JistValue].self, from: data) else {
            fatalError("Failed to decode theme.json")
        }
        return theme
    }
}
