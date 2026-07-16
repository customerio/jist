import SwiftUI

private let maxTemplateDepth = 10

private struct JistStretchKey: EnvironmentKey {
    static let defaultValue = false
}

struct JistImageProviderKey: EnvironmentKey {
    static let defaultValue: (@MainActor @Sendable (URL) -> Image?)? = nil
}

extension EnvironmentValues {
    var jistStretch: Bool {
        get { self[JistStretchKey.self] }
        set { self[JistStretchKey.self] = newValue }
    }

    public var jistImageProvider: (@MainActor @Sendable (URL) -> Image?)? {
        get { self[JistImageProviderKey.self] }
        set { self[JistImageProviderKey.self] = newValue }
    }
}

// MARK: - Node Dispatcher

struct JistNodeView: View {
    let node: JistNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?
    let onAction: ((JistActionEvent) -> Void)?
    let templates: [String: JistTemplate]?
    var templateDepth: Int = 0

    var body: some View {
        switch node {
        case .layout(let n):
            JistLayoutView(node: n, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth)
        case .action(let n):
            JistActionView(node: n, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth)
        case .heading(let n):
            JistHeadingView(node: n, data: data, resolver: resolver)
        case .text(let n):
            JistTextView(node: n, data: data, resolver: resolver)
        case .date(let n):
            JistDateView(node: n, data: data, resolver: resolver, formatDate: formatDate)
        case .button(let n):
            JistButtonView(node: n, data: data, resolver: resolver, onAction: onAction)
        case .image(let n):
            JistImageView(node: n, data: data, resolver: resolver)
        case .dynamicLayout(let n):
            JistDynamicLayoutView(node: n, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth)
        case .template(let n):
            JistTemplateView(node: n, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth)
        case .unknown:
            EmptyView()
        }
    }
}

// MARK: - Layout

struct JistLayoutView: View {
    let node: JistLayoutNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?
    let onAction: ((JistActionEvent) -> Void)?
    let templates: [String: JistTemplate]?
    var templateDepth: Int = 0

    private var isVertical: Bool { node.direction == "vertical" }
    private var justify: String { node.justify ?? "start" }
    private var isStretch: Bool { node.align == nil || node.align == "stretch" }

    var body: some View {
        let usesSpacerJustify = justify == "space-between" || justify == "space-around" || justify == "space-evenly"
        let spacing: CGFloat = usesSpacerJustify ? 0 : (node.gap ?? 0)

        Group {
            if isVertical {
                VStack(alignment: vAlignment, spacing: spacing) {
                    content
                }
            } else {
                HStack(alignment: hAlignment, spacing: spacing) {
                    content
                }
            }
        }
        .modifier(MarginModifier(margin: node.margin))
    }

    private var vAlignment: HorizontalAlignment {
        switch node.align {
        case "end":    return .trailing
        case "center": return .center
        default:       return .leading
        }
    }

    private var hAlignment: VerticalAlignment {
        switch node.align {
        case "start":    return .top
        case "end":      return .bottom
        case "center":   return .center
        case "baseline": return .firstTextBaseline
        default:         return .center
        }
    }

    @ViewBuilder
    private var content: some View {
        switch justify {
        case "end":
            Spacer(minLength: 0)
            children
        case "center":
            Spacer(minLength: 0)
            children
            Spacer(minLength: 0)
        case "space-between":
            spaceBetweenChildren
        case "space-around":
            spaceAroundChildren
        case "space-evenly":
            spaceEvenlyChildren
        default:
            children
        }
    }

    @ViewBuilder
    private var children: some View {
        ForEach(0..<node.children.count, id: \.self) { i in
            childView(node.children[i])
        }
    }

    @ViewBuilder
    private var spaceBetweenChildren: some View {
        ForEach(0..<node.children.count, id: \.self) { i in
            if i > 0 {
                Spacer(minLength: node.gap ?? 0)
            }
            childView(node.children[i])
        }
    }

    @ViewBuilder
    private var spaceAroundChildren: some View {
        let halfGap = (node.gap ?? 0) / 2
        ForEach(0..<node.children.count, id: \.self) { i in
            if i == 0 {
                Spacer(minLength: halfGap)
            } else {
                Spacer(minLength: halfGap)
                Spacer(minLength: halfGap)
            }
            childView(node.children[i])
        }
        Spacer(minLength: halfGap)
    }

