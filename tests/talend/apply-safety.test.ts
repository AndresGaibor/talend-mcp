import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveNewJobTarget, writeNewJobFiles } from "../../src/talend/studio/apply-safety";

let root: string;
afterEach(() => { if (root && existsSync(root)) rmSync(root, { recursive: true, force: true }); });

describe("resolveNewJobTarget", () => {
  test("maps Process-relative folders inside process and reserves fresh item/property files", () => {
    root = mkdtempSync(join(tmpdir(), "talend-apply-"));
    const target = resolveNewJobTarget(root, "DailyJob", "0.1", "Process/Generated", []);
    expect(target.jobDir).toBe(join(root, "process", "Generated"));
    expect(target.itemPath).toBe(join(root, "process", "Generated", "DailyJob_0.1.item"));
    expect(target.propertiesPath).toBe(join(root, "process", "Generated", "DailyJob_0.1.properties"));
  });

  test("rejects traversal and unsafe job names", () => {
    root = mkdtempSync(join(tmpdir(), "talend-apply-"));
    expect(() => resolveNewJobTarget(root, "../escape", "0.1", "Process", [])).toThrow();
    expect(() => resolveNewJobTarget(root, "DailyJob", "0.1", "Process/../../outside", [])).toThrow();
    expect(() => resolveNewJobTarget(root, "DailyJob", "../0.1", "Process", [])).toThrow();
  });

  test("rejects any matching existing job or output file without modifying it", async () => {
    root = mkdtempSync(join(tmpdir(), "talend-apply-"));
    expect(() => resolveNewJobTarget(root, "DailyJob", "0.1", "Process", ["DailyJob"])).toThrow(/already exists/i);
    const dir = join(root, "process");
    mkdirSync(dir, { recursive: true });
    const itemPath = join(dir, "DailyJob_0.1.item");
    writeFileSync(itemPath, "keep me");
    expect(() => resolveNewJobTarget(root, "DailyJob", "0.1", "Process", [])).toThrow(/already exists/i);
    expect(await Bun.file(itemPath).text()).toBe("keep me");
  });

  test("uses exclusive creation and cleans up a partial job if the second file collides", () => {
    root = mkdtempSync(join(tmpdir(), "talend-apply-"));
    const target = resolveNewJobTarget(root, "DailyJob", "0.1", "Process", []);
    mkdirSync(target.jobDir, { recursive: true });
    writeFileSync(target.propertiesPath, "keep properties");
    expect(() => writeNewJobFiles(target, "new item", "new properties")).toThrow();
    expect(existsSync(target.itemPath)).toBe(false);
    expect(readFileSync(target.propertiesPath, "utf8")).toBe("keep properties");
  });
});
