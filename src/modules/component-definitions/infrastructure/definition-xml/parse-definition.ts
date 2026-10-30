import type {
  ComponentDefinition,
  ComponentPalette,
} from "../../domain/component-definition.types";
import { parseConnectors } from "./connectors";
import { parseFamilies, parseImports, parseReturns } from "./imports-returns";
import { parseParameters } from "./parameters";
import type { Messages } from "./parameters";
import { type Bag, asBag, attr, flag, parseXmlBag } from "./xml-helpers";

export type ParseContext = {
  name: string;
  pluginId: string;
  palette: ComponentPalette;
  definitionPath: string;
  /** Etiquetas del `<nombre>_messages.properties`; vacio o ausente si no existe. */
  messages?: Messages;
};

/**
 * Parsea la definición XML de un componente.
 *
 * Devuelve `null` si el XML no es una definición de componente (no tiene
 * `<HEADER>` con nombre).
 */
export function parseDefinitionXml(xml: string, context: ParseContext): ComponentDefinition | null {
  let parsed: Bag;
  try {
    parsed = asBag(parseXmlBag(xml));
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

  const messages = context.messages ?? {};
  const parameters = parseParameters(component, messages);
  const connectors = parseConnectors(component);
  const families = parseFamilies(component);

  const definition: ComponentDefinition = {
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
  if (messages.LONG_NAME !== undefined) definition.label = messages.LONG_NAME;
  if (messages.HELP !== undefined) definition.helpKey = messages.HELP;
  return definition;
}
