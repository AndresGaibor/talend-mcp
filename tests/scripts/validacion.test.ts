import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { instalar } from "../../scripts/instalar-ganchos";
import {
  esCommit,
  evaluar,
  guardia,
  huellaArbol,
  registrar,
  type Estado,
} from "../../scripts/validacion";

/**
 * Repositorios Git temporales: el candado se prueba contra arboles reales, no contra mocks.
 * Nunca se toca el repositorio de trabajo ni su estado en `.talend-mcp/`.
 */

const temporales: string[] = [];

function temporal(prefijo: string): string {
  const ruta = mkdtempSync(join(tmpdir(), `talend-${prefijo}-`));
  temporales.push(ruta);
  return ruta;
}

/** Windows tarda en arrancar `git`; el candado se prueba con procesos reales, no con mocks. */
const prueba = (nombre: string, fn: () => void): void => test(nombre, fn, 30_000);

function git(repo: string, ...args: string[]): string {
  const proceso = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (proceso.status !== 0) {
    throw new Error(`git ${args.join(" ")} fallo: ${String(proceso.stderr ?? "").trim()}`);
  }
  return String(proceso.stdout ?? "").trim();
}

/** Repo con un commit inicial para que la huella tenga un commit base estable. */
function repoConCommit(): string {
  const repo = temporal("validacion-repo");
  git(repo, "init", "-q");
  writeFileSync(join(repo, "base.txt"), "inicial\n", "utf8");
  git(repo, "add", ".");
  git(
    repo,
    "-c",
    "user.email=pruebas@example.com",
    "-c",
    "user.name=Pruebas",
    "-c",
    "core.hooksPath=",
    "commit",
    "-q",
    "-m",
    "inicial",
  );
  return repo;
}

function estadoTemporal(): string {
  return temporal("validacion-estado");
}

function cerrarEnVerde(repo: string, base: string): Estado {
  const huella = huellaArbol(repo);
  for (const paso of ["typecheck", "tests", "l5"]) {
    registrar(paso, true, `${paso} ok`, { repo, base, huella });
  }
  return registrar("ci", true, "Todo verde", { repo, base, huella });
}

afterAll(() => {
  for (const ruta of temporales) rmSync(ruta, { recursive: true, force: true });
});

describe("huella del arbol", () => {
  prueba("cambia al crear o editar un archivo y vuelve al restaurarlo", () => {
    const repo = repoConCommit();
    const inicial = huellaArbol(repo);

    writeFileSync(join(repo, "nuevo.txt"), "uno\n", "utf8");
    const conArchivo = huellaArbol(repo);
    expect(conArchivo).not.toBe(inicial);

    writeFileSync(join(repo, "nuevo.txt"), "dos\n", "utf8");
    const editado = huellaArbol(repo);
    expect(editado).not.toBe(conArchivo);

    writeFileSync(join(repo, "nuevo.txt"), "uno\n", "utf8");
    expect(huellaArbol(repo)).toBe(conArchivo);

    rmSync(join(repo, "nuevo.txt"));
    expect(huellaArbol(repo)).toBe(inicial);
  });

  prueba("ignora archivos ignorados por Git", () => {
    const repo = repoConCommit();
    writeFileSync(join(repo, ".gitignore"), ".talend-mcp/\n", "utf8");
    const conIgnore = huellaArbol(repo);

    mkdirSync(join(repo, ".talend-mcp", "validacion"), { recursive: true });
    writeFileSync(join(repo, ".talend-mcp", "validacion", "estado.json"), "{}", "utf8");
    expect(huellaArbol(repo)).toBe(conIgnore);
  });
});

