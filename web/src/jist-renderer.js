/* ═══════════════════════════════════════════
   Jist Renderer
   Converts JSON template trees into DOM nodes
   ═══════════════════════════════════════════ */

const CLASS_PREFIX = "jist";

const ALIGN_MAP = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  stretch: "stretch",
  baseline: "baseline",
};

const JUSTIFY_MAP = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  "space-between": "space-between",
  "space-around": "space-around",
  "space-evenly": "space-evenly",
};

function px(value) {
  if (typeof value === "number") return `${value}px`;
  if (value === "fill") return "100%";
  return value;
}

function defaultFormatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(navigator.language);
  } catch {
    return iso;
  }
}

export default class JistRenderer {
  #formatDate;
  #onAction;

  /**
   * @param {object}   [opts]
   * @param {function} [opts.formatDate] — formats an ISO date string for display (receives isoString, name)
   * @param {function} [opts.onAction]   — called when a button or action component is activated
   */
  constructor({ formatDate, onAction } = {}) {
    this.#formatDate = formatDate || defaultFormatDate;
    this.#onAction = onAction || null;
  }

  /**
   * Recursively builds a DOM tree from a JSON template node.
   * @param {object} node — template node (layout or component)
   * @param {object} data — data object for binding
   * @returns {HTMLElement|null}
   */
  render(node, data) {
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

  #buildLayout(node, data) {
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

  #buildAction(node, data) {
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
      const handler = (e) => {
        e.stopPropagation();
        this.#onAction({
          component: "action",
          name,
          data: actionData,
          meta,
          event: e,
        });
      };
      el.addEventListener("click", handler);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handler(e);
        }
      });
    }

    return el;
  }

  // ── Heading ───────────────────────────────

  #buildHeading(node, data) {
    const variant = node.variant || "h3";
    return this.#buildText(variant, node, data, variant);
  }

  // ── Text (heading, body) ──────────────────

  #buildText(tag, node, data, variant) {
    const name = node.name || node.type;
    const el = document.createElement(tag);
    this.#applyClasses(el, node.type, name, variant || node.variant);
    el.textContent = data[name] || "";
    return el;
  }

  // ── Date ──────────────────────────────────

  #buildDate(node, data) {
    const name = node.name || "date";
    const el = document.createElement("time");
    this.#applyClasses(el, "date", name, node.variant);
    const value = data[name];
    el.textContent = value ? this.#formatDate(value, name) : "";
    return el;
  }

  // ── Button ────────────────────────────────

  #buildButton(node, data) {
    const name = node.name || "button";
    const buttonData = data[name];
    if (!buttonData) return null;
    const el = document.createElement("button");
    this.#applyClasses(el, "button", name, node.variant);
    el.textContent = buttonData.label;
    const meta = node.meta || null;
    el.addEventListener("click", (e) => {
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

  #buildImage(node, data) {
    const name = node.name || "image";
    const src = data[name];
    if (!src) return null;
    const el = document.createElement("img");
    this.#applyClasses(el, "image", name, node.variant);
    el.src = src;
    el.alt = data.title || "";
    if (node.width) el.style.width = px(node.width);
    if (node.height) el.style.height = px(node.height);
    if (node.objectFit) el.style.objectFit = node.objectFit;
    if (node.borderRadius) el.style.borderRadius = px(node.borderRadius);
    return el;
  }

  // ── Helpers ───────────────────────────────

  #applyClasses(el, type, name, variant) {
    el.classList.add(`${CLASS_PREFIX}__${type}`);
    if (variant) el.classList.add(`${CLASS_PREFIX}__${type}--${variant}`);
    if (name !== type) el.classList.add(`${CLASS_PREFIX}__${name}`);
  }
}
