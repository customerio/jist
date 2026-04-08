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

    static func loadTemplates() -> [String: [JistTemplate]] {
        guard let url = Bundle.main.url(forResource: "templates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }

        var result: [String: [JistTemplate]] = [:]
        let decoder = JSONDecoder()
        for (key, value) in raw where key != "$schema" {
            guard let versions = value as? [Any] else { continue }
            var templates: [JistTemplate] = []
            for version in versions {
                if let templateData = try? JSONSerialization.data(withJSONObject: version),
                   let template = try? decoder.decode(JistTemplate.self, from: templateData) {
                    templates.append(template)
                }
            }
            result[key] = templates
        }
        return result
    }

    static func loadData() -> [String: [String: JistValue]] {
        guard let url = Bundle.main.url(forResource: "data", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: [String: JistValue]].self, from: data) else { return [:] }
        return decoded
    }

    static func loadTheme() -> [String: JistValue] {
        guard let url = Bundle.main.url(forResource: "theme", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: JistValue].self, from: data) else { return [:] }
        return decoded
    }
}
