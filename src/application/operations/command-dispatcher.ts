/**
 * Punto de entrada de la CLI a las herramientas del registro.
 * Comparte `dispatchValidated` con el servidor MCP: validacion de
 * argumentos, `ToolRisk` y auditoria son las mismas en MCP y CLI.
 * La autorizacion de la CLI es su propia capa (confirmacion --yes).
 */
import { Validator } from "@cfworker/json-schema";
import { getRuntimeTools } from "../../server/registered-tools";
import { dispatchValidated } from "../../presentation/server/new-server/dispatch";
import { CupoDeLlamadas, ToolTimeoutError } from "../../presentation/server/new-server/tool-guard";
import { getToolRisk } from "../../presentation/server/tool-safety";
import { getTalendMcpEnv } from "../../config/env";

export type OperationRisk = "read" | "write" | "execute" | "destructive";

/**
 * Politica CLI: clasificacion explicita por tool; las no listadas se
 * derivan de `getToolRisk` (single source of truth, sin duplicar el mapa).
 * `destructive` se bloquea sin `allowDestructive` + `confirm` en la entrada.
 */
const OPERATION_POLICY: Readonly<Record<string, OperationRisk>> = {
  // MVP clasificado explicitamente (compatibilidad con tests existentes).
  talend_guide: "read",
  talend_diagnose_environment: "read",
  talend_jobs_list: "read",
  talend_jobs_read: "read",
  talend_jobs_create: "write",
}; 

export class CliOperationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CliOperationError";
  }
}

export function getPolicy(name: string): OperationRisk | undefined {
  const explicit = OPERATION_POLICY[name];
  if (explicit) return explicit;
  // Derivar de tool-safety (no duplicar el mapa completo de 257 tools).
  const risk = getToolRisk(name);
  if (risk) return risk;
  return undefined;
}

// CLI: cada tool se clasifica por defecto a traves de getToolRisk.
// Solo el MVP superior necesita politica explicita; el resto se deriva.
// La CLI queda como segunda entrada al MCP: los agentes eligen la via
// (MCP como herramienta semantica vs CLI como comando determinista).

export function getPolicySource(name: string): "explicit" | "derived" {
  return Object.prototype.hasOwnProperty.call(OPERATION_POLICY, name) ? "explicit" : "derived";
}

export function listOperations() {
  return getRuntimeTools().map(({ definition }) => ({
    name: definition.name,
    description: definition.description,
    risk: getPolicy(definition.name) ?? "unclassified",
  }));
}

export function describeOperation(name: string) {
  const operation = getRuntimeTools().find(({ definition }) => definition.name === name);
  if (!operation) throw new CliOperationError(`Operacion desconocida o no expuesta: ${name}`, "NOT_FOUND");
  return { ...operation.definition, risk: getPolicy(name) ?? "unclassified" };
}

export async function executeOperation(
  name: string,
  input: unknown,
  options: {
    allowWrite?: boolean;
    allowExecute?: boolean;
    allowDestructive?: boolean;
    confirm?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<unknown> {
  const operation = getRuntimeTools().find(({ definition }) => definition.name === name);
  if (!operation) throw new CliOperationError(`Operacion desconocida o no expuesta: ${name}`, "NOT_FOUND");
  const risk = getPolicy(name);
  if (!risk) {
    throw new CliOperationError(
      `Operacion no clasificada: ${name}. Revisa explicitamente su riesgo y anadela a OPERATION_POLICY.`,
      "UNCLASSIFIED",
    );
  }
  if (risk === "destructive" && !(options.allowDestructive && options.confirm === true)) {
    throw new CliOperationError(
      `Operacion destructiva bloqueada: ${name}. Requiere --yes y confirm:true en la entrada.`,
      "DENIED",
    );
  }
  if (risk === "destructive" && !options.allowDestructive) {
    throw new CliOperationError(
      `Operacion destructiva bloqueada: ${name}. Requiere --yes y confirm:true en la entrada.`,
      "DENIED",
    );
  }
  if (risk === "write" && !options.allowWrite) {
    throw new CliOperationError(`La operacion ${name} modifica el proyecto; requiere autorizacion explicita.`, "DENIED");
  }
  if (risk === "execute" && !options.allowExecute) {
    throw new CliOperationError(`La operacion ${name} ejecuta codigo o jobs; requiere autorizacion explicita.`, "DENIED");
  }

  const schema = operation.definition.inputSchema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || (schema as Record<string, unknown>).type !== "object") {
    throw new CliOperationError(`Esquema de entrada invalido o incompatible: ${name}`, "INVALID_SCHEMA");
  }
  let validation;
  try {
    validation = new Validator(schema as ConstructorParameters<typeof Validator>[0]).validate(input);
  } catch (error) {
    throw new CliOperationError(`No se pudo validar ${name}: ${String(error)}`, "INVALID_SCHEMA");
  }
  if (!validation.valid) {
    throw new CliOperationError(`Argumentos invalidos para ${name}: ${JSON.stringify(validation.errors)}`, "INVALID_INPUT");
  }

  // Segunda entrada al MCP: se pasa por dispatchValidated, el mismo camino
  // que el servidor MCP (validacion post-Validator + riesgo + auditoria).
  const env = getTalendMcpEnv();
  const cupo = new CupoDeLlamadas(env.TALEND_MCP_MAX_CONCURRENT_CALLS);
  const result = await dispatchValidated(
    name,
    input,
    schema,
    operation.handler as (input: unknown, signal: AbortSignal) => Promise<unknown>,
    { timeoutMs: options.timeoutMs ?? env.TALEND_MCP_TOOL_TIMEOUT_MS, cupo },
  ).catch((error: unknown) => {
    if (error instanceof ToolTimeoutError) {
      throw new CliOperationError(`La operacion ${name} supero el timeout.`, "TIMEOUT");
    }
    if (error && typeof error === "object" && "code" in (error as Record<string, unknown>)) {
      const code = String((error as { code?: unknown }).code);
      if (code === "RISK_NOT_ALLOWED" || code === "CONFIRMATION_REQUIRED") {
        throw new CliOperationError(`Operacion bloqueada por politica: ${name} (${code}).`, "DENIED");
      }
    }
    throw error instanceof CliOperationError
      ? error
      : new CliOperationError(`La operacion ${name} devolvio un error: ${error instanceof Error ? error.message : String(error)}`, "OPERATION_FAILED");
  });
  if (result && typeof result === "object") {
    const output = result as { ok?: unknown; isError?: unknown; structuredContent?: unknown };
    if (output.ok === false || output.isError === true) {
      throw new CliOperationError(`La operacion ${name} devolvio un error: ${JSON.stringify(result)}`, "OPERATION_FAILED");
    }
    if (output.structuredContent && typeof output.structuredContent === "object") {
      const inner = output.structuredContent as { ok?: unknown };
      if (inner.ok === false) throw new CliOperationError(`La operacion ${name} devolvio un error: ${JSON.stringify(inner)}`, "OPERATION_FAILED");
    }
  }
  return result;
}
