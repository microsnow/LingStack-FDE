import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addAssetRoot, listAssetRoots, removeAssetRoot, scanAssetRoots } from "../desktop/asset-index.mjs";
import { createAsset, serializeAssetMarkdown, serializeAssetsYaml } from "../lib/smart-assets";

test("indexes Markdown and YAML assets without modifying source files", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "fde-asset-index-"));
  try {
    const userData = join(sandbox, "profile");
    const root = join(sandbox, "assets");
    await mkdir(root);
    const markdownPath = join(root, "one.md");
    const yamlPath = join(root, "many.yaml");
    const markdown = serializeAssetMarkdown(createAsset("prompt", "2026-01-01T00:00:00.000Z", "md-one"));
    const yaml = serializeAssetsYaml([createAsset("media-prompt", "2026-01-01T00:00:00.000Z", "yaml-one")]);
    await writeFile(markdownPath, markdown);
    await writeFile(yamlPath, yaml);
    await writeFile(join(root, "unrelated.json"), "{}");

    const roots = await addAssetRoot(userData, root);
    assert.equal((await addAssetRoot(userData, root)).length, 1, "duplicate roots are not registered twice");
    const scan = await scanAssetRoots(userData);
    assert.equal(scan.files.length, 2);
    assert.deepEqual(new Set(scan.files.map(file => file.format)), new Set(["markdown", "yaml"]));
    assert.equal(await readFile(markdownPath, "utf8"), markdown);
    assert.equal((await listAssetRoots(userData))[0].id, roots[0].id);

    await removeAssetRoot(userData, roots[0].id);
    assert.equal((await scanAssetRoots(userData)).files.length, 0);
    assert.equal(await readFile(yamlPath, "utf8"), yaml, "removing an index preserves source files");
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
