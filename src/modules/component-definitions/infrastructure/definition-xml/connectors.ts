import type { DefinitionConnector } from "../../domain/component-definition.types";
import { type Bag, asArray, asBag, attr } from "./xml-helpers";

export function parseConnectors(component: Bag): DefinitionConnector[] {
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
