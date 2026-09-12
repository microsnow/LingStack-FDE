import type { SkillRootConfig } from "./skill-roots.mjs";
export type SkillChangeEvent = { rootId: string; eventType: string; filename: string; changedAt: string };
export function watchSkillRoots(roots: SkillRootConfig[], onChange: (event: SkillChangeEvent) => void, debounceMs?: number): { count: number; close(): void };
