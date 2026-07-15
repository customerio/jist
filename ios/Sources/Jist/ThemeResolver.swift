import SwiftUI

/// Thin SwiftUI adapter over the jist-core (Rust) `ThemeResolver`.
///
/// The cascades (state → dark → variant → base, both grouped and group-less),
/// hex-color parsing, and font-weight bucketing all live in
/// core/jist-core/src/theme_resolver.rs — shared with Android. This file only
/// maps Rust results onto SwiftUI types; font *registration and lookup*
/// (platform APIs) stay in ThemeResolver+FontResolver.swift.
public struct JistThemeResolver {
    private let core: ThemeResolver
    public let isDark: Bool

    public init(theme: [String: JistValue], isDark: Bool) {
        self.core = ThemeResolver(theme: theme, isDark: isDark)
        self.isDark = isDark
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

    /// Group-less variant: resolves `type.variant.property` (e.g. `button.minWidth`).
    public func resolve(
        type: String,
        variant: String? = nil,
        property: String
    ) -> JistValue? {
        core.resolveProperty(typeName: type, variant: variant, property: property)
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

    /// Group-less variant of resolveNumber (e.g. `button.minWidth`).
    public func resolveNumber(
        type: String,
        variant: String? = nil,
        property: String,
        fallback: CGFloat
    ) -> CGFloat {
        guard let val = resolve(type: type, variant: variant, property: property),
              let num = val.numberValue else { return fallback }
        return CGFloat(num)
    }

    public func resolveFont(
        type: String,
        variant: String? = nil,
        group: String,
        state: String? = nil,
        size: CGFloat,
        weight: Font.Weight
    ) -> Font {
        guard let val = resolve(type: type, variant: variant, group: group, property: "fontFamily", state: state),
              let family = val.stringValue, !family.isEmpty else {
            return .system(size: size, weight: weight)
        }
        return JistThemeResolver.resolveFont(family: family, size: size, weight: weight)
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
