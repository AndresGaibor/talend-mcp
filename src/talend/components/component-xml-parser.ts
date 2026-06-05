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

function getAttr(obj: Record<string, any>, key: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const upperKey = key.toUpperCase();
  const lowerKey = key.toLowerCase();
  return (
    obj[`@_${upperKey}`] ??
    obj[`@_${lowerKey}`] ??
    obj[upperKey] ??
    obj[lowerKey]
  );
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
      const match = keyNames.some(
        (kn) =>
          key.toUpperCase() === kn.toUpperCase() ||
          key.toUpperCase() === `@_${kn.toUpperCase()}`
      );
      if (match) {
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

  const PARAMETERS = collectByKey(COMPONENT, ["PARAMETER"]);
  const CONNECTORS = collectByKey(COMPONENT, ["CONNECTOR", "CONNECTORS"]);

  const parameters: ParsedParameter[] = [];
  for (const p of PARAMETERS) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const pName = getAttr(pr, "NAME");
    if (!pName) continue;
    
    const pField = getAttr(pr, "FIELD") ?? "id_String";
    const requiredVal = getAttr(pr, "REQUIRED");
    const defaultVal = getAttr(pr, "DEFAULT") ?? getAttr(pr, "DEFAULT_VALUE");
    const showVal = getAttr(pr, "SHOW");
    const repositoryValue = getAttr(pr, "REPOSITORY_VALUE");

    parameters.push({
      name: String(pName),
      field: String(pField),
      required: requiredVal === "true" || requiredVal === true,
      defaultValue: defaultVal !== undefined && defaultVal !== null ? String(defaultVal) : null,
      show: showVal !== "false" && showVal !== false,
      repositoryValue: repositoryValue !== undefined && repositoryValue !== null ? String(repositoryValue) : null,
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
    const cTypeRaw = getAttr(cr, "CTYPE") ?? getAttr(cr, "TYPE") ?? "FLOW";
    const cType = String(cTypeRaw).toUpperCase() as ParsedConnector["type"];
    const cName = getAttr(cr, "NAME") ?? cType;
    
    const maxInputRaw = getAttr(cr, "MAX_INPUT");
    const maxOutputRaw = getAttr(cr, "MAX_OUTPUT");

    connectors.push({
      name: String(cName),
      type: cType || "UNKNOWN",
      maxInput: maxInputRaw !== undefined && maxInputRaw !== null ? Number(maxInputRaw) : undefined,
      maxOutput: maxOutputRaw !== undefined && maxOutputRaw !== null ? Number(maxOutputRaw) : undefined,
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

  const hasInputSchemaRaw = getAttr(COMPONENT, "INPUT_SCHEMA");
  const hasOutputSchemaRaw = getAttr(COMPONENT, "OUTPUT_SCHEMA");
  const hasDynamicSchemaRaw = getAttr(COMPONENT, "DYNAMIC_SCHEMA");

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

  const STARTABLE = getAttr(HEADER, "STARTABLE") ?? getAttr(COMPONENT, "STARTABLE") ?? false;
  if (STARTABLE === "true" || STARTABLE === true) {
    capabilities.canStartFlow = true;
  }

  let family = "Unknown";
  const familiesObj = COMPONENT.FAMILIES ?? COMPONENT.families;
  if (familiesObj && typeof familiesObj === "object") {
    const familyVal = (familiesObj as Record<string, any>).FAMILY ?? (familiesObj as Record<string, any>).family;
    if (familyVal) {
      if (Array.isArray(familyVal)) {
        family = String(familyVal[0]);
      } else {
        family = String(familyVal);
      }
    }
  } else {
    const headerFamily = getAttr(HEADER, "FAMILY");
    if (headerFamily) {
      family = String(headerFamily);
    }
  }

  return {
    name: String(getAttr(HEADER, "NAME") ?? ""),
    version: String(getAttr(HEADER, "VERSION") ?? "1.0"),
    family,
    parameters,
    connectors,
    schemas,
    capabilities,
    limitations: [],
  };
}
