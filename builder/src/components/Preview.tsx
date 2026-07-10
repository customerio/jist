"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useBuilderStore, selectActiveData } from "@/store/builder-store";
import { RefreshIcon, TrashIcon, TypeIcon } from "./Icons";

const FONTS_STORAGE_KEY = "jist-builder-fonts";

interface CustomFont {
  name: string;
  url: string;
}

function loadFontsFromStorage(): CustomFont[] {
  try {
    const stored = localStorage.getItem(FONTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFontsToStorage(fonts: CustomFont[]) {
  localStorage.setItem(FONTS_STORAGE_KEY, JSON.stringify(fonts));
}

export function Preview() {
  const { registry, activeTemplateName, theme, colorMode } = useBuilderStore();
  const data = useBuilderStore(selectActiveData);
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  const [fontsOpen, setFontsOpen] = useState(false);
  const [fontName, setFontName] = useState("");
  const [fontUrl, setFontUrl] = useState("");
  const fontsInitialized = useRef(false);

  useEffect(() => {
    setFonts(loadFontsFromStorage());
    fontsInitialized.current = true;
  }, []);

  useEffect(() => {
    if (!fontsInitialized.current) return;
    saveFontsToStorage(fonts);
  }, [fonts]);

  useEffect(() => {
    document.querySelectorAll("link[data-jist-font]").forEach((el) => el.remove());

    fonts.forEach((font) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = font.url;
      link.setAttribute("data-jist-font", font.name);
      document.head.appendChild(link);
    });

    return () => {
      document.querySelectorAll("link[data-jist-font]").forEach((el) => el.remove());
    };
  }, [fonts]);

  const addFont = () => {
    if (!fontName.trim() || !fontUrl.trim()) return;
    const trimmedName = fontName.trim();
    const trimmedUrl = fontUrl.trim();
    setFonts((prev) => {
      if (prev.some((f) => f.url === trimmedUrl)) return prev;
      return [...prev, { name: trimmedName, url: trimmedUrl }];
    });
    setFontName("");
    setFontUrl("");
  };

  const removeFont = (index: number) => {
    setFonts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUrlChange = (url: string) => {
    setFontUrl(url);
    if (!fontName.trim()) {
      const match = url.match(/family=([^:&|]+)/);
      if (match) {
        setFontName(decodeURIComponent(match[1].replace(/\+/g, " ")));
      }
    }
  };

  const setupElement = useCallback(() => {
    if (!containerRef.current || !activeTemplateName) return;

    if (elementRef.current && !containerRef.current.contains(elementRef.current)) {
      elementRef.current = null;
    }

    if (!elementRef.current) {
      elementRef.current = document.createElement("jist-template");
      elementRef.current.style.display = "block";
      elementRef.current.style.maxWidth = "400px";
      elementRef.current.style.margin = "0 auto";
      elementRef.current.style.padding = "16px";
      elementRef.current.style.borderRadius = "12px";
      elementRef.current.style.border = "1px solid var(--border-clr)";
      elementRef.current.style.background =
        colorMode === "dark" ? "#1a1a2c" : "#ffffff";
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(elementRef.current);
    }

    const el = elementRef.current as unknown as {
      templates: Record<string, unknown[]>;
      template: string;
      data: unknown;
      theme: unknown;
      mode: string;
      formatDate: (iso: string, name: string) => string;
    };

    el.templates = registry;
    el.template = activeTemplateName;
    el.data = data;
    el.theme = theme;
    el.mode = colorMode;
    el.formatDate = (iso: string, _name: string) => {
      try {
        return new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return iso;
      }
    };

    elementRef.current.style.background =
      colorMode === "dark" ? "#1a1a2c" : "#ffffff";
  }, [registry, activeTemplateName, data, theme, colorMode]);

  const handleRefresh = () => {
    if (elementRef.current) {
      elementRef.current.remove();
      elementRef.current = null;
    }
    requestAnimationFrame(() => setupElement());
  };

  useEffect(() => {
    if (!document.querySelector('link[href="/jist/jist.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/jist/jist.css";
      document.head.appendChild(link);
    }

    // The element module has no import side effects — an inline module
    // script imports it and calls register() (a no-op if already defined).
    if (
      !customElements.get("jist-template") &&
      !document.querySelector("script[data-jist-element]")
    ) {
      const script = document.createElement("script");
      script.type = "module";
      script.setAttribute("data-jist-element", "");
      script.textContent = 'import { register } from "/jist/jist-element.js"; register();';
      document.head.appendChild(script);
    }

    customElements.whenDefined("jist-template").then(() => {
      requestAnimationFrame(() => setupElement());
    });
  }, [setupElement]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface shrink-0">
        <span className="text-xs font-medium text-muted">Preview</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFontsOpen(!fontsOpen)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
              fontsOpen
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
            title="Custom fonts"
          >
            <TypeIcon className="w-3.5 h-3.5" />
            {fonts.length > 0 && (
              <span
                className={`text-[10px] leading-none px-1 py-px rounded-full ${
                  fontsOpen
                    ? "bg-white/20"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {fonts.length}
              </span>
            )}
          </button>
          <button
            onClick={handleRefresh}
            className="p-1 text-muted hover:text-foreground rounded-md hover:bg-surface-hover transition-colors"
            title="Refresh preview"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Font management panel */}
      {fontsOpen && (
        <div className="border-b border-border bg-surface/50 px-3 py-2 space-y-2 shrink-0">
          {fonts.length > 0 && (
            <div className="space-y-1">
              {fonts.map((font, i) => (
                <div
                  key={font.url}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-background border border-border"
                >
                  <span className="text-xs font-medium text-foreground truncate">
                    {font.name}
                  </span>
                  <button
                    onClick={() => removeFont(i)}
                    className="shrink-0 p-0.5 text-muted hover:text-red-500 rounded transition-colors"
                    title={`Remove ${font.name}`}
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <input
              type="text"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              placeholder="Font name (e.g. Roboto)"
              className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary"
            />
            <div className="flex gap-1">
              <input
                type="text"
                value={fontUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="CSS URL (e.g. Google Fonts link)"
                className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFont();
                  }
                }}
              />
              <button
                onClick={addFont}
                disabled={!fontName.trim() || !fontUrl.trim()}
                className="shrink-0 px-2 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {fonts.length === 0 && (
            <p className="text-[10px] text-muted">
              Load custom fonts for the preview. Paste a Google Fonts URL and
              the name auto-fills.
            </p>
          )}
        </div>
      )}

      {/* Preview content */}
      {!activeTemplateName ? (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          No template to preview
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3">
          <div ref={containerRef} />
        </div>
      )}
    </div>
  );
}
