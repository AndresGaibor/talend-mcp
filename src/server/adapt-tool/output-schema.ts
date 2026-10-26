import { TalendResultSchema } from "../../shared/contracts/result.contract";
import { hasEnrichedDataSchema, getEnrichedOutputSchema } from "../enriched-schemas";
import { convertInputSchema } from "./input-schema";

/**
 * Quita `additionalProperties: false` de un JSON Schema.
 *
 * Los schemas de salida se publican para documentar la forma de la respuesta,
 * no para rechazarla: si una tool empieza a devolver un campo nuevo, el schema
 * publicado queda desactualizado y un cliente MCP con validacion estricta
 * (por ejemplo el SDK de Python) rechazaria toda la respuesta. Los objetos del
 * schema de salida quedan abiertos; los de entrada siguen siendo estrictos.
 */
function allowAdditionalOutputProperties(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(allowAdditionalOutputProperties);
  }
  if (schema && typeof schema === "object") {
    const obj = schema as Record<string, unknown>;
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === "additionalProperties" && val === false) continue;
      res[key] = allowAdditionalOutputProperties(val);
    }
    return res;
  }
  return schema;
}

export function convertOutputSchema(schema: unknown): unknown {
  return allowAdditionalOutputProperties(convertInputSchema(schema));
}

export function resolveOutputSchema(toolName: string, fallbackSchema: unknown): unknown {
  const normName = toolName.startsWith("talend_") ? toolName : `talend_${toolName}`;
  if (hasEnrichedDataSchema(normName)) {
    const isPatternB = normName === "talend_diagnose_environment" ||
      normName.startsWith("talend_secrets_") ||
      normName.startsWith("talend_snapshots_") ||
      normName.startsWith("talend_datasets_") ||
      normName.startsWith("talend_deliverables_") ||
      normName.startsWith("talend_errors_") ||
      normName.startsWith("talend_validation_") ||
      normName.startsWith("talend_evidence_") ||
      normName.startsWith("talend_report_snippets_") ||
      normName.startsWith("talend_runs_") ||
      normName.startsWith("talend_app_");
    return convertOutputSchema(getEnrichedOutputSchema(normName, isPatternB ? "B" : "A"));
  }
  return convertOutputSchema(fallbackSchema ?? TalendResultSchema);
}
