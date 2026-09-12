export type SkillRootConfig = { id: string; label: string; path: string; platform: string; enabled: boolean; readOnly: boolean; isDefault: boolean; priority: number; maxDepth: number };
export function defaultSkillRoots(home: string): SkillRootConfig[];
export function listSkillRoots(home: string, userData: string): Promise<SkillRootConfig[]>;
export function addSkillRoot(home: string, userData: string, directory: string): Promise<SkillRootConfig>;
export function updateSkillRoot(home: string, userData: string, id: string, patch: Partial<Pick<SkillRootConfig, "label" | "platform" | "enabled" | "priority" | "maxDepth">>): Promise<SkillRootConfig>;
export function removeSkillRoot(userData: string, id: string): Promise<void>;
