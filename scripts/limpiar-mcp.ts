/**
 * Limpia los jobs de prueba que deja el MCP en el proyecto de Talend.
 *
 * El arnes de escenarios (L5) y la medicion de cobertura (L4) crean jobs
 * `MCP_*` en el proyecto del usuario. Con el tiempo se acumulan, asi que este
 * script los borra: usa la API de Studio (que cierra los editores y limpia el
 * proyecto Maven) y despues quita las carpetas vacias y los proyectos Maven
 * que se quedan huerfanos.
 *
 * ```
 * bun run scripts/limpiar-mcp.ts            # borra los MCP_*
 * bun run scripts/limpiar-mcp.ts --simular  # solo lista lo que borraria
 * ```
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { createBridgeClient } from "../src/modules/studio-bridge/adapters/http-studio-bridge.client";
import { TalendJobRepository } from "../src/modules/jobs/adapters/talend-job.repository";
import { getConfiguredProjectPath } from "../src/talend/workspace";

const PREFIJO = "MCP";
const simular = process.argv.includes("--simular");

const repositorio = new TalendJobRepository();
const bridge = await createBridgeClient({ config: { timeoutMs: 120000 } });
const proyecto = getConfiguredProjectPath();
if (!proyecto) {
  console.error("No se sabe cual es el proyecto de Talend (TALEND_PROJECT).");
  process.exit(1);
}

const jobs = await repositorio.list();
const dePrueba = jobs.filter((job) => job.name.toUpperCase().startsWith(PREFIJO));
console.log(`Jobs ${PREFIJO}* en el proyecto: ${dePrueba.length}`);
for (const job of dePrueba) {
  console.log(`  ${job.name} (${job.path})`);
}
if (simular) {
  process.exit(0);
}

for (const job of dePrueba) {
  const borrado = await bridge.deleteJob({ name: job.name });
  if (!borrado.ok) {
    console.error(`  No se pudo borrar ${job.name}: ${borrado.error?.message ?? "error desconocido"}`);
    continue;
  }
  console.log(`  Borrado ${job.name}`);
}

// Las carpetas vacias que dejan los jobs, dentro de `process`.
const processDir = join(proyecto, "process");
if (existsSync(processDir)) {
  for (const carpeta of readdirSync(processDir)) {
    const ruta = join(processDir, carpeta);
    if (!statSync(ruta).isDirectory()) continue;
    if (readdirSync(ruta).length === 0) {
      rmSync(ruta, { recursive: true, force: true });
      console.log(`  Carpeta vacia fuera: ${carpeta}`);
    }
  }
}

// Los proyectos Maven huerfanos: los de los jobs que no existen.
const poms = join(proyecto, "poms", "jobs", "process");
if (existsSync(poms)) {
  const nombres = new Set(jobs.map((job) => job.name.toLowerCase()));
  for (const carpeta of readdirSync(poms)) {
    const ruta = join(poms, carpeta);
    if (!statSync(ruta).isDirectory()) continue;
    if (nombres.has(carpeta.toLowerCase())) continue;
    rmSync(ruta, { recursive: true, force: true });
    console.log(`  Proyecto Maven huerfano fuera: ${carpeta}`);
  }
}

console.log("Listo.");
