import { z } from "zod/v4";
import { okResult, errorResult } from "../../../presentation/tools/common/result";
import { applyJobEdits, jobEditOperationSchema } from "../../../talend/editor/job-edit";
import { findTalendJob } from "../../../talend/job-crud";
import { readTextFile, writeTextFile } from "../../../talend/files";
import { resolveProjectPath } from "../../../talend/workspace";
import { jobsAbiertosEnStudio } from "../../../talend/job-batch/open-guard";
import { DefinitionIndexRepository } from "../../component-definitions/infrastructure/definition-index.repository";
import { GetComponentDefinitionsUseCase } from "../../component-definitions/application/get-component-definitions.use-case";

const PlanSchema = z.object({
  job: z.string().min(1).describe("Nombre del job"),
  folderPath: z.string().optional(),
  operations: z.array(jobEditOperationSchema).min(1).max(500).describe("add_node, remove_node, set_params, set_schema, connect, disconnect, move, set_context"),
  mode: z.enum(["auto", "offline", "studio"]).optional().default("auto").describe("auto: offline salvo job abierto o tMap complejo"),
  dryRun: z.boolean().optional().default(true).describe("true: solo previsualiza (diff), no escribe"),
  force: z.boolean().optional().default(false),
});
let componentUseCase: GetComponentDefinitionsUseCase | null = null;
function getComponentUseCase(): GetComponentDefinitionsUseCase {
  if (!componentUseCase) componentUseCase = new GetComponentDefinitionsUseCase(new DefinitionIndexRepository());
  return componentUseCase;
}

export async function validateComponentParams(operations: Array<Record<string, unknown>>): Promise<{ ok: boolean; message?: string }> {
  const useCase = getComponentUseCase();
  for (const op of operations) {
    const componentName = String((op as { componentName?: unknown }).componentName ?? "");
    if (!componentName) continue;
    const definition = await useCase.get(componentName);
    if (!definition) continue;
    const provided = (op as { parameters?: Record<string, string> }).parameters;
    if (!provided) continue;
    const validNames = new Set(definition.parameters.map((p) => p.name));
    const unknown = Object.keys(provided).filter((name) => !validNames.has(name));
    if (unknown.length) {
      return { ok: false, message: `Componente ${componentName}: parametros desconocidos (${unknown.join(", ")}). Usa: ${[...validNames].slice(0, 8).join(", ")}...` };
    }
    for (const [name, value] of Object.entries(provided)) {
      const param = definition.parameters.find((p) => p.name === name);
      if (param?.options?.length) {
        const allowed = new Set(param.options.map((o) => o.value));
        const inner = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
        if (!allowed.has(inner) && !allowed.has(value)) {
          return { ok: false, message: `Componente ${componentName}: ${name}=${value} no es valido. Valores: ${[...allowed].join(", ")}` };
        }
      }
      if (param?.field === "CHECK" && value !== '"true"' && value !== '"false"') {
        return { ok: false, message: `Componente ${componentName}: ${name} es CHECK, usa '"true"' o '"false"', no ${value}` };
      }
    }
    const missing = definition.requiredParameters.filter((p: any) => !(p.name in provided) && !p.defaultValue && !p.suggestedValue);
    if (missing.length) {
      return { ok: false, message: `Componente ${componentName}: faltan obligatorios (${missing.map((p: any) => p.name).join(", ")})` };
    }
  }
  return { ok: true };
}

/** Schema compartido del repositorio: lectura + asignacion a un nodo (Fase A). */
export const AssignRepositorySchema = z.object({
  job: z.string().min(1).describe("Nombre del job abierto en Studio"),
  uniqueName: z.string().min(1).describe("Unique name del nodo"),
  connectionName: z.string().min(1).describe("Nombre de la conexion compartida del repositorio"),
  schemaName: z.string().min(1).describe("Nombre del schema/tabla dentro de la conexion"),
  confirm: z.boolean().optional().describe("Confirmar la asignacion (escritura)"),
});

export function createAssignRepositorySchemaTool() {
  return {
    name: "talend_job_assign_repository_schema",
    description: "Asigna un schema compartido del repositorio a un nodo. Falla en codigo (Zod, fail-fast) si falta algo; no escribe si la asignacion no es valida.",
    inputSchema: AssignRepositorySchema,
    handler: async (input: z.infer<typeof AssignRepositorySchema>) => {
      const tool = "assign-repository-schema";
      try {
        if (input.confirm !== true) {
          return errorResult(tool, "CONFIRMATION_REQUIRED", "La asignacion requiere confirm: true.");
        }
        const bridge = await (async () => {
          const mod = await import("../../../modules/studio-bridge/adapters/http-studio-bridge.client");
          return (mod as any).createBridgeClient();
        })();
        const result = await (bridge as any).assignRepositorySchema?.({ job: input.job, uniqueName: input.uniqueName, connectionName: input.connectionName, schemaName: input.schemaName });
        if (!result) {
          return errorResult(
            tool,
            "NOT_IMPLEMENTED_IN_BRIDGE",
            "El endpoint /automation/repository/schemas/assign aun no esta en el bridge: asigna schemas de archivo por XML offline o usa el modo built-in.",
          );
        }
        if (!result.ok) {
          return errorResult(tool, "ASSIGN_FAILED", result.error?.message ?? "La asignacion no se pudo aplicar.");
        }
        return okResult({ job: input.job, uniqueName: input.uniqueName, connectionName: input.connectionName, schemaName: input.schemaName }, tool);
      } catch (error) {
        return errorResult(tool, "ASSIGN_ERROR", error instanceof Error ? error.message : String(error));
      }
    },
  };
}