    @ViewBuilder
    private var spaceEvenlyChildren: some View {
        let gap = node.gap ?? 0
        ForEach(0..<node.children.count, id: \.self) { i in
            Spacer(minLength: gap)
            childView(node.children[i])
        }
        Spacer(minLength: gap)
    }

    @ViewBuilder
    private func childView(_ child: JistNode) -> some View {
        let view = JistNodeView(node: child, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth)
        if isVertical {
            view.frame(maxWidth: .infinity, alignment: frameAlignment)
                .multilineTextAlignment(textAlignment)
                .environment(\.jistStretch, true)
        } else if needsFlex && child.isLayout {
            view.frame(minWidth: 0, maxWidth: .infinity)
                .environment(\.jistStretch, false)
        } else if isStretch {
            view.frame(maxHeight: .infinity)
                .environment(\.jistStretch, false)
        } else {
            view.environment(\.jistStretch, false)
        }
    }

    private var needsFlex: Bool {
        !isVertical && (justify == "start")
    }

    private var frameAlignment: Alignment {
        switch node.align {
        case "end":    return .trailing
        case "center": return .center
        default:       return .leading
        }
    }

    private var textAlignment: TextAlignment {
        switch node.align {
        case "end":    return .trailing
        case "center": return .center
        default:       return .leading
        }
    }
}

// MARK: - Action

struct JistActionView: View {
    let node: JistActionNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?
    let onAction: ((JistActionEvent) -> Void)?
    let templates: [String: JistTemplate]?
    var templateDepth: Int = 0

    var body: some View {
        Button {
            onAction?(JistActionEvent(
                component: "action",
                name: node.name,
                data: data[node.name],
                meta: node.meta
            ))
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(0..<node.children.count, id: \.self) { i in
                    JistNodeView(node: node.children[i], data: data, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .jistAddTraits(.isButton)
    }
}

// MARK: - Heading

struct JistHeadingView: View {
    let node: JistHeadingNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver

    var body: some View {
        let name = node.name ?? "heading"
        let variant = node.variant ?? "h3"
        let text = data[name]?.stringValue ?? ""

        let headingSize = resolver.resolveNumber(type: "heading", variant: variant, group: "text", property: "fontSize", fallback: defaultSize(variant))
        let headingWeight = JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "heading", variant: variant, group: "text", property: "fontWeight", fallback: 600))
        let headingTracking = resolver.resolveNumber(type: "heading", variant: variant, group: "text", property: "letterSpacing", fallback: 0)
        let headingLineHeight = resolver.resolve(type: "heading", variant: variant, group: "text", property: "lineHeight")?.numberValue
            .flatMap { $0 > 0 ? CGFloat($0) : nil } ?? 0

        styledText(text, lineHeightMultiple: headingLineHeight)
            .font(resolver.resolveFont(type: "heading", variant: variant, group: "text", size: headingSize, weight: headingWeight))
            .fontWeight(headingWeight)
            .tracking(headingTracking)
            .foregroundColor(resolver.resolveColor(type: "heading", variant: variant, group: "text", property: "color", fallback: resolver.isDark ? .white : .black))
            .padding(EdgeInsets(
                top: resolver.resolveNumber(type: "heading", variant: variant, group: "padding", property: "top", fallback: 0),
                leading: resolver.resolveNumber(type: "heading", variant: variant, group: "padding", property: "left", fallback: 0),
                bottom: resolver.resolveNumber(type: "heading", variant: variant, group: "padding", property: "bottom", fallback: 0),
                trailing: resolver.resolveNumber(type: "heading", variant: variant, group: "padding", property: "right", fallback: 0)
            ))
            .padding(EdgeInsets(
                top: resolver.resolveNumber(type: "heading", variant: variant, group: "margin", property: "top", fallback: 0),
                leading: resolver.resolveNumber(type: "heading", variant: variant, group: "margin", property: "left", fallback: 0),
                bottom: resolver.resolveNumber(type: "heading", variant: variant, group: "margin", property: "bottom", fallback: 0),
                trailing: resolver.resolveNumber(type: "heading", variant: variant, group: "margin", property: "right", fallback: 0)
            ))
            .jistAddTraits(.isHeader)
    }

    private func defaultSize(_ v: String) -> CGFloat {
        switch v {
        case "h2": return 20
        case "h4": return 14
        default:   return 16
        }
    }
}

// MARK: - Text

struct JistTextView: View {
    let node: JistTextNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver

