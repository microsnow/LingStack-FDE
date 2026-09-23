import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { safeStorage } from "electron";

const STORE_FILE = "credentials.json";
const MAX_CREDENTIALS = 500;
const MAX_SECRET_BYTES = 64 * 1024;
let writeQueue = Promise.resolve();

export async function getCredentialStorageStatus(platform = process.platform) {
  const backend = platform === "linux" ? safeStorage.getSelectedStorageBackend() : platform;
  const encrypted = await safeStorage.isAsyncEncryptionAvailable();
  const supported = encrypted && !(platform === "linux" && backend === "basic_text");
  return {
    available: supported,
    backend,
    message: supported
      ? "凭据由操作系统安全存储保护。"
      : platform === "linux" && backend === "basic_text"
        ? "未检测到系统密钥环，已禁用凭据保存。请安装并启用 GNOME Keyring 或 KWallet。"
        : "当前系统安全存储不可用，凭据保存已禁用。",
  };
}

async function readStore(userData) {
  try {
    const parsed = JSON.parse(await readFile(join(userData, STORE_FILE), "utf8"));
    if (parsed?.format !== "fde-credentials" || parsed?.version !== 1 || !Array.isArray(parsed.credentials))
      throw new Error("安全凭据文件格式无效");
    return parsed.credentials;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeStore(userData, credentials) {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await mkdir(userData, { recursive: true });
    const destination = join(userData, STORE_FILE);
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify({ format: "fde-credentials", version: 1, credentials }, null, 2), "utf8");
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  });
  await writeQueue;
}

export async function listCredentials(userData) {
  return (await readStore(userData)).map(({ id, label, updatedAt }) => ({ id, label, updatedAt }));
}

export async function saveCredential(userData, label, secret, platform = process.platform) {
  if (typeof label !== "string" || !label.trim() || label.trim().length > 100)
    throw new Error("凭据名称须为 1–100 个字符");
  if (typeof secret !== "string" || !secret || Buffer.byteLength(secret, "utf8") > MAX_SECRET_BYTES)
    throw new Error("凭据内容不能为空且不能超过 64 KB");
  const status = await getCredentialStorageStatus(platform);
  if (!status.available) throw new Error(status.message);

  const credentials = await readStore(userData);
  const normalizedLabel = label.trim();
  const existing = credentials.find(item => item.label.toLocaleLowerCase() === normalizedLabel.toLocaleLowerCase());
  if (!existing && credentials.length >= MAX_CREDENTIALS) throw new Error("安全凭据数量已达上限");
  const encrypted = await safeStorage.encryptStringAsync(secret);
  const entry = {
    id: existing?.id ?? randomUUID(),
    label: normalizedLabel,
    encrypted: encrypted.toString("base64"),
    updatedAt: new Date().toISOString(),
  };
  const next = existing ? credentials.map(item => item.id === existing.id ? entry : item) : [...credentials, entry];
  await writeStore(userData, next);
  return { id: entry.id, label: entry.label, updatedAt: entry.updatedAt };
}

export async function removeCredential(userData, id) {
  if (typeof id !== "string") throw new Error("无效的凭据标识");
  const credentials = await readStore(userData);
  await writeStore(userData, credentials.filter(item => item.id !== id));
}

export async function readCredential(userData, id) {
  const entry = (await readStore(userData)).find(item => item.id === id);
  if (!entry) return null;
  const decrypted = await safeStorage.decryptStringAsync(Buffer.from(entry.encrypted, "base64"));
  return decrypted.result;
}
