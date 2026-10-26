import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";

import { nombresCambiadosDesde } from "../../scripts/l5/scenario-filters";
import type { Escenario } from "../../scripts/l5/scenario-types";

const repo = mkdtempSync(join(tmpdir(), "talend-l5-cambios-"));
afterAll(() => rmSync(repo, { recursive: true, force: true }));

function git(...args: string[]): void {
  execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

function escenario(nombre: string, job: string): Escenario {
  return { nombre, job, nodos: [{ type: "tLogRow", nombre: "salida" }], conexiones: [] };
}

function escribir(ruta: string, contenido: unknown): void {
  mkdirSync(join(repo, "fixtures"), { recursive: true });
  writeFileSync(join(repo, ruta), `${JSON.stringify(contenido, null, 2)}\n`, "utf8");
}

describe("escenarios cambiados desde una referencia", () => {
  test("detecta el archivo modificado y el nuevo, y deja quieto el resto", () => {
    escribir("fixtures/a.json", escenario("a: original", "Job_A"));
    escribir("fixtures/b.json", escenario("b: sin cambios", "Job_B"));

    git("init");
    git("add", "-A");
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "base");

    escribir("fixtures/a.json", escenario("a: original", "Job_A_modificado"));
    escribir("fixtures/c.json", escenario("c: nuevo", "Job_C"));

    const cambiados = nombresCambiadosDesde(
      "HEAD",
      [
        { path: "fixtures/a.json", scenario: escenario("a: original", "Job_A_modificado") },
        { path: "fixtures/b.json", scenario: escenario("b: sin cambios", "Job_B") },
        { path: "fixtures/c.json", scenario: escenario("c: nuevo", "Job_C") },
      ],
      { cwd: repo, root: "fixtures" },
    );

    expect([...cambiados].sort()).toEqual(["a: original", "c: nuevo"]);
  });

  test("una referencia inexistente falla con el nombre de la carpeta", () => {
    expect(() => nombresCambiadosDesde("no-existe", [], { cwd: repo, root: "fixtures" })).toThrow(
      "No se pudo leer fixtures en 'no-existe'",
    );
  });
});
