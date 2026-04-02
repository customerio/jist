/* ═══════════════════════════════════════════
   <jist-template> Custom Element
   Renders a Jist template tree into native DOM
   ═══════════════════════════════════════════ */

import JistRenderer from "./jist-renderer.js";

const SUPPORTED_VERSION = "1";

// Theme properties that are unitless numbers (not CSS lengths)
const UNITLESS_KEYS = new Set([
  "fontWeight",
  "maxLines",
  "lineHeight",
  "opacity",
]);

class JistTemplate extends HTMLElement {
  static observedAttributes = ["template", "data", "theme", "mode"];

  #template = null;
  #data = null;
  #theme = null;
  #mode = "auto";
  #formatDate = null;
  #onAction = null;
  #mediaQuery = null;
  #mediaHandler = null;

  // ── Property API ──────────────────────────

  get template() {
    return this.#template;
  }
  set template(val) {
    this.#template = typeof val === "string" ? JSON.parse(val) : val;
    this.#render();
  }

  get data() {
    return this.#data;
  }
  set data(val) {
    this.#data = typeof val === "string" ? JSON.parse(val) : val;
    this.#render();
  }

  get theme() {
    return this.#theme;
  }
  set theme(val) {
    this.#theme = typeof val === "string" ? JSON.parse(val) : val;
    this.#applyTheme();
    this.#render();
  }

  get mode() {
    return this.#mode;
  }
  set mode(val) {
    this.#mode = val || "auto";
    this.#applyTheme();
  }

  get formatDate() {
    return this.#formatDate;
  }
  set formatDate(fn) {
    this.#formatDate = fn;
    this.#render();
  }

  get onAction() {
    return this.#onAction;
  }
  set onAction(fn) {
    this.#onAction = fn;
  }

  // ── Lifecycle ─────────────────────────────

  connectedCallback() {
    this.#mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.#mediaHandler = () => {
      if (this.#mode === "auto") {
        this.#applyTheme();
        this.#render();
      }
    };
    this.#mediaQuery.addEventListener("change", this.#mediaHandler);

    this.#applyTheme();
    this.#render();
  }

  disconnectedCallback() {
    if (this.#mediaQuery && this.#mediaHandler) {
      this.#mediaQuery.removeEventListener("change", this.#mediaHandler);
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    switch (name) {
      case "template":
        this.#template = newVal ? JSON.parse(newVal) : null;
        this.#render();
        break;
      case "data":
        this.#data = newVal ? JSON.parse(newVal) : null;
        this.#render();
        break;
      case "theme":
        this.#theme = newVal ? JSON.parse(newVal) : null;
        this.#applyTheme();
        this.#render();
        break;
      case "mode":
        this.#mode = newVal || "auto";
        this.#applyTheme();
        this.#render();
        break;
    }
  }

  // ── Theme → CSS Custom Properties ─────────

  #isDark() {
    if (this.#mode === "dark") return true;
    if (this.#mode === "light") return false;
    return this.#mediaQuery?.matches ?? false;
  }

  #applyTheme() {
    if (!this.#theme) return;
    if (!this.isConnected) return;

    // Clear existing jist custom properties
    const toRemove = [];
    for (let i = 0; i < this.style.length; i++) {
      if (this.style[i].startsWith("--jist-")) toRemove.push(this.style[i]);
    }
    toRemove.forEach((p) => this.style.removeProperty(p));

    // Flatten base theme
    this.#flatten(this.#theme, "--jist");

    // Apply dark overrides if active
    if (this.#isDark() && this.#theme.modes?.dark) {
      this.#flatten(this.#theme.modes.dark, "--jist");
    }
  }

  #flatten(obj, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "modes" || key.startsWith("$")) continue;
      const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      const prop = `${prefix}-${kebab}`;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        this.#flatten(value, prop);
      } else if (value !== null && value !== undefined) {
        // Numeric values get "px" suffix unless they're unitless properties
        const cssValue =
          typeof value === "number" && !UNITLESS_KEYS.has(key)
            ? `${value}px`
            : String(value);
        this.style.setProperty(prop, cssValue);
      }
    }
  }

  // ── Rendering ─────────────────────────────

  #render() {
    if (!this.#template || !this.#data) return;
    if (!this.isConnected) return;

    // Version check — silently skip unsupported templates
    if (this.#template.version !== SUPPORTED_VERSION) {
      this.innerHTML = "";
      return;
    }

    const renderer = new JistRenderer({
      formatDate: this.#formatDate,
      onAction: (detail) => {
        // Property callback
        if (this.#onAction) this.#onAction(detail);

        // CustomEvent (without DOM event in detail — not cloneable)
        this.dispatchEvent(
          new CustomEvent("jist-action", {
            bubbles: true,
            detail: {
              component: detail.component,
              name: detail.name,
              data: detail.data,
              meta: detail.meta,
            },
          })
        );
      },
    });

    this.innerHTML = "";
    const dom = renderer.render(this.#template.root, this.#data);
    if (dom) this.appendChild(dom);
  }
}

customElements.define("jist-template", JistTemplate);

export default JistTemplate;
export { JistRenderer };
