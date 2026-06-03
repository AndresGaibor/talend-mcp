import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export type ParsedComponent = {
  name: string;
  version: string;
  family: string;
  parameters: ParsedParameter[];
  connectors: ParsedConnector[];
  schemas: {
    hasInputSchema: boolean;
    hasOutputSchema: boolean;
    hasDynamicSchema: boolean;
  };
  capabilities: {
    canStartFlow: boolean;
    canReceiveFlow: boolean;
    canOutputFlow: boolean;
    canUseReject: boolean;
    canUseIterate: boolean;
  };
  limitations: string[];
};

export type ParsedParameter = {
  name: string;
  field: string;
  required: boolean;
  defaultValue: string | null;
  show: boolean;
  repositoryValue: string | null;
};

export type ParsedConnector = {
  name: string;
  type: "FLOW" | "ITERATE" | "REJECT" | "LOOKUP" | "UNKNOWN";
  maxInput?: number;
  maxOutput?: number;
};

export function parseComponentXmlWithParser(xml: string): ParsedComponent {
  const parsed = parser.parse(xml);

  const COMPONENT = parsed.COMPONENT ?? parsed.component ?? {};
  const HEADER = COMPONENT.HEADER ?? COMPONENT.header ?? {};
  const IMPL = COMPONENT.IMPL ?? COMPONENT.impl ?? {};
  const PARAMETERS = toArray(IMPL.PARAMETER ?? IMPL.parameter);
  const CONNECTORS = toArray(IMPL.CONNECTOR ?? IMPL.connector ?? IMPL.CONNECTORS ?? IMPL.connectors);

  const parameters: ParsedParameter[] = [];
  for (const p of PARAMETERS) {
    if (!p) continue;
    const pName = p.NAME ?? p.name ?? p["@_name"] ?? "";
    if (!pName) continue;
    parameters.push({
      name: String(pName),
      field: String(p.FIELD ?? p.field ?? "id_String"),
      required: p.REQUIRED === "true" || p.required === "true" || p["@_required"] === "true",
      defaultValue: p.DEFAULT ?? p.defaultValue ?? p["@_default"] ?? null,
      show: p.SHOW !== "false" && p.show !== "false",
      repositoryValue: p.REPOSITORY_VALUE ?? p.repositoryValue ?? null,
    });
  }

  const connectors: ParsedConnector[] = [];
  const capabilities = {
    canStartFlow: false,
    canReceiveFlow: false,
    canOutputFlow: false,
    canUseReject: false,
    canUseIterate: false,
  };

  for (const c of CONNECTORS) {
    if (!c) continue;
    const cName = c.NAME ?? c.name ?? "FLOW";
    const cType = (c.TYPE ?? c.type ?? "FLOW").toUpperCase() as ParsedConnector["type"];
    connectors.push({
      name: String(cName),
      type: cType || "UNKNOWN",
      maxInput: c.MAX_INPUT ?? c.maxInput ?? undefined,
      maxOutput: c.MAX_OUTPUT ?? c.maxOutput ?? undefined,
    });
    if (cType === "FLOW") {
      capabilities.canReceiveFlow = true;
      capabilities.canOutputFlow = true;
    } else if (cType === "ITERATE") {
      capabilities.canUseIterate = true;
    } else if (cType === "REJECT") {
      capabilities.canUseReject = true;
    }
  }

  const schemas = {
    hasInputSchema: COMPONENT.INPUT_SCHEMA === "true" || COMPONENT.inputSchema === "true",
    hasOutputSchema: COMPONENT.OUTPUT_SCHEMA === "true" || COMPONENT.outputSchema === "true",
    hasDynamicSchema: COMPONENT.DYNAMIC_SCHEMA === "true" || COMPONENT.dynamicSchema === "true",
  };

  const STARTABLE = HEADER.STARTABLE ?? HEADER.startable ?? COMPONENT.STARTABLE ?? false;
  if (STARTABLE === "true" || STARTABLE === true) {
    capabilities.canStartFlow = true;
  }

  return {
    name: String(HEADER.NAME ?? HEADER.name ?? ""),
    version: String(HEADER.VERSION ?? HEADER.version ?? "1.0"),
    family: String(HEADER.FAMILY ?? HEADER.family ?? "Unknown"),
    parameters,
    connectors,
    schemas,
    capabilities,
    limitations: [],
  };
}