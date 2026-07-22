import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runP0Tool } from "../lib/p0-tools";

test("converts YAML, XML and CSV formats", async () => {
  assert.deepEqual(JSON.parse((await runP0Tool("yaml2json", "name: DevKit\nversion: 4"))!), { name: "DevKit", version: 4 });
  assert.match((await runP0Tool("json2xml", '{"project":{"name":"DevKit"}}'))!, /<project>/);
  assert.deepEqual(JSON.parse((await runP0Tool("xml2json", "<project><name>DevKit</name></project>"))!), { project: { name: "DevKit" } });
  assert.match((await runP0Tool("json2csv", '[{"name":"DevKit","version":4}]'))!, /name,version/);
  assert.deepEqual(JSON.parse((await runP0Tool("csv2json", "name,version\nDevKit,4"))!), [{ name: "DevKit", version: "4" }]);
});

test("validates schemas and reports field paths", async () => {
  const valid = await runP0Tool("jsonschema", JSON.stringify({ schema: { type: "object", required: ["name"] }, data: { name: "DevKit" } }));
  assert.match(valid!, /校验通过/);
  const invalid = await runP0Tool("jsonschema", JSON.stringify({ schema: { type: "object", required: ["name"] }, data: {} }));
  assert.match(invalid!, /\$\.name/);
});

test("handles text utilities and markdown", async () => {
  assert.equal(await runP0Tool("findreplace", "查找: DevKit\n替换: 工具箱\n--- 文本 ---\nDevKit DevKit"), "工具箱 工具箱");
  assert.equal(await runP0Tool("linefilter", "包含: 工具\n排除: 旧版\n--- 文本 ---\n开发工具\n旧版工具\n说明"), "开发工具");
  assert.match((await runP0Tool("markdown", "# DevKit\n\n- 本地处理"))!, /<h1>DevKit<\/h1>/);
});

test("production render contains the product and current tool count", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/"), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /DevKit · 开发者工具箱/);
  assert.match(html, /搜索 74 个工具/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working/);
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /拖放|onDrop/);
  assert.match(page, /自动执行/);
});
