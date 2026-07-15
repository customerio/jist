import Foundation

// Swift-side ergonomics for the jist-core (Rust) generated model types.
//
// The model itself — every node type, `JistValue`, parsing — is defined once
// in core/jist-core/src/models.rs and generated into Generated/jist_core.swift.
// This file only adds Swift conveniences on top; it defines no model shape.

public extension JistValue {
    var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    var numberValue: Double? {
        if case .number(let n) = self { return n }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    var objectValue: [String: JistValue]? {
        if case .object(let o) = self { return o }
        return nil
    }

    var arrayValue: [JistValue]? {
        if case .array(let a) = self { return a }
        return nil
    }

    subscript(key: String) -> JistValue? {
        objectValue?[key]
    }
}

public extension JistDynamicLayoutNode {
    /// The template node rendered once per data-array item. (Stored as a
    /// one-element array purely for FFI reasons; see the Rust model.)
    var templateNode: JistNode? { template.first }
}

public extension JistNode {
    var isLayout: Bool {
        if case .layout = self { return true }
        return false
    }
}
