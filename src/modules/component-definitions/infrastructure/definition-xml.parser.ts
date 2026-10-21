import { XMLParser } from "fast-xml-parser";
import type {
  ComponentDefinition,
  ComponentPalette,
  DefinitionConnector,
  DefinitionImport,
  DefinitionParameter,
  DefinitionReturn,
  DefinitionTable,
  DefinitionTableColumn,
} from "../domain/component-definition.types";

/**
 * Lector de la definición XML de un componente (`<nombre>_java.xml`).
 *
 * El XML de Talend es la fuente autoritativa de lo que un componente exige:
 * qué parámetros son obligatorios (`REQUIRED`), con qué valor por defecto
 * (`<DEFAULT>`), cuándo se ven (`SHOW_IF`, `NOT_SHOW_IF`), qué conexiones
 * admite (`<CONNECTORS>`) y qué artefactos necesita (`<IMPORTS>`).
 *
 * Los atributos llegan con el prefijo `@_` y los valores por defecto vienen
 * como elemento hijo (`<DEFAULT>...</DEFAULT>`), no como atributo: los dos
 * casos se contemplan.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
});

export type ParseContext = {
  name: string;
  pluginId: string;
  palette: ComponentPalette;
  definitionPath: string;
};

type Bag = Record<string, unknown>;

function asBag(value: unknown): Bag {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Bag) : {};
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Atributo XML (`@_NAME`), con alternativa sin prefijo. */
function attr(bag: Bag, key: string): string | undefined {
  const upper = key.toUpperCase();
  const raw = bag[`@_${upper}`] ?? bag[upper] ?? bag[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "object") return undefined;
  return String(raw);
}

