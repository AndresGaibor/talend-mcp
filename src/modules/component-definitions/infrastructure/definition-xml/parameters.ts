import type {
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
 * Estructura de la tabla de un parámetro de tipo TABLE.
 *
 * El XML declara las columnas con su valor por defecto. Una celda puede ser
 * una lista cerrada (`FIELD="CLOSED_LIST"`), y entonces su valor por defecto
 * es el del elemento que marca `DEFAULT`.
 */
export function parseTable(parameter: Bag): DefinitionTable | undefined {
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

export function parseParameters(component: Bag): DefinitionParameter[] {
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
