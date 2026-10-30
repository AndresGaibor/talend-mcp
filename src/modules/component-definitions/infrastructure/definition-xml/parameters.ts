import type {
  DefinitionOption,
  DefinitionParameter,
  DefinitionTable,
  DefinitionTableColumn,
} from "../../domain/component-definition.types";
import {
  type Bag,
  asArray,
  asBag,
  attr,
  defaultValueOf,
  flag,
} from "./xml-helpers";

/** Etiquetas del properties del componente (vacio si no existe el fichero). */
export type Messages = Record<string, string>;

/** Etiqueta de una clave del properties, o undefined si no esta. */
function labelOf(messages: Messages, key: string): string | undefined {
  return messages[key];
}

export function parseItems(parameter: Bag): string[] | undefined {
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
 * Elementos de una lista cerrada, con nombre y valor (`<ITEM NAME="AND" VALUE="&amp;&amp;"/>`).
 * La etiqueta visible sale de `<PARAM>.ITEM.<NAME>` del properties.
 */
export function parseOptions(
  parameter: Bag,
  messages: Messages = {},
  paramName = attr(parameter, "NAME") ?? "",
): DefinitionOption[] | undefined {
  const items = asBag(parameter["ITEMS"] ?? parameter["items"]);
  const options: DefinitionOption[] = [];
  for (const raw of asArray(items["ITEM"] ?? items["item"])) {
    const item = asBag(raw);
    const name = attr(item, "NAME");
    if (!name) continue;
    const option: DefinitionOption = { name, value: attr(item, "VALUE") ?? name };
    const label = labelOf(messages, `${paramName}.ITEM.${name}`);
    if (label !== undefined) option.label = label;
    options.push(option);
  }
  return options.length > 0 ? options : undefined;
}

/**
 * Estructura de la tabla de un parámetro de tipo TABLE.
 *
 * El XML declara las columnas con su valor por defecto. Una celda puede ser
 * una lista cerrada (`FIELD="CLOSED_LIST"`), y entonces su valor por defecto
 * es el del elemento que marca `DEFAULT`. Las etiquetas de columna y de sus
 * opciones salen de `<PARAM>.ITEM.<COLUMN>` y `<PARAM>.ITEM.<COLUMN>.ITEM.<OPTION>`.
 */
export function parseTable(
  parameter: Bag,
  messages: Messages = {},
  paramName = attr(parameter, "NAME") ?? "",
): DefinitionTable | undefined {
  const items = asBag(parameter["ITEMS"] ?? parameter["items"]);
  const list = asArray(items["ITEM"] ?? items["item"]);
  if (list.length === 0) return undefined;

  const columns: DefinitionTableColumn[] = [];
  for (const raw of list) {
    const item = asBag(raw);
    const name = attr(item, "NAME");
    if (!name) continue;
    const columnKey = `${paramName}.ITEM.${name}`;
    const column: DefinitionTableColumn = { name };
    const label = labelOf(messages, columnKey);
    if (label !== undefined) column.label = label;
    const value = attr(item, "VALUE");
    if (value !== undefined) {
      column.defaultValue = value;
    }
    const inner = asBag(item["ITEMS"] ?? item["items"]);
    const options = asArray(inner["ITEM"] ?? inner["item"]);
    if (options.length > 0) {
      const parsed: DefinitionOption[] = [];
      for (const rawOption of options) {
        const option = asBag(rawOption);
        const optionName = attr(option, "NAME");
        const optionValue = attr(option, "VALUE");
        if (optionName && optionValue !== undefined) {
          const parsedOption: DefinitionOption = { name: optionName, value: optionValue };
          const optionLabel = labelOf(messages, `${columnKey}.ITEM.${optionName}`);
          if (optionLabel !== undefined) parsedOption.label = optionLabel;
          parsed.push(parsedOption);
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

/** `NUM_ROW` como numero; undefined si no esta o no es numerico. */
function numRowOf(parameter: Bag): number | undefined {
  const raw = attr(parameter, "NUM_ROW");
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function parseParameters(component: Bag, messages: Messages = {}): DefinitionParameter[] {
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

      const isList = /LIST$/.test(attr(parameter, "FIELD") ?? "");
      const definition: DefinitionParameter = {
        name,
        field: attr(parameter, "FIELD") ?? "TEXT",
        required: flag(parameter, "REQUIRED", false),
        show: flag(parameter, "SHOW", true),
        showIf: attr(parameter, "SHOW_IF"),
        notShowIf: attr(parameter, "NOT_SHOW_IF"),
        defaultValue: defaultValueOf(parameter),
        repositoryValue: attr(parameter, "REPOSITORY_VALUE"),
        possibleValues: parseItems(parameter),
        options: isList ? parseOptions(parameter, messages, name) : undefined,
        defaultOption: isList
          ? attr(asBag(parameter["ITEMS"] ?? parameter["items"]), "DEFAULT")
          : undefined,
        advanced: section.advanced,
        table: parseTable(parameter, messages, name),
      };
      const label = labelOf(messages, `${name}.NAME`);
      if (label !== undefined) definition.label = label;
      const numRow = numRowOf(parameter);
      if (numRow !== undefined) definition.numRow = numRow;
      const group = attr(parameter, "GROUP");
      if (group) definition.group = group;
      const help = labelOf(messages, `${name}.HELP`);
      if (help !== undefined) definition.help = help;
      parameters.push(definition);
    }
  }

  return parameters;
}
