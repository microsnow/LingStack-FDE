import assert from "node:assert/strict";
import test from "node:test";
import { tools } from "../lib/tool-catalog";
import { formatToolError } from "../lib/tool-errors";
import { runTool } from "../lib/tool-runner";
import { toolSamples } from "../lib/tool-samples";

test("executes a representative sample for every registered tool", async (context) => {
  for (const tool of tools) {
    await context.test(tool.id, async () => {
      const result = await runTool(tool.id, toolSamples[tool.id]);
      assert.equal(typeof result, "string");
      assert.ok(result.length > 0, `${tool.id} returned an empty representative result`);
    });
  }
});

test("handles the empty-input boundary for every registered tool", async (context) => {
  for (const tool of tools) {
    await context.test(tool.id, async () => {
      try {
        const result = await runTool(tool.id, "");
        assert.equal(typeof result, "string");
      } catch (error) {
        assert.match(formatToolError(error), /建议：/, `${tool.id} did not provide a repair suggestion`);
      }
    });
  }
});

test("reports precise locations and repair suggestions for structured input", async () => {
  await assert.rejects(
    runTool("json", '{\n  "name": "DevKit",\n  "ready": }'),
    (error) => {
      const message = formatToolError(error);
      assert.match(message, /第 3 行，第 \d+ 列/);
      assert.match(message, /建议：/);
      return true;
    },
  );

  await assert.rejects(
    runTool("propertiesyaml", "app.name=DevKit\napp.version"),
    (error) => {
      const message = formatToolError(error);
      assert.match(message, /第 2 行/);
      assert.match(message, /key=value/);
      return true;
    },
  );
});

test("rejects catalog and runner drift", async () => {
  await assert.rejects(runTool("missing-tool", "value"), /没有已注册的处理器/);
});
