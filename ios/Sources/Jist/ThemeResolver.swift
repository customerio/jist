import SwiftUI

/// Thin SwiftUI adapter over the jist-core (Rust) `ThemeResolver`.
///
/// The cascade (state → dark → variant → base), hex-color parsing, and
/// font-weight bucketing all live in core/jist-core/src/theme_resolver.rs —
/// shared with Android. This file only maps Rust results onto SwiftUI types.
public struct JistThemeResolver {
    private let core: ThemeResolver

    public init(theme: [String: JistValue], isDark: Bool) {
        self.core = ThemeResolver(theme: theme, isDark: isDark)
    }

    /// Resolve a theme property using the cascade:
    /// state paths first (if state provided), then non-state paths.
    /// Within each: dark variant -> dark base -> light variant -> light base.
    public func resolve(
        type: String,
        variant: String? = nil,
        group: String,
        property: String,
        state: String? = nil
    ) -> JistValue? {
        core.resolve(typeName: type, variant: variant, group: group, property: property, state: state)
    }

    public func resolveColor(
        type: String,
        variant: String? = nil,
        group: String,
        property: String,
        state: String? = nil,
        fallback: Color
    ) -> Color {
        guard let c = core.resolveColor(typeName: type, variant: variant, group: group, property: property, state: state) else {
            return fallback
        }
        return Color(red: c.r, green: c.g, blue: c.b, opacity: c.a)
    }

    public func resolveNumber(
        type: String,
        variant: String? = nil,
        group: String,
        property: String,
        state: String? = nil,
        fallback: CGFloat
    ) -> CGFloat {
        CGFloat(core.resolveNumber(typeName: type, variant: variant, group: group, property: property, state: state, fallback: Double(fallback)))
    }

    public func resolveInt(
        type: String,
        variant: String? = nil,
        group: String,
        property: String
    ) -> Int? {
        core.resolveInt(typeName: type, variant: variant, group: group, property: property).map(Int.init)
    }

    // MARK: - Font Weight

    /// Buckets come from jist-core; this switch only maps the shared bucket
    /// onto SwiftUI's platform enum.
    static func fontWeight(from value: CGFloat) -> Font.Weight {
        switch fontWeightBucketFfi(value: Double(value)) {
        case 100: return .ultraLight
        case 200: return .thin
        case 300: return .light
        case 400: return .regular
        case 500: return .medium
        case 600: return .semibold
        case 700: return .bold
        case 800: return .heavy
        default:  return .black
        }
    }
}

// MARK: - Color Hex

extension Color {
    /// Parses `#RRGGBB` / `#RRGGBBAA` via jist-core's shared hex parser.
    init?(hex: String) {
        guard let c = parseHexColorFfi(hex: hex) else { return nil }
        self.init(red: c.r, green: c.g, blue: c.b, opacity: c.a)
    }
}
