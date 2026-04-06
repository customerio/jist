"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { COMPONENT_DEFS, type ComponentDef } from "@/lib/component-defs";
import { ComponentIcon, GripIcon } from "./Icons";

function DraggableComponent({ def }: { def: ComponentDef }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${def.type}`,
      data: { origin: "palette", componentType: def.type },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border
        bg-surface cursor-grab active:cursor-grabbing select-none
        hover:bg-surface-hover hover:border-primary/30 transition-colors
        ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <GripIcon className="w-4 h-4 text-muted flex-shrink-0" />
      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <ComponentIcon icon={def.icon} className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{def.label}</div>
        <div className="text-xs text-muted truncate">{def.description}</div>
      </div>
    </div>
  );
}

export function ComponentPalette() {
  return (
    <div className="p-3 space-y-4">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider px-1">
        Components
      </h3>
      <div className="space-y-1.5">
        {COMPONENT_DEFS.map((def) => (
          <DraggableComponent key={def.type} def={def} />
        ))}
      </div>
    </div>
  );
}
