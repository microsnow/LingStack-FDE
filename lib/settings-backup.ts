import { normalizeAsset, type SmartAsset } from "./smart-assets";

export const SETTINGS_STORAGE_KEYS = ["fde.active-module", "devkit-favorites", "devkit-recent", "devkit-theme"] as const;

export type SettingsBackup = {
  format: "fde-settings-backup";
  version: 1;
  exportedAt: string;
  preferences: Record<string, string>;
  assets: SmartAsset[];
};

export function collectPreferences(storage: Pick<Storage, "getItem">): Record<string, string> {
  return Object.fromEntries(SETTINGS_STORAGE_KEYS.flatMap(key => {
    const value = storage.getItem(key);
    return value === null ? [] : [[key, value]];
  }));
}

export function serializeSettingsBackup(preferences: Record<string, string>, assets: SmartAsset[], exportedAt = new Date().toISOString()): string {
  const allowed = new Set<string>(SETTINGS_STORAGE_KEYS);
  const safePreferences = Object.fromEntries(Object.entries(preferences).filter(([key, value]) => allowed.has(key) && typeof value === "string"));
  return JSON.stringify({ format: "fde-settings-backup", version: 1, exportedAt, preferences: safePreferences, assets } satisfies SettingsBackup, null, 2);
}

export function parseSettingsBackup(input: string): SettingsBackup {
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { throw new Error("备份文件不是有效的 JSON"); }
  const backup = parsed as Partial<SettingsBackup>;
  if (backup.format !== "fde-settings-backup" || backup.version !== 1 || !backup.preferences || typeof backup.preferences !== "object" || !Array.isArray(backup.assets)) throw new Error("不是受支持的灵栈 FDE 备份文件");
  const allowed = new Set<string>(SETTINGS_STORAGE_KEYS);
  const preferences = Object.fromEntries(Object.entries(backup.preferences).filter(([key, value]) => allowed.has(key) && typeof value === "string"));
  const assets = backup.assets.map(normalizeAsset).filter((asset): asset is SmartAsset => Boolean(asset));
  if (assets.length !== backup.assets.length) throw new Error("备份中包含无效的智能资产");
  return { format: "fde-settings-backup", version: 1, exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "", preferences, assets };
}

export function restorePreferences(storage: Pick<Storage, "setItem">, preferences: Record<string, string>) {
  const allowed = new Set<string>(SETTINGS_STORAGE_KEYS);
  for (const [key, value] of Object.entries(preferences)) if (allowed.has(key) && typeof value === "string") storage.setItem(key, value);
}
