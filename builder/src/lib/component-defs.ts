export interface ComponentDef {
  type: string;
  label: string;
  icon: string;
  description: string;
  isContainer: boolean;
  defaultNode: Record<string, unknown>;
}

export const COMPONENT_DEFS: ComponentDef[] = [
  {
    type: "layout",
    label: "Layout",
    icon: "grid",
    description: "Flex container",
    isContainer: true,
    defaultNode: { type: "layout", direction: "vertical", children: [] },
  },
  {
    type: "heading",
    label: "Heading",
    icon: "type",
    description: "Text heading",
    isContainer: false,
    defaultNode: { type: "heading", name: "heading", variant: "h3" },
  },
  {
    type: "text",
    label: "Text",
    icon: "align-left",
    description: "Body text",
    isContainer: false,
    defaultNode: { type: "text", name: "text" },
  },
  {
    type: "date",
    label: "Date",
    icon: "clock",
    description: "Formatted timestamp",
    isContainer: false,
    defaultNode: { type: "date", name: "date" },
  },
  {
    type: "button",
    label: "Button",
    icon: "square",
    description: "Action button",
    isContainer: false,
    defaultNode: { type: "button", name: "button" },
  },
  {
    type: "image",
    label: "Image",
    icon: "image",
    description: "Image from URL",
    isContainer: false,
    defaultNode: { type: "image", name: "image" },
  },
  {
    type: "action",
    label: "Action",
    icon: "pointer",
    description: "Clickable wrapper",
    isContainer: true,
    defaultNode: { type: "action", name: "action", children: [] },
  },
];

export function getComponentDef(type: string): ComponentDef | undefined {
  return COMPONENT_DEFS.find((d) => d.type === type);
}
