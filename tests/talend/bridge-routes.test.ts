import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const bridgeServerPath = join(
  process.cwd(),
  "talend-studio-bridge",
  "com.andres.talend.bridge",
  "src",
  "com",
  "andres",
  "talend",
  "bridge",
  "BridgeServer.java",
);
const contextClientPath = join(
  process.cwd(),
  "src",
  "modules",
  "studio-bridge",
  "adapters",
  "bridge-context.client.ts",
);
const nodeClientPath = join(
  process.cwd(),
  "src",
  "modules",
  "studio-bridge",
  "adapters",
  "bridge-node.client.ts",
);
const servicePath = join(
  process.cwd(),
  "talend-studio-bridge",
  "com.andres.talend.bridge",
  "src",
  "com",
  "andres",
  "talend",
  "bridge",
  "automation",
  "JobOperationsService.java",
);
const bridgeServer = readFileSync(bridgeServerPath, "utf8");
const contextClient = readFileSync(contextClientPath, "utf8");
const nodeClient = readFileSync(nodeClientPath, "utf8");
const service = readFileSync(servicePath, "utf8");

describe("Rutas HTTP del bridge de Studio", () => {
  test("cada ruta se registra una sola vez", () => {
    const routes = [...bridgeServer.matchAll(/(?:route|ui|worker|uiBody|workerBody)\("([^"]+)"/g)].map(
      (match) => match[1]!,
    );
    const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index);

    expect(duplicates).toEqual([]);
  });

  test("el cliente y el bridge comparten la ruta para agregar variables de contexto", () => {
    const route = "/automation/job/contexts/parameters";

    expect(bridgeServer).toContain(`uiBody("${route}"`);
    expect(service).toContain("ContextOperations.addParameters(spec)");
    expect(contextClient).toContain(`request<Record<string, unknown>>("${route}"`);
  });

  test("el cliente y el bridge comparten la ruta para desconectar un enlace exacto", () => {
    const route = "/automation/nodes/disconnect";

    expect(bridgeServer).toContain(`uiBody("${route}"`);
    expect(service).toContain("NodeConnectionOperations.disconnect(spec)");
    expect(nodeClient).toContain(`request<Record<string, unknown>>("${route}"`);
  });
});
