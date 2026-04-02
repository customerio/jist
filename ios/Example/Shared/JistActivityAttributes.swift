import ActivityKit
import Foundation

struct JistActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var dataJSON: String
    }

    let templateJSON: String
    let themeJSON: String
}
