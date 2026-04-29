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

// Numeric properties where 0 means "reset to platform default" (CSS `normal`),
// not a literal zero value. Setting these to 0 breaks the var() fallback chain
// so the variant doesn't inherit the base heading's value.
const ZERO_MEANS_NORMAL = new Set([
  "lineHeight",
  "letterSpacing",
]);

// ── Variant CSS generation ─────────────────
// Maps a flattened theme path suffix to the CSS property it controls.
// Only leaf properties that appear in a variant's theme data generate CSS.
const PATH_TO_CSS: Record<string, string> = {
  "text-font-size": "font-size",
  "text-font-weight": "font-weight",
  "text-font-family": "font-family",
  "text-color": "color",
  "text-line-height": "line-height",
  "text-letter-spacing": "letter-spacing",
  "text-max-lines": "-webkit-line-clamp",
  "background-color": "background-color",
  "border-width": "border-width",
  "border-color": "border-color",
  "border-radius": "border-radius",
  "padding-top": "padding-top",
  "padding-right": "padding-right",
  "padding-bottom": "padding-bottom",
  "padding-left": "padding-left",
  "margin-top": "margin-top",
  "margin-right": "margin-right",
  "margin-bottom": "margin-bottom",
  "margin-left": "margin-left",
  "min-width": "min-width",
  "min-height": "min-height",
};

const SHADOW_PARTS = ["shadow-offset-x", "shadow-offset-y", "shadow-blur", "shadow-color"] as const;
const SHADOW_DEFAULTS: Record<string, string> = {
  "shadow-offset-x": "0", "shadow-offset-y": "0", "shadow-blur": "0", "shadow-color": "transparent",
};

const BASE_KEYS: Record<string, Set<string>> = {
  heading: new Set(["text", "padding", "margin"]),
  text: new Set(["text", "padding", "margin"]),
  date: new Set(["text", "padding", "margin"]),
  button: new Set(["text", "background", "border", "shadow", "padding", "margin", "minWidth", "minHeight", "states"]),
  image: new Set(["border", "padding", "margin"]),
};

const BUTTON_STATES = ["hover", "active", "disabled"] as const;

const BUTTON_STATE_PROPS: Array<[string, string]> = [
  ["background-color", "background-color"],
  ["color", "text-color"],
];

type JistMode = "auto" | "light" | "dark";

type ThemeValue = string | number | boolean | null | ThemeObject;
interface ThemeObject {
  [key: string]: ThemeValue;
}

class JistTemplateElement extends HTMLElement {
  static observedAttributes = ["template", "data", "theme", "mode"];

  #template: string | null = null;
  #data: JistData | null = null;
  #theme: ThemeObject | null = null;
  #mode: JistMode = "auto";
  #formatDate: JistFormatDate | null = null;
  #onAction: JistOnAction | null = null;
  #templates: Record<string, JistTemplate> = {};
  #mediaQuery: MediaQueryList | null = null;
  #mediaHandler: (() => void) | null = null;
  #variantStyle: HTMLStyleElement | null = null;

  // ── Property API ──────────────────────────

