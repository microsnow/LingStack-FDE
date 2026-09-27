import type { SmartAsset } from "./smart-assets";

export const MEDIA_PROMPT_DICTIONARY = {
  风格: ["电影感", "纪实摄影", "极简主义", "水彩插画", "3D 渲染", "复古胶片"],
  镜头: ["特写", "中景", "广角镜头", "俯拍", "浅景深", "对称构图"],
  灯光: ["柔和自然光", "黄金时刻", "轮廓光", "低调光", "体积光"],
  构图: ["三分法构图", "居中构图", "留白", "引导线", "前景层次"],
  色彩: ["暖色调", "冷色调", "低饱和度", "高对比度", "青橙色调"],
} as const;

export type MediaPromptCheck = { level: "info" | "warning"; message: string };

export function checkMediaPrompt(asset: SmartAsset): MediaPromptCheck[] {
  const media = asset.media;
  if (!media) return [];
  const checks: MediaPromptCheck[] = [];
  const config = media.capabilityProfile?.trim();
  if (config) {
    try {
      const profile = JSON.parse(config) as {
        aspectRatios?: unknown;
        maxReferences?: unknown;
        maxDurationSeconds?: unknown;
      };
      if (Array.isArray(profile.aspectRatios) && profile.aspectRatios.length &&
          !profile.aspectRatios.includes(media.aspectRatio)) {
        checks.push({ level: "warning", message: `画面比例 ${media.aspectRatio} 不在此模型配置的支持列表中` });
      }
      if (typeof profile.maxReferences === "number") {
        const count = asset.attachments?.length ?? 0;
        if (count > profile.maxReferences) checks.push({ level: "warning", message: `参考素材 ${count} 项，超过配置上限 ${profile.maxReferences} 项` });
      }
      if (typeof profile.maxDurationSeconds === "number" && media.duration) {
        const duration = Number.parseFloat(media.duration);
        if (Number.isFinite(duration) && duration > profile.maxDurationSeconds) {
          checks.push({ level: "warning", message: `时长 ${duration} 秒，超过配置上限 ${profile.maxDurationSeconds} 秒` });
        }
      }
    } catch {
      checks.push({ level: "warning", message: "模型能力配置不是有效 JSON" });
    }
  }
  const variant = media.modelVariants?.find(item => item.model.trim().toLocaleLowerCase() === media.model.trim().toLocaleLowerCase());
  if (variant?.parameters.trim()) checks.push({ level: "info", message: `已填写「${media.model}」专属参数；请按模型平台文档核对字段` });
  if (!config) checks.push({ level: "info", message: "尚未配置模型能力限制，当前仅检查提示词内容" });
  return checks;
}

export function suggestNegativePrompt(asset: SmartAsset): string[] {
  const media = asset.media;
  if (!media) return [];
  if (media.kind === "video") return ["画面闪烁", "镜头抖动", "主体形变", "不连贯动作", "字幕水印"];
  if (media.kind === "image") return ["低清晰度", "模糊", "畸变", "多余肢体", "文字水印"];
  return ["背景噪声", "爆音", "失真", "突兀截断"];
}

export function checkNegativePromptCompatibility(prompt: string, platform: string): MediaPromptCheck[] {
  if (!prompt.trim()) return [];
  const normalized = platform.toLocaleLowerCase();
  const negativeFieldPlatforms = ["stable diffusion", "sdxl", "comfyui", "automatic1111", "invokeai"];
  if (negativeFieldPlatforms.some(name => normalized.includes(name))) return [];
  return [{ level: "warning", message: `未配置「${platform || "当前"}」的独立负面提示词字段；复制时建议将负面词并入主提示词或按平台格式转换` }];
}
