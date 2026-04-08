import { create } from "zustand";
import sampleTemplatesRaw from "@/lib/shared/templates.json";
import sampleDataRaw from "@/lib/shared/data.json";
import sampleThemeRaw from "@/lib/shared/theme.json";
import { getComponentDef } from "@/lib/component-defs";
import {
  insertNode,
  removeNodeByPath,
  updateNodeByPath,
  moveNode as moveNodeUtil,
} from "@/lib/template-utils";
import { validateTemplateJson, validateThemeJson } from "@/lib/validator";
import type { ErrorObject } from "ajv";

// Strip $schema keys and extract first version from each template array
const { $schema: _ts, ...sampleRegistry } = sampleTemplatesRaw as Record<string, unknown>;
const sampleTemplates: Record<string, TemplateRoot> = {};
for (const [key, value] of Object.entries(sampleRegistry)) {
  if (Array.isArray(value) && value.length > 0) {
    sampleTemplates[key] = value[0] as TemplateRoot;
  }
}
const sampleData = sampleDataRaw as Record<string, Record<string, unknown>>;
const { $schema: _ths, ...sampleTheme } = sampleThemeRaw as Record<string, unknown>;

type ViewMode = "editor" | "preview" | "code";
type ColorMode = "light" | "dark";
type ActiveTab = "template" | "data" | "theme";

interface TemplateRoot {
  version: string;
  root: Record<string, unknown>;
}

interface BuilderState {
  // Template registry: name → [versioned templates]
  registry: Record<string, TemplateRoot[]>;
  activeTemplateName: string | null;

  // Data per template name
  dataMap: Record<string, Record<string, unknown>>;

  // Shared theme
  theme: Record<string, unknown>;

  // Sample names for the dropdown
  sampleNames: string[];

  // UI state
  selectedNodePath: string | null;
  viewMode: ViewMode;
  colorMode: ColorMode;
  activeTab: ActiveTab;
  templateErrors: ErrorObject[];
  themeErrors: ErrorObject[];
  operationError: string | null;

  // Registry actions
  loadSample: (name: string) => void;
  loadAllSamples: () => void;
  newTemplate: (name: string) => void;
  addTemplate: (name: string) => void;
  removeTemplate: (name: string) => void;
  selectTemplate: (name: string) => void;

  // Template mutation (operates on active template)
  setTemplate: (template: TemplateRoot) => void;
  setRegistryFromJson: (json: string) => boolean;

  // Data
  setData: (data: Record<string, unknown>) => void;
  setDataFromJson: (json: string) => boolean;

  // Theme
  setTheme: (theme: Record<string, unknown>) => void;
  setThemeFromJson: (json: string) => boolean;

