import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeSkillDocument, scanSkillRoots } from "../desktop/skill-scanner.mjs";

test("extracts WorkBuddy skill metadata from YAML frontmatter", () => {
  const result = analyzeSkillDocument(`---
name: demo-skill
description: 扫描演示技能
metadata:
  short-description: Demo
---

# Demo

Read local content only.
`);
  assert.equal(result.name, "demo-skill");
  assert.equal(result.description, "扫描演示技能");
  assert.deepEqual(result.warnings, []);
  assert.equal(result.risk, "low");
});

test("reports missing metadata without rejecting the skill", () => {
  const result = analyzeSkillDocument("# No frontmatter\n\nInstructions", "folder-name");
  assert.equal(result.name, "folder-name");
  assert.match(result.warnings.join("\n"), /frontmatter/);
  assert.match(result.warnings.join("\n"), /description/);
});

test("labels declared command, network and destructive capabilities", () => {
  const result = analyzeSkillDocument(`---
name: operations
description: Run maintenance
---

Use powershell to call https://example.com and then Remove-Item when requested.
`);
  assert.deepEqual(result.capabilities, ["网络引用", "命令执行说明", "删除操作说明"]);
  assert.equal(result.risk, "high");
});

test("reports malformed YAML frontmatter", () => {
  const result = analyzeSkillDocument("---\nname: [broken\ndescription: demo\n---\nbody", "fallback");
  assert.match(result.warnings.join("\n"), /无法解析/);
  assert.equal(result.name, "fallback");
});

test("aggregates roots and detects duplicate skill names across platforms", async () => {
  const base = await mkdtemp(join(tmpdir(), "fde-skills-"));
  try {
    const first = join(base, "codex", "shared");
    const second = join(base, "workbuddy", "shared-copy");
    await mkdir(first, { recursive: true }); await mkdir(second, { recursive: true });
    const document = "---\nname: shared-skill\ndescription: duplicate demo\n---\n\n# Demo";
    await writeFile(join(first, "SKILL.md"), document); await writeFile(join(second, "SKILL.md"), document);
    const result = await scanSkillRoots([
      { id: "codex", label: "Codex", path: join(base, "codex"), platform: "Codex", enabled: true, readOnly: true, isDefault: true, priority: 10, maxDepth: 5 },
      { id: "workbuddy", label: "WorkBuddy", path: join(base, "workbuddy"), platform: "WorkBuddy", enabled: true, readOnly: true, isDefault: true, priority: 20, maxDepth: 5 },
    ]);
    assert.equal(result.summary.total, 2); assert.equal(result.summary.duplicates, 2);
    assert.deepEqual(new Set(result.skills.map(skill => skill.platform)), new Set(["Codex", "WorkBuddy"]));
  } finally { await rm(base, { recursive: true, force: true }); }
});
