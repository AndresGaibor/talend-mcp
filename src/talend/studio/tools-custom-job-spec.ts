import { DefinitionIndexRepository } from "../../modules/component-definitions/infrastructure/definition-index.repository";
import { ValidateConnectionUseCase } from "../../modules/component-definitions/application/validate-connection.use-case";
import { resolveProjectPath } from "../workspace";
import { listJobs } from "../repository";
import { applyCustomJobSpec } from "./apply-custom-job-spec";
import { customJobSpecSchema, type CustomJobSpec } from "./custom-job-spec";
import { bridgeFail, bridgeOk, loadBridge } from "./tools-base";
import type { z } from "zod/v4";

export const customJobSpecTool = {
  name: "talend_job_apply_custom_spec",
  description: "Crea o completa una estructura de Jobs con la API de Studio. Valida componentes y conexiones, conserva valores existentes y rechaza destinos ajenos. No compila, ejecuta ni publica Jobs.",
  // El schema es recursivo (childJobs) y por eso su tipo estatico es ZodType; en tiempo de ejecucion es un strictObject, es decir un ZodObject.
  inputSchema: customJobSpecSchema as unknown as z.ZodObject<any>,
  annotations: { readOnly: false, destructive: false, requiresConfirmation: true },
  handler: async (input: CustomJobSpec) => {
    try {
      const projectPath = await resolveProjectPath();
      if (!projectPath) throw new Error("No se pudo determinar el proyecto Talend activo");
      const validator = new ValidateConnectionUseCase(new DefinitionIndexRepository());
      const result = await applyCustomJobSpec(input, { bridge: await loadBridge(), listJobs: () => listJobs(projectPath), validateConnection: (source, target, connector) => validator.validate(source, target, connector) });
      return bridgeOk({ ok: true, source: "studio-bridge", confidence: "high", endpoint: "/job/apply-custom-spec", data: result });
    } catch (error) {
      return bridgeFail({ ok: false, source: "studio-bridge", confidence: "high", endpoint: "/job/apply-custom-spec", error: { code: String(error).includes("CONFLICT") ? "CONFLICT" : "APPLY_FAILED", message: String(error) } });
    }
  },
};
