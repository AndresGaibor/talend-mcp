import { asArray, parseXml } from "./xml";
import type {
  MapperEntry,
  ParsedJob,
  TalendColumn,
  TalendComponent,
  TalendConnection,
  TalendContextParameter,
  TalendSchema,
} from "./types";

type XmlRecord = Record<string, unknown>;

function attr(nodo: XmlRecord | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === "string" ? valor : undefined;
}

function nodeAttributes(node: XmlRecord): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(node)) {
    if (clave.startsWith("@_") && typeof valor === "string") {
      atributos[clave.slice(2)] = valor;
    }
  }
  return atributos;
}

function boolAttr(nodo: XmlRecord, nombre: string): boolean | undefined {
  const valor = attr(nodo, nombre);
  if (valor === undefined) return undefined;
  return valor === "true";
}

function numberAttr(nodo: XmlRecord, nombre: string): number | undefined {
  const valor = attr(nodo, nombre);
  if (valor === undefined || valor === "") return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

function cleanQuoted(valor: string | undefined): string | undefined {
  if (!valor) return valor;
  return valor.replace(/^&quot;/, "").replace(/&quot;$/, "").replace(/^"/, "").replace(/"$/, "");
}

function parseParameters(node: XmlRecord): Record<string, string> {
  const parametros: Record<string, string> = {};
  for (const parametro of asArray(node.elementParameter as XmlRecord | XmlRecord[] | undefined)) {
    const name = attr(parametro, "name");
    const value = attr(parametro, "value");
    if (name && value !== undefined) parametros[name] = cleanQuoted(value) ?? value;
  }
  return parametros;
}

function parseColumn(column: XmlRecord): TalendColumn {
  return {
    name: attr(column, "name") ?? "",
    type: attr(column, "type"),
    length: numberAttr(column, "length"),
    precision: numberAttr(column, "precision"),
    nullable: boolAttr(column, "nullable"),
    key: boolAttr(column, "key"),
    sourceType: attr(column, "sourceType"),
    pattern: cleanQuoted(attr(column, "pattern")),
  };
}

function parseSchemas(node: XmlRecord): TalendSchema[] {
  return asArray(node.metadata as XmlRecord | XmlRecord[] | undefined).map((metadata) => ({
    connector: attr(metadata, "connector"),
    name: attr(metadata, "name"),
    label: attr(metadata, "label"),
    columns: asArray(metadata.column as XmlRecord | XmlRecord[] | undefined).map(parseColumn),
  }));
}

function parseMapperEntries(node: XmlRecord): MapperEntry[] {
  const nodeData = node.nodeData as XmlRecord | undefined;
  const entries: MapperEntry[] = [];

  for (const tableKey of ["outputTables", "inputTables", "varTables"] as const) {
    for (const table of asArray(nodeData?.[tableKey] as XmlRecord | XmlRecord[] | undefined)) {
      const tableName = attr(table, "name") ?? tableKey;
      for (const entry of asArray(table.mapperTableEntries as XmlRecord | XmlRecord[] | undefined)) {
        entries.push({
          table: tableName,
          name: attr(entry, "name") ?? "",
          expression: attr(entry, "expression"),
          type: attr(entry, "type"),
          nullable: boolAttr(entry, "nullable"),
        });
      }
    }
  }

  return entries;
}

export function parseJobItem(xml: string, itemPath: string): ParsedJob {
  const parsed = parseXml(xml) as Record<string, XmlRecord>;
  const root = parsed["talendfile:ProcessType"] ?? parsed.ProcessType;
  if (!root) throw new Error("XML de job Talend inválido: falta talendfile:ProcessType");

  const contexts = asArray(root.context as XmlRecord | XmlRecord[] | undefined).flatMap((contexto) =>
    asArray(contexto.contextParameter as XmlRecord | XmlRecord[] | undefined).map<TalendContextParameter>(
      (parametro) => ({
        name: attr(parametro, "name") ?? "",
        type: attr(parametro, "type"),
        value: attr(parametro, "value"),
        prompt: attr(parametro, "prompt"),
      }),
    ),
  );

  const components = asArray(root.node as XmlRecord | XmlRecord[] | undefined).map<TalendComponent>((node) => {
    const parameters = parseParameters(node);
    return {
      uniqueName: parameters.UNIQUE_NAME ?? "",
      componentName: attr(node, "componentName") ?? "",
      label: parameters.LABEL,
      nodeAttributes: nodeAttributes(node),
      parameters,
      schemas: parseSchemas(node),
    };
  });

  const mapperEntries = asArray(root.node as XmlRecord | XmlRecord[] | undefined).flatMap(parseMapperEntries);

  const connections = asArray(root.connection as XmlRecord | XmlRecord[] | undefined).map<TalendConnection>(
    (connection) => {
      const parameters = parseParameters(connection);
      return {
        connectorName: attr(connection, "connectorName"),
        label: attr(connection, "label"),
        metaname: attr(connection, "metaname"),
        source: attr(connection, "source") ?? "",
        target: attr(connection, "target") ?? "",
        uniqueName: parameters.UNIQUE_NAME,
      };
    },
  );

  return { itemPath, components, connections, contexts, mapperEntries };
}
