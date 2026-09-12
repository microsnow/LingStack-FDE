export type AssetKind = "prompt" | "media-prompt";
export type AssetScope = "global" | "project";
export type MediaKind = "image" | "video" | "audio" | "tts";

export type PromptVariable = {
  name: string;
  value: string;
};

export type SmartAsset = {
  id: string;
  kind: AssetKind;
  name: string;
  description: string;
  category: string;
  tags: string[];
  source: "local" | "imported";
  scope: AssetScope;
  favorite: boolean;
  archived: boolean;
  version: number;
  systemPrompt: string;
  userPrompt: string;
  variables: PromptVariable[];
  media?: {
    kind: MediaKind;
    model: string;
    aspectRatio: string;
    negativePrompt: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AssetBundle = {
  format: "fde-smart-assets";
  version: 1;
  exportedAt: string;
  assets: SmartAsset[];
};

export const ASSET_STORAGE_KEY = "fde.smart-assets.v1";

const VARIABLE_PATTERN = /\{\{\s*([\w\u4e00-\u9fff.-]+)\s*\}\}/g;

export function extractTemplateVariables(...templates: string[]): string[] {
  const names = new Set<string>();
  for (const template of templates) {
    for (const match of template.matchAll(VARIABLE_PATTERN)) names.add(match[1]);
  }
  return [...names];
}

export function syncAssetVariables(asset: SmartAsset): SmartAsset {
  const current = new Map(asset.variables.map(variable => [variable.name, variable.value]));
  const names = extractTemplateVariables(asset.systemPrompt, asset.userPrompt, asset.media?.negativePrompt ?? "");
  return { ...asset, variables: names.map(name => ({ name, value: current.get(name) ?? "" })) };
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(VARIABLE_PATTERN, (_token, name: string) => values[name] ?? `{{${name}}}`);
}

export function renderAsset(asset: SmartAsset): { systemPrompt: string; userPrompt: string; negativePrompt: string } {
  const values = Object.fromEntries(asset.variables.map(variable => [variable.name, variable.value]));
  return {
    systemPrompt: renderTemplate(asset.systemPrompt, values),
    userPrompt: renderTemplate(asset.userPrompt, values),
    negativePrompt: renderTemplate(asset.media?.negativePrompt ?? "", values),
  };
}

export function createAsset(kind: AssetKind, now = new Date().toISOString(), id = crypto.randomUUID()): SmartAsset {
  const media = kind === "media-prompt" ? { kind: "image" as const, model: "通用", aspectRatio: "1:1", negativePrompt: "" } : undefined;
  return {
    id,
    kind,
    name: kind === "prompt" ? "未命名提示词" : "未命名媒体提示词",
    description: "",
    category: kind === "prompt" ? "编程开发" : "图片生成",
    tags: [],
    source: "local",
    scope: "global",
    favorite: false,
    archived: false,
    version: 1,
    systemPrompt: "",
    userPrompt: "",
    variables: [],
    media,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeAsset(value: unknown): SmartAsset | null {
  if (!value || typeof value !== "object") return null;
  const asset = value as Partial<SmartAsset>;
  if (asset.kind !== "prompt" && asset.kind !== "media-prompt") return null;
  if (typeof asset.id !== "string" || typeof asset.name !== "string") return null;
  const now = new Date().toISOString();
  return syncAssetVariables({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    description: typeof asset.description === "string" ? asset.description : "",
    category: typeof asset.category === "string" ? asset.category : "未分类",
    tags: Array.isArray(asset.tags) ? asset.tags.filter((tag): tag is string => typeof tag === "string") : [],
    source: asset.source === "imported" ? "imported" : "local",
    scope: asset.scope === "project" ? "project" : "global",
    favorite: Boolean(asset.favorite),
    archived: Boolean(asset.archived),
    version: typeof asset.version === "number" && asset.version > 0 ? asset.version : 1,
    systemPrompt: typeof asset.systemPrompt === "string" ? asset.systemPrompt : "",
    userPrompt: typeof asset.userPrompt === "string" ? asset.userPrompt : "",
    variables: Array.isArray(asset.variables)
      ? asset.variables.filter((item): item is PromptVariable => Boolean(item) && typeof item.name === "string" && typeof item.value === "string")
      : [],
    media: asset.kind === "media-prompt" ? {
      kind: ["image", "video", "audio", "tts"].includes(asset.media?.kind ?? "") ? asset.media!.kind : "image",
      model: typeof asset.media?.model === "string" ? asset.media.model : "通用",
      aspectRatio: typeof asset.media?.aspectRatio === "string" ? asset.media.aspectRatio : "1:1",
      negativePrompt: typeof asset.media?.negativePrompt === "string" ? asset.media.negativePrompt : "",
    } : undefined,
    createdAt: typeof asset.createdAt === "string" ? asset.createdAt : now,
    updatedAt: typeof asset.updatedAt === "string" ? asset.updatedAt : now,
  });
}

export function serializeAssetBundle(assets: SmartAsset[], exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ format: "fde-smart-assets", version: 1, exportedAt, assets } satisfies AssetBundle, null, 2);
}

export function parseAssetBundle(input: string): SmartAsset[] {
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { throw new Error("导入文件不是有效的 JSON"); }
  const bundle = parsed as Partial<AssetBundle>;
  if (bundle.format !== "fde-smart-assets" || bundle.version !== 1 || !Array.isArray(bundle.assets)) {
    throw new Error("不是受支持的 FDE 智能资产文件");
  }
  const assets = bundle.assets.map(normalizeAsset).filter((asset): asset is SmartAsset => Boolean(asset));
  if (!assets.length && bundle.assets.length) throw new Error("文件中没有有效的智能资产");
  return assets;
}

export function mergeAssets(current: SmartAsset[], incoming: SmartAsset[]): SmartAsset[] {
  const merged = new Map(current.map(asset => [asset.id, asset]));
  for (const asset of incoming) merged.set(asset.id, asset);
  return [...merged.values()];
}

export const defaultAssets: SmartAsset[] = [
  syncAssetVariables({
    ...createAsset("prompt", "2026-09-12T00:00:00.000Z", "fde-prompt-code-review"),
    name: "代码审查",
    description: "从正确性、安全性和可维护性审查代码。",
    category: "代码审查",
    tags: ["开发", "质量"],
    favorite: true,
    systemPrompt: "你是一名严谨的 {{语言}} 代码审查专家。",
    userPrompt: "请审查以下代码，重点关注 {{关注点}}：\n\n{{代码}}",
  }),
  syncAssetVariables({
    ...createAsset("prompt", "2026-09-12T00:00:00.000Z", "fde-prompt-error-analysis"),
    name: "错误日志分析",
    description: "分析日志并给出可验证的排查步骤。",
    category: "Bug 排查",
    tags: ["日志", "排错"],
    systemPrompt: "你是一名生产环境故障排查专家。不要忽略证据不足的地方。",
    userPrompt: "项目技术栈：{{技术栈}}\n\n请分析以下错误日志：\n{{错误日志}}",
  }),
  syncAssetVariables({
    ...createAsset("media-prompt", "2026-09-12T00:00:00.000Z", "fde-media-product-shot"),
    name: "极简产品主视觉",
    description: "生成适合产品发布页的干净主视觉。",
    category: "图片生成",
    tags: ["产品", "商业摄影"],
    favorite: true,
    userPrompt: "{{产品}} 位于 {{场景}} 中央，极简构图，柔和轮廓光，{{主色调}}，高端商业摄影。",
    media: { kind: "image", model: "通用", aspectRatio: "16:9", negativePrompt: "文字、水印、低清晰度、畸变" },
  }),
  syncAssetVariables({
    ...createAsset("media-prompt", "2026-09-12T00:00:00.000Z", "fde-media-video-shot"),
    name: "产品环绕镜头",
    description: "生成一段平滑的产品展示镜头。",
    category: "视频生成",
    tags: ["视频", "镜头"],
    userPrompt: "镜头从 {{起始角度}} 缓慢环绕 {{产品}}，背景为 {{场景}}，光线逐渐变为 {{光线变化}}，节奏平稳。",
    media: { kind: "video", model: "通用", aspectRatio: "16:9", negativePrompt: "镜头抖动、主体形变、闪烁" },
  }),
];
