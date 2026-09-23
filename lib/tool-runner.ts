import { convertChinese } from "./chinese-converter";
import { cipherRun, type CipherName } from "./cipher-tools";
import { runP0Tool } from "./p0-tools";
import { inputError, parseJson } from "./tool-errors";

export type PasswordGroupName = "numbers" | "lower" | "upper" | "symbols";
export type PinyinToneType = "symbol" | "num" | "none";
export type PinyinReadingMode = "context" | "surname" | "candidates";
export type ToolRunOptions = {
  passwordLength?: number;
  passwordCount?: number;
  passwordGroups?: Record<PasswordGroupName, boolean>;
  pinyinToneType?: PinyinToneType;
  pinyinReadingMode?: PinyinReadingMode;
};

const defaultPasswordGroups: Record<PasswordGroupName, boolean> = {
  numbers: true,
  lower: true,
  upper: true,
  symbols: true,
};

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string) {
  try {
    const binary = atob(value.trim());
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  } catch {
    inputError("Base64 内容无效。", {
      suggestion: "移除非 Base64 字符，并检查末尾的 = 填充是否完整。",
    });
  }
}

function inferType(value: unknown): string {
  if (Array.isArray(value)) return `${value.length ? inferType(value[0]) : "unknown"}[]`;
  if (value === null) return "null";
  if (typeof value === "object")
    return `{ ${Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => `${key}: ${inferType(child)}`)
      .join("; ")} }`;
  return typeof value;
}

function ipNumber(ip: string) {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => part < 0 || part > 255 || !Number.isInteger(part))
  )
    inputError("IPv4 地址无效。", {
      suggestion: "使用四段 0–255 的十进制数字，例如 192.168.1.10。",
    });
  return parts.reduce((number, part) => (number * 256 + part) >>> 0, 0) >>> 0;
}

function numberIp(number: number) {
  return [24, 16, 8, 0].map((shift) => (number >>> shift) & 255).join(".");
}

function luminance(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value))
    inputError("颜色格式无效。", {
      suggestion: "每个颜色使用 6 位 HEX，例如 #41e0c2。",
    });
  const channels = [0, 2, 4]
    .map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function crc32(value: string) {
  let crc = 0xffffffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte;
    for (let index = 0; index < 8; index++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function rmbUppercase(value: string) {
  const normalized = value.trim().replace(/[￥¥,，\s]/g, "");
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized))
    inputError("金额格式无效。", {
      suggestion: "输入非负数字且最多保留两位小数，例如 123456.78。",
    });
  const amount = Number(normalized);
  if (amount > 999999999999999.99)
    inputError("金额超过支持范围。", {
      suggestion: "请输入不超过 999999999999999.99 的金额。",
    });
  if (amount === 0) return "人民币零元整";
  const digits = "零壹贰叁肆伍陆柒捌玖";
  const units = ["仟", "佰", "拾", ""];
  let integer = Math.floor(amount);
  let text = "";
  const sections: { text: string; value: number }[] = [];
  do {
    const part = integer % 10000;
    let section = "";
    let zero = false;
    for (let index = 0, remaining = part; index < 4; index++, remaining = Math.floor(remaining / 10)) {
      const digit = remaining % 10;
      if (digit) {
        section = digits[digit] + units[3 - index] + section;
        zero = false;
      } else if (section && !zero) {
        section = "零" + section;
        zero = true;
      }
    }
    sections.unshift({ text: section.replace(/零+$/, ""), value: part });
    integer = Math.floor(integer / 10000);
  } while (integer);
  const sectionUnits = ["", "万", "亿", "万亿"];
  sections.forEach((section, index) => {
    if (!section.text) return;
    if (text && section.value < 1000 && !text.endsWith("零")) text += "零";
    text += section.text + sectionUnits[sections.length - 1 - index];
  });
  const cents = Math.round((amount - Math.floor(amount)) * 100);
  const jiao = Math.floor(cents / 10);
  const fen = cents % 10;
  return `人民币${text}元${jiao ? digits[jiao] + "角" : fen ? "零" : ""}${fen ? digits[fen] + "分" : "整"}`;
}

