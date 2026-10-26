import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contrato entre el cliente TypeScript y el servidor Java del plugin: toda ruta
 * que el cliente llama tiene que estar registrada en BridgeServer.java. Si no,
 * la llamada devuelve 404 solo cuando Studio esta abierto, y es facil no verlo.
 */

const ROOT = join(import.meta.dir, "..", "..");
const JAVA_SERVER = join(
  ROOT,
  "talend-studio-bridge",
  "com.andres.talend.bridge",
  "src",
  "com",
  "andres",
  "talend",
  "bridge",
  "BridgeServer.java",
);
const CLIENT_DIR = join(ROOT, "src", "modules", "studio-bridge", "adapters");

/** Rutas que registra la tabla de `registerRoutes()` (route, worker, ui y sus variantes). */
function javaRoutes(): string[] {
  const source = readFileSync(JAVA_SERVER, "utf8");
  return [...source.matchAll(/^\s+(?:route|worker|workerBody|ui|uiBody)\(\s*"(\/[^"]+)"/gm)].map((match) => match[1]!);
}

/** Rutas que llama el cliente con `this.request(...)`, sin query string. */
function clientRoutes(): string[] {
  const routes = new Set<string>();
  for (const file of readdirSync(CLIENT_DIR).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(join(CLIENT_DIR, file), "utf8");
    for (const match of source.matchAll(/this\.request(?:<[^>]*>)?\(\s*[`"](\/[^`"?$]*)/g)) {
      routes.add(match[1]!);
    }
  }
  return [...routes].sort();
}

describe("contrato de rutas del bridge", () => {
  test("el cliente TypeScript solo llama rutas que el servidor Java registra", () => {
    const served = new Set(javaRoutes());

    const missing = clientRoutes().filter((route) => !served.has(route));

    expect(missing).toEqual([]);
  });

  test("ninguna ruta se registra dos veces (HttpServer rechaza contextos repetidos)", () => {
    const routes = javaRoutes();

    expect(new Set(routes).size).toBe(routes.length);
  });

  test("el CLI de la API de Talend solo llama rutas que el servidor registra", () => {
    const source = readFileSync(join(ROOT, "scripts", "talend-api.ts"), "utf8");
    const routes = [...source.matchAll(/(\/talend\/[a-z/-]+)/g)].map((match) => match[1]!);
    const served = new Set(javaRoutes());

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => !served.has(route))).toEqual([]);
  });

  test("el lector de rutas encuentra la tabla completa", () => {
    // Guardia: si cambia el formato de la tabla y el parser deja de verla, el
    // contrato anterior pasaria en vacio.
    expect(javaRoutes().length).toBeGreaterThanOrEqual(60);
    expect(clientRoutes().length).toBeGreaterThanOrEqual(10);
    expect(javaRoutes()).toContain("/ping");
    expect(javaRoutes()).toContain("/logs/tail");
  });
});
