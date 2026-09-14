import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const npmEntry = process.env.npm_execpath;
if (!npmEntry) throw new Error("npm_execpath is unavailable; run this check through npm run release:verify");

function run(label, command, args) {
  console.log(`\n[release] ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

function runNpm(label, args) {
  run(label, process.execPath, [npmEntry, ...args]);
}

runNpm("build and automated tests", ["test"]);
runNpm("lint", ["run", "lint"]);

if (process.platform === "win32") {
  runNpm("unpacked Windows desktop build", ["run", "desktop:dir:offline"]);
  runNpm("desktop startup smoke test", ["run", "desktop:smoke"]);
  runNpm("Skills startup smoke test", ["run", "desktop:skills-smoke"]);
  const executable = join(root, "dist", "win-unpacked", "灵栈 FDE.exe");
  if (!existsSync(executable)) throw new Error(`Packaged executable not found: ${executable}`);
  run("packaged executable smoke test", executable, ["--smoke-test"]);
} else {
  console.log("\n[release] Windows desktop checks skipped on this platform");
}

console.log("\n[release] all automated release checks passed");
