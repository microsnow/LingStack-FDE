export type ToolErrorDetails = {
  line?: number;
  column?: number;
  suggestion?: string;
};

export class ToolInputError extends Error {
  readonly line?: number;
  readonly column?: number;
  readonly suggestion?: string;

  constructor(message: string, details: ToolErrorDetails = {}) {
    super(message);
    this.name = "ToolInputError";
    this.line = details.line;
    this.column = details.column;
    this.suggestion = details.suggestion;
  }
}

export function inputError(message: string, details: ToolErrorDetails = {}): never {
  throw new ToolInputError(message, details);
}

export function formatToolError(error: unknown): string {
  if (!(error instanceof Error)) return "处理失败，请检查输入。";
  if (!(error instanceof ToolInputError))
    return `${error.message}\n建议：请检查输入格式和必填字段后重试。`;

  const location = error.line
    ? `第 ${error.line} 行${error.column ? `，第 ${error.column} 列` : ""}：`
    : "";
  const suggestion = error.suggestion ? `\n建议：${error.suggestion}` : "";
  return `${location}${error.message}${suggestion}`;
}

export function locateOffset(value: string, offset: number): Pick<ToolErrorDetails, "line" | "column"> {
  const before = value.slice(0, Math.max(0, offset));
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON 语法无效";
    const offsetText = message.match(/position\s+(\d+)/i)?.[1];
    const unexpectedToken = message.match(/Unexpected token '([^']+)'/i)?.[1];
    const offset = offsetText
      ? Number(offsetText)
      : unexpectedToken
        ? value.lastIndexOf(unexpectedToken)
        : /end of JSON/i.test(message)
          ? value.length
          : -1;
    const location = offset >= 0 ? locateOffset(value, offset) : {};
    inputError("JSON 解析失败。", {
      ...location,
      suggestion: "检查该位置附近是否缺少引号、逗号、冒号或闭合括号。",
    });
  }
}
