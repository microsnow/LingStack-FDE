import { inputError, parseJson } from "./tool-errors";

export const p0Samples: Record<string, string> = {
  yaml2json: "name: DevKit\nversion: 4\nfeatures:\n  - local\n  - private",
  json2xml: '{"project":{"name":"DevKit","version":4}}',
  xml2json: "<project><name>DevKit</name><version>4</version></project>",
  json2csv: '[{"name":"JSON","category":"格式"},{"name":"Base64","category":"编码"}]',
  csv2json: "name,category\nJSON,格式\nBase64,编码",
  jsonschema: JSON.stringify({ schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, version: { type: "number" } } }, data: { name: "DevKit", version: 4 } }, null, 2),
  yamlformat: "name: DevKit\nfeatures: [local, private]",
  xmlformat: "<project><name>DevKit</name><features><item>local</item></features></project>",
  webformat: "function hello(){const name='DevKit';return `Hello ${name}`;}",
  csvpreview: "name,category,status\nJSON,格式,已上线\nBase64,编码,已上线",
  propertiesyaml: "app.name=DevKit\napp.version=4\nprivacy.local=true",
  findreplace: "查找: DevKit\n替换: Developer Toolkit\n--- 文本 ---\nDevKit 是一个本地开发者工具箱。",
  linefilter: "包含: 工具\n排除: 旧版\n--- 文本 ---\n开发者工具\n旧版工具\n使用说明",
  shuffle: "苹果\n香蕉\n橙子\n葡萄",
  mdtable: "名称,分类,状态\nJSON,格式,已上线\nBase64,编码,已上线",
};

function validateSchema(schema: Record<string, unknown>, data: unknown, path = "$"): string[] {
  const errors: string[] = [];
  const type = schema.type as string | undefined;
  const actual = Array.isArray(data) ? "array" : data === null ? "null" : typeof data;
  if (type && type !== actual) return [`${path}：应为 ${type}，实际为 ${actual}`];
  if (type === "object" && data && typeof data === "object" && !Array.isArray(data)) {
    const object = data as Record<string, unknown>;
    for (const key of (schema.required as string[] | undefined) ?? []) if (!(key in object)) errors.push(`${path}.${key}：缺少必填字段`);
    const properties = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
    for (const [key, child] of Object.entries(properties)) if (key in object) errors.push(...validateSchema(child, object[key], `${path}.${key}`));
  }
  if (type === "array" && Array.isArray(data) && schema.items) data.forEach((item, index) => errors.push(...validateSchema(schema.items as Record<string, unknown>, item, `${path}[${index}]`)));
  return errors;
}

