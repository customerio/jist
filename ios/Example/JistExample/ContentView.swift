import ActivityKit
import SwiftUI
import Jist

struct ContentView: View {
    let templates: [String: [JistTemplate]]
    let dataEntries: [String: [String: JistValue]]
    let theme: [String: JistValue]

    @State private var isDarkMode = false
    @State private var actionLog: [String] = []
    @State private var currentActivity: Activity<JistActivityAttributes>?
    @State private var progressTask: Task<Void, Never>?

    private let templateOrder = ["basic", "image", "cta", "action", "hero", "inbox", "profile", "stats", "card", "announcement"]

    private let deliverySteps: [(title: String, body: String, step: String, eta: String)] = [
        ("Order Confirmed", "Your order #1234 has been confirmed.", "1 of 4", "ETA 30 min"),
        ("Preparing", "The kitchen is preparing your order.", "2 of 4", "ETA 20 min"),
        ("Out for Delivery", "Your driver is on the way!", "3 of 4", "ETA 5 min"),
        ("Delivered", "Your order has been delivered. Enjoy!", "4 of 4", "")
    ]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(templateOrder, id: \.self) { key in
                        if templates[key] != nil,
                           let data = dataEntries[key] {
                            cardView(key: key, data: data)
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

    private func cardView(key: String, data: [String: JistValue]) -> some View {
        JistView(
            name: key,
            templates: templates,
            data: data,
            theme: theme,
            mode: isDarkMode ? .dark : .light,
            formatDate: { iso, _ in formatRelative(iso) },
            onAction: { event in
                handleAction(event)
            }
        )
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(cardBackground)
        .cornerRadius(12)
        .shadow(color: .black.opacity(isDarkMode ? 0 : 0.08), radius: 4, y: 2)
    }

    // MARK: - Actions

    private func handleAction(_ event: JistActionEvent) {
        var parts = ["\(event.component) \"\(event.name)\""]
        if let meta = event.meta {
            parts.append("meta: \(meta)")
        }
        actionLog.insert(parts.joined(separator: " — "), at: 0)

        if event.component == "button" && event.name == "cta" {
            startLiveActivity()
        }
    }

    // MARK: - Live Activity

    private func dataForStep(_ step: (title: String, body: String, step: String, eta: String)) -> [String: JistValue] {
        var data: [String: JistValue] = [
            "title": .string(step.title),
            "body": .string(step.body),
            "step": .string(step.step),
            "timestamp": .string(ISO8601DateFormatter().string(from: Date()))
        ]
        if !step.eta.isEmpty {
            data["eta"] = .string(step.eta)
        }
        return data
    }

    private func startLiveActivity() {
        guard currentActivity == nil,
              let template = templates["liveActivity"]?.first(where: { $0.version == "1" }) else { return }

        // Serialization goes through jist-core (Rust) — the inverse of parsing.
        let templateJSON = templateToJson(template: template)
        let themeJSON = dataToJson(data: theme)
        let dataJSON = dataToJson(data: dataForStep(deliverySteps[0]))

        let attributes = JistActivityAttributes(templateJSON: templateJSON, themeJSON: themeJSON)
        let state = JistActivityAttributes.ContentState(dataJSON: dataJSON)

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: nil)
            )
            currentActivity = activity
            actionLog.insert("Live Activity started", at: 0)

            progressTask = Task {
                for i in 1..<deliverySteps.count {
                    try? await Task.sleep(for: .seconds(5))
                    if Task.isCancelled { return }

                    let stepData = dataForStep(deliverySteps[i])
                    let json = dataToJson(data: stepData)
                    let newState = JistActivityAttributes.ContentState(dataJSON: json)
                    await activity.update(ActivityContent(state: newState, staleDate: nil))

                    await MainActor.run {
                        actionLog.insert("Live Activity → \(deliverySteps[i].title)", at: 0)
                    }
                }

                try? await Task.sleep(for: .seconds(5))
                if Task.isCancelled { return }

                await activity.end(nil, dismissalPolicy: .immediate)
                await MainActor.run {
                    currentActivity = nil
                    progressTask = nil
                    actionLog.insert("Live Activity ended", at: 0)
                }
            }
        } catch {
            print("Failed to start live activity: \(error)")
        }
    }

    // MARK: - Action Log

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
