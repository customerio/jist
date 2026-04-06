"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useBuilderStore } from "@/store/builder-store";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted text-sm">
      Loading editor...
    </div>
  ),
});

export function ThemeEditor() {
  const { theme, colorMode, setThemeFromJson, themeErrors } = useBuilderStore();
  const [localValue, setLocalValue] = useState(() => JSON.stringify(theme, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) {
      editingRef.current = false;
      return;
    }
    setLocalValue(JSON.stringify(theme, null, 2));
    setParseError(null);
  }, [theme]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      const v = value || "";
      setLocalValue(v);

      if (!v.trim()) {
        setParseError(null);
        return;
      }

      try {
        JSON.parse(v);
        setParseError(null);
        editingRef.current = true;
        setThemeFromJson(v);
      } catch (e) {
        setParseError((e as Error).message);
      }
    },
    [setThemeFromJson]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Theme
        </h3>
        <div className="flex items-center gap-2">
          {parseError && (
            <span className="text-xs text-red-500">JSON Error</span>
          )}
          {!parseError && themeErrors.length > 0 && (
            <span className="text-xs text-amber-500">
              {themeErrors.length} issue{themeErrors.length > 1 ? "s" : ""}
            </span>
          )}
          {!parseError && themeErrors.length === 0 && (
            <span className="text-xs text-green-500">Valid</span>
          )}
        </div>
      </div>

      {/* Validation errors */}
      {themeErrors.length > 0 && !parseError && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 max-h-24 overflow-auto">
          {themeErrors.map((err, i) => (
            <div key={i} className="text-xs text-amber-700 font-mono">
              {err.instancePath || "/"}: {err.message}
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language="json"
          value={localValue}
          onChange={handleChange}
          theme={colorMode === "dark" ? "vs-dark" : "light"}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            automaticLayout: true,
            formatOnPaste: true,
          }}
        />
      </div>
    </div>
  );
}
