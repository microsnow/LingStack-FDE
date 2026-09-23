import assert from "node:assert/strict";
import test from "node:test";
import { p0Samples } from "../lib/p0-tools";
import { sensitiveToolIds } from "../lib/tool-policy";
import { categories, tools } from "../lib/tool-catalog";
import { toolSamples } from "../lib/tool-samples";
import { cipherRun, type CipherName } from "../lib/cipher-tools";

test("registers 78 uniquely identified tools with valid categories", () => {
  assert.equal(tools.length, 78);
  assert.equal(new Set(tools.map((tool) => tool.id)).size, tools.length);
  const availableCategories = new Set(categories);
  for (const tool of tools) {
    assert.ok(tool.id.trim(), "tool id");
    assert.ok(tool.name.trim(), tool.id);
    assert.ok(tool.desc.trim(), tool.id);
    assert.ok(availableCategories.has(tool.category), `${tool.id}: ${tool.category}`);
    assert.ok(["local", "network", "ai"].includes(tool.capability), `${tool.id}: ${tool.capability}`);
  }
});

test("classifies every current tool as local-only", () => {
  assert.equal(tools.every((tool) => tool.capability === "local"), true);
});

test("keeps samples and sensitive-tool policy aligned with the catalog", () => {
  const ids = new Set(tools.map((tool) => tool.id));
  assert.deepEqual(new Set(Object.keys(toolSamples)), ids, "every tool must have exactly one default sample");
  for (const [id, sample] of Object.entries(toolSamples)) assert.ok(sample.trim(), `empty sample: ${id}`);
  for (const id of Object.keys(p0Samples)) assert.ok(ids.has(id), `P0 sample: ${id}`);
  for (const id of sensitiveToolIds) assert.ok(ids.has(id), `sensitive: ${id}`);
});

test("keeps every decryption sample executable", async () => {
  const ciphers: CipherName[] = ["aes", "des", "tripledes", "rabbit", "rc4"];
  for (const cipher of ciphers) {
    assert.equal(await cipherRun(cipher, true, toolSamples[`${cipher}-decrypt`]), "Hello DevKit", cipher);
  }
});