function splitConfig(value: string) {
  const parts = value.split(/^--- 文本 ---$/m);
  if (parts.length !== 2) inputError("缺少“--- 文本 ---”分隔行。", { suggestion: "加入单独一行“--- 文本 ---”。" });
  const config = Object.fromEntries(parts[0].split(/\r?\n/).map((line, index) => ({ line, index })).filter(({ line }) => line.trim()).map(({ line, index: lineIndex }) => {
    const index = line.indexOf(":");
    if (index < 0) inputError("配置行格式无效。", { line: lineIndex + 1, column: 1, suggestion: "使用“名称: 值”格式。" });
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  return { config, text: parts[1].replace(/^\r?\n/, "") };
}

export async function runP0Tool(id: string, input: string, action = "primary"): Promise<string | null> {
  if (id === "yaml2json") {
    const { parse } = await import("yaml");
    return JSON.stringify(parse(input), null, 2);
  }
  if (id === "json2xml") {
    const { XMLBuilder } = await import("fast-xml-parser");
    return new XMLBuilder({ ignoreAttributes: false, format: true }).build(parseJson(input));
  }
  if (id === "xml2json") {
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true, trimValues: true });
    return JSON.stringify(parser.parse(input), null, 2);
  }
  if (id === "json2csv") {
    const Papa = (await import("papaparse")).default;
    const data = parseJson(input); if (!Array.isArray(data)) inputError("JSON 顶层不是对象数组。", { suggestion: "使用 [{\"name\":\"DevKit\"}] 形式。" });
    return Papa.unparse(data);
  }
  if (id === "csv2json" || id === "csvpreview") {
    const Papa = (await import("papaparse")).default;
    const result = Papa.parse<Record<string, string>>(input, { header: true, skipEmptyLines: true });
    const firstError = result.errors[0];
    if (firstError) {
      const line = (firstError.row ?? 0) + 1;
      inputError(`CSV 第 ${line} 行格式无效：${firstError.message}`, { line, suggestion: "检查引号、分隔符以及各行列数。" });
    }
    if (id === "csv2json") return JSON.stringify(result.data, null, 2);
    const headers = result.meta.fields ?? [], rows = id === "csvpreview" ? [...result.data].sort((a, b) => (a[headers[0]] ?? "").localeCompare(b[headers[0]] ?? "", "zh-CN", { numeric: true })) : result.data;
    return [headers.join(" | "), headers.map(() => "---").join(" | "), ...rows.map(row => headers.map(key => row[key] ?? "").join(" | "))].join("\n");
  }
  if (id === "jsonschema") {
    const value = parseJson(input) as { schema?: Record<string, unknown>; data?: unknown };
    if (!value.schema || !("data" in value)) inputError("缺少 schema 或 data 字段。", { suggestion: "输入包含 schema 和 data 的 JSON 对象。" });
    const errors = validateSchema(value.schema, value.data);
    return errors.length ? `校验未通过（${errors.length} 项）\n${errors.map((x, i) => `${i + 1}. ${x}`).join("\n")}` : "校验通过：数据符合 Schema。";
  }
  if (id === "yamlformat") {
    const { parse, stringify } = await import("yaml");
    return stringify(parse(input), { indent: 2 });
  }
  if (id === "xmlformat") {
    const { XMLBuilder, XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: true, trimValues: true });
    return new XMLBuilder({ ignoreAttributes: false, format: true }).build(parser.parse(input));
  }
  if (id === "webformat") {
    const parser = action === "html" ? "html" : action === "css" ? "css" : "babel";
    const prettier = await import("prettier/standalone");
    const plugins = parser === "html" ? [await import("prettier/plugins/html")] : parser === "css" ? [await import("prettier/plugins/postcss")] : [await import("prettier/plugins/babel"), await import("prettier/plugins/estree")];
    return prettier.format(input, { parser, plugins, printWidth: 100 });
  }
  if (id === "propertiesyaml") {
    const { parse, stringify } = await import("yaml");
    if (action === "properties") {
      const value = parse(input) as Record<string, unknown>;
      const flatten = (object: Record<string, unknown>, prefix = ""): string[] => Object.entries(object).flatMap(([key, child]) => child && typeof child === "object" && !Array.isArray(child) ? flatten(child as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}=${String(child)}`]);
      return flatten(value).join("\n");
    }
    const root: Record<string, unknown> = {};
    for (const { line, lineNumber } of input.split(/\r?\n/).map((line, index) => ({ line, lineNumber: index + 1 })).filter(({ line }) => line.trim() && !line.trim().startsWith("#"))) {
      const index = line.indexOf("="); if (index < 0) inputError("Properties 行缺少等号。", { line: lineNumber, column: line.length + 1, suggestion: "使用 key=value 格式。" });
      const keys = line.slice(0, index).trim().split("."); let target = root;
      keys.forEach((key, i) => { if (i === keys.length - 1) target[key] = line.slice(index + 1).trim(); else target = target[key] = (target[key] as Record<string, unknown>) ?? {}; });
    }
    return stringify(root);
  }
  if (id === "findreplace") { const { config, text } = splitConfig(input); return text.split(config["查找"] ?? "").join(config["替换"] ?? ""); }
  if (id === "linefilter") {
    const { config, text } = splitConfig(input); const include = config["包含"] ?? "", exclude = config["排除"] ?? "";
    return text.split(/\r?\n/).filter(line => (!include || line.includes(include)) && (!exclude || !line.includes(exclude))).join("\n");
  }
  if (id === "shuffle") {
    const lines = input.split(/\r?\n/); crypto.getRandomValues(new Uint32Array(lines.length)).forEach((value, index) => { const target = index + value % (lines.length - index); [lines[index], lines[target]] = [lines[target], lines[index]]; }); return lines.join("\n");
  }
  if (id === "mdtable") {
    const Papa = (await import("papaparse")).default;
    const parsed = Papa.parse<string[]>(input, { skipEmptyLines: true }); if (parsed.errors.length || !parsed.data.length) inputError("CSV 数据无效。", { line: (parsed.errors[0]?.row ?? 0) + 1, suggestion: "检查表头、引号和分隔符。" });
    const [head, ...rows] = parsed.data; return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map(row => `| ${row.join(" | ")} |`)].join("\n");
  }
  if (id === "markdown") {
    const { marked } = await import("marked");
    return marked.parse(input, { gfm: true, breaks: true }) as string;
  }
  return null;
}