function flag(bag: Bag, key: string, fallback: boolean): boolean {
  const raw = attr(bag, key);
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

/**
 * Texto de un elemento que puede ser texto plano o un objeto con `#text`.
 */
function textOf(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const bag = asBag(value);
  const inner = bag["#text"];
  if (inner !== undefined && inner !== null) return String(inner);
  return undefined;
}

/** `<DEFAULT>` puede ser atributo o elemento hijo. */
function defaultValueOf(parameter: Bag): string | undefined {
  const fromAttribute = attr(parameter, "DEFAULT");
  if (fromAttribute !== undefined) return fromAttribute;
  return textOf(parameter["DEFAULT"] ?? parameter["default"]);
}

function parseItems(parameter: Bag): string[] | undefined {
  const items = asBag(parameter["ITEMS"] ?? parameter["items"]);
  const list = asArray(items["ITEM"] ?? items["item"]);
  if (list.length === 0) return undefined;
  const values: string[] = [];
  for (const raw of list) {
    const item = asBag(raw);
    const value = attr(item, "VALUE") ?? attr(item, "NAME");
    if (value !== undefined) values.push(value);
  }
  return values.length > 0 ? values : undefined;
}

/**
 * Estructura de la tabla de un parámetro de tipo TABLE.
 *
 * El XML declara las columnas con su valor por defecto. Una celda puede ser
 * una lista cerrada (`FIELD="CLOSED_LIST"`), y entonces su valor por defecto
 * es el del elemento que marca `DEFAULT`.
 */
function parseTable(parameter: Bag): DefinitionTable | undefined {
  const items = asBag(parameter["ITEMS"] ?? parameter["items"]);
  const list = asArray(items["ITEM"] ?? items["item"]);
  if (list.length === 0) return undefined;

  const columns: DefinitionTableColumn[] = [];
  for (const raw of list) {
    const item = asBag(raw);
    const name = attr(item, "NAME");
    if (!name) continue;
    const column: DefinitionTableColumn = { name };
    const value = attr(item, "VALUE");
    if (value !== undefined) {
      column.defaultValue = value;
    }
    const inner = asBag(item["ITEMS"] ?? item["items"]);
    const options = asArray(inner["ITEM"] ?? inner["item"]);
    if (options.length > 0) {
      const parsed: Array<{ name: string; value: string }> = [];
      for (const rawOption of options) {
        const option = asBag(rawOption);
        const optionName = attr(option, "NAME");
        const optionValue = attr(option, "VALUE");
        if (optionName && optionValue !== undefined) {
          parsed.push({ name: optionName, value: optionValue });
        }
      }
      if (parsed.length > 0) {
        column.options = parsed;
        const preferred = attr(inner, "DEFAULT");
        const chosen = parsed.find((option) => option.name === preferred) ?? parsed[0];
        column.defaultValue = chosen?.value;
      }
    }
    columns.push(column);
  }

  const rows = Number(attr(parameter, "NB_LINES") ?? "0");
  return {
    basedOnSchema: attr(items, "BASED_ON_SCHEMA") === "true",
    rows: Number.isFinite(rows) ? rows : 0,
    columns,
  };
}

function parseParameters(component: Bag): DefinitionParameter[] {
  const parameters: DefinitionParameter[] = [];
  const seen = new Set<string>();

  const sections: Array<{ bag: Bag; advanced: boolean }> = [
    { bag: asBag(component["PARAMETERS"] ?? component["parameters"]), advanced: false },
    {
      bag: asBag(component["ADVANCED_PARAMETERS"] ?? component["advanced_parameters"]),
      advanced: true,
    },
  ];

  for (const section of sections) {
    for (const raw of asArray(section.bag["PARAMETER"] ?? section.bag["parameter"])) {
      const parameter = asBag(raw);
      const name = attr(parameter, "NAME");
      if (!name || seen.has(name)) continue;
      seen.add(name);

      parameters.push({
        name,
        field: attr(parameter, "FIELD") ?? "TEXT",
        required: flag(parameter, "REQUIRED", false),
        show: flag(parameter, "SHOW", true),
        showIf: attr(parameter, "SHOW_IF"),
        notShowIf: attr(parameter, "NOT_SHOW_IF"),
        defaultValue: defaultValueOf(parameter),
        repositoryValue: attr(parameter, "REPOSITORY_VALUE"),
        possibleValues: parseItems(parameter),
        advanced: section.advanced,
        table: parseTable(parameter),
      });
    }
  }

  return parameters;
}

function parseConnectors(component: Bag): DefinitionConnector[] {
  const section = asBag(component["CONNECTORS"] ?? component["connectors"]);
  const connectors: DefinitionConnector[] = [];
  for (const raw of asArray(section["CONNECTOR"] ?? section["connector"])) {
    const connector = asBag(raw);
    const type = attr(connector, "CTYPE") ?? attr(connector, "TYPE");
    if (!type) continue;
    const maxInput = attr(connector, "MAX_INPUT");
    const maxOutput = attr(connector, "MAX_OUTPUT");
    // El conector principal no tiene NAME: se llama como su tipo.
    const name = attr(connector, "NAME") ?? type;
    connectors.push({
      name: name.toUpperCase(),
      type: type.toUpperCase(),
      maxInput: maxInput === undefined ? undefined : Number(maxInput),
      maxOutput: maxOutput === undefined ? undefined : Number(maxOutput),
    });
  }
  return connectors;
}

function parseImports(component: Bag): DefinitionImport[] {
  const codegen = asBag(component["CODEGENERATION"] ?? component["codegeneration"]);
  const imports = asBag(codegen["IMPORTS"] ?? codegen["imports"]);
  const result: DefinitionImport[] = [];
  for (const raw of asArray(imports["IMPORT"] ?? imports["import"])) {
    const item = asBag(raw);
    const name = attr(item, "NAME");
    if (!name) continue;
    result.push({
      name,
      module: attr(item, "MODULE"),
      mvn: attr(item, "MVN"),
      required: flag(item, "REQUIRED", false),
    });
  }
  return result;
}

function parseReturns(component: Bag): DefinitionReturn[] {
  const section = asBag(component["RETURNS"] ?? component["returns"]);
  const result: DefinitionReturn[] = [];
  for (const raw of asArray(section["RETURN"] ?? section["return"])) {
    const item = asBag(raw);
    const name = attr(item, "NAME");
    if (!name) continue;
    result.push({
      name,
      type: attr(item, "TYPE") ?? "id_String",
      availability: attr(item, "AVAILABILITY"),
    });
  }
  return result;
}

function parseFamilies(component: Bag): string[] {
  const families = asBag(component["FAMILIES"] ?? component["families"]);
  const values = asArray(families["FAMILY"] ?? families["family"])
    .map((raw) => textOf(raw))
    .filter((value): value is string => Boolean(value && value.trim()));
  if (values.length > 0) return values;
  const header = asBag(component["HEADER"] ?? component["header"]);
  const fromHeader = attr(header, "FAMILY");
  return fromHeader ? [fromHeader] : ["Unknown"];
}

/**
 * Parsea la definición XML de un componente.
 *
 * Devuelve `null` si el XML no es una definición de componente (no tiene
 * `<HEADER>` con nombre).
 */
export function parseDefinitionXml(xml: string, context: ParseContext): ComponentDefinition | null {
  let parsed: Bag;
  try {
    parsed = asBag(parser.parse(xml));
  } catch {
    return null;
  }

  const root = parsed["COMPONENT"] ?? parsed["component"];
  if (!root || typeof root !== "object") {
    // No es la definicion de un componente.
    return null;
  }
  const component = asBag(root);
  const header = asBag(component["HEADER"] ?? component["header"]);
  const name = attr(header, "NAME") ?? context.name;
  if (!name) return null;

  const parameters = parseParameters(component);
  const connectors = parseConnectors(component);
  const families = parseFamilies(component);

  return {
    name,
    family: families[0] ?? "Unknown",
    families,
    version: attr(header, "VERSION"),
    startable: flag(header, "STARTABLE", false),
    palette: context.palette,
    pluginId: context.pluginId,
    definitionPath: context.definitionPath,
    parameters,
    requiredParameters: parameters.filter((parameter) => parameter.required),
    connectors,
    imports: parseImports(component),
    returns: parseReturns(component),
  };
}
