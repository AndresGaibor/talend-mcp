import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  extractCandidatePathsFromLsofOutput,
  extractProjectPathFromLsofOutput,
  findProjectDirFromCandidates,
} from "../../src/talend/workspace";

const LSOF_OUTPUT = `Talend-St 16382 andresgaibor  548u      REG               1,17   9437184           116267746 /Applications/TalendStudio-8.0.1/studio/workspace/ALIWARECALIDAD/.Work_MapDB/_nYdqkF6dEfGQ0ed-VkYKHg
Talend-St 16382 andresgaibor   30r      REG               1,17       235           116155321 /Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/.git/objects/pack/pack-79bc1a46f5b8c298317e0c233203aad72a9a576e.pack`;

describe("workspace project autodetect", () => {
  describe("parseo de lsof", () => {
    test("extrae las rutas absolutas de cada línea", () => {
      const paths = extractCandidatePathsFromLsofOutput(LSOF_OUTPUT);

      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe(
        "/Applications/TalendStudio-8.0.1/studio/workspace/ALIWARECALIDAD/.Work_MapDB/_nYdqkF6dEfGQ0ed-VkYKHg",
      );
      expect(paths[1]).toBe(
        "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/.git/objects/pack/pack-79bc1a46f5b8c298317e0c233203aad72a9a576e.pack",
      );
    });

    test("ignora líneas sin ruta al final", () => {
      expect(extractCandidatePathsFromLsofOutput("Talend-St 1234 user 548u REG 1,17 9437184 116267746")).toEqual([]);
    });
  });

  describe("búsqueda del proyecto en disco", () => {
    let tempRoot: string;
    let projectDir: string;
    let emptyRoot: string;

    beforeAll(() => {
      tempRoot = mkdtempSync(join(tmpdir(), "talend-workspace-"));
      projectDir = join(tempRoot, "PROJ_GENIUS_LAB");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "talend.project"), "<project/>", "utf8");

      emptyRoot = mkdtempSync(join(tmpdir(), "talend-empty-"));
      mkdirSync(join(emptyRoot, "no-project"), { recursive: true });
    });

    afterAll(() => {
      rmSync(tempRoot, { recursive: true, force: true });
      rmSync(emptyRoot, { recursive: true, force: true });
    });

    test("detecta la carpeta del proyecto Talend a partir de una ruta interna", () => {
      const candidate = join(projectDir, "process", "job_0.1.item");
      expect(findProjectDirFromCandidates([candidate])).toBe(projectDir);
    });

    test("detecta la carpeta del proyecto cuando está un nivel más arriba", () => {
      const candidate = join(tempRoot, "PROJ_GENIUS_LAB", "process");
      expect(findProjectDirFromCandidates([candidate])).toBe(projectDir);
    });

    test("devuelve undefined si ninguna ruta pertenece a un proyecto Talend", () => {
      expect(findProjectDirFromCandidates([join(emptyRoot, "no-project", "file.txt")])).toBeUndefined();
    });

    test("extractProjectPathFromLsofOutput delega en el parser y en la búsqueda", () => {
      // El output de ejemplo apunta a rutas que no existen en esta máquina,
      // así que el resultado debe ser undefined y no lanzar.
      expect(extractProjectPathFromLsofOutput(LSOF_OUTPUT)).toBeUndefined();
    });
  });
});