  // UI actions
  selectNode: (path: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setColorMode: (mode: ColorMode) => void;
  setActiveTab: (tab: ActiveTab) => void;

  // Node operations (on active template)
  addNode: (parentPath: string, index: number, componentType: string) => void;
  updateNode: (path: string, updates: Record<string, unknown>) => void;
  removeNode: (path: string) => void;
  moveNode: (fromPath: string, toParentPath: string, toIndex: number) => void;
  clearOperationError: () => void;
}

const EMPTY_TEMPLATE: TemplateRoot = {
  version: "1",
  root: {
    type: "layout",
    direction: "vertical",
    gap: 8,
    children: [],
  },
};

// ── Selectors ──────────────────────────────────

export const selectActiveTemplate = (s: BuilderState): TemplateRoot | null => {
  if (!s.activeTemplateName) return null;
  return s.registry[s.activeTemplateName]?.[0] ?? null;
};

export const selectActiveData = (s: BuilderState): Record<string, unknown> => {
  if (!s.activeTemplateName) return {};
  return s.dataMap[s.activeTemplateName] ?? {};
};

// ── Helpers ────────────────────────────────────

function validateActive(registry: Record<string, TemplateRoot[]>, name: string | null): ErrorObject[] {
  if (!name) return [];
  const tmpl = registry[name]?.[0];
  return tmpl ? validateTemplateJson(tmpl).errors : [];
}

function updateActiveTemplate(
  registry: Record<string, TemplateRoot[]>,
  name: string,
  template: TemplateRoot
): Record<string, TemplateRoot[]> {
  return { ...registry, [name]: [template] };
}

// ── Store ──────────────────────────────────────

export const useBuilderStore = create<BuilderState>((set, get) => ({
  registry: {},
  activeTemplateName: null,
  dataMap: {},
  theme: sampleTheme as Record<string, unknown>,
  sampleNames: Object.keys(sampleTemplates),
  selectedNodePath: null,
  viewMode: "editor",
  colorMode: "light",
  activeTab: "template",
  templateErrors: [],
  themeErrors: [],
  operationError: null,

  loadSample: (name: string) => {
    const tmpl = sampleTemplates[name];
    if (!tmpl) return;
    const d = sampleData[name];

    const { registry, dataMap } = get();
    const newRegistry = { ...registry, [name]: [structuredClone(tmpl)] };
    const newDataMap = { ...dataMap, [name]: d ? structuredClone(d) : {} };

    set({
      registry: newRegistry,
      dataMap: newDataMap,
      activeTemplateName: name,
      selectedNodePath: null,
      templateErrors: validateTemplateJson(tmpl).errors,
      viewMode: "editor",
      activeTab: "template",
    });
  },

  loadAllSamples: () => {
    const newRegistry: Record<string, TemplateRoot[]> = {};
    const newDataMap: Record<string, Record<string, unknown>> = {};

    for (const [key, tmpl] of Object.entries(sampleTemplates)) {
      newRegistry[key] = [structuredClone(tmpl)];
      const d = sampleData[key];
      newDataMap[key] = d ? structuredClone(d) : {};
    }

    const firstName = Object.keys(newRegistry)[0] || null;

    set({
      registry: newRegistry,
      dataMap: newDataMap,
      activeTemplateName: firstName,
      selectedNodePath: null,
      templateErrors: validateActive(newRegistry, firstName),
      viewMode: "editor",
      activeTab: "template",
    });
  },

  newTemplate: (name: string) => {
    set({
      registry: { [name]: [structuredClone(EMPTY_TEMPLATE)] },
      dataMap: { [name]: {} },
      activeTemplateName: name,
      selectedNodePath: null,
      templateErrors: [],
      viewMode: "editor",
      activeTab: "template",
    });
  },

  addTemplate: (name: string) => {
    const { registry, dataMap } = get();
    if (registry[name]) return;

    set({
      registry: { ...registry, [name]: [structuredClone(EMPTY_TEMPLATE)] },
      dataMap: { ...dataMap, [name]: {} },
      activeTemplateName: name,
      selectedNodePath: null,
      templateErrors: [],
    });
  },

  removeTemplate: (name: string) => {
    const { registry, dataMap, activeTemplateName } = get();
    const { [name]: _, ...rest } = registry;
    const { [name]: __, ...restData } = dataMap;

    const names = Object.keys(rest);
    const newActive = name === activeTemplateName ? (names[0] || null) : activeTemplateName;

    set({
      registry: rest,
      dataMap: restData,
      activeTemplateName: newActive,
      selectedNodePath: null,
      templateErrors: validateActive(rest, newActive),
    });
  },

  selectTemplate: (name: string) => {
    const { registry } = get();
    if (!registry[name]) return;

    set({
      activeTemplateName: name,
      selectedNodePath: null,
      templateErrors: validateActive(registry, name),
    });
  },

  setTemplate: (template: TemplateRoot) => {
    const { activeTemplateName, registry } = get();
    if (!activeTemplateName) return;

    const result = validateTemplateJson(template);
    set({
      registry: updateActiveTemplate(registry, activeTemplateName, template),
      templateErrors: result.errors,
    });
  },

  setRegistryFromJson: (json: string) => {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const newRegistry: Record<string, TemplateRoot[]> = {};
      for (const [name, value] of Object.entries(parsed)) {
        if (name.startsWith("$")) continue;
        if (!Array.isArray(value)) continue;
        newRegistry[name] = value as TemplateRoot[];
      }

      const { activeTemplateName } = get();
      const newActive = activeTemplateName && newRegistry[activeTemplateName]
        ? activeTemplateName
        : Object.keys(newRegistry)[0] || null;

      set({
        registry: newRegistry,
        activeTemplateName: newActive,
        selectedNodePath: null,
        templateErrors: validateActive(newRegistry, newActive),
      });
      return true;
    } catch {
      return false;
    }
  },

  setData: (data: Record<string, unknown>) => {
    const { activeTemplateName, dataMap } = get();
    if (!activeTemplateName) return;
    set({ dataMap: { ...dataMap, [activeTemplateName]: data } });
  },

  setDataFromJson: (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const { activeTemplateName, dataMap } = get();
      if (!activeTemplateName) return false;
      set({ dataMap: { ...dataMap, [activeTemplateName]: parsed } });
      return true;
    } catch {
      return false;
    }
  },

  setTheme: (theme: Record<string, unknown>) => {
    const result = validateThemeJson(theme);
    set({ theme, themeErrors: result.errors });
  },

  setThemeFromJson: (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const result = validateThemeJson(parsed);
      set({ theme: parsed, themeErrors: result.errors });
      return true;
    } catch {
      return false;
    }
  },

