"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function CodeView() {
  const { registry, colorMode, setRegistryFromJson, templateErrors } =
    useBuilderStore();

  const [localValue, setLocalValue] = useState(() =>
    JSON.stringify(registry, null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) {
      editingRef.current = false;
      return;
    }
    setLocalValue(JSON.stringify(registry, null, 2));
    setParseError(null);
  }, [registry]);

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
        setRegistryFromJson(v);
      } catch (e) {
        setParseError((e as Error).message);
      }
    },
    [setRegistryFromJson]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Status bar */}
      <div className="flex items-center px-3 py-1.5 border-b border-border bg-surface">
        <span className="text-xs text-muted font-medium">Template Registry JSON</span>
        <div className="ml-auto flex items-center gap-2">
          {parseError && <span className="text-xs text-red-500">JSON Error</span>}
          {!parseError && templateErrors.length > 0 && (
            <span className="text-xs text-amber-500">
              {templateErrors.length} validation issue
              {templateErrors.length > 1 ? "s" : ""}
            </span>
          )}
          {!parseError && templateErrors.length === 0 && (
            <span className="text-xs text-green-500">Valid</span>
          )}
        </div>
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
            fontSize: 13,
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
