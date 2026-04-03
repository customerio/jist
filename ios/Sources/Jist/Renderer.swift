import SwiftUI

// MARK: - Node Dispatcher

struct JistNodeView: View {
    let node: JistNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?
    let onAction: ((JistActionEvent) -> Void)?

    var body: some View {
        switch node {
        case .layout(let n):
            JistLayoutView(node: n, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction)
        case .action(let n):
            JistActionView(node: n, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction)
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

    private var isVertical: Bool { node.direction == "vertical" }
    private var justify: String { node.justify ?? "start" }
    private var isStretch: Bool { node.align == nil || node.align == "stretch" }

    var body: some View {
        let useSpaceBetween = justify == "space-between"
        let spacing = useSpaceBetween ? 0 : (node.gap ?? 0)

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
    private func childView(_ child: JistNode) -> some View {
        let view = JistNodeView(node: child, data: data, resolver: resolver, formatDate: formatDate, onAction: onAction)
        if isVertical {
            view.frame(maxWidth: .infinity, alignment: frameAlignment)
                .multilineTextAlignment(textAlignment)
        } else if isStretch {
            view.frame(maxHeight: .infinity)
        } else {
            view
        }
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

    var body: some View {
        Button {
            onAction?(JistActionEvent(
                component: "action",
                name: node.name,
                data: data[node.name],
                meta: node.meta
            ))
        } label: {
            ForEach(0..<node.children.count, id: \.self) { i in
                JistNodeView(node: node.children[i], data: data, resolver: resolver, formatDate: formatDate, onAction: onAction)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
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

        Text(text)
            .font(.system(
                size: resolver.resolveNumber(type: "heading", variant: variant, group: "text", property: "fontSize", fallback: defaultSize(variant)),
                weight: JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "heading", variant: variant, group: "text", property: "fontWeight", fallback: 600))
            ))
            .foregroundColor(resolver.resolveColor(type: "heading", variant: variant, group: "text", property: "color", fallback: .primary))
            .accessibilityAddTraits(.isHeader)
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

        Text(text)
            .font(.system(
                size: resolver.resolveNumber(type: "text", variant: node.variant, group: "text", property: "fontSize", fallback: 14),
                weight: JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "text", variant: node.variant, group: "text", property: "fontWeight", fallback: 400))
            ))
            .foregroundColor(resolver.resolveColor(type: "text", variant: node.variant, group: "text", property: "color", fallback: .primary))
            .lineLimit(maxLines)
    }
}

// MARK: - Date

struct JistDateView: View {
    let node: JistDateNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver
    let formatDate: ((String, String) -> String)?

    var body: some View {
        Text(displayText)
            .font(.system(
                size: resolver.resolveNumber(type: "date", variant: node.variant, group: "text", property: "fontSize", fallback: 12),
                weight: JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "date", variant: node.variant, group: "text", property: "fontWeight", fallback: 400))
            ))
            .foregroundColor(resolver.resolveColor(type: "date", variant: node.variant, group: "text", property: "color", fallback: .secondary))
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

    var body: some View {
        if let obj = data[node.name]?.objectValue,
           let label = obj["label"]?.stringValue {
            Button {
                onAction?(JistActionEvent(
                    component: "button",
                    name: node.name,
                    data: data[node.name],
                    meta: node.meta
                ))
            } label: {
                Text(label)
                    .font(.system(
                        size: resolver.resolveNumber(type: "button", variant: node.variant, group: "text", property: "fontSize", fallback: 14),
                        weight: JistThemeResolver.fontWeight(from: resolver.resolveNumber(type: "button", variant: node.variant, group: "text", property: "fontWeight", fallback: 500))
                    ))
                    .foregroundColor(resolver.resolveColor(type: "button", variant: node.variant, group: "text", property: "color", fallback: .white))
            }
            .buttonStyle(JistButtonStyle(resolver: resolver, variant: node.variant))
        }
    }
}

struct JistButtonStyle: ButtonStyle {
    let resolver: JistThemeResolver
    let variant: String?

    func makeBody(configuration: Configuration) -> some View {
        let state: String? = configuration.isPressed ? "active" : nil
        let radius = resolver.resolveNumber(type: "button", variant: variant, group: "border", property: "radius", fallback: 6)
        let borderWidth = resolver.resolveNumber(type: "button", variant: variant, group: "border", property: "width", fallback: 0)

        configuration.label
            .padding(EdgeInsets(
                top:      resolver.resolveNumber(type: "button", variant: variant, group: "padding", property: "top", fallback: 8),
                leading:  resolver.resolveNumber(type: "button", variant: variant, group: "padding", property: "left", fallback: 16),
                bottom:   resolver.resolveNumber(type: "button", variant: variant, group: "padding", property: "bottom", fallback: 8),
                trailing: resolver.resolveNumber(type: "button", variant: variant, group: "padding", property: "right", fallback: 16)
            ))
            .background(
                RoundedRectangle(cornerRadius: radius)
                    .fill(resolver.resolveColor(
                        type: "button", variant: variant, group: "background", property: "color",
                        state: state, fallback: Color(hex: "#4F46E5")!
                    ))
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .stroke(
                        resolver.resolveColor(type: "button", variant: variant, group: "border", property: "color", state: state, fallback: .clear),
                        lineWidth: borderWidth
                    )
            )
    }
}

// MARK: - Image

struct JistImageView: View {
    let node: JistImageNode
    let data: [String: JistValue]
    let resolver: JistThemeResolver

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
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    applyFit(image.resizable())
                case .failure:
                    Color.gray.opacity(0.2)
                case .empty:
                    ProgressView()
                @unknown default:
                    EmptyView()
                }
            }
            .frame(width: fixedWidth, height: node.height)
            .frame(maxWidth: isFill ? .infinity : nil)
            .clipShape(RoundedRectangle(cornerRadius: node.borderRadius ?? 0))
            .accessibilityLabel(data["title"]?.stringValue ?? "")
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