async function describeCron(expression: string, mode: "linux" | "spring" | "quartz") {
  const { default: cronstrue } = await import("cronstrue/i18n.js");
  const fields = expression.trim().split(/\s+/);
  const expected = mode === "linux" ? "5" : mode === "spring" ? "6" : "6 或 7";
  if (
    (mode === "linux" && fields.length !== 5) ||
    (mode === "spring" && fields.length !== 6) ||
    (mode === "quartz" && ![6, 7].includes(fields.length))
  )
    inputError(`${mode === "linux" ? "Linux" : mode === "spring" ? "Spring" : "Quartz"} 表达式字段数不正确。`, {
      line: 1,
      column: 1,
      suggestion: `该模式需要 ${expected} 个以空格分隔的字段。`,
    });
  const names =
    mode === "linux"
      ? ["分钟", "小时", "日", "月", "星期"]
      : ["秒", "分钟", "小时", "日", "月", "星期", ...(mode === "quartz" && fields.length === 7 ? ["年"] : [])];
  let meaning: string;
  try {
    meaning = cronstrue.toString(expression, {
      locale: "zh_CN",
      use24HourTimeFormat: true,
      throwExceptionOnParseError: true,
      verbose: true,
    });
  } catch {
    inputError("Cron 表达式格式无效。", {
      line: 1,
      column: 1,
      suggestion: "检查各字段的范围、问号、星号、斜杠和连字符。",
    });
  }
  const title = mode === "linux" ? "Linux Crontab" : mode === "spring" ? "Java Spring @Scheduled" : "Java Quartz CronTrigger";
  return `${title}\n含义：${meaning}\n\n字段结构：\n${fields.map((field, index) => `${names[index]}：${field}`).join("\n")}\n\n说明：实际执行时间取决于应用或服务器时区。`;
}

function secureRandomIndex(max: number) {
  const limit = 0x100000000 - (0x100000000 % max);
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value);
  while (value[0] >= limit);
  return value[0] % max;
}

