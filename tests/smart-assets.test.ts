import assert from "node:assert/strict";
import test from "node:test";
import {
  createAsset,
  extractTemplateVariables,
  mergeAssets,
  parseAssetBundle,
  renderAsset,
  serializeAssetBundle,
  syncAssetVariables,
} from "../lib/smart-assets";

test("extracts unique Chinese and English prompt variables", () => {
  assert.deepEqual(
    extractTemplateVariables("你是 {{ language }} 专家", "分析 {{代码}}，使用 {{language}}", "忽略 {{负面.内容}}"),
    ["language", "代码", "负面.内容"],
  );
});

test("keeps variable values while prompt templates change", () => {
  const asset = createAsset("prompt", "2026-01-01T00:00:00.000Z", "test-prompt");
  const first = syncAssetVariables({ ...asset, userPrompt: "{{语言}}：{{代码}}" });
  const withValues = { ...first, variables: first.variables.map(variable => ({ ...variable, value: variable.name === "语言" ? "TypeScript" : "const n = 1" })) };
  const updated = syncAssetVariables({ ...withValues, userPrompt: "审查 {{代码}}，语言为 {{语言}}，关注 {{安全}}" });
  assert.deepEqual(updated.variables, [
    { name: "代码", value: "const n = 1" },
    { name: "语言", value: "TypeScript" },
    { name: "安全", value: "" },
  ]);
  assert.equal(renderAsset(updated).userPrompt, "审查 const n = 1，语言为 TypeScript，关注 ");
});

test("round-trips FDE smart asset bundles and rejects unknown files", () => {
  const prompt = syncAssetVariables({ ...createAsset("prompt", "2026-01-01T00:00:00.000Z", "one"), name: "测试", userPrompt: "你好 {{姓名}}" });
  const serialized = serializeAssetBundle([prompt], "2026-01-02T00:00:00.000Z");
  assert.deepEqual(parseAssetBundle(serialized), [prompt]);
  assert.throws(() => parseAssetBundle('{"format":"unknown","assets":[]}'), /不是受支持/);
  assert.throws(() => parseAssetBundle("invalid"), /不是有效的 JSON/);
});

test("merges imported assets by stable id", () => {
  const oldAsset = { ...createAsset("prompt", "2026-01-01T00:00:00.000Z", "same"), name: "旧名称" };
  const newAsset = { ...oldAsset, name: "新名称" };
  const another = createAsset("media-prompt", "2026-01-01T00:00:00.000Z", "another");
  assert.deepEqual(mergeAssets([oldAsset], [newAsset, another]).map(asset => asset.name), ["新名称", "未命名媒体提示词"]);
});
