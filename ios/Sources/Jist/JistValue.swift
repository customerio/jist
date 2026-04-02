import Foundation

/// A type-erased JSON value for dynamic data handling.
public enum JistValue: Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JistValue])
    case array([JistValue])
    case null

    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    public var numberValue: Double? {
        if case .number(let n) = self { return n }
        return nil
    }

    public var objectValue: [String: JistValue]? {
        if case .object(let o) = self { return o }
        return nil
    }

    public var arrayValue: [JistValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    public subscript(key: String) -> JistValue? {
        objectValue?[key]
    }
}

extension JistValue: Decodable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let num = try? container.decode(Double.self) {
            self = .number(num)
        } else if let str = try? container.decode(String.self) {
            self = .string(str)
        } else if let arr = try? container.decode([JistValue].self) {
            self = .array(arr)
        } else if let obj = try? container.decode([String: JistValue].self) {
            self = .object(obj)
        } else {
            self = .null
        }
    }
}

extension JistValue: Encodable {
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let s): try container.encode(s)
        case .number(let n): try container.encode(n)
        case .bool(let b): try container.encode(b)
        case .object(let o): try container.encode(o)
        case .array(let a): try container.encode(a)
        case .null: try container.encodeNil()
        }
    }
}
