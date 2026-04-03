/* ═══════════════════════════════════════════
   Jist Renderer
   Converts JSON template trees into DOM nodes
   ═══════════════════════════════════════════ */

// ── Template Types ─────────────────────────

export interface JistSpacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface JistLayoutNode {
  type: "layout";
  direction: "vertical" | "horizontal";
  gap?: number;
  align?: string;
  justify?: string;
  margin?: JistSpacing;
  children: JistNode[];
}

export interface JistActionNode {
  type: "action";
  name: string;
  meta?: Record<string, unknown>;
  children: JistNode[];
}

export interface JistHeadingNode {
  type: "heading";
  name?: string;
  variant?: "h2" | "h3" | "h4";
}

export interface JistTextNode {
  type: "text";
  name?: string;
  variant?: string;
}

export interface JistDateNode {
  type: "date";
  name?: string;
  variant?: string;
}

export interface JistButtonNode {
  type: "button";
  name: string;
  variant?: string;
  meta?: Record<string, unknown>;
}

export interface JistImageNode {
  type: "image";
  name: string;
  variant?: string;
  width?: number | "fill";
  height?: number;
  objectFit?: "contain" | "cover" | "fill";
  borderRadius?: number;
}

export type JistNode =
  | JistLayoutNode
  | JistActionNode
  | JistHeadingNode
  | JistTextNode
  | JistDateNode
  | JistButtonNode
  | JistImageNode;

export interface JistTemplate {
  version: string;
  root: JistNode;
}

// ── Data Types ─────────────────────────────

export interface JistButtonData {
  label: string;
  url: string;
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

export default class JistRenderer {
  #formatDate: JistFormatDate;
  #onAction: JistOnAction | null;

  constructor({ formatDate, onAction }: JistRendererOptions = {}) {
    this.#formatDate = formatDate || defaultFormatDate;
    this.#onAction = onAction || null;
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
        return this.#buildText("p", node, data);
      case "date":
        return this.#buildDate(node, data);
      case "button":
        return this.#buildButton(node, data);
      case "image":
        return this.#buildImage(node, data);
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
    for (const child of node.children || []) {
      const childEl = this.render(child, data);
      if (childEl) el.appendChild(childEl);
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
    return this.#buildText(variant, node, data, variant);
  }

  // ── Text (heading, body) ──────────────────

  #buildText(
    tag: string,
    node: JistHeadingNode | JistTextNode,
    data: JistData,
    variant?: string
  ): HTMLElement {
    const name = node.name || node.type;
    const el = document.createElement(tag);
    this.#applyClasses(el, node.type, name, variant || node.variant);
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
    const el = document.createElement("img");
    this.#applyClasses(el, "image", name, node.variant);
    el.src = src;
    el.alt = (data.title as string) || "";
    if (node.width) el.style.width = px(node.width);
    if (node.height) el.style.height = px(node.height);
    if (node.objectFit) el.style.objectFit = node.objectFit;
    if (node.borderRadius) el.style.borderRadius = px(node.borderRadius);
    return el;
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
