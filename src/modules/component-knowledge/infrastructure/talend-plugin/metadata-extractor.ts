import type {
  ComponentConnector,
  ComponentParameter,
  ComponentSchemaDefinition,
} from "../../domain/component-definition";

/** Extrae los parámetros declarados en el bloque COMPONENT. */
export function extractParameters(comp: Record<string, unknown>): ComponentParameter[] {
  const parameters: ComponentParameter[] = [];
  const paramEntries = collectByKey(comp, ["PARAMETER", "parameter"]);

  for (const p of paramEntries) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const pName = pr.NAME ?? pr.name ?? pr["@_name"] ?? "";
    if (!pName) continue;

    const field = String(pr.FIELD ?? pr.field ?? "id_String");
    let type: ComponentParameter["type"] = "unknown";
    if (field.includes("SCHEMA")) type = "schema";
    else if (field.includes("FILE") || field.includes("PATH")) type = "file";
    else if (field.includes("DIR") || field.includes("FOLDER")) type = "directory";
    else if (field.includes("TABLE") || field.includes("DB")) type = "table";
    else if (field.includes("CONNECTION")) type = "connection";
    else if (field.includes("PASSWORD") || field.includes("SECRET")) type = "password";
    else if (field.includes("BOOL")) type = "boolean";
    else if (field.includes("INT") || field.includes("NUM") || field.includes("DOUBLE") || field.includes("FLOAT")) type = "number";
    else type = "string";

    parameters.push({
      name: String(pName),
      displayName: String(pr.DISPLAY_NAME ?? pr.displayName ?? pName),
      type,
      required: pr.REQUIRED === "true" || pr.required === "true" || pr["@_required"] === "true",
      defaultValue: pr.DEFAULT ?? pr.defaultValue ?? pr["@_default"] ? String(pr.DEFAULT ?? pr.defaultValue ?? pr["@_default"]) : undefined,
      possibleValues: undefined,
      category: "basic",
      description: undefined,
      safeToEdit: true,
      riskLevel: "low",
    });
  }

  return parameters;
}

/** Extrae los conectores y deduce su tipo y dirección. */
export function extractConnectors(comp: Record<string, unknown>): ComponentConnector[] {
  const connectors: ComponentConnector[] = [];
  const connEntries = collectByKey(comp, ["CONNECTOR", "connector", "CONNECTORS", "connectors"]);

  for (const c of connEntries) {
    if (!c || typeof c !== "object") continue;
    const cr = c as Record<string, unknown>;
    const cName = cr.NAME ?? cr.name ?? "FLOW";
    const cTypeRaw = (cr.TYPE ?? cr.type ?? "FLOW") as string;
    const cType = String(cTypeRaw).toUpperCase();

    let connectorType: ComponentConnector["type"] = "UNKNOWN";
    let direction: ComponentConnector["direction"] = "output";

    if (cType === "FLOW" || cType === "FLOW_MAIN") {
      connectorType = "FLOW_MAIN";
      direction = "output";
    } else if (cType === "ITERATE") {
      connectorType = "ITERATE";
      direction = "output";
    } else if (cType === "ON_COMPONENT_OK") {
      connectorType = "ON_COMPONENT_OK";
      direction = "output";
    } else if (cType === "ON_COMPONENT_ERROR") {
      connectorType = "ON_COMPONENT_ERROR";
      direction = "output";
    } else if (cType === "RUN_IF") {
      connectorType = "RUN_IF";
      direction = "output";
    } else if (cType === "LOOKUP") {
      connectorType = "LOOKUP";
      direction = "input";
    } else if (cType === "REJECT") {
      connectorType = "REJECT";
      direction = "output";
    }

    connectors.push({
      name: String(cName),
      type: connectorType,
      direction,
      required: false,
      maxConnections: cr.MAX_CONNECTIONS ?? cr.maxConnections ? Number(cr.MAX_CONNECTIONS ?? cr.maxConnections) : undefined,
    });
  }

  return connectors;
}

/** Deduce los schemas de entrada y salida a partir de los conectores. */
export function extractSchemas(comp: Record<string, unknown>, connectors: ComponentConnector[]): ComponentSchemaDefinition[] {
  const schemas: ComponentSchemaDefinition[] = [];

  const hasInput = connectors.some(c => c.type === "LOOKUP" || c.direction === "input");
  const hasOutput = connectors.some(c => c.type === "FLOW_MAIN" || c.direction === "output");

  if (hasInput) {
    schemas.push({
      name: "InputSchema",
      type: "input",
      schemaType: "built-in",
      columns: [],
    });
  }

  if (hasOutput) {
    schemas.push({
      name: "OutputSchema",
      type: "output",
      schemaType: "built-in",
      columns: [],
    });
  }

  return schemas;
}

/** Recorre el árbol del XML y junta los valores de las claves indicadas. */
export function collectByKey(obj: unknown, keyNames: string[]): unknown[] {
  const found: unknown[] = [];

  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (keyNames.includes(key)) {
        if (Array.isArray(child)) {
          found.push(...child);
        } else {
          found.push(child);
        }
      }
      walk(child);
    }
  }

  walk(obj);
  return found;
}
