package io.customer.jist

// Re-exports of the jist-core (Rust) generated model types under the
// library's package, plus Kotlin-side ergonomics.
//
// The model itself — every node type, `JistValue`, parsing — is defined once
// in core/jist-core/src/models.rs and generated into uniffi/jist_core/.
// This file adds no model shape of its own.

typealias JistTemplate = uniffi.jist_core.JistTemplate
typealias JistNode = uniffi.jist_core.JistNode
typealias JistLayoutNode = uniffi.jist_core.JistLayoutNode
typealias JistActionNode = uniffi.jist_core.JistActionNode
typealias JistHeadingNode = uniffi.jist_core.JistHeadingNode
typealias JistTextNode = uniffi.jist_core.JistTextNode
typealias JistDateNode = uniffi.jist_core.JistDateNode
typealias JistButtonNode = uniffi.jist_core.JistButtonNode
typealias JistImageNode = uniffi.jist_core.JistImageNode
typealias JistDynamicLayoutNode = uniffi.jist_core.JistDynamicLayoutNode
typealias JistTemplateNode = uniffi.jist_core.JistTemplateNode
typealias JistSpacing = uniffi.jist_core.JistSpacing
typealias JistActionEvent = uniffi.jist_core.JistActionEvent
typealias JistMode = uniffi.jist_core.JistMode
typealias JistValue = uniffi.jist_core.JistValue
typealias ImageWidth = uniffi.jist_core.ImageWidth

// ── JistValue accessors ─────────────────────────────────────────────────────

val JistValue.stringValue: String?
    get() = (this as? uniffi.jist_core.JistValue.String)?.v1

val JistValue.numberValue: Double?
    get() = (this as? uniffi.jist_core.JistValue.Number)?.v1

val JistValue.boolValue: Boolean?
    get() = (this as? uniffi.jist_core.JistValue.Bool)?.v1

val JistValue.objectValue: Map<String, JistValue>?
    get() = (this as? uniffi.jist_core.JistValue.Object)?.v1

val JistValue.arrayValue: List<JistValue>?
    get() = (this as? uniffi.jist_core.JistValue.Array)?.v1

// ── Node conveniences ───────────────────────────────────────────────────────

/// The template node rendered once per data-array item. (Stored as a
/// one-element list purely for FFI reasons; see the Rust model.)
val JistDynamicLayoutNode.templateNode: JistNode?
    get() = template.firstOrNull()

val JistImageNode.isFillWidth: Boolean
    get() = width is uniffi.jist_core.ImageWidth.Fill

val JistImageNode.widthValue: Double?
    get() = (width as? uniffi.jist_core.ImageWidth.Fixed)?.v1
