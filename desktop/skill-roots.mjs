import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join, resolve } from "node:path";

const CONFIG_FILE = "skill-roots.json";

function rootId(path) {
  return `custom-${createHash("sha256").update(path.toLocaleLowerCase()).digest("hex").slice(0, 12)}`;
}

export function defaultSkillRoots(home) {
  void home;
  return [];
}

async function readCustomRoots(userData) {
  try {
    const parsed = JSON.parse(await readFile(join(userData, CONFIG_FILE), "utf8"));
    return Array.isArray(parsed) ? parsed.filter(root => root && typeof root.path === "string" && !root.isDefault).map(root => ({ ...root, enabled: root.enabled !== false, readOnly: true, isDefault: false, priority: Number.isFinite(root.priority) ? root.priority : 100, maxDepth: Number.isFinite(root.maxDepth) ? root.maxDepth : 5 })) : [];
  } catch { return []; }
}

async function saveCustomRoots(userData, roots) {
  await mkdir(userData, { recursive: true });
  await writeFile(join(userData, CONFIG_FILE), JSON.stringify(roots, null, 2), "utf8");
}

export async function listSkillRoots(home, userData) {
  const custom = await readCustomRoots(userData);
  void home;
  return custom.sort((a, b) => a.priority - b.priority);
}

export async function addSkillRoot(home, userData, directory) {
  const path = resolve(directory);
  if (!(await stat(path)).isDirectory()) throw new Error("选择的路径不是目录");
  const roots = await listSkillRoots(home, userData);
  const existing = roots.find(root => resolve(root.path).toLocaleLowerCase() === path.toLocaleLowerCase());
  if (existing) return existing;
  const custom = await readCustomRoots(userData);
  const next = { id: rootId(path), label: basename(path) || path, path, platform: "自定义", enabled: true, readOnly: true, isDefault: false, priority: 100 + custom.filter(root => !root.isDefault).length, maxDepth: 5 };
  await saveCustomRoots(userData, [...custom, next]);
  return next;
}

function sanitizedPatch(current, patch) {
  const label = typeof patch.label === "string" ? patch.label.trim().slice(0, 80) : current.label;
  const platform = typeof patch.platform === "string" ? patch.platform.trim().slice(0, 40) : current.platform;
  return {
    ...current,
    label: label || current.label,
    platform: platform || current.platform,
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    priority: Number.isFinite(patch.priority) ? Math.max(0, Math.min(999, Math.round(patch.priority))) : current.priority,
    maxDepth: Number.isFinite(patch.maxDepth) ? Math.max(1, Math.min(12, Math.round(patch.maxDepth))) : (current.maxDepth ?? 5),
    path: current.path,
    readOnly: true,
  };
}

export async function updateSkillRoot(home, userData, id, patch) {
  const custom = await readCustomRoots(userData);
  void home;
  const current = custom.find(root => root.id === id);
  if (!current) throw new Error("Skills 目录不存在");
  const next = sanitizedPatch(current, patch);
  await saveCustomRoots(userData, custom.map(root => root.id === id ? next : root));
  return next;
}

export async function removeSkillRoot(userData, id) {
  const custom = await readCustomRoots(userData);
  const current = custom.find(root => root.id === id);
  if (!current) throw new Error("Skills 目录不存在");
  await saveCustomRoots(userData, custom.filter(root => root.id !== id));
}
