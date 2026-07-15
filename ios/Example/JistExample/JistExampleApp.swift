import SwiftUI
import Jist

@main
struct JistExampleApp: App {
    let templates: [String: [JistTemplate]]
    let dataEntries: [String: [String: JistValue]]
    let theme: [String: JistValue]

    init() {
        templates = Self.loadTemplates()
        dataEntries = Self.loadData()
        theme = Self.loadTheme()
    }

    var body: some Scene {
        WindowGroup {
            ContentView(templates: templates, dataEntries: dataEntries, theme: theme)
        }
    }

    // All parsing goes through jist-core (Rust) — the same parser as Android/web.

    private static func loadJSON(_ resource: String) -> String? {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "json"),
              let json = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        return json
    }

    static func loadTemplates() -> [String: [JistTemplate]] {
        guard let json = loadJSON("templates"),
              let registry = try? parseRegistryJson(json: json) else { return [:] }
        return registry
    }

    static func loadData() -> [String: [String: JistValue]] {
        guard let json = loadJSON("data"),
              let all = try? parseDataJson(json: json) else { return [:] }
        return all.compactMapValues { $0.objectValue }
    }

    static func loadTheme() -> [String: JistValue] {
        guard let json = loadJSON("theme"),
              let theme = try? parseDataJson(json: json) else { return [:] }
        return theme
    }
}
