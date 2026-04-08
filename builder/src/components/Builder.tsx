"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  pointerWithin,
} from "@dnd-kit/core";
import { useBuilderStore, selectActiveData } from "@/store/builder-store";
import { isDescendant } from "@/lib/template-utils";
import { getComponentDef } from "@/lib/component-defs";
import { ComponentPalette } from "./ComponentPalette";
import { TemplateCanvas } from "./TemplateCanvas";
import { Preview } from "./Preview";
import { CodeView } from "./CodeView";
import { PropertyPanel } from "./PropertyPanel";
import { ThemeEditor } from "./ThemeEditor";
import { DataEditor } from "./DataEditor";
import { ResizeHandle } from "./ResizeHandle";
import {
  SunIcon,
  MoonIcon,
  PlusIcon,
  PenIcon,
  EyeIcon,
  CodeIcon,
  ChevronDownIcon,
  ComponentIcon,
  DownloadIcon,
} from "./Icons";

const LEFT_MIN = 180;
const LEFT_MAX = 400;
const RIGHT_MIN = 240;
const RIGHT_MAX = 520;

/* ── Drag overlay shown while dragging ────────────── */

function DragGhost({ type }: { type: string }) {
  const def = getComponentDef(type);
  if (!def) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border-2 border-primary shadow-xl text-sm font-medium">
      <ComponentIcon icon={def.icon} className="w-4 h-4 text-primary" />
      {def.label}
    </div>
  );
}

/* ── Toolbar ──────────────────────────────────────── */

