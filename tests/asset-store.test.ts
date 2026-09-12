import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSmartAssets, saveSmartAssets } from "../desktop/asset-store.mjs";

test("persists desktop smart assets with a versioned envelope", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fde-assets-"));
  try {
    assert.equal(await loadSmartAssets(directory), null);
    const assets = [{ id: "one", kind: "prompt", name: "测试" }];
    await saveSmartAssets(directory, assets);
    assert.deepEqual(await loadSmartAssets(directory), assets);
    const stored = JSON.parse(await readFile(join(directory, "smart-assets.json"), "utf8"));
    assert.equal(stored.format, "fde-smart-assets");
    assert.equal(stored.version, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects oversized desktop asset collections", async () => {
  await assert.rejects(
    saveSmartAssets(tmpdir(), Array.from({ length: 5001 }, (_, id) => ({ id }))),
    /数量无效/,
  );
});