/** Fachada canónica de edición: planifica (dryRun) y aplica con garantías. mode auto elige el motor offline. */
export function createJobPlanTool() {
  return {
    name: "talend_job_plan",
    description: "Planifica cambios sobre un job sin aplicarlos: valida las operaciones y devuelve el diff. mode=auto elige offline o Studio.",
    inputSchema: PlanSchema,
    handler: async (input: z.infer<typeof PlanSchema>) => {
      const tool = "job-plan";
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return errorResult(tool, "NO_PROJECT", "No se pudo detectar el proyecto Talend.");
        const job = await findTalendJob(projectPath, input.job, input.folderPath);
        const xml = await readTextFile(job.itemPath, projectPath);
        let result;
        try {
          result = applyJobEdits(xml, input.operations);
        } catch (error) {
          return errorResult(tool, "EDIT_REJECTED", error instanceof Error ? error.message : String(error));
        }
        // Validacion en codigo contra las definiciones XML de los componentes
        // implicados: un agente configura mal y salta aqui, antes de escribir.
        const validation = await validateComponentParams(input.operations as unknown as Array<Record<string, unknown>>);
        if (!validation.ok) {
          return errorResult(tool, "INVALID_COMPONENT_PARAMS", validation.message ?? "Parametros invalidos");
        }
        return okResult({
          job: input.job,
          mode: input.mode ?? "auto",
          strategy: input.mode === "studio" ? "studio (manual)" : "offline",
          operations: input.operations.length,
          changed: result.changed,
          written: false,
          dryRun: true,
          diff: result.diff.length > 6000 ? `${result.diff.slice(0, 6000)}\n... (diff recortado)` : result.diff,
          validation,
        }, tool);
      } catch (error) {
        return errorResult(tool, "PLAN_ERROR", error instanceof Error ? error.message : String(error));
      }
    },
  };
}

const EditSchema = PlanSchema.extend({
  dryRun: z.boolean().optional().default(false),
  refreshStudio: z.boolean().optional().default(true),
});

export function createJobEditTool() {
  return {
    name: "talend_job_edit",
    description: "Aplica cambios declarativos a un job (add_node, configure, connect...) de forma atómica. dryRun=true previsualiza. mode=auto elige offline o Studio.",
    inputSchema: EditSchema,
    handler: async (input: z.infer<typeof EditSchema>) => {
      const tool = "job-edit";
      try {
        const projectPath = await resolveProjectPath();
        if (!projectPath) return errorResult(tool, "NO_PROJECT", "No se pudo detectar el proyecto Talend.");
        const job = await findTalendJob(projectPath, input.job, input.folderPath);
        if (!input.dryRun && !input.force) {
          const abiertos = await jobsAbiertosEnStudio([input.job]);
          if (abiertos.length > 0 && input.mode !== "studio") {
            return errorResult(tool, "JOB_OPEN_IN_STUDIO", `El job ${input.job} esta abierto en Studio: usa mode=studio o cierra el editor.`);
          }
        }
        const xml = await readTextFile(job.itemPath, projectPath);
        let result;
        try {
          result = applyJobEdits(xml, input.operations);
        } catch (error) {
          return errorResult(tool, "EDIT_REJECTED", error instanceof Error ? error.message : String(error));
        }
        const validation = await validateComponentParams(input.operations as unknown as Array<Record<string, unknown>>);
        if (!validation.ok) {
          return errorResult(tool, "INVALID_COMPONENT_PARAMS", validation.message ?? "Parametros invalidos");
        }
        const written = !input.dryRun && result.changed;
        if (written) await writeTextFile(job.itemPath, result.xml, projectPath);
        return okResult({
          job: input.job,
          mode: input.mode ?? "auto",
          operations: input.operations.length,
          changed: result.changed,
          written,
          diff: result.diff.length > 6000 ? `${result.diff.slice(0, 6000)}\n... (diff recortado)` : result.diff,
          validation,
        }, tool);
      } catch (error) {
        return errorResult(tool, "EDIT_ERROR", error instanceof Error ? error.message : String(error));
      }
    },
  };
}
