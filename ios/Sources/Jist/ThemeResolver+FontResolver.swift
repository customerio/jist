import SwiftUI

// Resolves CSS-style font family stacks to SwiftUI Fonts using platform font APIs.
// Split into a separate file so the #if canImport(UIKit) condition lives at the file
// level rather than scattered inside method bodies.

private struct FontCacheKey: Hashable {
    let family: String
    let size: CGFloat
    let weight: CGFloat // platform raw value, avoids Hashable requirement on Font.Weight
}

private nonisolated(unsafe) var fontCache: [FontCacheKey: Font] = [:]

/// Splits a CSS font-family stack into individual family names.
///
/// Trims whitespace and strips the surrounding single/double quotes the portal emits
/// around custom families (e.g. `"'Abril Fatface', sans-serif"`). Browsers strip these
/// quotes; we must too, otherwise a quoted custom family never matches a registered font
/// and always falls through to the system font.
func parseFontStack(_ family: String) -> [String] {
    let quotes = CharacterSet(charactersIn: "\"'")
    return family.split(separator: ",").map { component -> String in
        component
            .trimmingCharacters(in: .whitespaces)
            .trimmingCharacters(in: quotes)
            .trimmingCharacters(in: .whitespaces)
    }.filter { !$0.isEmpty }
}

#if canImport(UIKit)
import UIKit

extension JistThemeResolver {

    /// Resolves a CSS-style font family stack (e.g. "Roboto, sans-serif") to a SwiftUI Font.
    ///
    /// For each name in the stack:
    ///   1. Try it as a **family name**. If the family is registered (all weight variants
    ///      bundled in UIAppFonts), this picks the variant closest to the requested weight.
    ///   2. Fall back to treating the name as a **PostScript name** directly. This handles
    ///      single-weight fonts (e.g. "AbrilFatface-Regular").
    ///
    /// Falls back to `.system(size:weight:)` if nothing in the stack resolves.
    /// Results are cached — font registry lookups only happen once per unique (family, size, weight).
    static func resolveFont(family: String, size: CGFloat, weight: Font.Weight) -> Font {
        let rawWeight = platformFontWeight(for: weight)
        let key = FontCacheKey(family: family, size: size, weight: rawWeight)
        if let cached = fontCache[key] { return cached }

        let names = parseFontStack(family)
        let font: Font = {
            for name in names {
                let variants = UIFont.fontNames(forFamilyName: name)
                if !variants.isEmpty {
                    return .custom(bestVariant(variants, for: weight), size: size)
                }
                if UIFont(name: name, size: size) != nil {
                    return .custom(name, size: size)
                }
            }
            return .system(size: size, weight: weight)
        }()

        fontCache[key] = font
        return font
    }

    private static func bestVariant(_ variants: [String], for weight: Font.Weight) -> String {
        let target = platformFontWeight(for: weight)
        return variants.min(by: {
            abs(traitWeight(of: $0) - target) < abs(traitWeight(of: $1) - target)
        }) ?? variants[0]
    }

    private static func traitWeight(of postScriptName: String) -> CGFloat {
        guard let font = UIFont(name: postScriptName, size: 12),
              let traits = font.fontDescriptor.object(forKey: .traits) as? [UIFontDescriptor.TraitKey: Any],
              let w = traits[.weight] as? CGFloat else { return 0 }
        return w
    }

    private static func platformFontWeight(for weight: Font.Weight) -> CGFloat {
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
}

#else
import AppKit

extension JistThemeResolver {

    static func resolveFont(family: String, size: CGFloat, weight: Font.Weight) -> Font {
        let rawWeight = platformFontWeight(for: weight)
        let key = FontCacheKey(family: family, size: size, weight: rawWeight)
        if let cached = fontCache[key] { return cached }

        let names = parseFontStack(family)
        let font: Font = {
            for name in names {
                let variants = NSFontManager.shared.availableMembers(ofFontFamily: name)?
                    .compactMap { $0[0] as? String } ?? []
                if !variants.isEmpty {
                    return .custom(bestVariant(variants, for: weight), size: size)
                }
                if NSFont(name: name, size: size) != nil {
                    return .custom(name, size: size)
                }
            }
            return .system(size: size, weight: weight)
        }()

        fontCache[key] = font
        return font
    }

    private static func bestVariant(_ variants: [String], for weight: Font.Weight) -> String {
        let target = platformFontWeight(for: weight)
        return variants.min(by: {
            abs(traitWeight(of: $0) - target) < abs(traitWeight(of: $1) - target)
        }) ?? variants[0]
    }

    private static func traitWeight(of postScriptName: String) -> CGFloat {
        guard let font = NSFont(name: postScriptName, size: 12) else { return 0 }
        let traits = font.fontDescriptor.object(forKey: .traits) as? [NSFontDescriptor.TraitKey: Any]
        return traits?[.weight] as? CGFloat ?? 0
    }

    private static func platformFontWeight(for weight: Font.Weight) -> CGFloat {
        switch weight {
        case .ultraLight: return NSFont.Weight.ultraLight.rawValue
        case .thin:       return NSFont.Weight.thin.rawValue
        case .light:      return NSFont.Weight.light.rawValue
        case .regular:    return NSFont.Weight.regular.rawValue
        case .medium:     return NSFont.Weight.medium.rawValue
        case .semibold:   return NSFont.Weight.semibold.rawValue
        case .bold:       return NSFont.Weight.bold.rawValue
        case .heavy:      return NSFont.Weight.heavy.rawValue
        case .black:      return NSFont.Weight.black.rawValue
        default:          return NSFont.Weight.regular.rawValue
        }
    }
}

#endif
