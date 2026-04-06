"use client";

import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useBuilderStore } from "@/store/builder-store";
import { isContainer } from "@/lib/template-utils";
import { ComponentIcon, TrashIcon, GripIcon } from "./Icons";

/* ── Drop zone between nodes ──────────────────────── */

function DropZone({ parentPath, index }: { parentPath: string; index: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `drop-${parentPath || "root"}-${index}`,
    data: { parentPath, index },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all rounded ${
        isOver
          ? "h-10 my-1 bg-primary/15 border-2 border-dashed border-primary flex items-center justify-center"
          : "h-1.5 my-0.5"
      }`}
    >
      {isOver && (
        <span className="text-xs text-primary font-medium">Drop here</span>
      )}
    </div>
  );
}

/* ── Type badge colors ────────────────────────────── */

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  layout:  { bg: "#dbeafe", text: "#1d4ed8" },
  heading: { bg: "#e9d5ff", text: "#7c3aed" },
  text:    { bg: "#d1fae5", text: "#059669" },
  date:    { bg: "#ffedd5", text: "#c2410c" },
  button:  { bg: "#e0e7ff", text: "#4338ca" },
  image:   { bg: "#fce7f3", text: "#be185d" },
  action:  { bg: "#fef3c7", text: "#b45309" },
};

const TYPE_ICONS: Record<string, string> = {
  layout: "grid",
  heading: "type",
  text: "align-left",
  date: "clock",
  button: "square",
  image: "image",
  action: "pointer",
};

/* ── Single canvas node ───────────────────────────── */

interface CanvasNodeProps {
  node: Record<string, unknown>;
  path: string;
  depth?: number;
}

export function CanvasNode({ node, path, depth = 0 }: CanvasNodeProps) {
  const { selectedNodePath, selectNode, removeNode } = useBuilderStore();
  const isSelected = selectedNodePath === path;
  const container = isContainer(node);
  const children = (node.children as Record<string, unknown>[]) || [];
  const type = node.type as string;

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } =
    useDraggable({
      id: `node-${path || "root"}`,
      data: { origin: "canvas", nodePath: path, componentType: type },
      disabled: !path, // Can't drag root
    });

  const dragStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const dirLabel =
    type === "layout"
      ? (node.direction as string) === "horizontal"
        ? "row"
        : "col"
      : null;

  return (
    <div
      ref={setDragRef}
      style={dragStyle}
      className={`transition-all ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          selectNode(path);
        }}
        className={`group rounded-lg border transition-all ${
          isSelected
            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
            : "border-border hover:border-primary/30 bg-surface"
        }`}
      >
        {/* Node header */}
        <div className="flex items-center gap-2 px-3 py-2">
          {path && (
            <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
              <GripIcon className="w-3.5 h-3.5 text-muted" />
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
            style={{
              backgroundColor: TYPE_COLORS[type]?.bg ?? "#f3f4f6",
              color: TYPE_COLORS[type]?.text ?? "#374151",
            }}
          >
            <ComponentIcon icon={TYPE_ICONS[type] || "square"} className="w-3 h-3" />
            {type}
          </span>
          {dirLabel && (
            <span className="text-[10px] text-foreground/50 font-mono font-medium">{dirLabel}</span>
          )}
          {typeof node.name === "string" && node.name !== type && (
            <span className="text-xs text-foreground/70 font-mono font-medium truncate max-w-[140px]">
              {node.name}
            </span>
          )}
          {typeof node.variant === "string" && (
            <span className="text-[10px] px-1.5 py-0.5 bg-foreground/8 text-foreground/60 rounded font-medium">
              {node.variant}
            </span>
          )}
          {type === "layout" && (
            <span className="text-[10px] text-foreground/40 ml-auto font-medium">
              {children.length} child{children.length !== 1 ? "ren" : ""}
            </span>
          )}
          {path && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeNode(path);
              }}
              className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded
                hover:bg-red-100 hover:text-red-600 text-muted transition-all"
              title="Remove"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Children (for containers) */}
        {container && (
          <div className="px-3 pb-2">
            <div className="pl-3 border-l-2 border-border">
              <DropZone parentPath={path} index={0} />
              {children.map((child, i) => (
                <div key={i}>
                  <CanvasNode
                    node={child}
                    path={path ? `${path}.${i}` : `${i}`}
                    depth={depth + 1}
                  />
                  <DropZone parentPath={path} index={i + 1} />
                </div>
              ))}
              {children.length === 0 && (
                <div className="py-4 text-center text-xs text-muted border border-dashed border-border rounded-lg my-1">
                  Drag components here
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