function generatePassword(length: number, groups: string[]) {
  const pool = groups.join("");
  const characters = groups.slice(0, length).map((group) => group[secureRandomIndex(group.length)]);
  while (characters.length < length) characters.push(pool[secureRandomIndex(pool.length)]);
  for (let index = characters.length - 1; index > 0; index--) {
    const target = secureRandomIndex(index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join("");
}

function padDate(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`;
}

function formatLocalDateTime(date: Date) {
  return `${formatLocalDate(date)} ${padDate(date.getHours())}:${padDate(date.getMinutes())}:${padDate(date.getSeconds())}`;
}

function parseDateValue(raw: string) {
  const value = raw.trim();
  if (!value)
    inputError("日期不能为空。", { suggestion: "输入日期、ISO 8601 时间或 10/13 位时间戳。" });
  let date: Date;
  if (/^\d{10}$/.test(value)) date = new Date(Number(value) * 1000);
  else if (/^\d{13}$/.test(value)) date = new Date(Number(value));
  else {
    const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    const standard = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?)?$/);
    const parts = compact
      ? [compact[1], compact[2], compact[3], "0", "0", "0", "0"]
      : standard
        ? [standard[1], standard[2], standard[3], standard[4] ?? "0", standard[5] ?? "0", standard[6] ?? "0", standard[7] ?? "0"]
        : null;
    if (parts) {
      const [year, month, day, hour, minute, second, millisecond] = parts.map(Number);
      date = new Date(year, month - 1, day, hour, minute, second, millisecond);
      if (
        date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
        date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second
      )
        inputError(`日期“${value}”不存在。`, { suggestion: "检查月份、日期和时间各字段范围。" });
    } else date = new Date(value);
  }
  if (Number.isNaN(date.getTime()))
    inputError(`无法识别日期“${value}”。`, { suggestion: "推荐使用 YYYY-MM-DD HH:mm:ss 格式。" });
  return date;
}

function parseIso8601(raw: string) {
  const value = raw.trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?)?$/);
  if (!match)
    inputError("ISO 8601 日期时间格式无效。", { suggestion: "使用 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ssZ 格式；无时区时按本地时间解析。" });
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText ?? 0), minute = Number(minuteText ?? 0), second = Number(secondText ?? 0);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, 0);
  if (month < 1 || month > 12 || day < 1 || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59)
    inputError("ISO 8601 日期时间包含不存在的日期或时间。", { suggestion: "检查月份天数，以及小时 0–23、分钟和秒 0–59 的范围。" });
  if (zone && zone !== "Z") {
    const [offsetHour, offsetMinute] = zone.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59)
      inputError("ISO 8601 时区偏移无效。", { suggestion: "时区偏移使用 ±HH:mm 格式，例如 +08:00。" });
  }
  return parseDateValue(value);
}

type SemVer = { raw: string; major: bigint; minor: bigint; patch: bigint; prerelease: string[] };

function parseSemVer(raw: string, line: number): SemVer {
  const match = raw.match(/^[vV]?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
  if (!match)
    inputError("SemVer 版本格式无效。", { line, suggestion: "使用 MAJOR.MINOR.PATCH 格式，例如 2.1.0-beta.1+build.5；核心数字不能包含前导零。" });
  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0")))
    inputError("SemVer 数字型预发布标识不能有前导零。", { line, suggestion: "将预发布标识中的数字改为规范格式，例如 beta.1。" });
  return { raw, major: BigInt(match[1]), minor: BigInt(match[2]), patch: BigInt(match[3]), prerelease };
}

function compareSemVer(first: SemVer, second: SemVer) {
  for (const key of ["major", "minor", "patch"] as const) {
    if (first[key] !== second[key]) return first[key] > second[key] ? 1 : -1;
  }
  if (!first.prerelease.length || !second.prerelease.length)
    return first.prerelease.length === second.prerelease.length ? 0 : first.prerelease.length ? -1 : 1;
  const length = Math.max(first.prerelease.length, second.prerelease.length);
  for (let index = 0; index < length; index++) {
    const a = first.prerelease[index], b = second.prerelease[index];
    if (a === undefined || b === undefined) return a === undefined ? -1 : 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a), bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return a.length !== b.length ? a.length > b.length ? 1 : -1 : a > b ? 1 : -1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a > b ? 1 : -1;
  }
  return 0;
}

function dateDetails(date: Date) {
  return `日期：${formatLocalDate(date)}\n本地时间：${formatLocalDateTime(date)}\nISO 8601：${date.toISOString()}\n时间戳秒：${Math.floor(date.getTime() / 1000)}\n时间戳毫秒：${date.getTime()}`;
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const number = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(number) && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
  });
}

const fileSizeUnits: Record<string, number> = {
  B: 1,
  KB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  PB: 1e15,
  KIB: 1024,
  MIB: 1024 ** 2,
  GIB: 1024 ** 3,
  TIB: 1024 ** 4,
  PIB: 1024 ** 5,
};

function formatFileSize(bytes: number, base: 1000 | 1024, units: string[]) {
  let value = bytes;
  let unit = 0;
  while (value >= base && unit < units.length - 1) {
    value /= base;
    unit++;
  }
  return `${Number(value.toPrecision(6))} ${units[unit]}`;
}

export async function runTool(id: string, input: string, action = "primary", options: ToolRunOptions = {}): Promise<string> {
  const p0Result = await runP0Tool(id, input, action);
  if (p0Result !== null) return p0Result;

  if (id === "json") return action === "minify" ? JSON.stringify(parseJson(input)) : JSON.stringify(parseJson(input), null, 2);
  if (id === "base64") return action === "decode" ? decodeBase64(input) : encodeBase64(input);
  if (id === "url") {
    try {
      return action === "decode" ? decodeURIComponent(input) : encodeURIComponent(input);
    } catch {
      inputError("URL 编码内容无效。", { suggestion: "检查百分号后是否跟随两位十六进制数字。" });
    }
  }
  if (id === "unicode") {
    return action === "decode"
      ? input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      : [...input].map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
  }
  if (id === "timestamp") {
    const number = Number(input);
    const date = Number.isFinite(number) ? new Date(input.trim().length <= 10 ? number * 1000 : number) : new Date(input);
    if (Number.isNaN(date.getTime()))
      inputError("时间戳或日期无效。", { suggestion: "输入 10 位秒级时间戳、13 位毫秒时间戳或 ISO 日期。" });
    return Number.isFinite(number)
      ? `本地时间：${date.toLocaleString("zh-CN", { hour12: false })}\nISO 8601：${date.toISOString()}\n秒级时间戳：${Math.floor(date.getTime() / 1000)}\n毫秒时间戳：${date.getTime()}`
      : String(Math.floor(date.getTime() / 1000));
  }
  if (id === "datecalc") {
    const values = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (values.length !== 2)
      inputError("日期计算需要两个日期时间。", { suggestion: "每行输入一个日期时间。" });
    const start = parseDateValue(values[0]);
    const end = parseDateValue(values[1]);
    const difference = end.getTime() - start.getTime();
    const absolute = Math.abs(difference);
    const direction = difference === 0 ? "两个时间相同" : difference > 0 ? "第二个时间晚于第一个时间" : "第二个时间早于第一个时间";
    return `开始：${formatLocalDateTime(start)}\n结束：${formatLocalDateTime(end)}\n方向：${direction}\n\n相差毫秒数：${absolute}\n相差秒数：${absolute / 1000}\n相差小时数：${absolute / 3600000}\n相差天数：${absolute / 86400000}`;
  }
  if (id === "timeunits") {
    const secondsPerUnit: Record<string, number> = {
      ms: 0.001, msec: 0.001, millisecond: 0.001, milliseconds: 0.001,
      s: 1, sec: 1, second: 1, seconds: 1,
      min: 60, minute: 60, minutes: 60,
      h: 3600, hr: 3600, hour: 3600, hours: 3600,
      d: 86400, day: 86400, days: 86400,
      w: 604800, wk: 604800, week: 604800, weeks: 604800,
    };
    const values = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!values.length)
      inputError("没有可转换的时间。", { suggestion: "每行输入一个时长，例如 90 min；省略单位时按秒处理。" });
    return values.map((value, index) => {
      const match = value.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(ms|msec|milliseconds?|s|sec|seconds?|min|minutes?|h|hr|hours?|d|days?|w|wk|weeks?)?$/i);
      if (!match)
        inputError("时间格式无效。", { line: index + 1, suggestion: "输入数值及 ms、s、min、h、d 或 wk 单位；省略单位时按秒处理。" });
      const amount = Number(match[1]);
      const unit = (match[2] ?? "s").toLowerCase();
      const seconds = amount * (secondsPerUnit[unit] ?? Number.NaN);
      if (!Number.isFinite(seconds) || !Number.isFinite(seconds * 1000))
        inputError("时间超出可计算范围。", { line: index + 1, suggestion: "检查单位或减小数值后重试。" });
      const format = (number: number) => Number(number.toPrecision(8));
      return `# ${index + 1} · ${value}\n毫秒：${format(seconds * 1000)} ms\n秒：${format(seconds)} s\n分钟：${format(seconds / 60)} min\n小时：${format(seconds / 3600)} h\n天：${format(seconds / 86400)} d\n周：${format(seconds / 604800)} wk`;
    }).join("\n\n");
  }
  if (id === "iso8601") {
    const values = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!values.length)
      inputError("没有可解析的日期时间。", { suggestion: "每行输入一个 ISO 8601 日期或日期时间。" });
    return values.map((value, index) => `# ${index + 1} · ${value}\n${dateDetails(parseIso8601(value))}`).join("\n\n");
  }
  if (id === "semver") {
    const values = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (values.length !== 2)
      inputError("版本比较需要两个 SemVer 版本。", { suggestion: "每行输入一个版本，例如 1.2.0-beta.1 和 1.2.0。" });
    const first = parseSemVer(values[0], 1), second = parseSemVer(values[1], 2);
    const comparison = compareSemVer(first, second);
    const relation = comparison === 0 ? "与 B 优先级相同" : comparison > 0 ? "高于 B" : "低于 B";
    const order = comparison === 0 ? `${first.raw} ≡ ${second.raw}` : comparison > 0 ? `${second.raw} < ${first.raw}` : `${first.raw} < ${second.raw}`;
    return `版本 A：${first.raw}\n版本 B：${second.raw}\n比较结果：A ${relation}\n优先级顺序：${order}\n说明：构建元数据（+ 后内容）不影响版本优先级。`;
  }
  if (id === "dateconvert") {
    const values = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!values.length)
      inputError("没有可转换的日期。", { suggestion: "至少输入一个日期或时间戳。" });
    return values.map((value, index) => `# ${index + 1} · ${value}\n${dateDetails(parseDateValue(value))}`).join("\n\n");
  }
  if (id === "filesize") {
    const values = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!values.length)
      inputError("没有可转换的文件大小。", { suggestion: "每行输入一个数值和单位，例如 1.5 GB；省略单位时按 B 处理。" });
    return values.map((value, index) => {
      const match = value.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(B|KB|MB|GB|TB|PB|KiB|MiB|GiB|TiB|PiB)?$/i);
      if (!match)
        inputError("文件大小格式无效。", { line: index + 1, suggestion: "输入非负数值及 B、KB、MB、GB、TB、PB 或 KiB、MiB、GiB、TiB、PiB 单位。" });
      const amount = Number(match[1]);
      const unit = (match[2] ?? "B").toUpperCase();
      const bytes = amount * fileSizeUnits[unit];
      if (!Number.isFinite(bytes))
        inputError("文件大小超出可计算范围。", { line: index + 1, suggestion: "减小数值后重试。" });
      return `# ${index + 1} · ${value}\n字节数：${Number(bytes.toPrecision(15))} B\n十进制：${formatFileSize(bytes, 1000, ["B", "KB", "MB", "GB", "TB", "PB"])}\n二进制：${formatFileSize(bytes, 1024, ["B", "KiB", "MiB", "GiB", "TiB", "PiB"])}`;
    }).join("\n\n");
  }
  if (id === "radix") {
    const number = input.trim().startsWith("0x") ? parseInt(input, 16) : Number(input);
    if (!Number.isInteger(number))
      inputError("整数格式无效。", { suggestion: "输入十进制整数或以 0x 开头的十六进制整数。" });
    return `二进制：${number.toString(2)}\n八进制：${number.toString(8)}\n十进制：${number}\n十六进制：${number.toString(16).toUpperCase()}`;
  }
  if (id === "chinese") return convertChinese(input, action === "simplified");
  if (id === "case") return action === "lower" ? input.toLocaleLowerCase() : input.toLocaleUpperCase();
  if (id === "ascii") {
    if (action !== "decode") return [...input].map((character) => character.codePointAt(0)).join(" ");
    const values = input.trim().split(/[\s,，]+/).filter(Boolean);
    if (!values.length || values.some((value) => !/^\d+$/.test(value) || Number(value) > 0x10ffff))
      inputError("字符编码列表无效。", { suggestion: "使用空格或逗号分隔 0–1114111 的十进制数字。" });
    return values.map((value) => String.fromCodePoint(Number(value))).join("");
  }
  if (id === "escape") {
    if (action !== "decode") return JSON.stringify(input).slice(1, -1);
    try {
      return JSON.parse(`"${input}"`);
    } catch {
      inputError("字符串转义序列无效。", { suggestion: "检查反斜杠后是否为 n、t、r、uXXXX、引号或反斜杠。" });
    }
  }
  if (id === "rmb") return rmbUppercase(input);
  if (id === "pinyin") {
    const { convert, pinyin } = await import("pinyin-pro");
    const toneType = options.pinyinToneType ?? "symbol";
    const readingMode = options.pinyinReadingMode ?? "context";
    if (readingMode === "candidates") {
      const entries = pinyin(input, { toneType, type: "all", nonZh: "consecutive" });
      return entries.map(({ origin, pinyin: selected, polyphonic, isZh }) => {
        if (!isZh) return origin;
        const readings = [...new Set(polyphonic.map((reading) => {
          const hasNumericTone = /[0-5]$/.test(reading);
          if (toneType === "num") return hasNumericTone ? reading : convert(reading, { format: "symbolToNum" });
          if (toneType === "none") return hasNumericTone ? reading.slice(0, -1) : convert(reading, { format: "toneNone" });
          return hasNumericTone ? convert(reading, { format: "numToSymbol" }) : reading;
        }))];
        return `${origin}：${readings.length > 1 ? readings.join(" / ") : selected}`;
      }).join("\n");
    }
    return pinyin(input, {
      toneType,
      type: "string",
      nonZh: "consecutive",
      ...(readingMode === "surname" ? { mode: "surname" as const, surname: "head" as const } : {}),
    });
  }
  if (id === "hash") {
    const algorithm = action === "sha1" ? "SHA-1" : action === "sha512" ? "SHA-512" : "SHA-256";
    const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  if (id.startsWith("md5-")) {
    const { default: CryptoJS } = await import("crypto-js");
    let result = CryptoJS.MD5(input).toString();
    if (id.includes("16-")) result = result.slice(8, 24);
    return id.endsWith("upper") ? result.toUpperCase() : result;
  }
  if (["sha1", "sha2-256", "sha2-512", "ripemd-160"].includes(id)) {
    const { default: CryptoJS } = await import("crypto-js");
    const algorithms = { sha1: CryptoJS.SHA1, "sha2-256": CryptoJS.SHA256, "sha2-512": CryptoJS.SHA512, "ripemd-160": CryptoJS.RIPEMD160 };
    return algorithms[id as keyof typeof algorithms](input).toString();
  }
  if (id.startsWith("sha3-")) {
    const sha3 = await import("@noble/hashes/sha3.js");
    const algorithms = { "sha3-224": sha3.sha3_224, "sha3-256": sha3.sha3_256, "sha3-384": sha3.sha3_384, "sha3-512": sha3.sha3_512 };
    return Array.from(algorithms[id as keyof typeof algorithms](new TextEncoder().encode(input)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  if (id === "crc32-64") return crc32(input).toString(16).padStart(16, "0");
  if (/^(aes|des|tripledes|rabbit|rc4)-(encrypt|decrypt)$/.test(id)) {
    const [name, mode] = id.split("-") as [CipherName, "encrypt" | "decrypt"];
    return cipherRun(name, mode === "decrypt", input);
  }
  if (id === "uuid") {
    const count = Number(input) || 1;
    if (!Number.isInteger(count) || count < 1 || count > 100)
      inputError("UUID 数量无效。", { suggestion: "输入 1–100 之间的整数。" });
    return Array.from({ length: count }, () => crypto.randomUUID()).join("\n");
  }
  if (id === "password") {
    const definitions = { numbers: "0123456789", lower: "abcdefghijklmnopqrstuvwxyz", upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", symbols: "!@#$%^&*()_+-=[]{};:,.?/|~" };
    const enabled = options.passwordGroups ?? defaultPasswordGroups;
    const groups = Object.entries(enabled).filter(([, selected]) => selected).map(([name]) => definitions[name as PasswordGroupName]);
    const length = options.passwordLength ?? Math.min(Math.max(Number(input) || 16, 4), 128);
    const count = options.passwordCount ?? 5;
    if (!groups.length)
      inputError("没有选择字符类型。", { suggestion: "至少选择数字、小写字母、大写字母或符号中的一种。" });
    if (length < groups.length)
      inputError("密码长度小于已选择的字符类型数量。", { suggestion: `将密码长度调整为至少 ${groups.length}。` });
    if (!Number.isInteger(length) || length < 4 || length > 128 || !Number.isInteger(count) || count < 1 || count > 50)
      inputError("密码生成参数超出范围。", { suggestion: "密码长度应为 4–128，生成数量应为 1–50。" });
    return Array.from({ length: count }, () => generatePassword(length, groups)).join("\n");
  }
  if (id === "text") {
    const lines = input.split(/\r?\n/);
    const compare = (first: string, second: string) => first.localeCompare(second, "zh-CN", { numeric: true, sensitivity: "base" });
    if (action === "upper") return input.toUpperCase();
    if (action === "lower") return input.toLowerCase();
    if (action === "unique") return [...new Set(lines)].join("\n");
    if (action === "sort-asc") return [...lines].sort(compare).join("\n");
    if (action === "sort-desc") return [...lines].sort((first, second) => compare(second, first)).join("\n");
    if (action === "remove-empty") return lines.filter((line) => line.trim().length > 0).join("\n");
    if (action === "trim-start") return lines.map((line) => line.replace(/^[ \t]+/, "")).join("\n");
    if (action === "trim-end") return lines.map((line) => line.replace(/[ \t]+$/, "")).join("\n");
    return `字符数：${input.length}\n单词数：${input.trim() ? input.trim().split(/\s+/).length : 0}\n行数：${lines.length}`;
  }
  if (id === "dedupe") return [...new Set(input.split(/\r?\n/))].join("\n");
  if (id === "sortlines") {
    const compare = (first: string, second: string) => first.localeCompare(second, "zh-CN", { numeric: true, sensitivity: "base" });
    return [...input.split(/\r?\n/)].sort(action === "desc" ? (first, second) => compare(second, first) : compare).join("\n");
  }
  if (id === "regex") {
    const [pattern, ...lines] = input.split("\n");
    const match = pattern.match(/^\/(.*)\/([a-z]*)$/);
    if (!match)
      inputError("正则表达式格式无效。", { line: 1, column: 1, suggestion: "第一行使用 /pattern/flags 格式。" });
    let expression: RegExp;
    try {
      expression = new RegExp(match[1], match[2].includes("g") ? match[2] : match[2] + "g");
    } catch {
      inputError("正则表达式语法无效。", { line: 1, column: 1, suggestion: "检查括号、方括号、转义符和 flags。" });
    }
    const matches = [...lines.join("\n").matchAll(expression)];
    return matches.length ? matches.map((item, index) => `${index + 1}. "${item[0]}" · 位置 ${item.index}`).join("\n") : "没有匹配结果";
  }
  if (id === "jwt") {
    const parts = input.split(".");
    if (parts.length < 2)
      inputError("JWT 结构无效。", { suggestion: "JWT 至少应包含由句点分隔的 header 和 payload。" });
    const parsePart = (part: string, label: string) => {
      try {
        return parseJson(decodeBase64(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
      } catch {
        inputError(`JWT ${label} 无法解析。`, { suggestion: `检查 ${label} 是否为 Base64URL 编码的 JSON。` });
      }
    };
    return JSON.stringify({ header: parsePart(parts[0], "header"), payload: parsePart(parts[1], "payload"), notice: "仅解析，未验证签名" }, null, 2);
  }
  if (id === "json2ts") return `interface Root ${inferType(parseJson(input))}`;
  if (id === "query") {
    try {
      const url = new URL(input.includes("://") ? input : `https://local.dev/?${input.replace(/^\?/, "")}`);
      return JSON.stringify(Object.fromEntries(url.searchParams), null, 2);
    } catch {
      inputError("URL 或查询参数无效。", { suggestion: "输入完整 URL，或输入形如 q=devkit&page=2 的参数。" });
    }
  }
  if (id === "color") {
    if (action === "rgb" || input.trim().startsWith("#")) {
      const hex = input.trim().replace(/^#/, "");
      if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex))
        inputError("HEX 颜色无效。", { suggestion: "使用 3 位或 6 位十六进制颜色，例如 #41e0c2。" });
      const full = hex.length === 3 ? [...hex].map((value) => value + value).join("") : hex;
      return `rgb(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)})`;
    }
    const values = input.match(/-?\d+(?:\.\d+)?/g);
    if (!values || values.length !== 3 || values.some((value) => Number(value) < 0 || Number(value) > 255))
      inputError("RGB 颜色无效。", { suggestion: "输入三个 0–255 之间的数值，例如 rgb(65, 224, 194)。" });
    return "#" + values.map((value) => Math.round(Number(value)).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  if (id === "diff") {
    const [first = "", second = ""] = input.split(/^--- 对比 ---$/m);
    const before = first.trim().split("\n");
    const after = second.trim().split("\n");
    return Array.from({ length: Math.max(before.length, after.length) }, (_, index) =>
      before[index] === after[index] ? `  ${before[index] ?? ""}` : `- ${before[index] ?? ""}\n+ ${after[index] ?? ""}`,
    ).join("\n");
  }
  if (id === "naming") {
    const words = input.trim().replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_-]+/).filter(Boolean).map((word) => word.toLowerCase());
    if (!words.length)
      inputError("没有可转换的名称。", { suggestion: "输入一个或多个由空格、短横线或下划线分隔的单词。" });
    return `camelCase：${words[0] + words.slice(1).map((word) => word[0].toUpperCase() + word.slice(1)).join("")}\nPascalCase：${words.map((word) => word[0].toUpperCase() + word.slice(1)).join("")}\nsnake_case：${words.join("_")}\nkebab-case：${words.join("-")}\nCONSTANT_CASE：${words.join("_").toUpperCase()}`;
  }
  if (id === "entities") {
    if (action === "decode") return decodeEntities(input);
    return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  if (id === "cron") return describeCron(input, action === "spring" ? "spring" : action === "quartz" ? "quartz" : "linux");
  if (id === "curl") {
    const url = input.match(/https?:\/\/[^\s'\"]+/)?.[0];
    if (!url)
      inputError("Curl 命令中未找到请求 URL。", { line: 1, column: 1, suggestion: "加入以 http:// 或 https:// 开头的 URL。" });
    const method = input.match(/(?:-X|--request)\s+([A-Z]+)/i)?.[1] ?? (input.match(/(?:-d|--data)/) ? "POST" : "GET");
    const headers = Object.fromEntries([...input.matchAll(/(?:-H|--header)\s+['\"]([^:]+):\s*([^'\"]+)['\"]/g)].map((match) => [match[1], match[2]]));
    const body = input.match(/(?:-d|--data(?:-raw)?)\s+'([^']*)'/)?.[1];
    return `fetch(${JSON.stringify(url)}, ${JSON.stringify({ method: method.toUpperCase(), ...(Object.keys(headers).length ? { headers } : {}), ...(body ? { body } : {}) }, null, 2)})\n  .then(response => response.json())\n  .then(console.log);`;
  }
  if (id === "cidr") {
    const [ip, prefixText] = input.trim().split("/");
    const prefix = Number(prefixText);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32)
      inputError("CIDR 前缀长度无效。", { suggestion: "使用 0–32 的整数，例如 192.168.1.10/24。" });
    const number = ipNumber(ip);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (number & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const hosts = prefix >= 31 ? Math.pow(2, 32 - prefix) : Math.pow(2, 32 - prefix) - 2;
    return `网络地址：${numberIp(network)}\n子网掩码：${numberIp(mask)}\n广播地址：${numberIp(broadcast)}\n可用范围：${numberIp(prefix >= 31 ? network : network + 1)} — ${numberIp(prefix >= 31 ? broadcast : broadcast - 1)}\n主机数：${hosts}`;
  }
  if (id === "units") {
    const number = Number(input);
    if (!Number.isFinite(number))
      inputError("单位转换值无效。", { suggestion: "输入一个有限数值。" });
    return action === "decode" ? `${number}rem = ${number * 16}px（基准 16px）` : `${number}px = ${number / 16}rem（基准 16px）`;
  }
  if (id === "contrast") {
    const [first, second] = input.trim().split(/\s+/);
    if (!first || !second)
      inputError("需要两个 HEX 颜色。", { suggestion: "每行输入一个颜色，例如 #41e0c2 和 #091011。" });
    const firstLuminance = luminance(first);
    const secondLuminance = luminance(second);
    const ratio = (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
    return `对比度：${ratio.toFixed(2)}:1\n普通文本 AA：${ratio >= 4.5 ? "通过" : "不通过"}\n大文本 AA：${ratio >= 3 ? "通过" : "不通过"}\nAAA：${ratio >= 7 ? "通过" : "不通过"}`;
  }
  if (id === "sql") return input.replace(/\s+/g, " ").replace(/\b(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|VALUES|SET)\b/gi, "\n$1").replace(/\b(AND|OR)\b/gi, "\n  $1").trim();
  if (id === "yaml") {
    const { stringify } = await import("yaml");
    return stringify(parseJson(input));
  }

  inputError(`工具“${id}”没有已注册的处理器。`, { suggestion: "检查工具目录与执行模块是否同步。" });
}
