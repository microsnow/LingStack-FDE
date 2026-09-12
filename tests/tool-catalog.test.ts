import assert from "node:assert/strict";
import test from "node:test";
import { p0Samples } from "../lib/p0-tools";
import { sensitiveToolIds } from "../lib/tool-policy";
import { categories, tools } from "../lib/tool-catalog";

test("registers 74 uniquely identified tools with valid categories", () => {
  assert.equal(tools.length, 74);
  assert.equal(new Set(tools.map((tool) => tool.id)).size, tools.length);
  const availableCategories = new Set(categories);
  for (const tool of tools) {
    assert.ok(tool.id.trim(), "tool id");
    assert.ok(tool.name.trim(), tool.id);
    assert.ok(tool.desc.trim(), tool.id);
    assert.ok(availableCategories.has(tool.category), `${tool.id}: ${tool.category}`);
  }
});

test("keeps samples and sensitive-tool policy aligned with the catalog", () => {
  const ids = new Set(tools.map((tool) => tool.id));
  for (const id of Object.keys(p0Samples)) assert.ok(ids.has(id), `sample: ${id}`);
  for (const id of sensitiveToolIds) assert.ok(ids.has(id), `sensitive: ${id}`);
});
