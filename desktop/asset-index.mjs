import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";

const CONFIG = "asset-index-roots.json";
const MAX_FILES = 500;
const MAX_DEPTH = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const SKIP = new Set([".git", "node_modules", "dist", "build"]);

async function saveRoots(userData, roots) {
  await mkdir(userData, { recursive: true });
  const path = join(userData, CONFIG);
  const temporary = `${path}.${process.pid}.tmp`;
  try { await writeFile(temporary, JSON.stringify(roots, null, 2), "utf8"); await rename(temporary, path); }
  catch (error) { await rm(temporary, { force: true }); throw error; }
}

export async function listAssetRoots(userData) {
  try {
    const roots = JSON.parse(await readFile(join(userData, CONFIG), "utf8"));
    return Array.isArray(roots) ? roots.filter(root => root && typeof root.id === "string" && typeof root.path === "string") : [];
  } catch { return []; }
}

export async function addAssetRoot(userData, directory) {
  const path = resolve(directory);
  if (!(await stat(path)).isDirectory()) throw new Error("选择的路径不是目录");
  const roots = await listAssetRoots(userData);
  if (roots.some(root => root.path.toLocaleLowerCase() === path.toLocaleLowerCase())) return roots;
  const id = `asset-${createHash("sha256").update(path.toLocaleLowerCase()).digest("hex").slice(0, 12)}`;
  const next = [...roots, { id, label: basename(path) || path, path }];
  await saveRoots(userData, next);
  return next;
}

export async function removeAssetRoot(userData, id) {
  const roots = await listAssetRoots(userData);
  await saveRoots(userData, roots.filter(root => root.id !== id));
  return roots.filter(root => root.id !== id);
}

export async function scanAssetRoots(userData) {
  const roots = await listAssetRoots(userData);
  const files = [];
  for (const root of roots) {
    async function walk(directory, depth) {
      if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (files.length >= MAX_FILES) break;
        if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path, depth + 1);
        else if (entry.isFile() && /\.(md|markdown|yaml|yml)$/i.test(entry.name)) {
          try {
            const info = await stat(path);
            if (info.size > MAX_BYTES) continue;
            const content = await readFile(path, "utf8");
            const format = /\.ya?ml$/i.test(entry.name) ? "yaml" : "markdown";
            files.push({ path, rootId: root.id, rootLabel: root.label, name: entry.name, format, content, modifiedAt: info.mtime.toISOString() });
          } catch { /* Ignore files removed or made unreadable while scanning. */ }
        }
      }
    }
    await walk(root.path, 0);
  }
  return { roots, files, truncated: files.length >= MAX_FILES, scannedAt: new Date().toISOString() };
}
