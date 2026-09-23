import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { runP0Tool } from "../lib/p0-tools";
import { nextRecentTools, sensitiveToolIds } from "../lib/tool-policy";
import { runTool } from "../lib/tool-runner";

test("converts pinyin with selectable tone and polyphonic readings", async () => {
  assert.equal(await runTool("pinyin", "你好", "primary", { pinyinToneType: "num" }), "ni3 hao3");
  assert.equal(await runTool("pinyin", "你好", "primary", { pinyinToneType: "none" }), "ni hao");
  const candidates = await runTool("pinyin", "银行", "primary", { pinyinReadingMode: "candidates" });
  assert.match(candidates, /银：yín/);
  assert.match(candidates, /行：.*xíng/);
  assert.match(candidates, /行：.*háng/);
  const numericCandidates = await runTool("pinyin", "银行", "primary", { pinyinReadingMode: "candidates", pinyinToneType: "num" });
  assert.match(numericCandidates, /银：yin2/);
  assert.doesNotMatch(numericCandidates, /yin20|hang20/);
  const untonedCandidates = await runTool("pinyin", "银行", "primary", { pinyinReadingMode: "candidates", pinyinToneType: "none" });
  assert.match(untonedCandidates, /行：.*hang.*xing/);
  assert.equal(await runTool("pinyin", "单于", "primary", { pinyinReadingMode: "surname" }), "shàn yú");
});

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

test("reports malformed input without hiding the relevant location", async () => {
  await assert.rejects(runP0Tool("json2xml", '{"name":}'), /JSON 解析失败/);
  await assert.rejects(runP0Tool("csv2json", 'name,version\n"DevKit,4'), /CSV 第 2 行/);
  await assert.rejects(runP0Tool("propertiesyaml", "app.name"), /Properties 行缺少/);
  await assert.rejects(runP0Tool("findreplace", "查找: DevKit\n没有分隔行"), /--- 文本 ---/);
});

test("covers every P0 tool with a representative result", async () => {
  const cases: Array<[string, string, RegExp, string?]> = [
    ["yaml2json", "name: DevKit", /\"name\": \"DevKit\"/],
    ["json2xml", '{"name":"DevKit"}', /<name>DevKit<\/name>/],
    ["xml2json", "<name>DevKit</name>", /\"name\": \"DevKit\"/],
    ["json2csv", '[{"name":"DevKit"}]', /name.*DevKit/s],
    ["csv2json", "name,version\nDevKit,4", /\"name\": \"DevKit\"/],
    ["jsonschema", '{"schema":{"type":"string"},"data":"ok"}', /校验通过/],
    ["yamlformat", "name: DevKit", /name: DevKit/],
    ["xmlformat", "<name>DevKit</name>", /<name>DevKit<\/name>/],
    ["webformat", "const value=1", /const value = 1;/, "javascript"],
    ["csvpreview", "name,version\nDevKit,4", /name \| version.*DevKit \| 4/s],
    ["propertiesyaml", "app.name=DevKit", /app:.*name: DevKit/s],
    ["findreplace", "查找: A\n替换: B\n--- 文本 ---\nA", /^B$/],
    ["linefilter", "包含: A\n排除:\n--- 文本 ---\nA\nB", /^A$/],
    ["shuffle", "only", /^only$/],
    ["mdtable", "name,version\nDevKit,4", /\| name \| version \|.*\| DevKit \| 4 \|/s],
  ];
  for (const [id, input, expected, action] of cases) assert.match((await runP0Tool(id, input, action))!, expected, id);
});

test("does not add sensitive tools to recent history", () => {
  const current = ["json", "base64"];
  for (const id of sensitiveToolIds) assert.deepEqual(nextRecentTools(current, id), current, id);
  assert.deepEqual(nextRecentTools(current, "yaml"), ["yaml", "json", "base64"]);
});

test("fresh static production build contains the product and current tool count", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /灵栈 FDE · 开发者工作台/);
  assert.match(html, /内置 78 个开发工具/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working/);
  await assert.rejects(readFile(new URL("../dist/server/index.js", import.meta.url)), error => (error as NodeJS.ErrnoException).code === "ENOENT");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /拖放|onDrop/);
  assert.match(page, /自动执行/);
  const desktopMain = await readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8");
  assert.match(desktopMain, /contextIsolation: true/);
  assert.match(desktopMain, /nodeIntegration: false/);
  assert.match(desktopMain, /sandbox: true/);
});

test("keeps the initial application script below 500 KB", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const source = html.match(/<script[^>]+src="\.\/(assets\/index-[^"]+\.js)"/)?.[1];
  assert.ok(source, "找不到生产构建入口脚本");
  const entry = await stat(new URL(`../dist/${source}`, import.meta.url));
  assert.ok(entry.size < 500 * 1024, `入口脚本过大：${entry.size} bytes`);
});
