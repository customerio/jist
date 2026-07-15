import ActivityKit
import SwiftUI
import WidgetKit
import Jist

struct JistLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: JistActivityAttributes.self) { context in
            lockScreenView(context: context)
                .padding()
                .activityBackgroundTint(Color(.secondarySystemBackground))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    lockScreenView(context: context)
                }
            } compactLeading: {
                Image(systemName: "shippingbox.fill")
            } compactTrailing: {
                Text("Live")
                    .font(.caption2)
            } minimal: {
                Image(systemName: "shippingbox.fill")
            }
        }
    }

    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<JistActivityAttributes>) -> some View {
        // Parsing goes through jist-core (Rust) — the same parser as Android/web.
        if let template = try? parseTemplateJson(json: context.attributes.templateJSON),
           let theme = try? parseDataJson(json: context.attributes.themeJSON),
           let data = try? parseDataJson(json: context.state.dataJSON) {
            JistView(
                name: "liveActivity",
                templates: ["liveActivity": [template]],
                data: data,
                theme: theme
            )
        }
    }
}
