import * as z from "zod/v4";
import { bridgeOk, loadBridge } from "./tools-base";

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
    description: "Genera el codigo Java del job y comprueba que compila, sin ejecutarlo. Devuelve 'compiles' y, si falla, la linea y el mensaje del error (por ejemplo 'no_comillas cannot be resolved to a variable'). Es la forma de saber si una configuracion genera codigo valido antes de correr el job. Tarda unos segundos y ocupa el hilo de la interfaz de Studio mientras genera, igual que un Run.",
    inputSchema: z.object({
      job: z.string().optional().describe("Job a compilar. Si se omite, el job activo"),
    }),
    handler: async ({ job }: { job?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.jobCompile({ job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/compile",
        data: result.data,
        error: result.error,
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
