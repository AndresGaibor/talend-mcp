import { test, expect, describe } from "bun:test";
import { readdirSync } from "node:fs";

describe("no hardcoded local paths in src", () => {
  function findFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          files.push(...findFiles(fullPath));
        } else if (entry.name.endsWith(".ts")) {
          files.push(fullPath);
        }
      }
    } catch {}
    return files;
  }

  test("ningún archivo src contiene /Users/andresgaibor", async () => {
    const srcDir = new URL("../../src", import.meta.url).pathname;
    const files = findFiles(srcDir);
    const offenders: string[] = [];
    for (const file of files) {
      const content = await Bun.file(file).text();
      if (content.includes("/Users/andresgaibor")) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("ningún archivo src contiene aliware-calidad", async () => {
    const srcDir = new URL("../../src", import.meta.url).pathname;
    const files = findFiles(srcDir);
    const offenders: string[] = [];
    for (const file of files) {
      const content = await Bun.file(file).text();
      if (content.includes("aliware-calidad")) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
