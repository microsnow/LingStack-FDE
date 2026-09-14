import assert from "node:assert/strict";
import test from "node:test";
import { convertChinese } from "../lib/chinese-converter";

test("converts simplified Chinese to traditional Chinese", async () => {
  assert.equal(await convertChinese("开发者工具箱", false), "開發者工具箱");
});

test("converts traditional Chinese to simplified Chinese", async () => {
  assert.equal(await convertChinese("開發者工具箱", true), "开发者工具箱");
});
