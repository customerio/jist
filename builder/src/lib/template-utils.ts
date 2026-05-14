/* Template tree manipulation utilities.
   Path format: "" = root, "0" = root.children[0], "0.2" = root.children[0].children[2] */

type AnyNode = Record<string, unknown> & { children?: AnyNode[]; template?: AnyNode };

function getChildren(node: AnyNode): AnyNode[] {
  if (node.type === "dynamicLayout") {
    return node.template ? [node.template] : [];
  }
  return node.children || [];
}

export function getNodeByPath(root: AnyNode, path: string): AnyNode | null {
  if (!path) return root;
  const indices = path.split(".").map(Number);
  let node: AnyNode | undefined = root;
  for (const i of indices) {
    const kids = getChildren(node!);
    if (i < 0 || i >= kids.length) return null;
    node = kids[i];
  }
  return node ?? null;
}

export function getParentPath(path: string): string {
  const parts = path.split(".");
  return parts.slice(0, -1).join(".");
}

export function getChildIndex(path: string): number {
  const parts = path.split(".");
  return Number(parts[parts.length - 1]);
}

function setChildAt(parent: AnyNode, idx: number, child: AnyNode): void {
  if (parent.type === "dynamicLayout") {
    parent.template = child;
  } else {
    if (parent.children && idx < parent.children.length) {
      parent.children[idx] = child;
    }
  }
}

export function updateNodeByPath(
  root: AnyNode,
  path: string,
  replacement: Record<string, unknown>
): AnyNode {
  const newRoot = structuredClone(root);
  if (!path) {
    return { ...replacement, children: (replacement.children ?? newRoot.children) as AnyNode[] };
  }
  const parentPath = getParentPath(path);
  const idx = getChildIndex(path);
  const parent = parentPath ? getNodeByPath(newRoot, parentPath) : newRoot;
  if (!parent) return newRoot;
  const kids = getChildren(parent);
  if (idx >= kids.length) return newRoot;
  setChildAt(parent, idx, replacement as AnyNode);
  return newRoot;
}

export function insertNode(
  root: AnyNode,
  parentPath: string,
  index: number,
  node: AnyNode
): AnyNode {
  const newRoot = structuredClone(root);
  const parent = parentPath ? getNodeByPath(newRoot, parentPath) : newRoot;
  if (!parent) throw new Error(`Parent path "${parentPath}" not found`);
  if (!isContainer(parent)) throw new Error(`Node at "${parentPath}" is not a container`);

  if (parent.type === "dynamicLayout") {
    parent.template = structuredClone(node);
  } else {
    if (!parent.children) parent.children = [];
    const clampedIndex = Math.max(0, Math.min(index, parent.children.length));
    parent.children.splice(clampedIndex, 0, structuredClone(node));
  }
  return newRoot;
}

export function removeNodeByPath(root: AnyNode, path: string): AnyNode {
  if (!path) return root;
  const newRoot = structuredClone(root);
  const parentPath = getParentPath(path);
  const idx = getChildIndex(path);
  const parent = parentPath ? getNodeByPath(newRoot, parentPath) : newRoot;
  if (!parent) return newRoot;

  if (parent.type === "dynamicLayout") {
    parent.template = { type: "layout", direction: "vertical", children: [] } as unknown as AnyNode;
  } else {
    if (!parent.children || idx >= parent.children.length) return newRoot;
    parent.children.splice(idx, 1);
  }
  return newRoot;
}

/**
 * After removing a node at `removedPath`, any path that referenced a sibling
 * at a higher index (at the same level) needs its index decremented.
 */
function adjustPathAfterRemoval(targetPath: string, removedPath: string): string {
  if (!targetPath || !removedPath) return targetPath;

  const targetParts = targetPath.split(".").map(Number);
  const removedParts = removedPath.split(".").map(Number);

  // The removed node's parent is everything except the last segment
  const removedParent = removedParts.slice(0, -1);
  const removedIdx = removedParts[removedParts.length - 1];

  // Target must be at least as deep as the removed node's level
  if (targetParts.length <= removedParent.length) return targetPath;

  // Check that the target shares the same parent prefix as the removed node
  for (let i = 0; i < removedParent.length; i++) {
    if (targetParts[i] !== removedParent[i]) return targetPath;
  }

  // At the level where the node was removed, adjust if target index is greater
  const level = removedParent.length;
  if (targetParts[level] > removedIdx) {
    targetParts[level]--;
  } else if (targetParts[level] === removedIdx) {
    // Target path pointed into the removed node — this shouldn't happen
    // but if it does, return as-is (caller should guard against this)
    return targetPath;
  }

  return targetParts.join(".");
}

export function moveNode(
  root: AnyNode,
  fromPath: string,
  toParentPath: string,
  toIndex: number
): AnyNode {
  if (!fromPath) throw new Error("Cannot move root node");

  const node = getNodeByPath(root, fromPath);
  if (!node) throw new Error(`Source node "${fromPath}" not found`);

  // Remove the node first
  let newRoot = removeNodeByPath(root, fromPath);

  // Adjust target parent path — indices may have shifted after removal
  const adjustedParentPath = adjustPathAfterRemoval(toParentPath, fromPath);

  // Adjust target index if moving within the same parent
  const fromParent = getParentPath(fromPath);
  const fromIdx = getChildIndex(fromPath);
  let adjustedIndex = toIndex;
  if (fromParent === toParentPath && fromIdx < toIndex) {
    adjustedIndex--;
  }

  // Insert at adjusted location
  newRoot = insertNode(newRoot, adjustedParentPath, Math.max(0, adjustedIndex), node);
  return newRoot;
}

export function isContainer(node: AnyNode): boolean {
  return node.type === "layout" || node.type === "action" || node.type === "dynamicLayout";
}

export function isDescendant(ancestorPath: string, targetPath: string): boolean {
  if (!ancestorPath) return true;
  return targetPath.startsWith(ancestorPath + ".");
}
