/* ═══════════════════════════════════════════
   <jist-template> Custom Element
   Renders a Jist template tree into native DOM
   ═══════════════════════════════════════════ */

import JistRenderer from "./jist-renderer.js";
import type {
  JistTemplate,
  JistData,
  JistFormatDate,
  JistOnAction,
  JistActionEvent,
} from "./jist-renderer.js";

const SUPPORTED_VERSION = "1";

// Theme properties that are unitless numbers (not CSS lengths)
const UNITLESS_KEYS = new Set([
  "fontWeight",
  "maxLines",
  "lineHeight",
  "opacity",
]);

type JistMode = "auto" | "light" | "dark";

type ThemeValue = string | number | boolean | null | ThemeObject;
interface ThemeObject {
  [key: string]: ThemeValue;
}

class JistTemplateElement extends HTMLElement {
  static observedAttributes = ["template", "data", "theme", "mode"];

  #template: JistTemplate | null = null;
  #data: JistData | null = null;
  #theme: ThemeObject | null = null;
  #mode: JistMode = "auto";
  #formatDate: JistFormatDate | null = null;
  #onAction: JistOnAction | null = null;
  #mediaQuery: MediaQueryList | null = null;
  #mediaHandler: (() => void) | null = null;

  // ── Property API ──────────────────────────

  get template(): JistTemplate | null {
    return this.#template;
  }
  set template(val: JistTemplate | string | null) {
    this.#template = typeof val === "string" ? JSON.parse(val) : val;
    this.#render();
  }

  get data(): JistData | null {
    return this.#data;
  }
  set data(val: JistData | string | null) {
    this.#data = typeof val === "string" ? JSON.parse(val) : val;
    this.#render();
  }

  get theme(): ThemeObject | null {
    return this.#theme;
  }
  set theme(val: ThemeObject | string | null) {
    this.#theme = typeof val === "string" ? JSON.parse(val) : val;
    this.#applyTheme();
    this.#render();
  }

  get mode(): JistMode {
    return this.#mode;
  }
  set mode(val: JistMode | string) {
    this.#mode = (val || "auto") as JistMode;
    this.#applyTheme();
  }

  get formatDate(): JistFormatDate | null {
    return this.#formatDate;
  }
  set formatDate(fn: JistFormatDate | null) {
    this.#formatDate = fn;
    this.#render();
  }

  get onAction(): JistOnAction | null {
    return this.#onAction;
  }
  set onAction(fn: JistOnAction | null) {
    this.#onAction = fn;
  }

  // ── Lifecycle ─────────────────────────────

  connectedCallback(): void {
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

  disconnectedCallback(): void {
    if (this.#mediaQuery && this.#mediaHandler) {
      this.#mediaQuery.removeEventListener("change", this.#mediaHandler);
    }
  }

  attributeChangedCallback(
    name: string,
    oldVal: string | null,
    newVal: string | null
  ): void {
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
        this.#mode = (newVal || "auto") as JistMode;
        this.#applyTheme();
        this.#render();
        break;
    }
  }

  // ── Theme → CSS Custom Properties ─────────

  #isDark(): boolean {
    if (this.#mode === "dark") return true;
    if (this.#mode === "light") return false;
    return this.#mediaQuery?.matches ?? false;
  }

  #applyTheme(): void {
    if (!this.#theme) return;
    if (!this.isConnected) return;

    // Clear existing jist custom properties
    const toRemove: string[] = [];
    for (let i = 0; i < this.style.length; i++) {
      if (this.style[i].startsWith("--jist-")) toRemove.push(this.style[i]);
    }
    toRemove.forEach((p) => this.style.removeProperty(p));

    // Flatten base theme
    this.#flatten(this.#theme, "--jist");

    // Apply dark overrides if active
    if (this.#isDark()) {
      const darkOverrides = (this.#theme.modes as ThemeObject | undefined)
        ?.dark as ThemeObject | undefined;
      if (darkOverrides) {
        this.#flatten(darkOverrides, "--jist");
      }
    }
  }

  #flatten(obj: ThemeObject, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "modes" || key.startsWith("$")) continue;
      const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      const prop = `${prefix}-${kebab}`;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        this.#flatten(value as ThemeObject, prop);
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

  #render(): void {
    if (!this.#template || !this.#data) return;
    if (!this.isConnected) return;

    // Version check — silently skip unsupported templates
    if (this.#template.version !== SUPPORTED_VERSION) {
      this.innerHTML = "";
      return;
    }

    const renderer = new JistRenderer({
      formatDate: this.#formatDate || undefined,
      onAction: (detail: JistActionEvent) => {
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

customElements.define("jist-template", JistTemplateElement);

export default JistTemplateElement;
export { JistRenderer };
export type {
  JistTemplate,
  JistData,
  JistFormatDate,
  JistOnAction,
  JistActionEvent,
  JistMode,
};
