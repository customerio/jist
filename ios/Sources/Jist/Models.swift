import Foundation
import CoreGraphics

// MARK: - Template

public struct JistTemplate: Codable, Sendable {
    public let version: String
    public let root: JistNode

    public init(version: String, root: JistNode) {
        self.version = version
        self.root = root
    }
}

// MARK: - Node

public indirect enum JistNode: Codable, Sendable {
    case layout(JistLayoutNode)
    case action(JistActionNode)
    case heading(JistHeadingNode)
    case text(JistTextNode)
    case date(JistDateNode)
    case button(JistButtonNode)
    case image(JistImageNode)
    case dynamicLayout(JistDynamicLayoutNode)
    case unknown

    enum CodingKeys: String, CodingKey {
        case type
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "layout":  self = .layout(try JistLayoutNode(from: decoder))
        case "action":  self = .action(try JistActionNode(from: decoder))
        case "heading": self = .heading(try JistHeadingNode(from: decoder))
        case "text":    self = .text(try JistTextNode(from: decoder))
        case "date":    self = .date(try JistDateNode(from: decoder))
        case "button":  self = .button(try JistButtonNode(from: decoder))
        case "image":   self = .image(try JistImageNode(from: decoder))
        case "dynamicLayout": self = .dynamicLayout(try JistDynamicLayoutNode(from: decoder))
        default:        self = .unknown
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .layout(let n):  try n.encode(to: encoder)
        case .action(let n):  try n.encode(to: encoder)
        case .heading(let n): try n.encode(to: encoder)
        case .text(let n):    try n.encode(to: encoder)
        case .date(let n):    try n.encode(to: encoder)
        case .button(let n):  try n.encode(to: encoder)
        case .image(let n):   try n.encode(to: encoder)
        case .dynamicLayout(let n): try n.encode(to: encoder)
        case .unknown:        break
        }
    }
}

// MARK: - Spacing

public struct JistSpacing: Codable, Sendable {
    public var top: CGFloat?
    public var right: CGFloat?
    public var bottom: CGFloat?
    public var left: CGFloat?
}

// MARK: - Node Types

public struct JistLayoutNode: Codable, Sendable {
    public let type: String
    public let direction: String
    public var gap: CGFloat?
    public var align: String?
    public var justify: String?
    public var margin: JistSpacing?
    public let children: [JistNode]
}

public struct JistActionNode: Codable, Sendable {
    public let type: String
    public let name: String
    public var meta: [String: JistValue]?
    public let children: [JistNode]
}

public struct JistHeadingNode: Codable, Sendable {
    public let type: String
    public var name: String?
    public var variant: String?
}

public struct JistTextNode: Codable, Sendable {
    public let type: String
    public var name: String?
    public var variant: String?
}

public struct JistDateNode: Codable, Sendable {
    public let type: String
    public var name: String?
    public var variant: String?
}

public struct JistButtonNode: Codable, Sendable {
    public let type: String
    public let name: String
    public var variant: String?
    public var meta: [String: JistValue]?
}

public enum JistImageWidth: Codable, Sendable, Equatable {
    case fixed(CGFloat)
    case fill

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self), str == "fill" {
            self = .fill
        } else if let num = try? container.decode(CGFloat.self) {
            self = .fixed(num)
        } else {
            self = .fill
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .fixed(let v): try container.encode(v)
        case .fill: try container.encode("fill")
        }
    }
}

public struct JistImageNode: Codable, Sendable {
    public let type: String
    public let name: String
    public var variant: String?
    public var width: JistImageWidth?
    public var height: CGFloat?
    public var objectFit: String?
    public var borderRadius: CGFloat?
}

public struct JistDynamicLayoutNode: Codable, Sendable {
    public let type: String
    public let name: String
    public var direction: String?
    public var gap: CGFloat?
    public var align: String?
    public var justify: String?
    public var margin: JistSpacing?
    public let template: JistNode
}

// MARK: - Action Event

public struct JistActionEvent: Sendable {
    public let component: String
    public let name: String
    public let data: JistValue?
    public let meta: [String: JistValue]?

    public init(component: String, name: String, data: JistValue?, meta: [String: JistValue]?) {
        self.component = component
        self.name = name
        self.data = data
        self.meta = meta
    }
}

// MARK: - Mode

public enum JistMode: String, Sendable {
    case auto
    case light
    case dark
}
