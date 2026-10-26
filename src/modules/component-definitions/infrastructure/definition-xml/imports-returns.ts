import type {
  DefinitionImport,
  DefinitionReturn,
} from "../../domain/component-definition.types";
import { type Bag, asArray, asBag, attr, flag, textOf } from "./xml-helpers";

/** Artefactos que el componente necesita para generar código (`<IMPORTS>`). */
export function parseImports(component: Bag): DefinitionImport[] {
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

/** Columnas que el componente devuelve (`<RETURNS>`). */
export function parseReturns(component: Bag): DefinitionReturn[] {
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

/** Familias del componente (`<FAMILIES>`), con la del `<HEADER>` como respaldo. */
export function parseFamilies(component: Bag): string[] {
  const families = asBag(component["FAMILIES"] ?? component["families"]);
  const values = asArray(families["FAMILY"] ?? families["family"])
    .map((raw) => textOf(raw))
    .filter((value): value is string => Boolean(value && value.trim()));
  if (values.length > 0) return values;
  const header = asBag(component["HEADER"] ?? component["header"]);
  const fromHeader = attr(header, "FAMILY");
  return fromHeader ? [fromHeader] : ["Unknown"];
}
