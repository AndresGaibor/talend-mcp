/** Tools de jobOperationsTools: job-lifecycle. */
import * as z from "zod/v4";

import { bridgeOk, loadBridge } from "../tools-base";

import { columnSchema, componentSpecShape, parameterSchema } from "../tools-job-operation-schemas";

import { jobContextTools } from "../tools-job-contexts";

import { studioMaintenanceTools } from "../tools-studio-maintenance";

import { jobDiagnosticsTools } from "../tools-job-diagnostics";

import { componentCatalogTools } from "../tools-component-catalog";

import { nodeConnectionTools } from "../tools-node-connection";
export const jobLifecycle = [
{
    name: "talend_job_create_in_studio",
    description:
      "Crea un job vacio en el repositorio de Talend y lo abre en el editor. El job se crea con la API del IDE, no escribiendo el XML a mano. Con jobType se elige el tipo de job (Standard, Big_Data_Batch para Spark Batch, Big_Data_Stream para Spark Streaming), que decide que paleta de componentes usa el editor.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job. Solo letras, digitos y guion bajo"),
      version: z.string().optional().default("0.1").describe("Version del job"),
      folder: z.string().optional().default("").describe("Carpeta dentro de process/"),
      description: z.string().optional().describe("Descripcion del job"),
      replace: z.boolean().optional().default(false).describe("Reemplaza el job si ya existe con esa etiqueta"),
      jobType: z
        .string()
        .optional()
        .describe("Tipo de job: Standard (por defecto), Big_Data_Batch (Spark Batch), Big_Data_Stream (Spark Streaming)"),
      framework: z.string().optional().describe("Framework del job: Spark, Storm, MapReduce"),
    }),
    handler: async ({ name, version, folder, description, replace, jobType, framework }: {
      name: string;
      version?: string;
      folder?: string;
      description?: string;
      replace?: boolean;
      jobType?: string;
      framework?: string;
    }) => {
      const bridge = await loadBridge();
      const result = await bridge.createJob({ name, version, folder, description, replace, jobType, framework });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/create",
        data: result.data,
        error: result.error,
      });
    },
  },
{
    name: "talend_job_delete_in_studio",
    description: "Borra un job del repositorio de Talend, con sus archivos. Se borra desde el repositorio, no desde el disco, para que no quede un item fantasma.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job"),
      version: z.string().optional().default("0.1").describe("Version del job"),
    }),
    handler: async ({ name, version }: { name: string; version?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.deleteJob({ name, version });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/delete",
        data: result.data,
        error: result.error,
      });
    },
  },
{
    name: "talend_studio_dismiss_dialogs",
    description: "Cierra los dialogos modales que bloquean Talend Studio PULSANDO su boton: 'Jobname Error' y 'Save Resource' responden Yes (reemplaza el job o guarda los cambios pendientes). NO es de solo lectura. Para ver que dialogos hay sin tocarlos usa talend_studio_ui_inventory. El plugin ya lo hace solo; esta tool lo fuerza bajo demanda.",
    inputSchema: z.object({}),
    handler: async () => {
      const bridge = await loadBridge();
      const result = await bridge.dismissDialogs();
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/workbench/dialogs",
        data: result.data,
        error: result.error,
      });
    },
  },
{
    name: "talend_job_open_in_studio",
    description: "Abre un job del proyecto en el editor de Talend. Necesario antes de operar sobre sus nodos.",
    inputSchema: z.object({
      name: z.string().describe("Nombre del job"),
      version: z.string().optional().default("0.1").describe("Version del job"),
    }),
    handler: async ({ name, version }: { name: string; version?: string }) => {
      const bridge = await loadBridge();
      const result = await bridge.openJob({ name, version });
      return bridgeOk({
        ok: result.ok,
        source: result.source,
        confidence: result.confidence,
        endpoint: "/automation/job/open",
        data: result.data,
        error: result.error,
      });
    },
  }
];