  selectNode: (path: string | null) => {
    set({ selectedNodePath: path });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  setColorMode: (mode: ColorMode) => {
    set({ colorMode: mode });
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", mode);
    }
  },

  setActiveTab: (tab: ActiveTab) => {
    set({ activeTab: tab });
  },

  addNode: (parentPath: string, index: number, componentType: string) => {
    const { activeTemplateName, registry } = get();
    if (!activeTemplateName) return;
    const template = registry[activeTemplateName]?.[0];
    if (!template) return;
    const def = getComponentDef(componentType);
    if (!def) return;
    try {
      const newNode = structuredClone(def.defaultNode);
      const newRoot = insertNode(
        template.root as Record<string, unknown> & { children?: Record<string, unknown>[] },
        parentPath,
        index,
        newNode as Record<string, unknown> & { children?: Record<string, unknown>[] }
      );
      const newTemplate = { ...template, root: newRoot };
      const result = validateTemplateJson(newTemplate);
      set({
        registry: updateActiveTemplate(registry, activeTemplateName, newTemplate),
        templateErrors: result.errors,
        operationError: null,
      });
    } catch (e) {
      set({ operationError: `Could not add component: ${(e as Error).message}` });
    }
  },

  updateNode: (path: string, updates: Record<string, unknown>) => {
    const { activeTemplateName, registry } = get();
    if (!activeTemplateName) return;
    const template = registry[activeTemplateName]?.[0];
    if (!template) return;
    const newRoot = updateNodeByPath(
      template.root as Record<string, unknown> & { children?: Record<string, unknown>[] },
      path,
      updates
    );
    const newTemplate = { ...template, root: newRoot };
    const result = validateTemplateJson(newTemplate);
    set({
      registry: updateActiveTemplate(registry, activeTemplateName, newTemplate),
      templateErrors: result.errors,
    });
  },

  removeNode: (path: string) => {
    const { activeTemplateName, registry, selectedNodePath } = get();
    if (!activeTemplateName || !path) return;
    const template = registry[activeTemplateName]?.[0];
    if (!template) return;
    try {
      const newRoot = removeNodeByPath(
        template.root as Record<string, unknown> & { children?: Record<string, unknown>[] },
        path
      );
      const newTemplate = { ...template, root: newRoot };
      const result = validateTemplateJson(newTemplate);
      set({
        registry: updateActiveTemplate(registry, activeTemplateName, newTemplate),
        templateErrors: result.errors,
        selectedNodePath: selectedNodePath === path ? null : selectedNodePath,
        operationError: null,
      });
    } catch (e) {
      set({ operationError: `Could not remove component: ${(e as Error).message}` });
    }
  },

  moveNode: (fromPath: string, toParentPath: string, toIndex: number) => {
    const { activeTemplateName, registry } = get();
    if (!activeTemplateName) return;
    const template = registry[activeTemplateName]?.[0];
    if (!template) return;
    try {
      const newRoot = moveNodeUtil(
        template.root as Record<string, unknown> & { children?: Record<string, unknown>[] },
        fromPath,
        toParentPath,
        toIndex
      );
      const newTemplate = { ...template, root: newRoot };
      const result = validateTemplateJson(newTemplate);
      set({
        registry: updateActiveTemplate(registry, activeTemplateName, newTemplate),
        templateErrors: result.errors,
        operationError: null,
      });
    } catch (e) {
      set({ operationError: `Could not move component: ${(e as Error).message}` });
    }
  },

  clearOperationError: () => {
    set({ operationError: null });
  },
}));
