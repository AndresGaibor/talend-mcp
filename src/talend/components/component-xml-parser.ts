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

function collectByKey(obj: unknown, keyNames: string[]): unknown[] {
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
        found.push(...toArray(child as any));
      }
      walk(child);
    }
  }

  walk(obj);
  return found;
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
  const parsed = parser.parse(xml) as Record<string, unknown>;

  const rawComponent = parsed.COMPONENT ?? parsed.component ?? {};
  const COMPONENT = rawComponent as Record<string, unknown>;
  const rawHeader = COMPONENT.HEADER ?? COMPONENT.header ?? {};
  const HEADER = rawHeader as Record<string, unknown>;
  const rawImpl = COMPONENT.IMPL ?? COMPONENT.impl ?? {};
  const IMPL = rawImpl as Record<string, unknown>;

  const PARAMETERS = collectByKey(COMPONENT, ["PARAMETER", "parameter"]);
  const CONNECTORS = collectByKey(COMPONENT, ["CONNECTOR", "connector", "CONNECTORS", "connectors"]);

  const parameters: ParsedParameter[] = [];
  for (const p of PARAMETERS) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const pName = pr.NAME ?? pr.name ?? pr["@_name"] ?? "";
    if (!pName) continue;
    parameters.push({
      name: String(pName),
      field: String(pr.FIELD ?? pr.field ?? "id_String"),
      required: pr.REQUIRED === "true" || pr.required === "true" || pr["@_required"] === "true",
      defaultValue: String(pr.DEFAULT ?? pr.defaultValue ?? pr["@_default"] ?? null),
      show: pr.SHOW !== "false" && pr.show !== "false",
      repositoryValue: String(pr.REPOSITORY_VALUE ?? pr.repositoryValue ?? null),
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
    if (!c || typeof c !== "object") continue;
    const cr = c as Record<string, unknown>;
    const cName = cr.NAME ?? cr.name ?? "FLOW";
    const cTypeRaw = (cr.TYPE ?? cr.type ?? "FLOW") as unknown;
    const cType = String(cTypeRaw).toUpperCase() as ParsedConnector["type"];
    connectors.push({
      name: String(cName),
      type: cType || "UNKNOWN",
      maxInput: typeof cr.MAX_INPUT === "number" ? cr.MAX_INPUT : typeof cr.maxInput === "number" ? cr.maxInput : undefined,
      maxOutput: typeof cr.MAX_OUTPUT === "number" ? cr.MAX_OUTPUT : typeof cr.maxOutput === "number" ? cr.maxOutput : undefined,
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

  const hasInputSchemaRaw = COMPONENT.INPUT_SCHEMA ?? COMPONENT.inputSchema;
  const hasOutputSchemaRaw = COMPONENT.OUTPUT_SCHEMA ?? COMPONENT.outputSchema;
  const hasDynamicSchemaRaw = COMPONENT.DYNAMIC_SCHEMA ?? COMPONENT.dynamicSchema;

  const schemas = {
    hasInputSchema:
      hasInputSchemaRaw === "true" ||
      hasInputSchemaRaw === true ||
      parameters.some((p) => String(p.field).includes("SCHEMA")),
    hasOutputSchema:
      hasOutputSchemaRaw === "true" ||
      hasOutputSchemaRaw === true ||
      connectors.some((c) => String(c.type).toUpperCase() === "FLOW"),
    hasDynamicSchema:
      hasDynamicSchemaRaw === "true" ||
      hasDynamicSchemaRaw === true ||
      xml.includes("DYNAMIC"),
  };

  const STARTABLE = HEADER.STARTABLE ?? HEADER.startable ?? COMPONENT.STARTABLE ?? false;
  const startableRaw = STARTABLE as unknown;
  if (startableRaw === "true" || startableRaw === true) {
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
