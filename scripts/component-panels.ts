/**
 * Genera el snapshot de los paneles de Talend Studio (etiquetas visibles, orden de filas y grupo).
 *
 * ```
 * bun run panels:build
 * bun run panels:build -- --out <ruta> --studio-home <ruta> --scope <json> [--scope <json> ...]
 * ```
 *
 *   --out          fichero de salida. Por defecto ../../rules/talend/component-panels.json (raiz del portal).
 *   --studio-home  carpeta `studio` de Talend. Si falta, usa TALEND_STUDIO_HOME o la deteccion habitual.
 *   --scope        JSON de alcance (repetible). Por defecto, migration-candidate-scope.json y
 *                  mappings/talend-components.json del portal. Se toman todos los nombres `t[A-Z]...`.
 *
 * Ademas de esos nombres, incluye siempre la lista fija de `SIEMPRE_INCLUIDOS`.
 * Solo lee la instalacion de Studio: no hace falta tenerlo abierto.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { resolveTalendStudioHome } from "../src/talend/components/talend-paths";
import { DefinitionIndexRepository, elegirDefinicion } from "../src/modules/component-definitions/infrastructure/definition-index.repository";
import {
  SIEMPRE_INCLUIDOS,
  buildComponentPanelsSnapshot,
  collectComponentNames,
} from "../src/modules/component-definitions/application/component-panels";

/** Raiz de este MCP (mcp/talend-mcp) y del portal, relativas a este script. */
const MCP_ROOT = resolve(import.meta.dir, "..");
const PORTAL_RULES = resolve(MCP_ROOT, "..", "..", "rules");
const DEFAULT_OUT = join(PORTAL_RULES, "talend", "component-panels.json");
const DEFAULT_SCOPES = [
  join(PORTAL_RULES, "talend", "migration-candidate-scope.json"),
  join(PORTAL_RULES, "mappings", "talend-components.json"),
];

type Args = { out: string; studioHome?: string; scopes: string[] };

function parseArgs(argv: string[]): Args {
  const args: Args = { out: DEFAULT_OUT, scopes: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--out" && value) {
      args.out = resolve(value);
      i++;
    } else if (flag === "--studio-home" && value) {
      args.studioHome = resolve(value);
      i++;
    } else if (flag === "--scope" && value) {
      args.scopes.push(resolve(value));
      i++;
    } else {
      throw new Error(`Argumento no reconocido o sin valor: ${flag ?? ""}`);
    }
  }
  if (args.scopes.length === 0) args.scopes = DEFAULT_SCOPES;
  return args;
}

/** Version de Studio a partir de la ruta (`...\8.0.1\studio`), o de TALEND_STUDIO_VERSION. */
function studioVersionOf(studioHome: string): string {
  const fromPath = studioHome.match(/\d+\.\d+\.\d+/);
  return fromPath?.[0] ?? process.env.TALEND_STUDIO_VERSION ?? "desconocida";
}

function namesFromScopes(scopes: string[]): Set<string> {
  const names = new Set<string>(SIEMPRE_INCLUIDOS);
  for (const scope of scopes) {
    if (!existsSync(scope)) {
      console.warn(`Aviso: no existe el alcance ${scope}; se omite.`);
      continue;
    }
    collectComponentNames(JSON.parse(readFileSync(scope, "utf8")), names);
  }
  return names;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const studioHome = args.studioHome ?? resolveTalendStudioHome() ?? undefined;
  if (!studioHome || !existsSync(studioHome)) {
    throw new Error("No se encuentra Talend Studio. Pasa --studio-home <carpeta studio> o define TALEND_STUDIO_HOME.");
  }

  const repository = new DefinitionIndexRepository({ pluginsDir: join(studioHome, "plugins") });
  const index = repository.scan();
  const names = namesFromScopes(args.scopes);

  const { snapshot, missing } = buildComponentPanelsSnapshot({
    studioVersion: studioVersionOf(studioHome),
    names: [...names],
    find: (name) =>
      elegirDefinicion(index.components.filter((component) => component.name === name)),
  });

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  const found = Object.keys(snapshot.components).length;
  console.log(`Snapshot: ${args.out}`);
  console.log(`Componentes en el snapshot: ${found} de ${names.size} pedidos.`);
  if (missing.length > 0) {
    console.log(`No encontrados en Studio (${missing.length}): ${missing.join(", ")}`);
  }
}

main();
