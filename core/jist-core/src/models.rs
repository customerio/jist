// Canonical Jist template model — the single source of truth for the
// template tree across iOS, Android, and Web.
//
// Before this module, the node/model types were hand-written three times:
//   - ios/Sources/Jist/Models.swift        (~192 LOC)
//   - android/.../io/customer/jist/Models.kt (~154 LOC)
//   - web/src/jist-renderer.ts (inline)      (~115 LOC)
//
// They are defined once here, parsed once here (via serde), and — in the
// follow-on FFI step (PR 3b) — exposed to each platform via UniFFI / wasm.
//
// Field names mirror `spec/jist-template-schema.json`. `camelCase` JSON keys
// (objectFit, borderRadius) are mapped via serde rename. The discriminated
// union of nodes is driven by the `type` field, exactly as the schema's
// `componentNode.oneOf` prescribes.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── JSON value (data-binding currency) ──────────────────────────────────────

/// A JSON value, used for data binding, action payloads, and template `meta`
/// bags. This replaces the hand-written `JistValue.swift` (iOS), kotlinx
/// `JsonElement` usage (Android), and `unknown` (web) with one FFI-friendly
/// type. Recursion flows through `Vec`/`HashMap`, so no boxing is needed.
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Enum))]
pub enum JistValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<JistValue>),
    Object(HashMap<String, JistValue>),
}

impl JistValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            JistValue::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            JistValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&HashMap<String, JistValue>> {
        match self {
            JistValue::Object(o) => Some(o),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&Vec<JistValue>> {
        match self {
            JistValue::Array(a) => Some(a),
            _ => None,
        }
    }

    /// Look up a key on an object value; `None` for non-objects.
    pub fn get(&self, key: &str) -> Option<&JistValue> {
        self.as_object().and_then(|o| o.get(key))
    }
}

impl From<serde_json::Value> for JistValue {
    fn from(v: serde_json::Value) -> Self {
        match v {
            serde_json::Value::Null => JistValue::Null,
            serde_json::Value::Bool(b) => JistValue::Bool(b),
            serde_json::Value::Number(n) => JistValue::Number(n.as_f64().unwrap_or(0.0)),
            serde_json::Value::String(s) => JistValue::String(s),
            serde_json::Value::Array(a) => {
                JistValue::Array(a.into_iter().map(JistValue::from).collect())
            }
            serde_json::Value::Object(o) => {
                JistValue::Object(o.into_iter().map(|(k, v)| (k, JistValue::from(v))).collect())
            }
        }
    }
}

impl From<&JistValue> for serde_json::Value {
    fn from(v: &JistValue) -> Self {
        match v {
            JistValue::Null => serde_json::Value::Null,
            JistValue::Bool(b) => serde_json::Value::Bool(*b),
            JistValue::Number(n) => serde_json::Number::from_f64(*n)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            JistValue::String(s) => serde_json::Value::String(s.clone()),
            JistValue::Array(a) => serde_json::Value::Array(a.iter().map(Into::into).collect()),
            JistValue::Object(o) => serde_json::Value::Object(
                o.iter().map(|(k, v)| (k.clone(), v.into())).collect(),
            ),
        }
    }
}

impl<'de> Deserialize<'de> for JistValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        Ok(serde_json::Value::deserialize(deserializer)?.into())
    }
}

impl Serialize for JistValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serde_json::Value::from(self).serialize(serializer)
    }
}

// ── Template ───────────────────────────────────────────────────────────────

/// A versioned template tree. Equivalent to Swift `JistTemplate` /
/// Kotlin `JistTemplate` / TS `JistTemplate`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
pub struct JistTemplate {
    /// Spec version this template targets (e.g. "1"). Renderers silently skip
    /// templates whose version they do not support.
    pub version: String,
    /// Root of the tree. Per the schema this is always a layout node, but we
    /// model it as a general node so malformed/foreign roots degrade to
    /// `JistNode::Unknown` rather than failing the whole parse.
    pub root: JistNode,
}

// ── Node (discriminated union on `type`) ────────────────────────────────────

/// Any component node in the template tree, discriminated by its `type` field.
///
/// Unknown `type` values decode to [`JistNode::Unknown`] so that a renderer
/// built against spec vN quietly skips components introduced in spec vN+1
/// (forward compatibility) — the same contract the hand-written renderers
/// implemented, now unified in one place.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Enum))]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum JistNode {
    Layout(JistLayoutNode),
    Action(JistActionNode),
    Heading(JistHeadingNode),
    Text(JistTextNode),
    Date(JistDateNode),
    Button(JistButtonNode),
    Image(JistImageNode),
    DynamicLayout(JistDynamicLayoutNode),
    Template(JistTemplateNode),
    /// Any `type` value not known to this build. Forward-compatibility escape
    /// hatch — renderers skip these.
    #[serde(other)]
    Unknown,
}