    var body: some View {
        let name = node.name ?? "text"
        let text = data[name]?.stringValue ?? ""
        let maxLines = resolver.resolveInt(type: "text", variant: node.variant, group: "text", property: "maxLines")

        let textSize = resolver.resolveNumber(type: "text", variant: node.variant, group: "text", property: "fontSize", fallback: 14)
        let textWeight = JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "text", variant: node.variant, group: "text", property: "fontWeight", fallback: 400))
        let textTracking = resolver.resolveNumber(type: "text", variant: node.variant, group: "text", property: "letterSpacing", fallback: 0)
        let textLineHeight = resolver.resolve(type: "text", variant: node.variant, group: "text", property: "lineHeight")?.numberValue
            .flatMap { $0 > 0 ? CGFloat($0) : nil } ?? 0

        styledText(text, lineHeightMultiple: textLineHeight)
            .font(resolver.resolveFont(type: "text", variant: node.variant, group: "text", size: textSize, weight: textWeight))
            .fontWeight(textWeight)
            .tracking(textTracking)
            .foregroundColor(resolver.resolveColor(type: "text", variant: node.variant, group: "text", property: "color", fallback: resolver.isDark ? .white : .black))
            .lineLimit(maxLines)
            .padding(EdgeInsets(
                top: resolver.resolveNumber(type: "text", variant: node.variant, group: "padding", property: "top", fallback: 0),
                leading: resolver.resolveNumber(type: "text", variant: node.variant, group: "padding", property: "left", fallback: 0),
                bottom: resolver.resolveNumber(type: "text", variant: node.variant, group: "padding", property: "bottom", fallback: 0),
                trailing: resolver.resolveNumber(type: "text", variant: node.variant, group: "padding", property: "right", fallback: 0)
            ))
            .padding(EdgeInsets(
                top: resolver.resolveNumber(type: "text", variant: node.variant, group: "margin", property: "top", fallback: 0),
                leading: resolver.resolveNumber(type: "text", variant: node.variant, group: "margin", property: "left", fallback: 0),
                bottom: resolver.resolveNumber(type: "text", variant: node.variant, group: "margin", property: "bottom", fallback: 0),
                trailing: resolver.resolveNumber(type: "text", variant: node.variant, group: "margin", property: "right", fallback: 0)
            ))
    }
}

// MARK: - Date

struct JistDateView: View {
    let node: JistDateNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?

    var body: some View {
        let dateSize = resolver.resolveNumber(type: "date", variant: node.variant, group: "text", property: "fontSize", fallback: 12)
        let dateWeight = JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "date", variant: node.variant, group: "text", property: "fontWeight", fallback: 400))
        let dateTracking = resolver.resolveNumber(type: "date", variant: node.variant, group: "text", property: "letterSpacing", fallback: 0)
        let dateLineHeight = resolver.resolve(type: "date", variant: node.variant, group: "text", property: "lineHeight")?.numberValue
            .flatMap { $0 > 0 ? CGFloat($0) : nil } ?? 0

        styledText(displayText, lineHeightMultiple: dateLineHeight)
            .font(resolver.resolveFont(type: "date", variant: node.variant, group: "text", size: dateSize, weight: dateWeight))
            .fontWeight(dateWeight)
            .tracking(dateTracking)
            .foregroundColor(resolver.resolveColor(type: "date", variant: node.variant, group: "text", property: "color", fallback: resolver.isDark ? .white : .black))
            .padding(EdgeInsets(
                top: resolver.resolveNumber(type: "date", variant: node.variant, group: "padding", property: "top", fallback: 0),
                leading: resolver.resolveNumber(type: "date", variant: node.variant, group: "padding", property: "left", fallback: 0),
                bottom: resolver.resolveNumber(type: "date", variant: node.variant, group: "padding", property: "bottom", fallback: 0),
                trailing: resolver.resolveNumber(type: "date", variant: node.variant, group: "padding", property: "right", fallback: 0)
            ))
            .padding(EdgeInsets(
                top: resolver.resolveNumber(type: "date", variant: node.variant, group: "margin", property: "top", fallback: 0),
                leading: resolver.resolveNumber(type: "date", variant: node.variant, group: "margin", property: "left", fallback: 0),
                bottom: resolver.resolveNumber(type: "date", variant: node.variant, group: "margin", property: "bottom", fallback: 0),
                trailing: resolver.resolveNumber(type: "date", variant: node.variant, group: "margin", property: "right", fallback: 0)
            ))
    }

    private var displayText: String {
        let name = node.name ?? "date"
        let iso = data[name]?.stringValue ?? ""
        if iso.isEmpty { return "" }
        if let fmt = formatDate { return fmt(iso, name) }
        let f = ISO8601DateFormatter()
        guard let date = f.date(from: iso) else { return iso }
        return DateFormatter.localizedString(from: date, dateStyle: .medium, timeStyle: .none)
    }
}

