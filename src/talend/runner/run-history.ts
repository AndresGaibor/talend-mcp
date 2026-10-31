import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { open, stat } from "node:fs/promises";
import { TalendMcpEnvSchema } from "../../config/env";
import { getRunsDir } from "./exported-job/run-paths";

/**
 * Cuantas ejecuciones se conservan.
 *
 * Se lee aparte del resto del entorno: si otra variable esta mal formada,
 * guardar una ejecucion no debe fallar por eso.
 */
function maxRuns(): number {
  const parseado = TalendMcpEnvSchema.safeParse(process.env);
  const env = parseado.success ? parseado.data : TalendMcpEnvSchema.parse({});
  return env.TALEND_MCP_MAX_RUNS;
}

export interface RunHistoryEntry {
  runId: string;
  jobName: string;
  scriptPath: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "error" | "timeout" | "killed";
  exitCode?: number | null;
  durationMs?: number;
  stdoutPath: string;
  stderrPath: string;
  metadataPath: string;
}

export interface RunIndex {
  runs: RunHistoryEntry[];
}

function getIndexPath(): string {
  return join(getRunsDir(), "index.json");
}

async function readIndex(): Promise<RunIndex> {
  const indexPath = getIndexPath();
  try {
    const content = await Bun.file(indexPath).text();
    return JSON.parse(content) as RunIndex;
  } catch {
    return { runs: [] };
  }
}

async function writeIndex(index: RunIndex): Promise<void> {
  const indexPath = getIndexPath();
  mkdirSync(getRunsDir(), { recursive: true });
  await Bun.write(indexPath, JSON.stringify(index, null, 2));
}

/**
 * Serializa las escrituras del indice.
 *
 * Dos ejecuciones que terminan a la vez hacen leer-modificar-escribir sobre el
 * mismo `index.json`: sin cola, la segunda pisa la entrada de la primera.
 */
let colaDeEscritura: Promise<unknown> = Promise.resolve();

function enSerie<T>(fn: () => Promise<T>): Promise<T> {
  const siguiente = colaDeEscritura.then(fn, fn);
  colaDeEscritura = siguiente.catch(() => undefined);
  return siguiente;
}

/** Archivos que pertenecen a una ejecucion. */
function archivosDeRun(run: RunHistoryEntry): string[] {
  return [
    run.stdoutPath,
    run.stderrPath,
    run.metadataPath,
    join(getRunsDir(), `${run.runId}.log`),
  ];
}

/**
 * Borra las ejecuciones mas antiguas que el tope.
 *
 * Cada ejecucion deja tres archivos (stdout, stderr y log) mas su metadata;
 * sin retencion `.talend-mcp/runs` crece sin limite durante toda la vida del
 * proyecto. Se conservan las mas recientes, que son las que se consultan.
 */
