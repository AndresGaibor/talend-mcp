import { z } from "zod/v4";
import { createJobFromSpec, type TalendJobSpec } from "../../../talend/automation/job-automation";
import { resolveProjectPath } from "../../../talend/workspace";
import { okResult, errorResult } from "../common/result";

const ComponentSpecSchema = z.object({
  id: z.string().describe("UNIQUE_NAME del componente, por ejemplo tMap_1"),
  type: z.string().describe("Nombre del componente Talend, por ejemplo tFileInputDelimited"),
  label: z.string().optional().describe("Etiqueta visible del componente"),
  position: z.object({ x: z.number(), y: z.number() }).optional().describe("Posicion en el lienzo"),
  parameters: z.record(z.string(), z.union([
    z.string(),
    z.object({
      value: z.string(),
      field: z.enum(["TEXT", "CHECK", "FILE", "DIRECTORY", "RADIO", "COMPONENT_LIST", "TABLE", "OPENED_LIST"]).optional(),
    }),
  ])).optional().describe(
    "Parametros del componente. Un string se escribe como TEXT; para FILE, CHECK o RADIO usa { value, field }.",
  ),
  schema: z.array(z.object({
    name: z.string().describe("Nombre de la columna"),
    type: z.string().describe("Tipo de la columna"),
    nullable: z.boolean().optional(),
    length: z.number().optional(),
    precision: z.number().optional(),
  })).optional().describe("Esquema de salida del componente"),
});

const ConnectionSpecSchema = z.object({
  name: z.string().describe("Nombre de la conexion"),
  source: z.string().describe("UNIQUE_NAME del componente origen"),
  target: z.string().describe("UNIQUE_NAME del componente destino"),
  type: z.enum(["FLOW", "ITERATE", "REJECT", "LOOKUP"]).optional().describe("Tipo de conexion"),
  label: z.string().optional(),
});

const CreateJobFromSpecSchema = z.object({
  name: z.string().describe("Nombre del job"),
  version: z.string().optional().describe("Version (default: 0.1)"),
  folder: z.string().optional().describe("Carpeta dentro de process, por ejemplo Pruebas/MCP"),
  description: z.string().optional(),
  components: z.array(ComponentSpecSchema).describe("Componentes del job"),
  connections: z.array(ConnectionSpecSchema).optional().describe("Conexiones entre componentes"),
  contexts: z.record(z.string(), z.record(z.string(), z.string())).optional()
    .describe("Contextos del job: nombre -> { tipo, valor, comentario }"),
  openInStudio: z.boolean().optional().describe("Abrir el job en Talend Studio al terminar"),
});

export function createJobsCreateFromSpecTool() {
  return {
    name: "talend_jobs_create_from_spec",
    description:
      "Crea un job de Talend a partir de una especificacion de componentes y conexiones, y escribe los archivos .item y .properties en el proyecto. Requiere confirmacion.",
    inputSchema: CreateJobFromSpecSchema,
    annotations: {
      readOnly: false,
      requiresConfirmation: true,
    },
    handler: async (input: z.infer<typeof CreateJobFromSpecSchema>) => {
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) {
          return errorResult(
            "create-job-from-spec",
            "NO_PROJECT",
            "No se pudo detectar el proyecto Talend. Abre Talend Studio con el proyecto abierto o define TALEND_PROJECT.",
          );
        }

        const spec: TalendJobSpec = {
          name: input.name,
          version: input.version ?? "0.1",
          folder: input.folder,
          description: input.description,
          components: input.components.map((component) => ({
            id: component.id,
            type: component.type,
            label: component.label,
            position: component.position,
            parameters: component.parameters,
            schema: component.schema,
          })),
          connections: (input.connections ?? []).map((connection) => ({
            name: connection.name,
            source: connection.source,
            target: connection.target,
            type: connection.type ?? "FLOW",
            label: connection.label,
          })),
          contexts: input.contexts,
        };

        let bridge;
        if (input.openInStudio) {
          try {
            const { createBridgeClient } = await import("../../../modules/studio-bridge/adapters/http-studio-bridge.client");
            bridge = await createBridgeClient();
          } catch {
            bridge = undefined;
          }
        }

        const result = await createJobFromSpec(projectPath, spec, bridge);

        if (!result.ok) {
          return errorResult("create-job-from-spec", "CREATE_JOB_ERROR", result.errors.join("; "));
        }

        return okResult({
          jobName: result.jobName,
          version: input.version ?? "0.1",
          folderPath: result.folderPath,
          itemPath: result.itemPath,
          propertiesPath: result.propertiesPath,
          projectPath,
          openedInStudio: Boolean(input.openInStudio),
        }, "create-job-from-spec");
      } catch (err) {
        return errorResult("create-job-from-spec", "CREATE_JOB_ERROR", `Error creando job: ${err}`);
      }
    },
  };
}