describe("evaluacion del commit", () => {
  prueba("sin estado registrado bloquea", () => {
    const repo = repoConCommit();
    const resultado = evaluar(repo, estadoTemporal());
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toContain("No hay ninguna validacion");
  });

  prueba("con typecheck, pruebas y L5 en verde permite", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    cerrarEnVerde(repo, base);
    const resultado = evaluar(repo, base);
    expect(resultado.permitido).toBe(true);
    expect(resultado.motivo).toContain("Cierre completo en verde");
  });

  prueba("editar despues de validar invalida la huella y bloquea", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    cerrarEnVerde(repo, base);
    expect(evaluar(repo, base).permitido).toBe(true);

    writeFileSync(join(repo, "base.txt"), "cambio posterior\n", "utf8");
    const resultado = evaluar(repo, base);
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toContain("huella no coincide");
  });

  prueba("un cierre en rojo bloquea aunque los pasos sueltos esten en verde", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    const estado = cerrarEnVerde(repo, base);
    registrar("ci", false, "Falla: tests", { repo, base, huella: estado.huella });

    const resultado = evaluar(repo, base);
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toContain("fallo");
  });

  prueba("registrar sobre otro arbol reinicia los pasos", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    cerrarEnVerde(repo, base);

    writeFileSync(join(repo, "otro.txt"), "nuevo\n", "utf8");
    registrar("typecheck", true, "typecheck ok", { repo, base });

    const resultado = evaluar(repo, base);
    expect(resultado.permitido).toBe(false);
    expect(resultado.motivo).toContain("Falta la validacion completa");
  });
});

describe("deteccion del comando git commit", () => {
  prueba("reconoce git commit como subcomando", () => {
    expect(esCommit("git commit -m 'algo'")).toBe(true);
    expect(esCommit("git -C repo commit -m algo")).toBe(true);
    expect(esCommit("bun run verify && git commit -m algo")).toBe(true);
  });

  prueba("no confunde texto citado ni otros subcomandos", () => {
    expect(esCommit("echo 'git commit'")).toBe(false);
    expect(esCommit("git status")).toBe(false);
    expect(esCommit("git log --grep commit")).toBe(false);
  });
});

describe("gancho de Claude Code", () => {
  const evento = (comando: string, tool = "Bash"): string =>
    JSON.stringify({ tool_name: tool, tool_input: { command: comando } });

  prueba("ignora herramientas que no son Bash y comandos sin commit", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    expect(guardia(evento("git commit -m x", "Read"), { repo, base }).codigo).toBe(0);
    expect(guardia(evento("git status"), { repo, base }).codigo).toBe(0);
  });

  prueba("bloquea un commit sin cierre verde", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    const resultado = guardia(evento("git commit -m x"), { repo, base });
    expect(resultado.codigo).toBe(2);
    expect(resultado.aviso).toContain("Commit bloqueado");
  });

  prueba("bloquea --no-verify aunque el cierre este en verde", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    cerrarEnVerde(repo, base);
    const resultado = guardia(evento("git commit --no-verify -m x"), { repo, base });
    expect(resultado.codigo).toBe(2);
    expect(resultado.aviso).toContain("--no-verify");
  });

  prueba("permite el cierre y el commit en el mismo comando", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    const resultado = guardia(evento("bun run verify && git commit -m x"), { repo, base });
    expect(resultado.codigo).toBe(0);
  });

  prueba("permite el commit cuando el estado esta en verde para el arbol actual", () => {
    const repo = repoConCommit();
    const base = estadoTemporal();
    cerrarEnVerde(repo, base);
    expect(guardia(evento("git commit -m x"), { repo, base }).codigo).toBe(0);
  });
});

describe("instalador del gancho", () => {
  prueba("apunta core.hooksPath a .githooks", () => {
    const repo = repoConCommit();
    mkdirSync(join(repo, ".githooks"), { recursive: true });
    writeFileSync(join(repo, ".githooks", "pre-commit"), "#!/bin/sh\nexit 0\n", "utf8");

    expect(instalar(repo)).toBe(0);
    expect(git(repo, "config", "--get", "core.hooksPath")).toBe(".githooks");
  });

  prueba("falla si el gancho versionado no existe", () => {
    const repo = repoConCommit();
    expect(instalar(repo)).toBe(1);
  });
});