impl JistNode {
    /// The canonical `type` string for this node, matching the schema
    /// discriminator. Handy for logging and for the FFI summary surface.
    pub fn type_name(&self) -> &'static str {
        match self {
            JistNode::Layout(_) => "layout",
            JistNode::Action(_) => "action",
            JistNode::Heading(_) => "heading",
            JistNode::Text(_) => "text",
            JistNode::Date(_) => "date",
            JistNode::Button(_) => "button",
            JistNode::Image(_) => "image",
            JistNode::DynamicLayout(_) => "dynamicLayout",
            JistNode::Template(_) => "template",
            JistNode::Unknown => "unknown",
        }
    }

    /// Direct child nodes, if this node contains any. Layout and action nodes
    /// hold a list; dynamicLayout holds a single template node.
    pub fn children(&self) -> Vec<&JistNode> {
        match self {
            JistNode::Layout(n) => n.children.iter().collect(),
            JistNode::Action(n) => n.children.iter().collect(),
            JistNode::DynamicLayout(n) => n.template.iter().collect(),
            _ => Vec::new(),
        }
    }

    /// Total number of nodes in the subtree rooted at `self`, inclusive.
    pub fn node_count(&self) -> usize {
        1 + self.children().iter().map(|c| c.node_count()).sum::<usize>()
    }
}

// ── Node types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistLayoutNode {
    pub direction: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gap: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub justify: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin: Option<JistSpacing>,
    #[serde(default)]
    pub children: Vec<JistNode>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistActionNode {
    pub name: String,
    /// Static metadata forwarded verbatim in the action callback. Arbitrary
    /// JSON, preserved as-is.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(target_arch = "wasm32", tsify(type = "Record<string, unknown>"))]
    pub meta: Option<JistValue>,
    #[serde(default)]
    pub children: Vec<JistNode>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistHeadingNode {
    /// Data-binding key. Renderers default this to `"heading"` when absent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Semantic level / style variant (h2/h3/h4). Renderers default to `"h3"`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistTextNode {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistDateNode {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistButtonNode {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(target_arch = "wasm32", tsify(type = "Record<string, unknown>"))]
    pub meta: Option<JistValue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistImageNode {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
    /// `number` (fixed) or the string `"fill"` — see [`ImageWidth`]. This is
    /// the field that had drifted into three different representations across
    /// the hand-written models; here it is one type.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[cfg_attr(target_arch = "wasm32", tsify(type = "number | \"fill\""))]
    pub width: Option<ImageWidth>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object_fit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_radius: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistDynamicLayoutNode {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gap: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub justify: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin: Option<JistSpacing>,
    /// The single node rendered once per data-array item.
    ///
    /// Stored as a one-element `Vec` purely for FFI reasons: the recursive
    /// `JistNode` needs indirection, and UniFFI supports `Vec<T>` but not
    /// `Box<T>`. The custom serde below keeps the JSON identical (a single
    /// object, never an array); use [`Self::template_node`] to read it.
    #[serde(with = "single_node")]
    #[cfg_attr(target_arch = "wasm32", tsify(type = "JistNode"))]
    pub template: Vec<JistNode>,
}

impl JistDynamicLayoutNode {
    /// The template node rendered per item. Always present after parsing.
    pub fn template_node(&self) -> Option<&JistNode> {
        self.template.first()
    }
}

/// (De)serializes `Vec<JistNode>` as a single node — see
/// [`JistDynamicLayoutNode::template`].
mod single_node {
    use super::JistNode;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer>(v: &[JistNode], s: S) -> Result<S::Ok, S::Error> {
        v.first().unwrap_or(&JistNode::Unknown).serialize(s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<JistNode>, D::Error> {
        Ok(vec![JistNode::deserialize(d)?])
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistTemplateNode {
    /// Name of a template in the registry to render in place.
    pub name: String,
}

// ── Spacing ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(target_arch = "wasm32", derive(tsify_next::Tsify))]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
#[serde(rename_all = "camelCase")]
pub struct JistSpacing {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bottom: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub left: Option<f64>,
}

// ── Image width union (number | "fill") ─────────────────────────────────────

/// Image width: either a fixed unitless value or `"fill"` to expand to the
/// container. Mirrors the schema's `oneOf: [number, const "fill"]`.
///
/// Non-number, non-`"fill"` inputs degrade to [`ImageWidth::Fill`], matching
/// the lenient behavior of the previous Swift decoder.
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Enum))]
pub enum ImageWidth {
    Fixed(f64),
    Fill,
}

impl ImageWidth {
    pub fn is_fill(&self) -> bool {
        matches!(self, ImageWidth::Fill)
    }

    pub fn fixed_value(&self) -> Option<f64> {
        match self {
            ImageWidth::Fixed(n) => Some(*n),
            ImageWidth::Fill => None,
        }
    }
}

impl<'de> Deserialize<'de> for ImageWidth {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        match serde_json::Value::deserialize(deserializer)? {
            serde_json::Value::Number(n) => Ok(ImageWidth::Fixed(n.as_f64().unwrap_or(0.0))),
            serde_json::Value::String(s) if s == "fill" => Ok(ImageWidth::Fill),
            _ => Ok(ImageWidth::Fill),
        }
    }
}

impl Serialize for ImageWidth {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            ImageWidth::Fixed(n) => serializer.serialize_f64(*n),
            ImageWidth::Fill => serializer.serialize_str("fill"),
        }
    }
}

// ── Action event ────────────────────────────────────────────────────────────

/// Emitted to the host when an action/button is activated. Mirrors Swift
/// `JistActionEvent` / Kotlin `JistActionEvent`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
pub struct JistActionEvent {
    /// `"button"` or `"action"`.
    pub component: String,
    pub name: String,
    /// The bound payload (`data[name]`), arbitrary JSON.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<JistValue>,
    /// Static template metadata, arbitrary JSON.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<JistValue>,
}

// ── Color mode ──────────────────────────────────────────────────────────────

/// Requested color mode. `Auto` defers to the platform's current appearance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Enum))]
#[serde(rename_all = "lowercase")]
pub enum JistMode {
    Auto,
    Light,
    Dark,
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/// Error raised while parsing a template, data, or registry document.
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Error))]
#[cfg_attr(not(target_arch = "wasm32"), uniffi(flat_error))]
pub enum ParseError {
    /// The input was not valid JSON, or did not match the template shape.
    InvalidJson(String),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::InvalidJson(msg) => write!(f, "invalid template JSON: {msg}"),
        }
    }
}

