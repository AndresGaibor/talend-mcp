import { generateTalendId } from "../utils";
import { buildMapNodeData } from "../component-mappers";
import { buildColumn } from "./columns";
import type { ComponentSpec, ConnectionSpec } from "./types";

function buildElementParameter(name: string, value: string, field = "TEXT"): Record<string, unknown> {
  return { "@_field": field, "@_name": name, "@_value": value };
}

/**
 * Tabla `LENGTHS` de `tLogRow`: un par SCHEMA_COLUMN/LENGTH por columna.
 *
 * La longitud por defecto es 10, que es la que usan los jobs de Talend.
 */
function buildLogRowLengths(spec: ComponentSpec): Record<string, unknown>[] | null {
  const columns = spec.schema?.columns;
  if (!Array.isArray(columns) || columns.length === 0) {
    return null;
  }

  const values: Record<string, unknown>[] = [];
  let id = 0;
  for (const column of columns) {
    values.push({ "@_elementRef": "SCHEMA_COLUMN", "@_value": column.name, "@_id": String(id++) });
    values.push({ "@_elementRef": "LENGTH", "@_value": String(column.length ?? 10), "@_id": String(id++) });
  }
  return values;
}

export function buildComponentNode(spec: ComponentSpec): Record<string, unknown> {
  const parameters: Record<string, unknown>[] = [buildElementParameter("UNIQUE_NAME", spec.uniqueName)];
  if (spec.label) parameters.push(buildElementParameter("LABEL", spec.label));

  if (spec.parameters) {
    for (const [key, raw] of Object.entries(spec.parameters)) {
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
        const typed = raw as { value: string; field?: string };
        parameters.push(buildElementParameter(key, typed.value, typed.field ?? "TEXT"));
        continue;
      }
      if (typeof raw === "object" && raw !== null) {
        parameters.push({
          "@_field": "TABLE",
          "@_name": key,
          elementValue: raw,
        });
      } else {
        parameters.push(buildElementParameter(key, raw as string));
      }
    }
  }

  // `tLogRow` necesita varios parametros que el generador de codigo de Talend
  // lee sin comprobar que existan. Si faltan, falla con
  // `NumberFormatException: For input string: "Main1100Main1"`.
  //
  //   LENGTHS                tabla con un par SCHEMA_COLUMN/LENGTH por columna
  //   PRINT_CONTENT_WITH_LOG4J  registra con log4j en vez del main del job
  //   SCHEMA_OPT_NUM         limite de filas que imprime el log
  //
  // Ver docs/TALEND-STUDIO-INTERNALS.md.
  if (spec.componentName === "tLogRow") {
    const lengths = buildLogRowLengths(spec);
    if (lengths && !("LENGTHS" in (spec.parameters ?? {}))) {
      parameters.push({ "@_field": "TABLE", "@_name": "LENGTHS", elementValue: lengths });
    }

    if (!("PRINT_CONTENT_WITH_LOG4J" in (spec.parameters ?? {}))) {
      parameters.push(buildElementParameter("PRINT_CONTENT_WITH_LOG4J", "true", "CHECK"));
    }

    if (!("SCHEMA_OPT_NUM" in (spec.parameters ?? {}))) {
      parameters.push(buildElementParameter("SCHEMA_OPT_NUM", "100", "TEXT"));
    }
  }

  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_componentName": spec.componentName,
    elementParameter: parameters.length === 1 ? parameters[0] : parameters,
  };

  if (spec.componentVersion) node["@_componentVersion"] = spec.componentVersion;
  if (spec.posX !== undefined) node["@_posX"] = String(spec.posX);
  if (spec.posY !== undefined) node["@_posY"] = String(spec.posY);

  if (spec.schema && spec.schema.columns && Array.isArray(spec.schema.columns)) {
    // El nombre del metadata es el unique name del componente. Usar el nombre
    // de la primera columna deja el modelo de Studio inconsistente.
    const metadataName = spec.schema.name ?? spec.uniqueName;
    const metadata: Record<string, unknown> = {
      "@_connector": spec.schema.connector ?? "FLOW",
      "@_label": metadataName,
      "@_name": metadataName,
      "@_xmi:id": generateTalendId(),
      column: spec.schema.columns.map((c) => buildColumn(c)),
    };
    node.metadata = metadata;
  }

  if (spec.componentName === "tMap") {
    node.nodeData = (spec as any).nodeData ?? buildMapNodeData(spec.uniqueName);
  }

  return node;
}

export function buildConnectionNode(spec: ConnectionSpec): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@_xmi:id": generateTalendId(),
    "@_source": spec.source,
    "@_target": spec.target,
    "@_label": spec.label,
    elementParameter: buildElementParameter("UNIQUE_NAME", spec.uniqueName ?? spec.label),
  };
  if (spec.connectorName) node["@_connectorName"] = spec.connectorName;
  if (spec.metaname) node["@_metaname"] = spec.metaname;
  return node;
}
