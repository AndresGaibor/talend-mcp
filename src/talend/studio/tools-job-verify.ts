import * as z from "zod/v4";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";
import { compileWithDependencies } from "./compile-with-dependencies";
import { prepareStudioForJob } from "./studio-dialogs";
import {
  clasificarProblemas,
  clasificarSalida,
  problemasDe,
  type Hallazgos,
} from "../diagnostics/output-findings";

const ENDPOINT = "/automation/job/verify";
const TIMEOUT_POR_DEFECTO_MS = 120_000;

type Veredicto = "ok" | "ok_con_avisos" | "error";

function lineasDe(texto: unknown): string[] {
  return typeof texto === "string" ? texto.split(/\r?\n/).filter((linea) => linea.length > 0) : [];
}

function veredictoDe(hallazgos: Hallazgos, falloGrave: boolean): Veredicto {
  if (falloGrave || hallazgos.errores.length > 0) return "error";
  return hallazgos.avisos.length > 0 ? "ok_con_avisos" : "ok";
}

/**
 * Una sola llamada para comprobar un job: problemas de diseno, compilacion y
 * ejecucion con la salida revisada. Existe para que el agente no tenga que
 * acordarse de encadenar `talend_job_problems`, `talend_job_compile` y la
 * lectura de avisos: siempre se hacen, y en este orden.
 */
export const jobVerifyTools = [
  {
    name: "talend_job_verify",
    description: "Comprueba un job de principio a fin en UNA llamada: (1) errores y avisos de diseno (vista Problemas), (2) que compila, (3) lo ejecuta y revisa su salida buscando [WARN], [ERROR], [FATAL] y excepciones aunque el codigo de salida sea 0. Devuelve 'verdict' (ok | ok_con_avisos | error) con 'problems', 'compiles', 'exitCode', 'lines' y 'findings'. Es la tool que hay que usar tras crear o cambiar un job; informa al usuario de cada aviso. Con run:false solo comprueba diseno y compilacion, sin ejecutar.",
    inputSchema: z.object({
      job: z.string().describe("Nombre del job"),
      run: z.boolean().optional().default(true).describe("Ejecutar el job (false = solo diseno y compilacion)"),
      installMissing: z.boolean().optional().default(false).describe("Descargar las dependencias que falten al compilar"),
      timeoutMs: z.number().optional().describe("Tiempo maximo de la ejecucion en milisegundos (por defecto 120000)"),
    }),
    handler: async ({ job, run, installMissing, timeoutMs }: {
      job: string;
      run?: boolean;
      installMissing?: boolean;
      timeoutMs?: number;
    }) => {
      const bridge = await loadBridge();

      const prepared = await prepareStudioForJob(bridge, {
        ignoreDialogs: false,
        installMissing: installMissing ?? false,
      });
      if (prepared.check.status !== "clear") {
        return bridgeFail({
          ok: false,
          source: "studio-bridge",
          confidence: "high",
          endpoint: ENDPOINT,
          error: {
            code: prepared.check.status === "blocked" ? "STUDIO_DIALOG_OPEN" : "STUDIO_DIALOG_CHECK_FAILED",
            message: "Studio tiene dialogos que bloquean el IDE o no se pudieron comprobar. Mira talend_studio_ui_dialogs y resuelvelos antes de verificar.",
          },
        });
      }

      // 1. Diseno: se lee siempre, antes de compilar.
      const problemsResult = await bridge.jobProblems({ job });
      const design = clasificarProblemas(problemasDe(problemsResult.data));

      // 2. Compilacion.
      const compiled = await compileWithDependencies(bridge, job, installMissing ?? false);
      const compiles = compiled.data.compiles === true;
      const base = {
        job,
        problems: { errors: design.errores, warnings: design.avisos, clean: design.errores.length + design.avisos.length === 0 },
        compiles,
        ...(compiled.error ? { compileError: compiled.error } : {}),
        ...(compiled.data.error ? { compileDetail: compiled.data.error } : {}),
        ...(compiled.missingArtifacts.length > 0 ? { missingArtifacts: compiled.missingArtifacts } : {}),
      };

      if (!compiles || run === false) {
        const findings = { errors: design.errores, warnings: design.avisos };
        return bridgeOk({
          ok: compiles,
          source: compiled.source,
          confidence: compiled.confidence,
          endpoint: ENDPOINT,
          data: { ...base, executed: false, verdict: veredictoDe(design, !compiles), findings },
        });
      }

      // 3. Ejecucion con un solo Run de Studio: compila, ejecuta y devuelve la salida.
      const opened = await bridge.openJob({ name: job });
      if (!opened.ok) {
        return bridgeFail({
          ok: false,
          source: opened.source,
          confidence: opened.confidence,
          endpoint: ENDPOINT,
          data: { ...base, executed: false, verdict: "error" satisfies Veredicto },
          error: opened.error,
        });
      }
      const limite = timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;
      const launched = await bridge.runActiveJob(
        { dryRun: false, saveBefore: true, waitForTermination: true, timeoutMs: limite },
        { timeoutMs: limite + 30_000 },
      );
      const out = (launched.data ?? {}) as {
        launched?: boolean;
        timeout?: boolean;
        captured?: boolean;
        stdout?: string;
        stderr?: string;
        exitCode?: number | null;
        error?: { message?: string };
      };
      if (!launched.ok || out.error || !out.launched) {
        return bridgeFail({
          ok: false,
          source: launched.source,
          confidence: launched.confidence,
          endpoint: ENDPOINT,
          data: { ...base, executed: false, verdict: "error" satisfies Veredicto },
          error: launched.error ?? { code: "RUN_FAILED", message: out.error?.message ?? "Studio no lanzo el job" },
        });
      }

      const stdout = lineasDe(out.stdout);
      const stderr = lineasDe(out.stderr);
      const fromOutput = clasificarSalida([...stdout, ...stderr]);
      const all: Hallazgos = {
        errores: [...design.errores, ...fromOutput.errores],
        avisos: [...design.avisos, ...fromOutput.avisos],
      };
      const exitCode = out.exitCode ?? null;
      const failed = out.timeout === true || (exitCode !== null && exitCode !== 0);

      return bridgeOk({
        ok: !failed,
        source: launched.source,
        confidence: launched.confidence,
        endpoint: ENDPOINT,
        ...(out.captured
          ? {}
          : { warning: "El bridge no capturo la salida del job (acabo antes de pedirla). Usa talend_job_execute para leerla." }),
        data: {
          ...base,
          executed: true,
          timedOut: out.timeout === true,
          exitCode,
          outputCaptured: out.captured === true,
          lines: stdout,
          stderr,
          verdict: veredictoDe(all, failed),
          findings: { errors: all.errores, warnings: all.avisos },
        },
      });
    },
  },
];
