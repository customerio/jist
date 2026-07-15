/* ═══════════════════════════════════════════
   Jist Renderer
   Converts JSON template trees into DOM nodes
   ═══════════════════════════════════════════ */

// ── Template Model Types ───────────────────
// Single source of truth: core/jist-core/src/models.rs (Rust). These types are
// generated from it by tsify at wasm-build time and re-exported here, so the
// web renderer no longer hand-maintains its own copy of the node model.

import type {
  JistTemplate,
  JistNode,
  JistLayoutNode,
  JistActionNode,
  JistHeadingNode,
  JistTextNode,
  JistDateNode,
  JistButtonNode,
  JistImageNode,
  JistDynamicLayoutNode,
  JistTemplateNode,
} from "./wasm/jist_core.js";

export type {
  JistTemplate,
  JistNode,
  JistLayoutNode,
  JistActionNode,
  JistHeadingNode,
  JistTextNode,
  JistDateNode,
  JistButtonNode,
  JistImageNode,
  JistDynamicLayoutNode,
  JistTemplateNode,
};

// ── Data Types ─────────────────────────────

export interface JistButtonData {
  label: string;
  url: string;
  disabled?: boolean;
}

export type JistData = Record<string, unknown>;

// ── Action Event ───────────────────────────

export interface JistActionEvent {
  component: "button" | "action";
  name: string;
  data: unknown;
  meta: Record<string, unknown> | null;
  event?: Event;
}

// ── Callback Types ─────────────────────────

export type JistFormatDate = (isoString: string, name: string) => string;
export type JistOnAction = (event: JistActionEvent) => void;

export interface JistRendererOptions {
  formatDate?: JistFormatDate;
  onAction?: JistOnAction;
  templates?: Record<string, JistTemplate>;
}

// ── Constants ──────────────────────────────

const CLASS_PREFIX = "jist";

const ALIGN_MAP: Record<string, string> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  stretch: "stretch",
  baseline: "baseline",
};

const JUSTIFY_MAP: Record<string, string> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  "space-between": "space-between",
  "space-around": "space-around",
  "space-evenly": "space-evenly",
};

function px(value: number | string): string {
  if (typeof value === "number") return `${value}px`;
  if (value === "fill") return "100%";
  return value;
}

function defaultFormatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(navigator.language);
  } catch {
    return iso;
  }
}

// ── Renderer ───────────────────────────────

const MAX_TEMPLATE_DEPTH = 10;

export default class JistRenderer {
  #formatDate: JistFormatDate;
  #onAction: JistOnAction | null;
  #templates: Record<string, JistTemplate>;
  #templateDepth = 0;

  constructor({ formatDate, onAction, templates }: JistRendererOptions = {}) {
    this.#formatDate = formatDate || defaultFormatDate;
    this.#onAction = onAction || null;
    this.#templates = templates || {};
  }

  /**
   * Recursively builds a DOM tree from a JSON template node.
   */
  render(node: JistNode, data: JistData): HTMLElement | null {
    if (!node) return null;

    switch (node.type) {
      case "layout":
        return this.#buildLayout(node, data);
      case "action":
        return this.#buildAction(node, data);
      case "heading":
        return this.#buildHeading(node, data);
      case "text":
        return this.#buildText("p", "text", node, data);
      case "date":
        return this.#buildDate(node, data);
      case "button":
        return this.#buildButton(node, data);
      case "image":
        return this.#buildImage(node, data);
      case "dynamicLayout":
        return this.#buildDynamicLayout(node, data);
      case "template":
        return this.#buildTemplate(node, data);
      default:
        return null; // Unknown component — skip (forward compatibility)
    }
  }

  // ── Layout ────────────────────────────────