// MARK: - Button

struct JistButtonView: View {
    let node: JistButtonNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let onAction: ((JistActionEvent) -> Void)?

    @Environment(\.jistStretch) private var stretch
    @State private var isHovered = false

    var body: some View {
        if let obj = data[node.name]?.objectValue,
           let label = obj["label"]?.stringValue {
            let isDisabled = obj["disabled"]?.boolValue ?? false

            Button {
                onAction?(JistActionEvent(
                    component: "button",
                    name: node.name,
                    data: data[node.name],
                    meta: node.meta
                ))
            } label: {
                Text(label)
                    .if(stretch) { $0.frame(maxWidth: .infinity) }
            }
            .buttonStyle(JistButtonStateStyle(
                node: node, resolver: resolver,
                isHovered: isHovered, isDisabled: isDisabled,
                label: label, stretch: stretch
            ))
            .disabled(isDisabled)
            .jistOnHover { isHovered = $0 }
            .padding(EdgeInsets(
                top: resolver.resolveNumber(type: "button", variant: node.variant, group: "margin", property: "top", fallback: 0),
                leading: resolver.resolveNumber(type: "button", variant: node.variant, group: "margin", property: "left", fallback: 0),
                bottom: resolver.resolveNumber(type: "button", variant: node.variant, group: "margin", property: "bottom", fallback: 0),
                trailing: resolver.resolveNumber(type: "button", variant: node.variant, group: "margin", property: "right", fallback: 0)
            ))
        }
    }
}

private struct JistButtonStateStyle: ButtonStyle {
    let node: JistButtonNode
    let resolver: JistThemeResolver
    let isHovered: Bool
    let isDisabled: Bool
    let label: String
    let stretch: Bool

    func makeBody(configuration: Configuration) -> some View {
        let state: String? = {
            if isDisabled { return "disabled" }
            if configuration.isPressed { return "active" }
            if isHovered { return "hover" }
            return nil
        }()

        let radius = resolver.resolveNumber(type: "button", variant: node.variant, group: "border", property: "radius", fallback: 6)
        let borderWidth = resolver.resolveNumber(type: "button", variant: node.variant, group: "border", property: "width", fallback: 0)
        let minW = resolver.resolveNumber(type: "button", variant: node.variant, property: "minWidth", fallback: 0)
        let minH = resolver.resolveNumber(type: "button", variant: node.variant, property: "minHeight", fallback: 0)

        let buttonSize = resolver.resolveNumber(type: "button", variant: node.variant, group: "text", property: "fontSize", state: state, fallback: 14)
        let buttonWeight = JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "button", variant: node.variant, group: "text", property: "fontWeight", state: state, fallback: 500))
        let buttonTracking = resolver.resolveNumber(type: "button", variant: node.variant, group: "text", property: "letterSpacing", state: state, fallback: 0)
        let buttonLineHeight = resolver.resolve(type: "button", variant: node.variant, group: "text", property: "lineHeight", state: state)?.numberValue
            .flatMap { $0 > 0 ? CGFloat($0) : nil } ?? 0

        styledText(label, lineHeightMultiple: buttonLineHeight)
            .font(resolver.resolveFont(type: "button", variant: node.variant, group: "text", state: state, size: buttonSize, weight: buttonWeight))
            .fontWeight(buttonWeight)
            .tracking(buttonTracking)
            .if(stretch) { $0.frame(maxWidth: .infinity) }
            .foregroundColor(resolver.resolveColor(type: "button", variant: node.variant, group: "text", property: "color", state: state, fallback: .white))
            .padding(EdgeInsets(
                top:      resolver.resolveNumber(type: "button", variant: node.variant, group: "padding", property: "top", fallback: 8),
                leading:  resolver.resolveNumber(type: "button", variant: node.variant, group: "padding", property: "left", fallback: 16),
                bottom:   resolver.resolveNumber(type: "button", variant: node.variant, group: "padding", property: "bottom", fallback: 8),
                trailing: resolver.resolveNumber(type: "button", variant: node.variant, group: "padding", property: "right", fallback: 16)
            ))
            .frame(minWidth: minW > 0 ? minW : nil, minHeight: minH > 0 ? minH : nil)
            .background(
                RoundedRectangle(cornerRadius: radius)
                    .fill(resolver.resolveColor(
                        type: "button", variant: node.variant, group: "background", property: "color",
                        state: state, fallback: Color(hex: "#4F46E5")!
                    ))
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .stroke(
                        resolver.resolveColor(type: "button", variant: node.variant, group: "border", property: "color", state: state, fallback: .clear),
                        lineWidth: borderWidth
                    )
            )
            .shadow(
                color: resolver.resolveColor(type: "button", variant: node.variant, group: "shadow", property: "color", state: state, fallback: .clear),
                radius: resolver.resolveNumber(type: "button", variant: node.variant, group: "shadow", property: "blur", state: state, fallback: 0) / 2,
                x: resolver.resolveNumber(type: "button", variant: node.variant, group: "shadow", property: "offsetX", state: state, fallback: 0),
                y: resolver.resolveNumber(type: "button", variant: node.variant, group: "shadow", property: "offsetY", state: state, fallback: 0)
            )
    }
}

