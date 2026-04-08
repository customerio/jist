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
        if let template = decode(context.attributes.templateJSON, as: JistTemplate.self),
           let theme = decode(context.attributes.themeJSON, as: [String: JistValue].self),
           let data = decode(context.state.dataJSON, as: [String: JistValue].self) {
            JistView(
                name: "liveActivity",
                templates: ["liveActivity": [template]],
                data: data,
                theme: theme
            )
        }
    }

    private func decode<T: Decodable>(_ json: String, as type: T.Type) -> T? {
        try? JSONDecoder().decode(type, from: Data(json.utf8))
    }
}
