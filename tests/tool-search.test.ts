import assert from "node:assert/strict";
import test from "node:test";
import { tools } from "../lib/tool-catalog";
import { matchesToolSearch } from "../lib/tool-search";

function search(query: string) {
  return tools.filter(tool => matchesToolSearch(tool, query)).map(tool => tool.id);
}

test("tool search ignores Latin letter case and punctuation", () => {
  assert.ok(search("TEXT").includes("text"));
  assert.ok(search("Json-Schema").includes("jsonschema"));
});

test("tool search matches Chinese aliases and English phrases", () => {
  assert.ok(search("文本替换").includes("findreplace"));
  assert.ok(search("JSON to YAML").includes("yaml"));
});

test("tool search intersects multiple query terms", () => {
  assert.deepEqual(search("csv 预览"), ["csvpreview"]);
});