private extension View {
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition { transform(self) } else { self }
    }
}

// MARK: - Image

struct JistImageView: View {
    let node: JistImageNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    @Environment(\.jistImageProvider) private var imageProvider

    private var isFill: Bool {
        if case .fill = node.width { return true }
        return false
    }

    private var fixedWidth: CGFloat? {
        if case .fixed(let w) = node.width { return w }
        return nil
    }

    var body: some View {
        if let urlStr = data[node.name]?.stringValue,
           let url = URL(string: urlStr) {
            imageContent(url: url)
                .frame(width: fixedWidth, height: node.height)
                .frame(maxWidth: isFill ? .infinity : nil)
                .clipShape(RoundedRectangle(cornerRadius: node.borderRadius ?? resolver.resolveNumber(type: "image", variant: node.variant, group: "border", property: "radius", fallback: 0)))
                .jistAccessibilityLabel(data["title"]?.stringValue ?? "")
                .padding(EdgeInsets(
                    top: resolver.resolveNumber(type: "image", variant: node.variant, group: "padding", property: "top", fallback: 0),
                    leading: resolver.resolveNumber(type: "image", variant: node.variant, group: "padding", property: "left", fallback: 0),
                    bottom: resolver.resolveNumber(type: "image", variant: node.variant, group: "padding", property: "bottom", fallback: 0),
                    trailing: resolver.resolveNumber(type: "image", variant: node.variant, group: "padding", property: "right", fallback: 0)
                ))
                .padding(EdgeInsets(
                    top: resolver.resolveNumber(type: "image", variant: node.variant, group: "margin", property: "top", fallback: 0),
                    leading: resolver.resolveNumber(type: "image", variant: node.variant, group: "margin", property: "left", fallback: 0),
                    bottom: resolver.resolveNumber(type: "image", variant: node.variant, group: "margin", property: "bottom", fallback: 0),
                    trailing: resolver.resolveNumber(type: "image", variant: node.variant, group: "margin", property: "right", fallback: 0)
                ))
        }
    }

