"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useBuilderStore, selectActiveData } from "@/store/builder-store";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-muted text-sm">
      Loading editor...
    </div>
  ),
});

export function DataEditor() {
  const { activeTemplateName, colorMode, setDataFromJson } = useBuilderStore();
  const data = useBuilderStore(selectActiveData);
  const [localValue, setLocalValue] = useState(() => JSON.stringify(data, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  const editingRef = useRef(false);

  // Sync store → local only when the change came from outside (e.g. loading a sample)
  useEffect(() => {
    if (editingRef.current) {
      editingRef.current = false;
      return;
    }
    setLocalValue(JSON.stringify(data, null, 2));
    setParseError(null);
  }, [data]);

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
        setDataFromJson(v);
      } catch (e) {
        setParseError((e as Error).message);
      }
    },
    [setDataFromJson]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Data{activeTemplateName ? ` — ${activeTemplateName}` : ""}
        </h3>
        <div className="flex items-center gap-2">
          {parseError ? (
            <span className="text-xs text-red-500">JSON Error</span>
          ) : (
            <span className="text-xs text-green-500">Valid</span>
          )}
        </div>
      </div>

      {/* Help text */}
      <div className="px-3 py-2 bg-surface border-b border-border">
        <p className="text-xs text-muted">
          Sample data used to populate the template. Each key maps to a
          component&apos;s <code className="text-foreground/70">name</code> property.
        </p>
      </div>

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
