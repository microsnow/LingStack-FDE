import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps Windows installer and portable artifacts distinct", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const targets = packageJson.build?.win?.target;
  assert.ok(Array.isArray(targets));
  assert.ok(targets.includes("nsis"));
  assert.ok(targets.includes("portable"));

  const setupName = packageJson.build?.nsis?.artifactName;
  const portableName = packageJson.build?.portable?.artifactName;
  assert.equal(setupName, "LingStack-FDE-Setup-${version}-${arch}.${ext}");
  assert.equal(portableName, "LingStack-FDE-Portable-${version}-${arch}.${ext}");
  assert.notEqual(setupName, portableName);
});