    @ViewBuilder
    private func imageContent(url: URL) -> some View {
        if let provider = imageProvider, let image = provider(url) {
            applyFit(image.resizable())
        } else if #available(iOS 15, macOS 12, *) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    applyFit(image.resizable())
                case .failure:
                    Color.gray.opacity(0.2)
                case .empty:
                    JistSpinner()
                @unknown default:
                    EmptyView()
                }
            }
        } else {
            // iOS 13/14 fallback: AsyncImage is iOS 15+, so load via URLSession.
            JistAsyncImage(url: url) { image in
                applyFit(image.resizable())
            } placeholder: {
                JistSpinner()
            } failure: {
                Color.gray.opacity(0.2)
            }
            // iOS 13/14 has no `.onChange(of:)` (iOS 14+) and `.onAppear` doesn't re-fire on an
            // in-place data update, so key the view on `url`: a new URL yields a fresh identity (fresh
            // loader + `.loading`) that re-fires `.onAppear` to load it. The loader dedups repeated
            // appearances for the same URL.
            .id(url)
        }
    }

    @ViewBuilder
    private func applyFit(_ image: Image) -> some View {
        switch node.objectFit ?? "contain" {
        case "cover":
            image.scaledToFill()
        case "fill":
            image
        default:
            image.scaledToFit()
        }
    }
}

// MARK: - Async Image (iOS 13/14 backport)

/// Loads a remote image for the iOS 13/14 `AsyncImage` backport with `AsyncImage`-like semantics:
/// exactly one request per URL (repeated appearances during an in-flight load don't restart it), a
/// reload when the URL changes, and a stale in-flight result discarded if the URL changed meanwhile.
///
/// The data fetch is injected so this load/dedup logic is unit-testable without the network or a
/// SwiftUI host — important because the `JistAsyncImage` view wrapper below only runs when
/// `#available(iOS 15, …)` is false, so it can't be exercised on the iOS 15+ CI simulator.
@MainActor
final class JistImageLoader {
    enum Phase {
        case loading
        case success(Image)
        case failure
    }

    /// Fetches raw bytes for a URL, delivering `nil` on any failure. Injected for testing. The
    /// completion is `@Sendable` because the default fetch resolves it on a background URLSession queue.
    typealias DataFetch = (URL, @escaping @Sendable (Data?) -> Void) -> Void

    private let fetch: DataFetch
    /// URL of the current/most-recent request; drives dedup and stale-result rejection.
    private var requestedURL: URL?
    private var onPhase: ((Phase) -> Void)?

    init(fetch: @escaping DataFetch = JistImageLoader.urlSessionFetch) {
        self.fetch = fetch
    }

    /// Starts a load for `url` unless a load for the same URL is already the current one (dedup of
    /// repeated `onAppear`s during an in-flight request). A different URL supersedes the previous load.
    /// `onPhase` is invoked on the main actor: `.loading` immediately for a new URL, then
    /// `.success`/`.failure` when it resolves.
    func load(url: URL, onPhase: @escaping (Phase) -> Void) {
        guard url != requestedURL else { return }
        requestedURL = url
        self.onPhase = onPhase
        onPhase(.loading)
        fetch(url) { [weak self] data in
            // Background queue. `data` is Sendable; hop to the main actor and decode + deliver there,
            // so a non-Sendable `Image` is never created off-main or sent across threads.
            Task { @MainActor [weak self] in
                self?.deliver(data, for: url)
            }
        }
    }

    private func deliver(_ data: Data?, for url: URL) {
        // Drop a late result from a superseded URL so it can't clobber the current image.
        guard requestedURL == url else { return }
        onPhase?(JistImageLoader.decode(data))
    }

    private static func decode(_ data: Data?) -> Phase {
        // Only the UIKit decode runs at runtime: macOS 12+ takes the native AsyncImage path, so this
        // backport is never instantiated there. The #else only keeps non-UIKit builds compiling.
        #if canImport(UIKit)
        if let data, let image = UIImage(data: data) { return .success(Image(uiImage: image)) }
        return .failure
        #else
        return .failure
        #endif
    }

    private static let urlSessionFetch: DataFetch = { url, completion in
        URLSession.shared.dataTask(with: url) { data, _, _ in completion(data) }.resume()
    }
}

/// iOS 13/14-compatible replacement for SwiftUI's `AsyncImage` (iOS 15+). Thin view wrapper over
/// `JistImageLoader` (which holds the testable load/dedup logic): shows the placeholder while loading,
/// the resolved image on success, and the failure view on error.
private struct JistAsyncImage<Content: View, Placeholder: View, Failure: View>: View {
    let url: URL
    let content: (Image) -> Content
    let placeholder: () -> Placeholder
    let failure: () -> Failure