  #buildLayout(node: JistLayoutNode, data: JistData): HTMLElement {
    const el = document.createElement("div");
    el.style.display = "flex";
    el.style.flexDirection = node.direction === "horizontal" ? "row" : "column";
    if (node.gap) el.style.gap = px(node.gap);
    if (node.align) el.style.alignItems = ALIGN_MAP[node.align] || node.align;
    if (node.justify)
      el.style.justifyContent = JUSTIFY_MAP[node.justify] || node.justify;
    if (node.margin) {
      if (node.margin.top) el.style.marginTop = px(node.margin.top);
      if (node.margin.right) el.style.marginRight = px(node.margin.right);
      if (node.margin.bottom) el.style.marginBottom = px(node.margin.bottom);
      if (node.margin.left) el.style.marginLeft = px(node.margin.left);
    }
    const isHorizontal = node.direction === "horizontal";
    const needsFlex = isHorizontal && (!node.justify || node.justify === "start");
    const textAlign = !isHorizontal && node.align === "center" ? "center"
                    : !isHorizontal && node.align === "end" ? "right"
                    : "";
    for (const child of node.children || []) {
      const childEl = this.render(child, data);
      if (childEl) {
        if (needsFlex && child.type === "layout") {
          childEl.style.flex = "1";
          childEl.style.minWidth = "0";
        }
        if (textAlign) childEl.style.textAlign = textAlign;
        el.appendChild(childEl);
      }
    }
    return el;
  }

  // ── Action (clickable wrapper) ────────────

  #buildAction(node: JistActionNode, data: JistData): HTMLElement {
    const name = node.name || "action";
    const el = document.createElement("div");
    this.#applyClasses(el, "action", name);
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");

    for (const child of node.children || []) {
      const childEl = this.render(child, data);
      if (childEl) el.appendChild(childEl);
    }

    const actionData = data[name];
    const meta = node.meta || null;
    if (this.#onAction) {
      const onAction = this.#onAction;
      const handler = (e: Event) => {
        e.stopPropagation();
        onAction({
          component: "action",
          name,
          data: actionData,
          meta,
          event: e,
        });
      };
      el.addEventListener("click", handler);
      el.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handler(e);
        }
      });
    }

    return el;
  }

  // ── Heading ───────────────────────────────

  #buildHeading(node: JistHeadingNode, data: JistData): HTMLElement {
    const variant = node.variant || "h3";
    return this.#buildText(variant, "heading", node, data, variant);
  }

  // ── Text (heading, body) ──────────────────

  #buildText(
    tag: string,
    componentType: string,
    node: JistHeadingNode | JistTextNode,
    data: JistData,
    variant?: string
  ): HTMLElement {
    const name = node.name || componentType;
    const el = document.createElement(tag);
    this.#applyClasses(el, componentType, name, variant || node.variant);
    el.textContent = (data[name] as string) || "";
    return el;
  }

  // ── Date ──────────────────────────────────

  #buildDate(node: JistDateNode, data: JistData): HTMLElement {
    const name = node.name || "date";
    const el = document.createElement("time");
    this.#applyClasses(el, "date", name, node.variant);
    const value = data[name] as string | undefined;
    el.textContent = value ? this.#formatDate(value, name) : "";
    return el;
  }

  // ── Button ────────────────────────────────

  #buildButton(node: JistButtonNode, data: JistData): HTMLElement | null {
    const name = node.name || "button";
    const buttonData = data[name] as JistButtonData | undefined;
    if (!buttonData) return null;
    const el = document.createElement("button");
    this.#applyClasses(el, "button", name, node.variant);
    el.textContent = buttonData.label;
    if (buttonData.disabled) el.disabled = true;
    const meta = node.meta || null;
    el.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      if (this.#onAction) {
        this.#onAction({
          component: "button",
          name,
          data: buttonData,
          meta,
          event: e,
        });
      }
    });
    return el;
  }

  // ── Image ─────────────────────────────────

  #buildImage(node: JistImageNode, data: JistData): HTMLElement | null {
    const name = node.name || "image";
    const src = data[name] as string | undefined;
    if (!src) return null;

    const wrapper = document.createElement("div");
    this.#applyClasses(wrapper, "image", name, node.variant);
    wrapper.style.overflow = "hidden";

    const el = document.createElement("img");
    el.src = src;
    el.alt = (data.title as string) || "";
    el.style.display = "block";
    if (node.width) el.style.width = px(node.width);
    if (node.height) el.style.height = px(node.height);
    if (node.objectFit) el.style.objectFit = node.objectFit;
    if (node.borderRadius) el.style.borderRadius = px(node.borderRadius);

    wrapper.appendChild(el);
    return wrapper;
  }

  // ── Dynamic Layout (repeating container) ───

  #buildDynamicLayout(node: JistDynamicLayoutNode, data: JistData): HTMLElement | null {
    const items = data[node.name];
    if (!Array.isArray(items)) return null;
    const el = document.createElement("div");
    const direction = node.direction || "vertical";
    el.style.display = "flex";
    el.style.flexDirection = direction === "horizontal" ? "row" : "column";
    if (node.gap) el.style.gap = px(node.gap);
    if (node.align) el.style.alignItems = ALIGN_MAP[node.align] || node.align;
    if (node.justify)
      el.style.justifyContent = JUSTIFY_MAP[node.justify] || node.justify;
    if (node.margin) {
      if (node.margin.top) el.style.marginTop = px(node.margin.top);
      if (node.margin.right) el.style.marginRight = px(node.margin.right);
      if (node.margin.bottom) el.style.marginBottom = px(node.margin.bottom);
      if (node.margin.left) el.style.marginLeft = px(node.margin.left);
    }
    for (const item of items) {
      const itemData = (typeof item === "object" && item !== null) ? item as JistData : {};
      const childEl = this.render(node.template, itemData);
      if (childEl) el.appendChild(childEl);
    }
    return el;
  }

  // ── Ref (template reference) ───────────────

  #buildTemplate(node: JistTemplateNode, data: JistData): HTMLElement | null {
    const template = this.#templates[node.name];
    if (!template || this.#templateDepth >= MAX_TEMPLATE_DEPTH) return null;
    this.#templateDepth++;
    const result = this.render(template.root, data);
    this.#templateDepth--;
    return result;
  }

  // ── Helpers ───────────────────────────────

  #applyClasses(
    el: HTMLElement,
    type: string,
    name: string,
    variant?: string
  ): void {
    el.classList.add(`${CLASS_PREFIX}__${type}`);
    if (variant) el.classList.add(`${CLASS_PREFIX}__${type}--${variant}`);
    if (name !== type) el.classList.add(`${CLASS_PREFIX}__${name}`);
  }
}
