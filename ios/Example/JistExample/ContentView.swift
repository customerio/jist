import SwiftUI
import Jist

struct ContentView: View {
    let templates: [String: JistTemplate]
    let dataEntries: [String: [String: JistValue]]
    let theme: [String: JistValue]

    @State private var isDarkMode = false
    @State private var actionLog: [String] = []

    private let templateOrder = ["basic", "image", "cta", "action"]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(templateOrder, id: \.self) { key in
                        if let template = templates[key],
                           let data = dataEntries[key] {
                            cardView(key: key, template: template, data: data)
                        }
                    }

                    if !actionLog.isEmpty {
                        logView
                    }
                }
                .padding()
            }
            .background(pageBackground)
            .navigationTitle("Jist Templates")
            .toolbar {
                Button(isDarkMode ? "Light Mode" : "Dark Mode") {
                    isDarkMode.toggle()
                }
            }
            .preferredColorScheme(isDarkMode ? .dark : .light)
        }
        .navigationViewStyle(.stack)
    }

    private func cardView(key: String, template: JistTemplate, data: [String: JistValue]) -> some View {
        JistView(
            template: template,
            data: data,
            theme: theme,
            mode: isDarkMode ? .dark : .light,
            formatDate: { iso, _ in formatRelative(iso) },
            onAction: { event in
                var parts = ["\(event.component) \"\(event.name)\""]
                if let meta = event.meta {
                    parts.append("meta: \(meta)")
                }
                actionLog.insert(parts.joined(separator: " — "), at: 0)
            }
        )
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(cardBackground)
        .cornerRadius(12)
        .shadow(color: .black.opacity(isDarkMode ? 0 : 0.08), radius: 4, y: 2)
    }

    private var logView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Action Log")
                .font(.headline)
            ForEach(Array(actionLog.enumerated()), id: \.offset) { _, entry in
                Text(entry)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(isDarkMode ? Color(white: 0.15) : Color(.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private var cardBackground: Color {
        isDarkMode ? Color(white: 0.11) : .white
    }

    private var pageBackground: Color {
        isDarkMode ? Color.black : Color(white: 0.95)
    }

    private func formatRelative(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        guard let date = f.date(from: iso) else { return iso }
        let diff = Date().timeIntervalSince(date)
        if diff < 60    { return "\(Int(diff))s ago" }
        if diff < 3600  { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        if diff < 2592000 { return "\(Int(diff / 86400))d ago" }
        return DateFormatter.localizedString(from: date, dateStyle: .medium, timeStyle: .none)
    }
}
