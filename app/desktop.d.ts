export {};

export type SkillRisk = "low" | "medium" | "high";
export type ScannedSkill = {
  id: string;
  rootId: string;
  rootLabel: string;
  platform: string;
  name: string;
  description: string;
  directory: string;
  relativePath: string;
  modifiedAt: string;
  size: number;
  risk: SkillRisk;
  warnings: string[];
  capabilities: string[];
  tree: { path: string; type: "directory" | "file"; depth: number }[];
  preview: string;
};
export type SkillRoot = { id: string; label: string; path: string; platform: string; enabled: boolean; readOnly: boolean; isDefault: boolean; priority: number; maxDepth: number; available?: boolean; count?: number; error?: string };
export type SkillRootPatch = Partial<Pick<SkillRoot, "label" | "platform" | "enabled" | "priority" | "maxDepth">>;
export type SkillScanResult = {
  root?: string;
  roots: SkillRoot[];
  scannedAt: string;
  durationMs: number;
  truncated: boolean;
  skills: ScannedSkill[];
  summary: { total: number; valid: number; warnings: number; duplicates: number; highRisk: number };
};

declare global {
  interface Window {
    fdeDesktop?: {
      platform: string;
      readClipboardText(): Promise<string>;
      listSkillRoots(): Promise<SkillRoot[]>;
      scanSkills(): Promise<SkillScanResult>;
      addSkillRoot(): Promise<SkillRoot | null>;
      updateSkillRoot(id: string, patch: SkillRootPatch): Promise<SkillRoot>;
      removeSkillRoot(id: string): Promise<void>;
      openSkillPath(path: string): Promise<void>;
      onSkillsChanged(callback: (event: { rootId?: string; changedAt?: string }) => void): () => void;
      onClipboardInput(callback: (value: string) => void): () => void;
      onDeepLink(callback: (url: string) => void): () => void;
    };
  }
}