function pruneRuns(index: RunIndex, max: number): boolean {
  if (index.runs.length <= max) return false;

  const ordenados = [...index.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const conservar = new Set(ordenados.slice(0, max).map((run) => run.runId));
  const descartar = index.runs.filter((run) => !conservar.has(run.runId));

  for (const run of descartar) {
    for (const archivo of archivosDeRun(run)) {
      try {
        unlinkSync(archivo);
      } catch {
        // El archivo puede no existir o estar en uso: no se interrumpe la limpieza.
      }
    }
  }

  index.runs = ordenados.slice(0, max);
  return true;
}

/**
 * Borra restos de ejecuciones que nunca llegaron al indice.
 *
 * Si el proceso muere entre escribir los logs y guardar la entrada, quedan
 * archivos sueltos que nadie consulta. Se borran solo los que llevan dias
 * parados, para no tocar una ejecucion recien terminada.
 */
function pruneOrphans(index: RunIndex): void {
  const conocidos = new Set(index.runs.map((run) => run.runId));
  const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const patron = /\.(stdout|stderr)\.log$|\.log$|\.meta\.json$/;
  const dir = getRunsDir();
  let nombres: string[];
  try {
    nombres = readdirSync(dir);
  } catch {
    return;
  }
  for (const nombre of nombres) {
    if (!patron.test(nombre)) continue;
    const runId = nombre.replace(/\.(stdout|stderr)\.log$/, "").replace(/\.log$/, "").replace(/\.meta\.json$/, "");
    if (conocidos.has(runId)) continue;
    const ruta = join(dir, nombre);
    try {
      if (statSync(ruta).mtimeMs < limite) unlinkSync(ruta);
    } catch {
      // Archivo en uso o ya borrado: se deja para la proxima.
    }
  }
}

export async function saveRun(entry: Omit<RunHistoryEntry, "metadataPath">): Promise<void> {
  return enSerie(async () => {
    const index = await readIndex();
    const metadataPath = join(getRunsDir(), `${entry.runId}.meta.json`);
    const fullEntry: RunHistoryEntry = { ...entry, metadataPath };

    const existingIndex = index.runs.findIndex((r) => r.runId === entry.runId);
    if (existingIndex >= 0) {
      index.runs[existingIndex] = fullEntry;
    } else {
      index.runs.push(fullEntry);
    }

    pruneRuns(index, maxRuns());
    pruneOrphans(index);
    await writeIndex(index);

    const meta = {
      runId: entry.runId,
      jobName: entry.jobName,
      scriptPath: entry.scriptPath,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      status: entry.status,
      exitCode: entry.exitCode,
      durationMs: entry.durationMs,
    };
    await Bun.write(metadataPath, JSON.stringify(meta, null, 2));
  });
}

export async function listRuns(options?: {
  jobName?: string;
  limit?: number;
}): Promise<RunHistoryEntry[]> {
  const index = await readIndex();
  let runs = index.runs;

  if (options?.jobName) {
    runs = runs.filter((r) => r.jobName === options.jobName);
  }

  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  if (options?.limit && options.limit > 0) {
    runs = runs.slice(0, options.limit);
  }

  return runs;
}

export async function readRun(runId: string): Promise<RunHistoryEntry | null> {
  const index = await readIndex();
  return index.runs.find((r) => r.runId === runId) ?? null;
}

/**
 * Cuantos bytes se leen del final de un log para mostrar sus ultimas lineas.
 *
 * Leer el archivo entero para enseñar 50 lineas mete en memoria un log de
 * cientos de MB que el propio MCP acaba de escribir. Se estima por el ancho de
 * una linea y se lee solo la cola, como hace `LogTailService` en el bridge.
 */
const BYTES_POR_LINEA = 400;
const BYTES_MINIMOS_COLA = 8_192;

/** Ultimos bytes de un archivo, sin cargarlo entero. `recortado` marca que se dejo el principio. */
async function leerCola(ruta: string, maxBytes: number): Promise<{ texto: string; recortado: boolean }> {
  const { size } = await stat(ruta);
  const desde = Math.max(0, size - maxBytes);
  if (desde === 0) {
    return { texto: await Bun.file(ruta).text(), recortado: false };
  }
  const handle = await open(ruta, "r");
  try {
    const buffer = Buffer.alloc(size - desde);
    await handle.read(buffer, 0, buffer.length, desde);
    return { texto: buffer.toString("utf8"), recortado: true };
  } finally {
    await handle.close();
  }
}

/** Ultimas `maxLineas` lineas de un texto; si se leyo solo la cola, la primera linea puede estar partida. */
function ultimasLineas(texto: string, maxLineas: number, descartarPrimera: boolean): string {
  const lineas = texto.split("\n");
  if (descartarPrimera) lineas.shift();
  return lineas.slice(-maxLineas).join("\n");
}

export async function tailRunOutput(options: {
  runId: string;
  stream: "stdout" | "stderr" | "both";
  maxLines?: number;
}): Promise<{ stdout?: string; stderr?: string; error?: string }> {
  const entry = await readRun(options.runId);
  if (!entry) {
    return { error: `Run no encontrado: ${options.runId}` };
  }

  const result: { stdout?: string; stderr?: string } = {};
  const maxLines = options.maxLines ?? 50;
  const maxBytes = Math.max(BYTES_MINIMOS_COLA, Math.min(maxLines, 5_000) * BYTES_POR_LINEA);

  if (options.stream === "stdout" || options.stream === "both") {
    try {
      const cola = await leerCola(entry.stdoutPath, maxBytes);
      result.stdout = ultimasLineas(cola.texto, maxLines, cola.recortado);
    } catch (err) {
      result.stdout = `Error leyendo stdout: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (options.stream === "stderr" || options.stream === "both") {
    try {
      const cola = await leerCola(entry.stderrPath, maxBytes);
      result.stderr = ultimasLineas(cola.texto, maxLines, cola.recortado);
    } catch (err) {
      result.stderr = `Error leyendo stderr: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return result;
}
