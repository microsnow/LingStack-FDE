import type { Tool } from "./tool-catalog";

const aliases: Record<string, string> = {
  json: "json 格式 化 美化 压缩 校验 validate formatter",
  base64: "编码 解码 encode decode",
  url: "网址 链接 编码 解码 urlencode urldecode",
  unicode: "字符 编码 转换",
  timestamp: "时间 日期 unix epoch",
  datecalc: "日期 差值 天数 相隔",
  timeunits: "时间 单位 秒 分钟 小时 毫秒",
  iso8601: "日期 时间 标准 格式",
  semver: "版本号 版本 比较",
  dateconvert: "日期 时间 时区 转换",
  filesize: "文件 大小 字节 kb mb gb",
  radix: "进制 二进制 八进制 十进制 十六进制",
  chinese: "中文 简体 繁体 简繁 转换",
  case: "文本 字符 大写 小写 大小写",
  ascii: "字符 编码 ascii",
  escape: "文本 字符串 转义 反转义 escape unescape",
  rmb: "人民币 金额 中文 大写",
  pinyin: "中文 汉字 拼音",
  hash: "摘要 哈希 散列 hash digest",
  text: "文本 字符串 行 查找 替换 过滤 随机 打乱 大小写",
  dedupe: "文本 行 去重 重复 唯一 distinct unique",
  sortlines: "文本 行 排序 升序 降序 sort",
  regex: "正则 表达式 regexp regular expression",
  jwt: "令牌 token json web token 解析",
  json2ts: "json typescript 类型 接口 interface",
  query: "url 网址 查询 参数 query string",
  color: "颜色 色彩 hex rgb 十六进制",
  markdown: "md 文档 预览",
  diff: "文本 比较 差异 对比 git patch",
  naming: "命名 格式 驼峰 snake kebab camel pascal",
  entities: "html 实体 编码 解码 entity",
  cron: "定时 计划 cron 表达式",
  curl: "http 请求 命令行 fetch axios",
  cidr: "ip 子网 网络 地址范围",
  units: "css 像素 px rem em 单位",
  contrast: "颜色 对比度 无障碍 可读性",
  sql: "数据库 查询 语句 格式化",
  yaml: "json yaml 转换",
  yaml2json: "yaml json 转换",
  json2xml: "json xml 转换",
  xml2json: "xml json 转换",
  json2csv: "json csv 表格 转换",
  csv2json: "csv json 表格 转换",
  jsonschema: "json schema 结构 校验 验证",
  yamlformat: "yaml 格式化 校验",
  xmlformat: "xml 格式化 校验",
  webformat: "html css javascript js 格式化 美化",
  csvpreview: "csv 表格 预览 查看",
  propertiesyaml: "java properties 配置 yaml 转换",
  findreplace: "文本替换 查找替换 文本 搜索 查找 替换 批量",
  linefilter: "文本 行 过滤 筛选 包含 排除",
  shuffle: "文本 行 随机 打乱 shuffle",
  mdtable: "markdown md 表格 table 生成",
};

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, "");
}

export function matchesToolSearch(tool: Tool, query: string): boolean {
  const terms = query.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/u).filter(term => term && !["to", "for", "the", "a", "an"].includes(term));
  if (!terms.length) return true;
  const searchable = normalize([
    tool.id,
    tool.name,
    tool.desc,
    tool.category,
    aliases[tool.id] ?? "",
  ].join(" "));
  return terms.every(term => searchable.includes(normalize(term)));
}