    @State private var phase: JistImageLoader.Phase = .loading
    // Held in @State (not @StateObject, which is iOS 14+) so the loader — and its per-URL dedup state —
    // survives body re-evaluations at the same view identity. `.id(url)` at the call site gives a fresh
    // identity (and a fresh loader) when the URL changes.
    @State private var loader = JistImageLoader()

    init(
        url: URL,
        @ViewBuilder content: @escaping (Image) -> Content,
        @ViewBuilder placeholder: @escaping () -> Placeholder,
        @ViewBuilder failure: @escaping () -> Failure
    ) {
        self.url = url
        self.content = content
        self.placeholder = placeholder
        self.failure = failure
    }

    var body: some View {
        Group {
            switch phase {
            case .success(let image):
                content(image)
            case .failure:
                failure()
            case .loading:
                placeholder()
            }
        }
        .onAppear { loader.load(url: url) { phase = $0 } }
    }
}

// MARK: - Dynamic Layout

struct JistDynamicLayoutView: View {
    let node: JistDynamicLayoutNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?
    let onAction: ((JistActionEvent) -> Void)?
    let templates: [String: JistTemplate]?
    var templateDepth: Int = 0

    private var isVertical: Bool { (node.direction ?? "vertical") == "vertical" }
    private var justify: String { node.justify ?? "start" }

    var body: some View {
        guard let array = data[node.name]?.arrayValue else {
            return AnyView(EmptyView())
        }
        let usesSpacerJustify = justify == "space-between" || justify == "space-around" || justify == "space-evenly"
        let spacing: CGFloat = usesSpacerJustify ? 0 : (node.gap ?? 0)

        return AnyView(Group {
            if isVertical {
                VStack(alignment: vAlignment, spacing: spacing) {
                    justifiedItems(array)
                }
            } else {
                HStack(alignment: hAlignment, spacing: spacing) {
                    justifiedItems(array)
                }
            }
        }
        .modifier(MarginModifier(margin: node.margin)))
    }

    @ViewBuilder
    private func justifiedItems(_ array: [JistValue]) -> some View {
        switch justify {
        case "end":
            Spacer(minLength: 0)
            items(array)
        case "center":
            Spacer(minLength: 0)
            items(array)
            Spacer(minLength: 0)
        case "space-between":
            ForEach(0..<array.count, id: \.self) { i in
                if i > 0 { Spacer(minLength: node.gap ?? 0) }
                itemView(array[i])
            }
        case "space-around":
            let halfGap = (node.gap ?? 0) / 2
            ForEach(0..<array.count, id: \.self) { i in
                if i == 0 {
                    Spacer(minLength: halfGap)
                } else {
                    Spacer(minLength: halfGap)
                    Spacer(minLength: halfGap)
                }
                itemView(array[i])
            }
            Spacer(minLength: halfGap)
        case "space-evenly":
            let gap = node.gap ?? 0
            ForEach(0..<array.count, id: \.self) { i in
                Spacer(minLength: gap)
                itemView(array[i])
            }
            Spacer(minLength: gap)
        default:
            items(array)
        }
    }

    @ViewBuilder
    private func items(_ array: [JistValue]) -> some View {
        ForEach(0..<array.count, id: \.self) { i in
            itemView(array[i])
        }
    }

    @ViewBuilder
    private func itemView(_ item: JistValue) -> some View {
        let itemData = item.objectValue ?? [:]
        JistNodeView(node: node.template, data: itemData, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth)
    }

    private var vAlignment: HorizontalAlignment {
        switch node.align {
        case "end":    return .trailing
        case "center": return .center
        default:       return .leading
        }
    }

    private var hAlignment: VerticalAlignment {
        switch node.align {
        case "start":    return .top
        case "end":      return .bottom
        case "center":   return .center
        case "baseline": return .firstTextBaseline
        default:         return .center
        }
    }
}

// MARK: - Template

struct JistTemplateView: View {
    let node: JistTemplateNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?
    let onAction: ((JistActionEvent) -> Void)?
    let templates: [String: JistTemplate]?
    var templateDepth: Int = 0

    var body: some View {
        if templateDepth < maxTemplateDepth,
           let template = templates?[node.name] {
            JistNodeView(node: template.root, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction, templates: templates, templateDepth: templateDepth + 1)
        }
    }
}

// MARK: - Margin Modifier

struct MarginModifier: ViewModifier {
    let margin: JistSpacing?

