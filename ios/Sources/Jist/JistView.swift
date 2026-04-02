import SwiftUI

/// Renders a Jist template tree into native SwiftUI views.
///
/// ```swift
/// JistView(
///     template: template,
///     data: ["title": .string("Hello")],
///     theme: theme,
///     formatDate: { iso, name in "2 hours ago" },
///     onAction: { event in print(event.name) }
/// )
/// ```
public struct JistView: View {
    private let template: JistTemplate
    private let data: [String: JistValue]
    private let theme: [String: JistValue]
    private let mode: JistMode
    private let formatDate: ((String, String) -> String)?
    private let onAction: ((JistActionEvent) -> Void)?

    @Environment(\.colorScheme) private var colorScheme

    public init(
        template: JistTemplate,
        data: [String: JistValue],
        theme: [String: JistValue],
        mode: JistMode = .auto,
        formatDate: ((String, String) -> String)? = nil,
        onAction: ((JistActionEvent) -> Void)? = nil
    ) {
        self.template = template
        self.data = data
        self.theme = theme
        self.mode = mode
        self.formatDate = formatDate
        self.onAction = onAction
    }

    public var body: some View {
        if template.version == supportedVersion {
            let isDark = resolveDarkMode()
            let resolver = JistThemeResolver(theme: theme, isDark: isDark)

            JistNodeView(
                node: template.root,
                data: data,
                resolver: resolver,
                formatDate: formatDate,
                onAction: onAction
            )
        }
    }

    private let supportedVersion = "1"

    private func resolveDarkMode() -> Bool {
        switch mode {
        case .dark:  return true
        case .light: return false
        case .auto:  return colorScheme == .dark
        }
    }
}
