import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { duplicateDQAnalysisFiles } from "../../src/talend/dq-crud";
import { parseDQAnalysis } from "../../src/talend/dq-analysis";

const FIXTURES = join(import.meta.dir, "..", "fixtures", "talend", "dq");

describe("DQ analysis CRUD", () => {
  test("duplica un analysis con nuevo nombre y version", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "talend-dq-"));
    const projectPath = join(tempRoot, "project");
    const srcDir = FIXTURES;
    const dstDir = join(projectPath, "TDQ_Data Profiling", "Analyses");

    mkdirSync(dstDir, { recursive: true });
    copyFileSync(join(srcDir, "Basic_Column_Analysis_orders_0.1.ana"), join(dstDir, "Basic_Column_Analysis_orders_0.1.ana"));
    copyFileSync(join(srcDir, "Basic_Column_Analysis_orders_0.1.properties"), join(dstDir, "Basic_Column_Analysis_orders_0.1.properties"));

    const result = duplicateDQAnalysisFiles(projectPath, "Basic_Column_Analysis_orders", "Basic_Column_Analysis_orders_copy", {
      version: "0.2",
      purpose: "Copia de prueba",
    });

    const duplicated = parseDQAnalysis(result.anaPath);

    expect(result.anaPath).toContain("Basic_Column_Analysis_orders_copy_0.2.ana");
    expect(result.propertiesPath).toContain("Basic_Column_Analysis_orders_copy_0.2.properties");
    expect(duplicated?.name).toBe("Basic_Column_Analysis_orders_copy");
    expect(duplicated?.purpose).toBe("Copia de prueba");
    expect(duplicated?.version).toBe("0.2");

    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("falla si el analysis origen no existe", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "talend-dq-"));
    const projectPath = join(tempRoot, "project");
    mkdirSync(join(projectPath, "TDQ_Data Profiling", "Analyses"), { recursive: true });

    expect(() =>
      duplicateDQAnalysisFiles(projectPath, "no_existe", "copia"),
    ).toThrow("Analysis no encontrado");

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
