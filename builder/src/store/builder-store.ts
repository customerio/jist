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

// Strip $schema keys from imported JSON
const { $schema: _ts, ...sampleTemplates } = sampleTemplatesRaw as Record<string, unknown>;
const sampleData = sampleDataRaw as Record<string, unknown>;
const { $schema: _ths, ...sampleTheme } = sampleThemeRaw as Record<string, unknown>;

type ViewMode = "editor" | "preview" | "code";
type ColorMode = "light" | "dark";
type ActiveTab = "template" | "data" | "theme";

interface TemplateRoot {
  version: string;
  root: Record<string, unknown>;
}

interface BuilderState {
  // Template data
  template: TemplateRoot | null;
  data: Record<string, unknown>;
  theme: Record<string, unknown>;

  // Samples
  sampleNames: string[];

  // UI state
  selectedNodePath: string | null;
  viewMode: ViewMode;
  colorMode: ColorMode;
  activeTab: ActiveTab;
  templateErrors: ErrorObject[];
  themeErrors: ErrorObject[];
  operationError: string | null;

  // Actions
  loadSample: (name: string) => void;
  newTemplate: () => void;
  setTemplate: (template: TemplateRoot) => void;
  setTemplateFromJson: (json: string) => boolean;
  setData: (data: Record<string, unknown>) => void;
  setDataFromJson: (json: string) => boolean;
  setTheme: (theme: Record<string, unknown>) => void;
  setThemeFromJson: (json: string) => boolean;
  selectNode: (path: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setColorMode: (mode: ColorMode) => void;
  setActiveTab: (tab: ActiveTab) => void;
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

export const useBuilderStore = create<BuilderState>((set, get) => ({
  template: null,
  data: {},
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
    const tmpl = (sampleTemplates as Record<string, unknown>)[name] as TemplateRoot | undefined;
    const d = (sampleData as Record<string, unknown>)[name] as Record<string, unknown> | undefined;
    if (tmpl) {
      const result = validateTemplateJson(tmpl);
      set({
        template: structuredClone(tmpl),
        data: d ? structuredClone(d) : {},
        selectedNodePath: null,
        templateErrors: result.errors,
        viewMode: "editor",
        activeTab: "template",
      });
    }
  },

  newTemplate: () => {
    set({
      template: structuredClone(EMPTY_TEMPLATE),
      data: {},
      selectedNodePath: null,
      templateErrors: [],
      viewMode: "editor",
      activeTab: "template",
    });
  },

  setTemplate: (template: TemplateRoot) => {
    const result = validateTemplateJson(template);
    set({ template, templateErrors: result.errors });
  },

  setTemplateFromJson: (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const result = validateTemplateJson(parsed);
      set({ template: parsed, templateErrors: result.errors });
      return true;
    } catch {
      return false;
    }
  },

  setData: (data: Record<string, unknown>) => {
    set({ data });
  },

  setDataFromJson: (json: string) => {
    try {
      set({ data: JSON.parse(json) });
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
    const { template } = get();
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
      set({ template: newTemplate, templateErrors: result.errors, operationError: null });
    } catch (e) {
      set({ operationError: `Could not add component: ${(e as Error).message}` });
    }
  },

  updateNode: (path: string, updates: Record<string, unknown>) => {
    const { template } = get();
    if (!template) return;
    const newRoot = updateNodeByPath(
      template.root as Record<string, unknown> & { children?: Record<string, unknown>[] },
      path,
      updates
    );
    const newTemplate = { ...template, root: newRoot };
    const result = validateTemplateJson(newTemplate);
    set({ template: newTemplate, templateErrors: result.errors });
  },

  removeNode: (path: string) => {
    const { template, selectedNodePath } = get();
    if (!template || !path) return;
    try {
      const newRoot = removeNodeByPath(
        template.root as Record<string, unknown> & { children?: Record<string, unknown>[] },
        path
      );
      const newTemplate = { ...template, root: newRoot };
      const result = validateTemplateJson(newTemplate);
      set({
        template: newTemplate,
        templateErrors: result.errors,
        selectedNodePath: selectedNodePath === path ? null : selectedNodePath,
        operationError: null,
      });
    } catch (e) {
      set({ operationError: `Could not remove component: ${(e as Error).message}` });
    }
  },

  moveNode: (fromPath: string, toParentPath: string, toIndex: number) => {
    const { template } = get();
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
      set({ template: newTemplate, templateErrors: result.errors, operationError: null });
    } catch (e) {
      set({ operationError: `Could not move component: ${(e as Error).message}` });
    }
  },

  clearOperationError: () => {
    set({ operationError: null });
  },
}));