    func body(content: Content) -> some View {
        content.padding(EdgeInsets(
            top:      margin?.top ?? 0,
            leading:  margin?.left ?? 0,
            bottom:   margin?.bottom ?? 0,
            trailing: margin?.right ?? 0
        ))
    }
}

// MARK: - Line Height Helper

/// Applies `lineHeightMultiple` via `NSParagraphStyle` so the multiplier is relative to the font's
/// natural line metrics — consistent with how iOS text layout works.
///
/// Two DISTINCT cases return plain `Text` and must not be conflated:
///  1. `lineHeightMultiple == 0` — intentional reset/unset: no custom line height was requested.
///  2. iOS 13/14 with a positive value — `AttributedString`/`Text(AttributedString)` are iOS 15+ and
///     there is no SwiftUI API to apply a paragraph `lineHeightMultiple` to `Text` on iOS 13/14, so
///     the multiplier is dropped and text renders at the font's natural line height. This is an
///     ACCEPTED iOS 13/14 typography limitation (validated on-device), NOT a reset — line spacing can
///     differ slightly from iOS 15+. A `lineSpacing` approximation would require returning a `View`
///     instead of `Text`; intentionally not done for this backport.
private func styledText(_ string: String, lineHeightMultiple: CGFloat) -> Text {
    guard lineHeightMultiple > 0 else { return Text(string) } // case 1: reset/unset
    if #available(iOS 15, macOS 12, *) {
        var attributed = AttributedString(string)
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineHeightMultiple = lineHeightMultiple
        attributed.paragraphStyle = paragraphStyle
        return Text(attributed)
    } else {
        return Text(string)
    }
}

// MARK: - iOS 13/14 compatibility helpers

/// `accessibilityAddTraits` / `accessibilityLabel` on `View` are iOS 14+; `onHover`
/// is iOS 13.4+. These wrappers keep the call sites clean while supporting the iOS 13
/// deployment floor — using the current spelling where available and the older (but
/// since-13.0) `accessibility(...)` spelling on iOS 13, so VoiceOver traits/labels are
/// preserved on every supported OS (not dropped).
extension View {
    func jistAddTraits(_ traits: AccessibilityTraits) -> some View {
        if #available(iOS 14, macOS 11, *) {
            return AnyView(self.accessibilityAddTraits(traits))
        } else {
            // Deprecated spelling, available since iOS 13.0 — keeps the traits for VoiceOver on
            // iOS 13 rather than dropping them. Remove when the deployment floor reaches iOS 14.
            return AnyView(self.accessibility(addTraits: traits))
        }
    }

    func jistAccessibilityLabel(_ label: String) -> some View {
        if #available(iOS 14, macOS 11, *) {
            return AnyView(self.accessibilityLabel(label))
        } else {
            // Deprecated spelling, available since iOS 13.0 — keeps the label for VoiceOver on
            // iOS 13 rather than dropping it. Remove when the deployment floor reaches iOS 14.
            return AnyView(self.accessibility(label: Text(label)))
        }
    }

    func jistOnHover(_ perform: @escaping (Bool) -> Void) -> some View {
        // Returns AnyView so the availability branch doesn't require the
        // ViewBuilder `buildLimitedAvailability` machinery (itself iOS 14+).
        if #available(iOS 13.4, macOS 10.15, *) {
            return AnyView(self.onHover(perform: perform))
        } else {
            return AnyView(self)
        }
    }
}

/// iOS 13/14-compatible spinner. `ProgressView` is iOS 14+, so on iOS 13 we fall
/// back to a UIKit `UIActivityIndicatorView` wrapped as a representable.
struct JistSpinner: View {
    var body: some View {
        if #available(iOS 14, macOS 11, *) {
            return AnyView(ProgressView())
        } else {
            #if canImport(UIKit)
            return AnyView(JistActivityIndicator())
            #else
            return AnyView(Color.gray.opacity(0.2))
            #endif
        }
    }
}

#if canImport(UIKit)
private struct JistActivityIndicator: UIViewRepresentable {
    func makeUIView(context: Context) -> UIActivityIndicatorView {
        let view = UIActivityIndicatorView(style: .medium)
        view.startAnimating()
        return view
    }

    func updateUIView(_ uiView: UIActivityIndicatorView, context: Context) {}
}
#endif
