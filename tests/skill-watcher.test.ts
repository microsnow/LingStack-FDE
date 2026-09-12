import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { watchSkillRoots } from "../desktop/skill-watcher.mjs";

test("emits one debounced change for an enabled Skills directory", async () => {
  const base = await mkdtemp(join(tmpdir(), "fde-watch-"));
  const skillDirectory = join(base, "demo");
  await mkdir(skillDirectory, { recursive: true });
  let session: ReturnType<typeof watchSkillRoots> | undefined;
  try {
    const event = new Promise<{ rootId: string; filename: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("没有收到 Skills 文件变化事件")), 3000);
      session = watchSkillRoots([{ id: "test", label: "Test", path: base, platform: "Test", enabled: true, readOnly: true, isDefault: false, priority: 1, maxDepth: 5 }], value => { clearTimeout(timeout); resolve(value); }, 40);
    });
    assert.equal(session?.count, 1);
    await writeFile(join(skillDirectory, "SKILL.md"), "---\nname: demo\ndescription: demo\n---\n");
    const changed = await event;
    assert.equal(changed.rootId, "test"); assert.match(changed.filename.toLocaleLowerCase(), /skill\.md/);
  } finally { session?.close(); await rm(base, { recursive: true, force: true }); }
});
