import { watch } from "node:fs";

export function watchSkillRoots(roots, onChange, debounceMs = 700) {
  const watchers = [];
  let timer;
  let pending;
  for (const root of roots) {
    if (!root.enabled) continue;
    try {
      const watcher = watch(root.path, { recursive: true }, (eventType, filename) => {
        pending = { rootId: root.id, eventType, filename: filename ? String(filename).replaceAll("\\", "/") : "", changedAt: new Date().toISOString() };
        clearTimeout(timer);
        timer = setTimeout(() => { const event = pending; pending = undefined; if (event) onChange(event); }, debounceMs);
      });
      watcher.on("error", () => {});
      watchers.push(watcher);
    } catch { /* Missing or inaccessible roots are simply not watched. */ }
  }
  return { count: watchers.length, close() { clearTimeout(timer); for (const watcher of watchers) watcher.close(); } };
}
