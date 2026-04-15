import SwiftUI

public struct JistThemeResolver {
    private let theme: [String: JistValue]
    private let isDark: Bool

    public init(theme: [String: JistValue], isDark: Bool) {
        self.theme = theme
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
        if let state = state {
            if isDark {
                if let v = variant,
                   let val = dig(["modes", "dark", type, v, "states", state, group, property]) { return val }
                if let val = dig(["modes", "dark", type, "states", state, group, property]) { return val }
            }
            if let v = variant,
               let val = dig([type, v, "states", state, group, property]) { return val }
            if let val = dig([type, "states", state, group, property]) { return val }
        }

        if isDark {
            if let v = variant,
               let val = dig(["modes", "dark", type, v, group, property]) { return val }
            if let val = dig(["modes", "dark", type, group, property]) { return val }
        }
        if let v = variant,
           let val = dig([type, v, group, property]) { return val }
        if let val = dig([type, group, property]) { return val }

        return nil
    }

    public func resolveColor(
        type: String,
        variant: String? = nil,
        group: String,
        property: String,
        state: String? = nil,
        fallback: Color
    ) -> Color {
        guard let val = resolve(type: type, variant: variant, group: group, property: property, state: state),
              let hex = val.stringValue else { return fallback }
        return Color(hex: hex) ?? fallback
    }

    public func resolveNumber(
        type: String,
        variant: String? = nil,
        group: String,
        property: String,
        state: String? = nil,
        fallback: CGFloat
    ) -> CGFloat {
        guard let val = resolve(type: type, variant: variant, group: group, property: property, state: state),
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
        guard let val = resolve(type: type, variant: variant, group: group, property: property),
              let num = val.numberValue else { return nil }
        return Int(num)
    }

    private func dig(_ path: [String]) -> JistValue? {
        var current: JistValue = .object(theme)
        for key in path {
            guard let obj = current.objectValue, let next = obj[key] else { return nil }
            current = next
        }
        return current
    }

    // MARK: - Font

    /// Resolves a CSS-style font family stack (e.g. "Roboto, sans-serif") to a SwiftUI Font.
    ///
    /// For each name in the stack:
    ///   1. Try it as a **family name** via `UIFont.fontNames(forFamilyName:)`. If the family is
    ///      registered (all weight variants bundled in UIAppFonts), this picks the variant whose
    ///      UIFontDescriptor weight trait is closest to the requested weight.
    ///   2. Fall back to treating the name as a **PostScript name** directly. This handles
    ///      single-weight fonts (e.g. "AbrilFatface-Regular") where the PostScript name is the
    ///      only entry and there are no family variants to choose from.
    ///
    /// Falls back to `.system(size:weight:)` if nothing in the stack resolves.
    static func resolveFont(family: String, size: CGFloat, weight: Font.Weight) -> Font {
        let names = family.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        for name in names {
            // 1. Family name lookup — supports multi-weight fonts (Roboto, Open Sans, etc.)
            let variants = UIFont.fontNames(forFamilyName: name)
            if !variants.isEmpty {
                let postScriptName = bestVariant(variants, for: weight)
                return .custom(postScriptName, size: size)
            }
            // 2. PostScript name lookup — single-weight fonts (AbrilFatface-Regular, etc.)
            if UIFont(name: name, size: size) != nil {
                return .custom(name, size: size)
            }
        }
        return .system(size: size, weight: weight)
    }

    /// Returns the PostScript name from `variants` whose UIFontDescriptor weight trait
    /// is closest to `weight`.
    private static func bestVariant(_ variants: [String], for weight: Font.Weight) -> String {
        let target = uiFontWeight(for: weight)
        return variants.min(by: { a, b in
            let wa = traitWeight(of: a)
            let wb = traitWeight(of: b)
            return abs(wa - target) < abs(wb - target)
        }) ?? variants[0]
    }

    /// Reads the UIFontDescriptor weight trait value (-1…1) for a given PostScript name.
    private static func traitWeight(of postScriptName: String) -> CGFloat {
        guard let font = UIFont(name: postScriptName, size: 12),
              let traits = font.fontDescriptor.object(forKey: .traits) as? [UIFontDescriptor.TraitKey: Any],
              let w = traits[.weight] as? CGFloat else { return 0 }
        return w
    }

    /// Maps a SwiftUI Font.Weight to the equivalent UIFont.Weight raw value (-1…1),
    /// which is the same scale used by UIFontDescriptor trait keys.
    private static func uiFontWeight(for weight: Font.Weight) -> CGFloat {
        switch weight {
        case .ultraLight: return UIFont.Weight.ultraLight.rawValue
        case .thin:       return UIFont.Weight.thin.rawValue
        case .light:      return UIFont.Weight.light.rawValue
        case .regular:    return UIFont.Weight.regular.rawValue
        case .medium:     return UIFont.Weight.medium.rawValue
        case .semibold:   return UIFont.Weight.semibold.rawValue
        case .bold:       return UIFont.Weight.bold.rawValue
        case .heavy:      return UIFont.Weight.heavy.rawValue
        case .black:      return UIFont.Weight.black.rawValue
        default:          return UIFont.Weight.regular.rawValue
        }
    }

    // MARK: - Font Weight

    static func fontWeight(from value: CGFloat) -> Font.Weight {
        switch value {
        case ..<200: return .ultraLight
        case ..<300: return .thin
        case ..<400: return .light
        case ..<500: return .regular
        case ..<600: return .medium
        case ..<700: return .semibold
        case ..<800: return .bold
        case ..<900: return .heavy
        default:     return .black
        }
    }
}

// MARK: - Color Hex

extension Color {
    init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h.removeFirst() }

        var rgb: UInt64 = 0
        guard Scanner(string: h).scanHexInt64(&rgb) else { return nil }

        if h.count == 8 {
            self.init(
                red:     Double((rgb & 0xFF00_0000) >> 24) / 255,
                green:   Double((rgb & 0x00FF_0000) >> 16) / 255,
                blue:    Double((rgb & 0x0000_FF00) >> 8)  / 255,
                opacity: Double( rgb & 0x0000_00FF)        / 255
            )
        } else if h.count == 6 {
            self.init(
                red:   Double((rgb & 0xFF0000) >> 16) / 255,
                green: Double((rgb & 0x00FF00) >> 8)  / 255,
                blue:  Double( rgb & 0x0000FF)        / 255
            )
        } else {
            return nil
        }
    }
}