function Toolbar() {
  const {
    colorMode,
    setColorMode,
    sampleNames,
    loadSample,
    loadAllSamples,
    newTemplate,
    registry,
    dataMap,
    theme,
  } = useBuilderStore();

  const [sampleOpen, setSampleOpen] = useState(false);
  const hasTemplates = Object.keys(registry).length > 0;

  const handleNew = () => {
    const name = prompt("Template name:");
    if (!name?.trim()) return;
    newTemplate(name.trim());
  };

  const handleExport = () => {
    const exported = { templates: registry, data: dataMap, theme };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jist-templates.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <span className="text-base font-bold text-primary">Jist</span>
        <span className="text-xs text-muted">Builder</span>
      </div>

      {/* New template */}
      <button
        onClick={handleNew}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
          border border-border text-foreground hover:bg-surface-hover transition-colors"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        New
      </button>

      {/* Sample loader */}
      <div className="relative">
        <button
          onClick={() => setSampleOpen(!sampleOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
            border border-border text-foreground hover:bg-surface-hover transition-colors"
        >
          Samples
          <ChevronDownIcon className="w-3.5 h-3.5" />
        </button>
        {sampleOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setSampleOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-48 py-1 rounded-lg border border-border bg-background shadow-lg z-20">
              <button
                onClick={() => {
                  loadAllSamples();
                  setSampleOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-surface-hover transition-colors border-b border-border"
              >
                Load All
              </button>
              {sampleNames.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    loadSample(name);
                    setSampleOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors capitalize"
                >
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Export */}
      {hasTemplates && (
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
            border border-border text-foreground hover:bg-surface-hover transition-colors"
          title="Export JSON"
        >
          <DownloadIcon className="w-3.5 h-3.5" />
          Export
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dark mode toggle */}
      <button
        onClick={() => setColorMode(colorMode === "light" ? "dark" : "light")}
        className="p-1.5 rounded-md border border-border text-muted hover:text-foreground
          hover:bg-surface-hover transition-colors ml-2"
        title={`Switch to ${colorMode === "light" ? "dark" : "light"} mode`}
      >
        {colorMode === "light" ? (
          <MoonIcon className="w-4 h-4" />
        ) : (
          <SunIcon className="w-4 h-4" />
        )}
      </button>
    </header>
  );
}

/* ── Template tabs ──────────────────────────────── */

function TemplateTabs() {
  const { registry, activeTemplateName, selectTemplate, addTemplate, removeTemplate } =
    useBuilderStore();

  const names = Object.keys(registry);

  if (names.length === 0) return null;

  const handleAdd = () => {
    const name = prompt("Template name:");
    if (!name?.trim()) return;
    if (registry[name.trim()]) {
      alert("A template with that name already exists.");
      return;
    }
    addTemplate(name.trim());
  };

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 border-b border-border bg-surface overflow-x-auto shrink-0">
      {names.map((name) => (
        <div
          key={name}
          className={`group flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${
            name === activeTemplateName
              ? "bg-primary text-white"
              : "text-muted hover:text-foreground hover:bg-surface-hover"
          }`}
          onClick={() => selectTemplate(name)}
        >
          <span>{name}</span>
          {names.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTemplate(name);
              }}
              className={`ml-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity ${
                name === activeTemplateName
                  ? "hover:bg-white/20"
                  : "hover:bg-surface-hover"
              }`}
              title={`Remove ${name}`}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        onClick={handleAdd}
        className="flex items-center px-1.5 py-1 text-muted hover:text-foreground rounded-md hover:bg-surface-hover transition-colors"
        title="Add template"
      >
        <PlusIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Error toast ─────────────────────────────────── */

function OperationErrorToast() {
  const { operationError, clearOperationError } = useBuilderStore();

  useEffect(() => {
    if (!operationError) return;
    const timer = setTimeout(clearOperationError, 5000);
    return () => clearTimeout(timer);
  }, [operationError, clearOperationError]);

  if (!operationError) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm shadow-lg animate-fade-in">
      <span>{operationError}</span>
      <button
        onClick={clearOperationError}
        className="ml-2 p-0.5 rounded hover:bg-red-500 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── Main builder layout ──────────────────────────── */

export function Builder() {
  const { addNode, moveNode } = useBuilderStore();
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(320);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w + delta)));
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.origin === "palette") {
      setActiveDragType(data.componentType);
    } else if (data?.origin === "canvas") {
      setActiveDragType(data.componentType || "unknown");
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragType(null);
      const { active, over } = event;
      if (!over?.data?.current) return;

      const activeData = active.data.current;
      const { parentPath, index } = over.data.current as {
        parentPath: string;
        index: number;
      };

      try {
        if (activeData?.origin === "palette") {
          addNode(parentPath, index, activeData.componentType);
        } else if (activeData?.origin === "canvas") {
          const fromPath = activeData.nodePath as string;
          // Don't drop into self or descendant
          if (
            fromPath === parentPath ||
            isDescendant(fromPath, parentPath)
          ) {
            return;
          }
          moveNode(fromPath, parentPath, index);
        }
      } catch {
        // Store-level try-catch should handle this, but guard against unexpected errors
      }
    },
    [addNode, moveNode]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragType(null);
  }, []);

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={pointerWithin}
    >
      <div className="h-screen flex flex-col bg-background text-foreground">
        <Toolbar />

        <div className="flex-1 flex overflow-hidden">
          {/* Panel 1: Component Palette */}
          <aside
            className="bg-background overflow-y-auto shrink-0"
            style={{ width: leftWidth }}
          >
            <ComponentPalette />
          </aside>

          <ResizeHandle side="left" onResize={handleLeftResize} />

          {/* Panel 2: Canvas / Preview / Code */}
          <main className="flex-1 min-w-0 bg-surface/50">
            <CenterPanel />
          </main>

          <ResizeHandle side="right" onResize={handleRightResize} />

          {/* Panel 3: Properties / Data / Theme */}
          <aside
            className="bg-background shrink-0"
            style={{ width: rightWidth }}
          >
            <RightPanel />
          </aside>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragType && <DragGhost type={activeDragType} />}
      </DragOverlay>

      <OperationErrorToast />
    </DndContext>
  );
}

const VIEW_TABS: { id: "editor" | "preview" | "code"; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "editor", label: "Editor", Icon: PenIcon },
  { id: "preview", label: "Preview", Icon: EyeIcon },
  { id: "code", label: "Code", Icon: CodeIcon },
];

function CenterPanel() {
  const { viewMode, setViewMode } = useBuilderStore();

  return (
    <div className="h-full flex flex-col">
      {/* View mode tabs */}
      <div className="flex items-center px-3 py-1.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center bg-background rounded-lg border border-border p-0.5">
          {VIEW_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Template tabs */}
      <TemplateTabs />

      {/* Content */}
      <div className="flex-1 min-h-0">
        {viewMode === "editor" && <TemplateCanvas />}
        {viewMode === "preview" && <Preview />}
        {viewMode === "code" && <CodeView />}
      </div>
    </div>
  );
}

const RIGHT_TABS: { id: "template" | "data" | "theme"; label: string }[] = [
  { id: "template", label: "Properties" },
  { id: "data", label: "Data" },
  { id: "theme", label: "Theme" },
];

function RightPanel() {
  const { activeTab, setActiveTab } = useBuilderStore();

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center px-3 py-1.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center bg-background rounded-lg border border-border p-0.5">
          {RIGHT_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "template" && <PropertyPanel />}
        {activeTab === "data" && <DataEditor />}
        {activeTab === "theme" && <ThemeEditor />}
      </div>
    </div>
  );
}
