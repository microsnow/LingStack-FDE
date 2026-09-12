import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ASSET_FILE = "smart-assets.json";
const MAX_ASSETS = 5000;
const MAX_BYTES = 10 * 1024 * 1024;
let writeQueue = Promise.resolve();

export async function loadSmartAssets(userData) {
  try {
    const parsed = JSON.parse(await readFile(join(userData, ASSET_FILE), "utf8"));
    if (parsed?.format !== "fde-smart-assets" || parsed?.version !== 1 || !Array.isArray(parsed.assets)) {
      throw new Error("桌面智能资产文件格式无效");
    }
    return parsed.assets;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveSmartAssets(userData, assets) {
  if (!Array.isArray(assets) || assets.length > MAX_ASSETS) throw new Error("智能资产数量无效");
  const serialized = JSON.stringify({ format: "fde-smart-assets", version: 1, assets }, null, 2);
  if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) throw new Error("智能资产数据超过 10 MB 限制");

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await mkdir(userData, { recursive: true });
    const destination = join(userData, ASSET_FILE);
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporary, serialized, "utf8");
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  });
  await writeQueue;
}
