import SwiftUI

/// Renders a Jist template tree into native SwiftUI views.
///
/// ```swift
/// JistView(
///     name: "basic",
///     templates: allTemplates,
///     data: ["title": .string("Hello")],
///     theme: theme,
///     formatDate: { iso, name in "2 hours ago" },
///     onAction: { event in print(event.name) }
/// )
/// ```
public struct JistView: View {
    private let name: String
    private let templates: [String: JistTemplate]
    private let data: [String: JistValue]
    private let theme: [String: JistValue]
    private let mode: JistMode
    private let formatDate: ((String, String) -> String)?
    private let onAction: ((JistActionEvent) -> Void)?

    private static let supportedVersion = "1"

    @Environment(\.colorScheme) private var colorScheme

    public init(
        name: String,
        templates: [String: [JistTemplate]],
        data: [String: JistValue],
        theme: [String: JistValue],
        mode: JistMode = .auto,
        formatDate: ((String, String) -> String)? = nil,
        onAction: ((JistActionEvent) -> Void)? = nil
    ) {
        self.name = name
        // Resolve: pick the template matching this renderer's supported version
        var resolved: [String: JistTemplate] = [:]
        for (key, versions) in templates {
            if let match = versions.first(where: { $0.version == Self.supportedVersion }) {
                resolved[key] = match
            }
        }
        self.templates = resolved
        self.data = data
        self.theme = theme
        self.mode = mode
        self.formatDate = formatDate
        self.onAction = onAction
    }

    public var body: some View {
        if let template = templates[name] {
            let isDark = resolveDarkMode()
            let resolver = JistThemeResolver(theme: theme, isDark: isDark)

            JistNodeView(
                node: template.root,
                data: data,
                resolver: resolver,
                formatDate: formatDate,
                onAction: onAction,
                templates: templates
            )
        }
    }

    private func resolveDarkMode() -> Bool {
        switch mode {
        case .dark:  return true
        case .light: return false
        case .auto:  return colorScheme == .dark
        }
    }
}