impl std::error::Error for ParseError {}

impl From<serde_json::Error> for ParseError {
    fn from(e: serde_json::Error) -> Self {
        ParseError::InvalidJson(e.to_string())
    }
}

/// Parse a single template document (`{ "version", "root" }`).
pub fn parse_template(json: &str) -> Result<JistTemplate, ParseError> {
    Ok(serde_json::from_str(json)?)
}

/// Parse a template registry (`{ "<name>": [template, ...], ... }`).
///
/// The optional `$schema` key (and any other `$`-prefixed key) is ignored.
pub fn parse_registry(json: &str) -> Result<HashMap<String, Vec<JistTemplate>>, ParseError> {
    let raw: HashMap<String, serde_json::Value> = serde_json::from_str(json)?;
    let mut out = HashMap::new();
    for (name, value) in raw {
        if name.starts_with('$') {
            continue;
        }
        let templates: Vec<JistTemplate> = serde_json::from_value(value)?;
        out.insert(name, templates);
    }
    Ok(out)
}

/// Parse a data-binding document (`{ "<key>": <any JSON>, ... }`) into the
/// shared value type. Hosts use this for the `data` and `theme` inputs, which
/// previously required a hand-written JSON value type per platform.
pub fn parse_data(json: &str) -> Result<HashMap<String, JistValue>, ParseError> {
    Ok(serde_json::from_str(json)?)
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // The real, canonical fixtures the platform snapshot suites render against.
    // Parsing these proves the Rust model is faithful to production templates.
    const REGISTRY: &str = include_str!("../../../shared/templates.json");

    fn count_by_type(node: &JistNode, kind: &str, acc: &mut usize) {
        if node.type_name() == kind {
            *acc += 1;
        }
        for child in node.children() {
            count_by_type(child, kind, acc);
        }
    }

    #[test]
    fn parses_a_minimal_template() {
        let json = r#"{"version":"1","root":{"type":"layout","direction":"vertical","children":[]}}"#;
        let t = parse_template(json).unwrap();
        assert_eq!(t.version, "1");
        match t.root {
            JistNode::Layout(l) => {
                assert_eq!(l.direction, "vertical");
                assert!(l.children.is_empty());
            }
            other => panic!("expected layout root, got {}", other.type_name()),
        }
    }

    #[test]
    fn parses_every_leaf_node_type() {
        let json = r#"{
            "version":"1",
            "root":{"type":"layout","direction":"vertical","gap":8,"children":[
                {"type":"heading","name":"title","variant":"h2"},
                {"type":"text","name":"body"},
                {"type":"date","name":"ts","variant":"compact"},
                {"type":"button","name":"cta","variant":"primary"},
                {"type":"template","name":"row"}
            ]}
        }"#;
        let t = parse_template(json).unwrap();
        let JistNode::Layout(root) = t.root else { panic!("expected layout") };
        let kinds: Vec<&str> = root.children.iter().map(|n| n.type_name()).collect();
        assert_eq!(kinds, ["heading", "text", "date", "button", "template"]);
    }

    #[test]
    fn image_width_fill_and_fixed_and_absent() {
        let fill = r#"{"version":"1","root":{"type":"layout","direction":"vertical","children":[
            {"type":"image","name":"a","width":"fill","height":180,"objectFit":"cover","borderRadius":8}
        ]}}"#;
        let fixed = r#"{"version":"1","root":{"type":"layout","direction":"vertical","children":[
            {"type":"image","name":"a","width":36,"height":36}
        ]}}"#;
        let absent = r#"{"version":"1","root":{"type":"layout","direction":"vertical","children":[
            {"type":"image","name":"a"}
        ]}}"#;

        let img = |src: &str| -> JistImageNode {
            let JistNode::Layout(root) = parse_template(src).unwrap().root else { panic!() };
            let JistNode::Image(img) = root.children.into_iter().next().unwrap() else { panic!() };
            img
        };

        assert_eq!(img(fill).width, Some(ImageWidth::Fill));
        assert!(img(fill).width.unwrap().is_fill());
        assert_eq!(img(fixed).width, Some(ImageWidth::Fixed(36.0)));
        assert_eq!(img(fixed).width.unwrap().fixed_value(), Some(36.0));
        assert_eq!(img(absent).width, None);
    }

    #[test]
    fn unknown_node_type_degrades_to_unknown() {
        // A component introduced in a future spec version.
        let json = r#"{"version":"1","root":{"type":"layout","direction":"vertical","children":[
            {"type":"carousel","name":"gallery","slides":3}
        ]}}"#;
        let JistNode::Layout(root) = parse_template(json).unwrap().root else { panic!() };
        assert_eq!(root.children.len(), 1);
        assert_eq!(root.children[0], JistNode::Unknown);
    }

    #[test]
    fn ignores_unknown_properties_on_known_nodes() {
        // Forward-compat: a new field on an existing node must not break parsing.
        let json = r#"{"version":"1","root":{"type":"layout","direction":"vertical","opacity":0.5,"children":[]}}"#;
        assert!(parse_template(json).is_ok());
    }

    #[test]
    fn preserves_action_meta_verbatim() {
        let json = r#"{"version":"1","root":{"type":"layout","direction":"vertical","children":[
            {"type":"action","name":"open","meta":{"track":"tap","weight":3,"nested":{"k":true}},"children":[]}
        ]}}"#;
        let JistNode::Layout(root) = parse_template(json).unwrap().root else { panic!() };
        let JistNode::Action(a) = &root.children[0] else { panic!() };
        let meta = a.meta.as_ref().unwrap();
        assert_eq!(meta.get("track"), Some(&JistValue::String("tap".into())));
        assert_eq!(meta.get("weight"), Some(&JistValue::Number(3.0)));
        assert_eq!(
            meta.get("nested").and_then(|n| n.get("k")),
            Some(&JistValue::Bool(true))
        );
    }

    #[test]
    fn parse_data_handles_every_json_shape() {
        let data = parse_data(
            r#"{
                "title": "Hello",
                "count": 3,
                "enabled": true,
                "missing": null,
                "cta": {"label": "Go", "url": "https://x.io"},
                "items": [{"body": "a"}, {"body": "b"}]
            }"#,
        )
        .unwrap();
        assert_eq!(data["title"].as_str(), Some("Hello"));
        assert_eq!(data["count"].as_f64(), Some(3.0));
        assert_eq!(data["enabled"], JistValue::Bool(true));
        assert_eq!(data["missing"], JistValue::Null);
        assert_eq!(data["cta"].get("label").and_then(JistValue::as_str), Some("Go"));
        assert_eq!(data["items"].as_array().map(Vec::len), Some(2));
        // The real shared data fixture must also parse.
        let real = parse_data(include_str!("../../../shared/data.json")).unwrap();
        assert!(real.contains_key("basic"), "shared/data.json should have a `basic` entry");
    }

    #[test]
    fn dynamic_layout_holds_a_template_ref() {
        let json = r#"{"version":"1","root":{"type":"layout","direction":"vertical","children":[
            {"type":"dynamicLayout","name":"items","gap":12,"template":{"type":"template","name":"row"}}
        ]}}"#;
        let JistNode::Layout(root) = parse_template(json).unwrap().root else { panic!() };
        let JistNode::DynamicLayout(dl) = &root.children[0] else { panic!() };
        assert_eq!(dl.name, "items");
        match dl.template_node().unwrap() {
            JistNode::Template(t) => assert_eq!(t.name, "row"),
            other => panic!("expected template ref, got {}", other.type_name()),
        }
    }

    #[test]
    fn round_trips_through_serialize() {
        let json = r#"{"version":"1","root":{"type":"layout","direction":"vertical","gap":8,"children":[
            {"type":"image","name":"a","width":"fill","height":180},
            {"type":"image","name":"b","width":36}
        ]}}"#;
        let parsed = parse_template(json).unwrap();
        let reserialized = serde_json::to_string(&parsed).unwrap();
        let reparsed = parse_template(&reserialized).unwrap();
        assert_eq!(parsed, reparsed, "model must survive a serialize→parse round trip");
    }

    #[test]
    fn mode_serde_is_lowercase() {
        assert_eq!(serde_json::to_string(&JistMode::Dark).unwrap(), "\"dark\"");
        assert_eq!(
            serde_json::from_str::<JistMode>("\"auto\"").unwrap(),
            JistMode::Auto
        );
    }

    #[test]
    fn invalid_json_is_an_error() {
        assert!(parse_template("{ not json").is_err());
        assert!(parse_template(r#"{"version":"1"}"#).is_err()); // missing root
    }

    // ── Real fixtures ────────────────────────────────────────────────────────

    #[test]
    fn parses_the_real_template_registry() {
        let registry = parse_registry(REGISTRY).unwrap();

        // Every documented template is present; $schema is not a template.
        for name in [
            "basic",
            "image",
            "cta",
            "liveActivity",
            "action",
            "hero",
            "inbox",
            "profile",
            "announcement",
        ] {
            let entry = registry
                .get(name)
                .unwrap_or_else(|| panic!("missing template `{name}` in registry"));
            assert!(!entry.is_empty(), "template `{name}` has no versions");
        }
        assert!(!registry.contains_key("$schema"), "$schema must be skipped");
    }

    #[test]
    fn real_image_template_uses_fill_width() {
        let registry = parse_registry(REGISTRY).unwrap();
        let template = &registry.get("image").unwrap()[0];
        let mut fill_images = 0;
        fn walk(node: &JistNode, fill_images: &mut usize) {
            if let JistNode::Image(img) = node {
                if matches!(img.width, Some(ImageWidth::Fill)) {
                    *fill_images += 1;
                }
            }
            for child in node.children() {
                walk(child, fill_images);
            }
        }
        walk(&template.root, &mut fill_images);
        assert!(fill_images >= 1, "image template should contain a fill-width image");
    }

    #[test]
    fn real_inbox_template_uses_dynamic_layout_and_template_ref() {
        let registry = parse_registry(REGISTRY).unwrap();
        let template = &registry.get("inbox").unwrap()[0];
        let mut dynamic = 0;
        count_by_type(&template.root, "dynamicLayout", &mut dynamic);
        assert!(dynamic >= 1, "inbox template should use a dynamicLayout");
    }

    #[test]
    fn real_action_template_has_fixed_width_avatar() {
        // The `action` template uses numeric width (36) — the other arm of the
        // width union — so parsing it exercises ImageWidth::Fixed on real data.
        let registry = parse_registry(REGISTRY).unwrap();
        let template = &registry.get("action").unwrap()[0];
        fn find_fixed(node: &JistNode) -> bool {
            if let JistNode::Image(img) = node {
                if img.width.as_ref().and_then(|w| w.fixed_value()).is_some() {
                    return true;
                }
            }
            node.children().iter().any(|c| find_fixed(c))
        }
        assert!(find_fixed(&template.root), "action template should have a fixed-width image");
    }
}
