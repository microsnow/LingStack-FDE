export type AssetRoot = { id: string; label: string; path: string };
export type AssetIndexFile = {
  path: string;
  rootId: string;
  rootLabel: string;
  name: string;
  format: "yaml" | "markdown";
  content: string;
  modifiedAt: string;
};
export function listAssetRoots(userData: string): Promise<AssetRoot[]>;
export function addAssetRoot(userData: string, directory: string): Promise<AssetRoot[]>;
export function removeAssetRoot(userData: string, id: string): Promise<AssetRoot[]>;
export function scanAssetRoots(userData: string): Promise<{
  roots: AssetRoot[];
  files: AssetIndexFile[];
  truncated: boolean;
  scannedAt: string;
}>;
