import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export const WORKBUDDY_SKILLS_ROOT = "C:\\Users\\microsnow\\.workbuddy\\skills";
const MAX_SKILLS = 500;
const MAX_DEPTH = 5;
const MAX_SKILL_BYTES = 1024 * 1024;
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", "__pycache__"]);

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function analyzeSkillDocument(content, fallbackName = "unknown-skill") {
  const warnings = [];
  let frontmatter = {};
  let body = content;
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) warnings.push("缺少 YAML frontmatter");
  else {
    body = content.slice(match[0].length);
    try {
      const parsed = parseYaml(match[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) frontmatter = parsed;
      else warnings.push("YAML frontmatter 必须是对象");
    } catch (error) {
      warnings.push(`YAML frontmatter 无法解析：${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  const name = stringValue(frontmatter.name) || fallbackName;
  const description = stringValue(frontmatter.description);
  if (!stringValue(frontmatter.name)) warnings.push("缺少 name");
  if (!description) warnings.push("缺少 description");
  if (!body.trim()) warnings.push("SKILL.md 没有正文");

  const capabilities = [];
  if (/https?:\/\//i.test(content)) capabilities.push("网络引用");
  if (/\b(exec_command|subprocess|child_process|powershell|bash|shell)\b/i.test(content)) capabilities.push("命令执行说明");
  if (/\b(rm\s+-rf|remove-item|del(?:ete)?\s+)\b/i.test(content)) capabilities.push("删除操作说明");
  if (/api[_ -]?key|access[_ -]?token|password|密码|密钥/i.test(content)) capabilities.push("敏感凭据说明");
  const risk = capabilities.includes("删除操作说明") ? "high" : capabilities.length ? "medium" : "low";

  return { name, description, warnings, capabilities, risk, body };
}

async function findSkillFiles(root, maxDepth = MAX_DEPTH) {
  const files = [];
  async function walk(directory, depth) {
    if (depth > maxDepth || files.length >= MAX_SKILLS) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= MAX_SKILLS) break;
      if (entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isFile() && entry.name.toLocaleLowerCase() === "skill.md") files.push(path);
      else if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) await walk(path, depth + 1);
    }
  }
  await walk(root, 0);
  return files;
}

async function listSkillTree(skillDirectory, maxEntries = 80) {
  const items = [];
  async function walk(directory, depth) {
    if (depth > 2 || items.length >= maxEntries) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (items.length >= maxEntries) break;
      if (entry.isSymbolicLink() || SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const path = join(directory, entry.name);
      items.push({ path: relative(skillDirectory, path).replaceAll("\\", "/"), type: entry.isDirectory() ? "directory" : "file", depth });
      if (entry.isDirectory()) await walk(path, depth + 1);
    }
  }
  await walk(skillDirectory, 0);
  return items;
}

export async function scanSkillRoot(rootConfig) {
  const resolvedRoot = resolve(rootConfig.path);
  const rootInfo = await stat(resolvedRoot);
  if (!rootInfo.isDirectory()) throw new Error("Skills 路径不是目录");
  const startedAt = Date.now();
  const skillFiles = await findSkillFiles(resolvedRoot, rootConfig.maxDepth ?? MAX_DEPTH);
  const skills = [];

  for (const skillFile of skillFiles) {
    const fileInfo = await stat(skillFile);
    if (fileInfo.size > MAX_SKILL_BYTES) {
      skills.push({ id: `${rootConfig.id}:${relative(resolvedRoot, skillFile)}`, rootId: rootConfig.id, rootLabel: rootConfig.label, platform: rootConfig.platform, name: basename(dirname(skillFile)), description: "", directory: dirname(skillFile), relativePath: relative(resolvedRoot, dirname(skillFile)).replaceAll("\\", "/"), modifiedAt: fileInfo.mtime.toISOString(), size: fileInfo.size, risk: "high", warnings: ["SKILL.md 超过 1 MB，未读取"], capabilities: [], tree: [], preview: "" });
      continue;
    }
    const content = await readFile(skillFile, "utf8");
    const analysis = analyzeSkillDocument(content, basename(dirname(skillFile)));
    const skillDirectory = dirname(skillFile);
    skills.push({
      id: `${rootConfig.id}:${relative(resolvedRoot, skillFile).replaceAll("\\", "/")}`,
      rootId: rootConfig.id,
      rootLabel: rootConfig.label,
      platform: rootConfig.platform,
      name: analysis.name,
      description: analysis.description,
      directory: skillDirectory,
      relativePath: relative(resolvedRoot, skillDirectory).replaceAll("\\", "/"),
      modifiedAt: fileInfo.mtime.toISOString(),
      size: fileInfo.size,
      risk: analysis.risk,
      warnings: analysis.warnings,
      capabilities: analysis.capabilities,
      tree: await listSkillTree(skillDirectory),
      preview: content.slice(0, 20000),
    });
  }

  skills.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));

  return {
    root: resolvedRoot,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    truncated: skillFiles.length >= MAX_SKILLS,
    skills,
    summary: {
      total: skills.length,
      valid: skills.filter(skill => skill.warnings.length === 0).length,
      warnings: skills.filter(skill => skill.warnings.length > 0).length,
      duplicates: skills.filter(skill => skill.warnings.some(warning => warning.startsWith("名称重复"))).length,
      highRisk: skills.filter(skill => skill.risk === "high").length,
    },
  };
}

function summarize(skills) {
  return {
    total: skills.length,
    valid: skills.filter(skill => skill.warnings.length === 0).length,
    warnings: skills.filter(skill => skill.warnings.length > 0).length,
    duplicates: skills.filter(skill => skill.warnings.some(warning => warning.startsWith("名称重复"))).length,
    highRisk: skills.filter(skill => skill.risk === "high").length,
  };
}

export async function scanSkillRoots(rootConfigs) {
  const startedAt = Date.now();
  const roots = [];
  const skills = [];
  for (const rootConfig of rootConfigs.filter(root => root.enabled).sort((a, b) => a.priority - b.priority)) {
    try {
      const result = await scanSkillRoot(rootConfig);
      roots.push({ ...rootConfig, available: true, count: result.skills.length, error: "" });
      skills.push(...result.skills);
    } catch (error) {
      roots.push({ ...rootConfig, available: false, count: 0, error: error instanceof Error ? error.message : "扫描失败" });
    }
  }
  const names = new Map();
  for (const skill of skills) names.set(skill.name.toLocaleLowerCase(), (names.get(skill.name.toLocaleLowerCase()) ?? 0) + 1);
  for (const skill of skills) if ((names.get(skill.name.toLocaleLowerCase()) ?? 0) > 1) skill.warnings.push(`名称重复：${skill.name}`);
  skills.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }) || a.rootLabel.localeCompare(b.rootLabel));
  return { roots, scannedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, truncated: roots.some(root => root.count >= MAX_SKILLS), skills, summary: summarize(skills) };
}

export async function scanWorkbuddySkills(root = WORKBUDDY_SKILLS_ROOT) {
  const result = await scanSkillRoot({ id: "workbuddy", label: "WorkBuddy", path: root, platform: "WorkBuddy", enabled: true, priority: 20, maxDepth: 5 });
  const names = new Map();
  for (const skill of result.skills) names.set(skill.name.toLocaleLowerCase(), (names.get(skill.name.toLocaleLowerCase()) ?? 0) + 1);
  for (const skill of result.skills) if ((names.get(skill.name.toLocaleLowerCase()) ?? 0) > 1) skill.warnings.push(`名称重复：${skill.name}`);
  return { ...result, summary: summarize(result.skills) };
}
