"use client";

import { useEffect, useRef, useCallback } from "react";
import { useBuilderStore } from "@/store/builder-store";

export function Preview() {
  const { template, data, theme, colorMode } = useBuilderStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const scriptLoaded = useRef(false);

  const setupElement = useCallback(() => {
    if (!containerRef.current || !template) return;

    // Create or reuse the jist-template element
    if (!elementRef.current) {
      elementRef.current = document.createElement("jist-template");
      elementRef.current.style.display = "block";
      elementRef.current.style.maxWidth = "400px";
      elementRef.current.style.margin = "0 auto";
      elementRef.current.style.padding = "16px";
      elementRef.current.style.borderRadius = "12px";
      elementRef.current.style.border = "1px solid var(--border-clr)";
      elementRef.current.style.background = colorMode === "dark" ? "#1a1a2c" : "#ffffff";
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(elementRef.current);
    }

    // Update properties
    const el = elementRef.current as unknown as {
      template: unknown;
      data: unknown;
      theme: unknown;
      mode: string;
      formatDate: (iso: string) => string;
    };

    el.template = template;
    el.data = data;
    el.theme = theme;
    el.mode = colorMode;
    el.formatDate = (iso: string) => {
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

    elementRef.current.style.background = colorMode === "dark" ? "#1a1a2c" : "#ffffff";
  }, [template, data, theme, colorMode]);

  // Load the jist web component script and CSS
  useEffect(() => {
    if (scriptLoaded.current) {
      setupElement();
      return;
    }

    // Load CSS
    if (!document.querySelector('link[href="/jist/jist.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/jist/jist.css";
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/jist/jist-element.js";
    script.onload = () => {
      scriptLoaded.current = true;
      // Wait a tick for custom element to register
      requestAnimationFrame(() => setupElement());
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove the script on cleanup — the custom element stays registered
    };
  }, [setupElement]);

  // Update when data changes
  useEffect(() => {
    if (scriptLoaded.current) {
      setupElement();
    }
  }, [setupElement]);

  if (!template) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        No template to preview
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-4 text-xs text-muted text-center">
          Live preview with sample data
        </div>
        <div ref={containerRef} />
      </div>
    </div>
  );
}
