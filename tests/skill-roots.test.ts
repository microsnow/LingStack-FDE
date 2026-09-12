import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addSkillRoot, listSkillRoots, removeSkillRoot, updateSkillRoot } from "../desktop/skill-roots.mjs";

test("starts empty and persists only user-added skill roots", async () => {
  const base = await mkdtemp(join(tmpdir(), "fde-roots-"));
  const home = join(base, "home"); const userData = join(base, "data"); const customDirectory = join(base, "team-skills");
  try {
    await mkdir(customDirectory, { recursive: true });
    assert.deepEqual(await listSkillRoots(home, userData), []);
    const custom = await addSkillRoot(home, userData, customDirectory);
    await updateSkillRoot(home, userData, custom.id, { enabled: false, label: "Team Skills", maxDepth: 7 });
    const roots = await listSkillRoots(home, userData);
    assert.equal(roots.length, 1);
    assert.equal(roots[0]?.enabled, false);
    assert.equal(roots[0]?.label, "Team Skills");
    assert.equal(roots[0]?.maxDepth, 7);
    assert.equal(roots.find(root => root.id === custom.id)?.path, customDirectory);
    await removeSkillRoot(userData, custom.id);
    assert.equal((await listSkillRoots(home, userData)).some(root => root.id === custom.id), false);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("rejects removing an unknown root", async () => {
  const base = await mkdtemp(join(tmpdir(), "fde-roots-"));
  try { await assert.rejects(() => removeSkillRoot(base, "unknown"), /不存在/); }
  finally { await rm(base, { recursive: true, force: true }); }
});
