import { rm } from "fs/promises";
import { existsSync } from "node:fs";
import { $ } from "bun";

const targets = [".talend-mcp/runs", "apps-ui/dist"];

async function main() {
  for (const target of targets) {
    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true });
      console.log(`Deleted ${target}`);
    }
  }

  const targetDirs = await $`find talend-studio-bridge -type d -name target 2>/dev/null`.text();
  const dirs = targetDirs.trim().split("\n").filter(Boolean);
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
    console.log(`Deleted ${dir}`);
  }
  console.log(`Deleted ${dirs.length} target directories`);
}

main();