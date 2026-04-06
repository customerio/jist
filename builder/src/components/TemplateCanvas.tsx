"use client";

import { useBuilderStore } from "@/store/builder-store";
import { CanvasNode } from "./CanvasNode";
import { PlusIcon } from "./Icons";

export function TemplateCanvas() {
  const { template, newTemplate, templateErrors } = useBuilderStore();

  if (!template) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">No template loaded</p>
          <p className="text-sm">Start from scratch or load a sample from the toolbar</p>
        </div>
        <button
          onClick={newTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white
            hover:bg-primary-hover transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          New Template
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="max-w-2xl mx-auto space-y-3">
        <CanvasNode node={template.root as Record<string, unknown>} path="" />

        {templateErrors.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
            <div className="font-medium text-red-800 mb-1">Validation Errors</div>
            {templateErrors.map((err, i) => (
              <div key={i} className="text-red-600 text-xs font-mono">
                {err.instancePath || "/"}: {err.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
