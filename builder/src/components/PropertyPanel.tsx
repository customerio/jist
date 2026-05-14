"use client";

import { useBuilderStore, selectActiveTemplate } from "@/store/builder-store";
import { getNodeByPath } from "@/lib/template-utils";

/* ── Reusable form controls ──────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-colors";
const selectClass = inputClass + " appearance-none";

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={inputClass}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
        min={min}
        placeholder={placeholder}
      />
    </Field>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SpacingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, number> | undefined;
  onChange: (v: Record<string, number> | undefined) => void;
}) {
  const v = value || {};
  const set = (side: string, num: number | undefined) => {
    const next = { ...v };
    if (num === undefined) {
      delete next[side];
    } else {
      next[side] = num;
    }
    onChange(Object.keys(next).length ? next : undefined);
  };

  return (
    <Field label={label}>
      <div className="grid grid-cols-4 gap-1">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div key={side}>
            <input
              type="number"
              className={inputClass + " text-center !px-1"}
              value={v[side] ?? ""}
              onChange={(e) =>
                set(side, e.target.value === "" ? undefined : Number(e.target.value))
              }
              placeholder={side[0].toUpperCase()}
              title={side}
            />
          </div>
        ))}
      </div>
    </Field>
  );
}

function JsonInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, unknown> | undefined;
  onChange: (v: Record<string, unknown> | undefined) => void;
}) {
  const str = value ? JSON.stringify(value, null, 2) : "";
  return (
    <Field label={label}>
      <textarea
        className={inputClass + " font-mono text-xs h-20 resize-y"}
        value={str}
        onChange={(e) => {
          const text = e.target.value;
          if (!text.trim()) {
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(text));
          } catch {
            // Let user keep typing
          }
        }}
        placeholder="{}"
      />
    </Field>
  );
}

/* ── Per-type property editors ───────────────────── */

function LayoutProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <>
      <SelectInput
        label="Direction"
        value={(node.direction as string) || "vertical"}
        onChange={(v) => onUpdate({ direction: v })}
        options={[
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ]}
      />
      <NumberInput
        label="Gap"
        value={node.gap as number | undefined}
        onChange={(v) => onUpdate({ gap: v })}
        min={0}
        placeholder="0"
      />
      <SelectInput
        label="Align"
        value={(node.align as string) || ""}
        onChange={(v) => onUpdate(v ? { align: v } : { align: undefined })}
        options={[
          { value: "", label: "Default" },
          { value: "stretch", label: "Stretch" },
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
          { value: "center", label: "Center" },
          { value: "baseline", label: "Baseline" },
        ]}
      />
      <SelectInput
        label="Justify"
        value={(node.justify as string) || ""}
        onChange={(v) => onUpdate(v ? { justify: v } : { justify: undefined })}
        options={[
          { value: "", label: "Default" },
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
          { value: "center", label: "Center" },
          { value: "space-between", label: "Space Between" },
          { value: "space-around", label: "Space Around" },
          { value: "space-evenly", label: "Space Evenly" },
        ]}
      />
      <SpacingInput
        label="Margin (T R B L)"
        value={node.margin as Record<string, number> | undefined}
        onChange={(v) => onUpdate({ margin: v })}
      />
    </>
  );
}

function HeadingProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <>
      <TextInput
        label="Name (data key)"
        value={(node.name as string) ?? ""}
        onChange={(v) => onUpdate({ name: v })}
        placeholder="heading"
      />
      <SelectInput
        label="Variant"
        value={(node.variant as string) || "h3"}
        onChange={(v) => onUpdate({ variant: v || undefined })}
        options={[
          { value: "h2", label: "H2" },
          { value: "h3", label: "H3" },
          { value: "h4", label: "H4" },
        ]}
      />
    </>
  );
}

function TextProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <>
      <TextInput
        label="Name (data key)"
        value={(node.name as string) ?? ""}
        onChange={(v) => onUpdate({ name: v })}
        placeholder="text"
      />
      <TextInput
        label="Variant"
        value={(node.variant as string) ?? ""}
        onChange={(v) => onUpdate({ variant: v || undefined })}
        placeholder="e.g. caption"
      />
    </>
  );
}

function DateProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <>
      <TextInput
        label="Name (data key)"
        value={(node.name as string) ?? ""}
        onChange={(v) => onUpdate({ name: v })}
        placeholder="date"
      />
      <TextInput
        label="Variant"
        value={(node.variant as string) ?? ""}
        onChange={(v) => onUpdate({ variant: v || undefined })}
        placeholder="optional"
      />
    </>
  );
}

function ButtonProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <>
      <TextInput
        label="Name (data key)"
        value={(node.name as string) ?? ""}
        onChange={(v) => onUpdate({ name: v })}
        placeholder="button"
      />
      <TextInput
        label="Variant"
        value={(node.variant as string) ?? ""}
        onChange={(v) => onUpdate({ variant: v || undefined })}
        placeholder="e.g. secondary"
      />
      <JsonInput
        label="Meta"
        value={node.meta as Record<string, unknown> | undefined}
        onChange={(v) => onUpdate({ meta: v })}
      />
    </>
  );
}

function ImageProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  const widthIsFill = node.width === "fill";
  return (
    <>
      <TextInput
        label="Name (data key)"
        value={(node.name as string) || ""}
        onChange={(v) => onUpdate({ name: v })}
        placeholder="image"
      />
      <TextInput
        label="Variant"
        value={(node.variant as string) || ""}
        onChange={(v) => onUpdate({ variant: v || undefined })}
        placeholder="optional"
      />
      <Field label="Width">
        <div className="flex gap-2">
          <select
            className={selectClass + " w-24"}
            value={widthIsFill ? "fill" : "fixed"}
            onChange={(e) =>
              onUpdate({
                width: e.target.value === "fill" ? "fill" : undefined,
              })
            }
          >
            <option value="fixed">Fixed</option>
            <option value="fill">Fill</option>
          </select>
          {!widthIsFill && (
            <input
              type="number"
              className={inputClass}
              value={(node.width as number) ?? ""}
              onChange={(e) =>
                onUpdate({
                  width:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              min={0}
              placeholder="auto"
            />
          )}
        </div>
      </Field>
      <NumberInput
        label="Height"
        value={node.height as number | undefined}
        onChange={(v) => onUpdate({ height: v })}
        min={0}
        placeholder="auto"
      />
      <SelectInput
        label="Object Fit"
        value={(node.objectFit as string) || "contain"}
        onChange={(v) => onUpdate({ objectFit: v || undefined })}
        options={[
          { value: "contain", label: "Contain" },
          { value: "cover", label: "Cover" },
          { value: "fill", label: "Fill" },
        ]}
      />
      <NumberInput
        label="Border Radius"
        value={node.borderRadius as number | undefined}
        onChange={(v) => onUpdate({ borderRadius: v })}
        min={0}
        placeholder="0"
      />
    </>
  );
}

function ActionProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <>
      <TextInput
        label="Name (data key)"
        value={(node.name as string) || ""}
        onChange={(v) => onUpdate({ name: v })}
        placeholder="action"
      />
      <JsonInput
        label="Meta"
        value={node.meta as Record<string, unknown> | undefined}
        onChange={(v) => onUpdate({ meta: v })}
      />
    </>
  );
}

function DynamicLayoutProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <>
      <TextInput
        label="Name (data array key)"
        value={(node.name as string) || ""}
        onChange={(v) => onUpdate({ name: v })}
        placeholder="items"
      />
      <SelectInput
        label="Direction"
        value={(node.direction as string) || "vertical"}
        onChange={(v) => onUpdate({ direction: v })}
        options={[
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ]}
      />
      <NumberInput
        label="Gap"
        value={node.gap as number | undefined}
        onChange={(v) => onUpdate({ gap: v })}
        min={0}
        placeholder="0"
      />
      <SelectInput
        label="Align"
        value={(node.align as string) || ""}
        onChange={(v) => onUpdate(v ? { align: v } : { align: undefined })}
        options={[
          { value: "", label: "Default" },
          { value: "stretch", label: "Stretch" },
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
          { value: "center", label: "Center" },
          { value: "baseline", label: "Baseline" },
        ]}
      />
      <SelectInput
        label="Justify"
        value={(node.justify as string) || ""}
        onChange={(v) => onUpdate(v ? { justify: v } : { justify: undefined })}
        options={[
          { value: "", label: "Default" },
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
          { value: "center", label: "Center" },
          { value: "space-between", label: "Space Between" },
          { value: "space-around", label: "Space Around" },
          { value: "space-evenly", label: "Space Evenly" },
        ]}
      />
      <SpacingInput
        label="Margin (T R B L)"
        value={node.margin as Record<string, number> | undefined}
        onChange={(v) => onUpdate({ margin: v })}
      />
    </>
  );
}

function TemplateRefProps({
  node,
  onUpdate,
}: {
  node: Record<string, unknown>;
  onUpdate: (u: Record<string, unknown>) => void;
}) {
  return (
    <TextInput
      label="Template name (registry key)"
      value={(node.name as string) || ""}
      onChange={(v) => onUpdate({ name: v })}
      placeholder="e.g. notification-item"
    />
  );
}

/* ── Property panel ──────────────────────────────── */

const EDITORS: Record<
  string,
  React.FC<{
    node: Record<string, unknown>;
    onUpdate: (u: Record<string, unknown>) => void;
  }>
> = {
  layout: LayoutProps,
  heading: HeadingProps,
  text: TextProps,
  date: DateProps,
  button: ButtonProps,
  image: ImageProps,
  action: ActionProps,
  dynamicLayout: DynamicLayoutProps,
  template: TemplateRefProps,
};

export function PropertyPanel() {
  const { selectedNodePath, updateNode } = useBuilderStore();
  const template = useBuilderStore(selectActiveTemplate);

  if (!template || selectedNodePath === null) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-sm text-muted text-center">
          Select a component in the canvas to edit its properties
        </p>
      </div>
    );
  }

  const node = getNodeByPath(
    template.root as Record<string, unknown> & { children?: Record<string, unknown>[] },
    selectedNodePath
  );

  if (!node) {
    return (
      <div className="p-4 text-sm text-muted">Node not found</div>
    );
  }

  const type = node.type as string;
  const Editor = EDITORS[type];

  const handleUpdate = (updates: Record<string, unknown>) => {
    // Clean undefined values
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        cleaned[k] = v;
      }
    }

    // Build full node with updates, removing explicitly undefined keys
    const fullNode = { ...node };
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) {
        delete fullNode[k];
      } else {
        fullNode[k] = v;
      }
    }

    updateNode(selectedNodePath, fullNode);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
            Properties
          </h3>
          <div className="text-sm font-medium text-foreground capitalize">
            {type}
            {selectedNodePath && (
              <span className="text-xs text-muted font-mono ml-2">
                {selectedNodePath || "root"}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {Editor && <Editor node={node} onUpdate={handleUpdate} />}
        </div>
      </div>
    </div>
  );
}
