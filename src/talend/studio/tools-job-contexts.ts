import * as z from "zod/v4";
import { bridgeOk, loadBridge } from "./tools-base";

export const jobContextTools = [
  {
    name: "talend_job_contexts_list",
    description:
      "Lista los contextos (entornos) del job y sus variables, con el valor de cada variable en cada entorno. Los contextos se leen del modelo de Studio, no del archivo.",
    inputSchema: z.object({
      job: z.string().optional().describe("Job a consultar (si no, el que este abierto)"),
    }),
    handler: async ({ job }: { job?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.jobContexts({ job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/contexts",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_context_create",
    description:
      "Crea un contexto (un entorno) en el job, copiando las variables del entorno por defecto. Se edita con la API de Studio y el job se guarda.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del contexto nuevo (por ejemplo, 'produccion')"),
      job: z.string().optional().describe("Job donde crear el contexto"),
    }),
    handler: async ({ name, job }: { name: string; job?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.createJobContext({ name, job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/contexts/create",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_context_set",
    description:
      "Crea o cambia una variable de un contexto del job (su nombre, su tipo y su valor). Cada entorno puede tener un valor distinto de la misma variable.",
    inputSchema: z.object({
      context: z.string().describe("Contexto (entorno) al que pertenece la variable"),
      name: z.string().describe("Nombre de la variable"),
      value: z.string().describe("Valor de la variable en ese contexto"),
      type: z
        .string()
        .optional()
        .describe("Tipo: id_String (por defecto), id_Integer, id_Double, id_Boolean, id_Date..."),
      job: z.string().optional().describe("Job donde editarla"),
    }),
    handler: async ({ context, name, value, type, job }: {
      context: string;
      name: string;
      value: string;
      type?: string;
      job?: string;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.setJobContextParameter({ context, name, value, type, job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/contexts/parameter",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_context_delete_variable",
    description: "Borra una variable de un contexto del job.",
    inputSchema: z.object({
      context: z.string().describe("Contexto (entorno) de la variable"),
      name: z.string().describe("Nombre de la variable"),
      job: z.string().optional().describe("Job donde borrarla"),
    }),
    handler: async ({ context, name, job }: { context: string; name: string; job?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.deleteJobContextParameter({ context, name, job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/contexts/parameter/delete",
        data: result.data,
        error: result.error,
      });
    },
  },
  {
    name: "talend_job_context_delete",
    description: "Borra un contexto (un entorno) del job. El entorno por defecto no se puede borrar.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del contexto"),
      job: z.string().optional().describe("Job donde borrarlo"),
    }),
    handler: async ({ name, job }: { name: string; job?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.deleteJobContext({ name, job });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/contexts/delete",
        data: result.data,
        error: result.error,
      });
    },
  },
];