  get template(): string | null {
    return this.#template;
  }
  set template(val: string | null) {
    this.#template = val;
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

  get templates(): Record<string, JistTemplate> {
    return this.#templates;
  }
  set templates(val: Record<string, JistTemplate[]> | string) {
    const raw = typeof val === "string" ? JSON.parse(val) : (val || {});
    const resolved: Record<string, JistTemplate> = {};
    for (const [name, value] of Object.entries(raw)) {
      if (name.startsWith("$")) continue;
      if (!Array.isArray(value)) continue;
      const versions = value;
      const match = versions.find((t: JistTemplate) => t.version === SUPPORTED_VERSION);
      if (match) resolved[name] = match;
    }
    this.#templates = resolved;
    this.#render();
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
    if (this.#variantStyle) {
      this.#variantStyle.remove();
      this.#variantStyle = null;
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
        this.#template = newVal || null;
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
    if (!this.#theme) {
      if (this.#variantStyle) {
        this.#variantStyle.textContent = "";
      }
      return;
    }
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

    // Generate variant CSS rules
    this.#applyVariantCSS();
  }

  #flatten(obj: ThemeObject, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === "modes" || key.startsWith("$")) continue;
      const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      const prop = `${prefix}-${kebab}`;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        this.#flatten(value as ThemeObject, prop);
      } else if (value !== null && value !== undefined && value !== "") {
        // Numeric 0 on reset-capable properties means "back to normal" — set the
        // CSS keyword so the var() chain is broken rather than inheriting the base.
        const cssValue =
          value === 0 && ZERO_MEANS_NORMAL.has(key)
            ? "normal"
            : typeof value === "number" && !UNITLESS_KEYS.has(key)
            ? `${value}px`
            : String(value);
        this.style.setProperty(prop, cssValue);
      }
    }
  }

  // ── Variant CSS Generation ────────────────

  #applyVariantCSS(): void {
    const rules: string[] = [];
    const theme = this.#theme;
    if (!theme) return;

    const dark = (theme.modes as ThemeObject | undefined)?.dark as ThemeObject | undefined;

    for (const type of Object.keys(BASE_KEYS)) {
      const base = theme[type] as ThemeObject | undefined;
      const darkBase = dark?.[type] as ThemeObject | undefined;
      const baseKeys = BASE_KEYS[type];

      const variantNames = new Set<string>();
      for (const src of [base, darkBase]) {
        if (!src) continue;
        for (const key of Object.keys(src)) {
          if (!baseKeys.has(key) && !key.startsWith("$")) variantNames.add(key);
        }
      }

      for (const variant of variantNames) {
        const lightData = (base?.[variant] ?? {}) as ThemeObject;
        const darkData = (darkBase?.[variant] ?? {}) as ThemeObject;
        rules.push(this.#buildVariantRule(type, variant, lightData, darkData));
      }
    }

    if (!this.#variantStyle) {
      this.#variantStyle = document.createElement("style");
      this.#variantStyle.setAttribute("data-jist-variants", "");
      document.head.appendChild(this.#variantStyle);
    }
    this.#variantStyle.textContent = rules.join("\n");
  }

  #buildVariantRule(type: string, variant: string, lightData: ThemeObject, darkData: ThemeObject): string {
    const kebabVariant = variant.replace(/([A-Z])/g, "-$1").toLowerCase();
    const cls = `.jist__${type}--${kebabVariant}`;

    // Collect all leaf paths from the variant's theme data (union of light + dark)
    const paths = new Set<string>();
    const collectPaths = (obj: ThemeObject, prefix: string) => {
      for (const [key, value] of Object.entries(obj)) {
        if (key === "states" || key.startsWith("$")) continue;
        const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        const path = prefix ? `${prefix}-${kebab}` : kebab;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
          collectPaths(value as ThemeObject, path);
        } else {
          paths.add(path);
        }
      }
    };
    collectPaths(lightData, "");
    collectPaths(darkData, "");

    const lines: string[] = [];
    for (const path of paths) {
      const cssProp = PATH_TO_CSS[path];
      if (!cssProp) continue;
      const variantVar = `--jist-${type}-${kebabVariant}-${path}`;
      const baseVar = `--jist-${type}-${path}`;
      lines.push(`  ${cssProp}: var(${variantVar}, var(${baseVar}));`);
    }

    // box-shadow is composite — emit if any shadow sub-property is defined
    if (type === "button" && [...paths].some((p) => p.startsWith("shadow-"))) {
      const shadowParts = SHADOW_PARTS.map((part) => {
        const variantVar = `--jist-button-${kebabVariant}-${part}`;
        const baseVar = `--jist-button-${part}`;
        return `var(${variantVar}, var(${baseVar}, ${SHADOW_DEFAULTS[part]}))`;
      });
      lines.push(`  box-shadow: ${shadowParts.join(" ")};`);
    }

    let css = `${cls} {\n${lines.join("\n")}\n}`;

    // Button state pseudo-classes
    if (type === "button") {
      const hasStates = (lightData.states as ThemeObject | undefined)
        || (darkData.states as ThemeObject | undefined);
      if (hasStates) {
        for (const state of BUTTON_STATES) {
          const lightState = (lightData.states as ThemeObject | undefined)?.[state] as ThemeObject | undefined;
          const darkState = (darkData.states as ThemeObject | undefined)?.[state] as ThemeObject | undefined;
          if (!lightState && !darkState) continue;

          const stateLines: string[] = [];
          for (const [cssProp, suffix] of BUTTON_STATE_PROPS) {
            const vs = `--jist-button-${kebabVariant}-states-${state}-${suffix}`;
            const bs = `--jist-button-states-${state}-${suffix}`;
            const vb = `--jist-button-${kebabVariant}-${suffix}`;
            const bb = `--jist-button-${suffix}`;
            stateLines.push(`  ${cssProp}: var(${vs}, var(${bs}, var(${vb}, var(${bb}))));`);
          }
          const pseudo = state === "disabled" ? ":disabled" : `:${state}`;
          css += `\n${cls}${pseudo} {\n${stateLines.join("\n")}\n}`;
        }
      }
    }

    return css;
  }

  // ── Rendering ─────────────────────────────

  #render(): void {
    if (!this.#template || !this.#data) return;
    if (!this.isConnected) return;

    const tmpl = this.#templates[this.#template];
    if (!tmpl) {
      this.innerHTML = "";
      return;
    }

    const renderer = new JistRenderer({
      formatDate: this.#formatDate || undefined,
      templates: this.#templates,
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
    const dom = renderer.render(tmpl.root, this.#data);
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
