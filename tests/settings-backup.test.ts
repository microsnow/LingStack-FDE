import assert from "node:assert/strict";
import test from "node:test";
import { createAsset } from "../lib/smart-assets";
import { parseSettingsBackup, restorePreferences, serializeSettingsBackup } from "../lib/settings-backup";

test("round-trips whitelisted settings and smart assets", () => {
  const asset = createAsset("prompt", "2026-01-01T00:00:00.000Z", "one");
  const serialized = serializeSettingsBackup({ "devkit-theme": "dark", secret: "must-not-export" }, [asset], "2026-01-02T00:00:00.000Z");
  const backup = parseSettingsBackup(serialized);
  assert.deepEqual(backup.preferences, { "devkit-theme": "dark" });
  assert.deepEqual(backup.assets, [asset]);
});

test("restores only approved preference keys", () => {
  const restored = new Map<string, string>();
  restorePreferences({ setItem: (key, value) => void restored.set(key, value) }, { "devkit-theme": "light", unknown: "ignored" });
  assert.deepEqual([...restored], [["devkit-theme", "light"]]);
});

test("rejects unknown or malformed backup files", () => {
  assert.throws(() => parseSettingsBackup("invalid"), /不是有效的 JSON/);
  assert.throws(() => parseSettingsBackup('{"format":"unknown"}'), /不是受支持/);
});
