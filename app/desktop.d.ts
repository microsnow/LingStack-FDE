import type { SmartAsset } from "../lib/smart-assets";

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
export type OpenFilePayload = { name?: string; text?: string; error?: string };
export type CredentialSummary = { id: string; label: string; updatedAt: string };
export type CredentialStorageStatus = { available: boolean; backend: string; message: string };
export type UpdateCheckResult = { status: string; version?: string; message: string };
export type UpdateProgress = { status?: string; percent?: number; message?: string };

declare global {
  interface Window {
    fdeDesktop?: {
      platform: string;
      readClipboardText(): Promise<string>;
      openFileDialog(): Promise<void>;
      loadSmartAssets(): Promise<unknown[] | null>;
      saveSmartAssets(assets: SmartAsset[]): Promise<void>;
      getCredentialStatus(): Promise<CredentialStorageStatus>;
      listCredentials(): Promise<CredentialSummary[]>;
      saveCredential(label: string, secret: string): Promise<CredentialSummary>;
      removeCredential(id: string): Promise<void>;
      checkForUpdates(): Promise<UpdateCheckResult>;
      listSkillRoots(): Promise<SkillRoot[]>;
      scanSkills(): Promise<SkillScanResult>;
      addSkillRoot(): Promise<SkillRoot | null>;
      updateSkillRoot(id: string, patch: SkillRootPatch): Promise<SkillRoot>;
      removeSkillRoot(id: string): Promise<void>;
      openSkillPath(path: string): Promise<void>;
      onSkillsChanged(callback: (event: { rootId?: string; changedAt?: string }) => void): () => void;
      onClipboardInput(callback: (value: string) => void): () => void;
      onOpenFile(callback: (value: OpenFilePayload) => void): () => void;
      onUpdateProgress(callback: (value: UpdateProgress) => void): () => void;
      onDeepLink(callback: (url: string) => void): () => void;
    };
  }
}
