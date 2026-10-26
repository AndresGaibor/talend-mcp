import * as z from "zod/v4";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";
import { compileWithDependencies } from "./compile-with-dependencies";
import { prepareStudioForJob } from "./studio-dialogs";

export const jobDiagnosticsTools = [
  {
    name: "talend_job_execute",
    description: "Ejecuta un job ya generado y devuelve su salida (las filas que imprime el tLogRow). Sirve para comprobar que el resultado es el esperado: la vista Run de Studio no se puede leer desde el MCP.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job"),
      version: z.string().optional().default("0.1").describe("Version del job"),
      context: z.string().optional().default("Default").describe("Contexto con el que se ejecuta"),
      timeoutMs: z.number().optional().describe("Tiempo maximo de espera en milisegundos"),
    }),
    handler: async ({ name, version, context, timeoutMs }: {
      name: string;
      version?: string;
      context?: string;
      timeoutMs?: number;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.executeJob({ name, version, context, timeoutMs });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/execute",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_compile",
    description: "Genera el codigo Java del job y comprueba que compila, sin ejecutarlo. Devuelve 'compiles' y, si falla, la linea y el mensaje del error (por ejemplo 'no_comillas cannot be resolved to a variable'). Es la forma de saber si una configuracion genera codigo valido antes de correr el job. Si faltan dependencias Maven las lista en 'missingArtifacts'; con installMissing:true las descarga de Maven Central y vuelve a compilar. Se bloquea con STUDIO_DIALOG_OPEN si hay un dialogo modal abierto en Studio. Tarda unos segundos y ocupa el hilo de la interfaz de Studio mientras genera, igual que un Run.",
    inputSchema: z.object({
      job: z.string().optional().describe("Job a compilar. Si se omite, el job activo"),
      installMissing: z.boolean().optional().default(false).describe("Descargar lo que falte (modulos de terceros de Studio y dependencias Maven de Maven Central) y volver a compilar"),
      ignoreDialogs: z.boolean().optional().default(false).describe("Compilar aunque haya dialogos abiertos que bloquean Studio (no recomendado)"),
    }),
    handler: async ({ job, installMissing, ignoreDialogs }: { job?: string; installMissing?: boolean; ignoreDialogs?: boolean }) => {
      const bridge = await loadBridge();

      // Un dialogo modal abierto (por ejemplo los modulos de terceros) bloquea la generacion.
      const prepared = await prepareStudioForJob(bridge, {
        ignoreDialogs: ignoreDialogs ?? false,
        installMissing: installMissing ?? false,
      });
      const dialogCheck = prepared.check;
      const autoInstalledModules = prepared.autoInstalledModules;
      if (dialogCheck.status === "unavailable" && !ignoreDialogs) {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "medium",
          endpoint: "/automation/job/compile",
          error: {
            code: "STUDIO_DIALOG_CHECK_FAILED",
            message: `No se pudo comprobar si Studio tiene dialogos abiertos (${dialogCheck.reason}). No se compila sin esa comprobacion: revisa Studio o usa ignoreDialogs:true.`,
          },
        });
      }
      if (dialogCheck.status === "blocked") {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "high",
          endpoint: "/automation/job/compile",
          data: { blocking: dialogCheck.blocking, autoInstalledModules },
          error: {
            code: "STUDIO_DIALOG_OPEN",
            message: `Studio tiene ${dialogCheck.blocking.length} dialogo(s) que bloquean el IDE: ${dialogCheck.blocking.map((dialog) => `"${dialog.title}"`).join(", ")}. Resuelvelos antes de compilar (talend_studio_ui_dialogs muestra la accion sugerida).`,
          },
        });
      }

      const outcome = await compileWithDependencies(bridge, job, installMissing ?? false);
      const dialogWarning = dialogCheck.status === "unavailable"
        ? `No se pudo comprobar si Studio tiene dialogos abiertos: ${dialogCheck.reason}`
        : undefined;

      return bridgeOk({
        ok: outcome.ok,
        source: outcome.source,
        confidence: outcome.confidence,
        endpoint: "/automation/job/compile",
        warning: dialogWarning,
        data: {
          ...outcome.data,
          autoInstalledModules,
          missingArtifacts: outcome.missingArtifacts,
          ...(outcome.autoInstalled.length > 0 ? { autoInstalled: outcome.autoInstalled } : {}),
          ...(outcome.hint ? { hint: outcome.hint } : {}),
        },
        error: outcome.error,
      });
    },
  },
  {
    name: "talend_job_problems",
    description: "Errores y avisos de diseno de un job, los de la vista Problemas de Studio (por ejemplo 'No schema has been defined yet' o 'This component should have input link(s)'). Se calculan sin ejecutar el job: sirven para comprobar que abre sin avisos antes de compilarlo. 'clean' es true cuando no hay errores ni avisos.",
    inputSchema: z.object({
      job: z.string().optional().describe("Job a comprobar. Si se omite, el job activo"),
    }),
    handler: async ({ job }: { job?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.jobProblems({ job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/problems",
        data: result.data,
        error: result.error,
      });
    },
  },
];
