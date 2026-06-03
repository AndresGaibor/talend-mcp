import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";

export type ComponentJarEntry = {
  componentName: string;
  family: string;
  version: string;
  sourcePlugin: string;
  definitionFiles: string[];
  parameters: JarParameter[];
  connectors: JarConnector[];
  schemas: JarSchemas;
  capabilities: JarCapabilities;
  limitations: string[];
};

export type JarParameter = {
  name: string;
  field: string;
  required: boolean;
  defaultValue: string | null;
  show: boolean;
  repositoryValue: string | null;
  raw?: Record<string, unknown>;
};

export type JarConnector = {
  name: string;
  type: "FLOW" | "ITERATE" | "REJECT" | "LOOKUP" | "UNKNOWN";
  maxInput?: number;
  maxOutput?: number;
};

export type JarSchemas = {
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  hasDynamicSchema: boolean;
};

export type JarCapabilities = {
  canStartFlow: boolean;
  canReceiveFlow: boolean;
  canOutputFlow: boolean;
  canUseReject: boolean;
  canUseIterate: boolean;
};

export type ScanPluginsResult = {
  scannedPlugins: string[];
  entries: ComponentJarEntry[];
  errors: string[];
};

function getTalendStudioPath(): string {
  const p1 = "/Applications/TalendStudio-8.0.1/studio/plugins";
  if (existsSync(p1)) return p1;
  const home = process.env.HOME ?? "";
  const p2 = home + "/TalendStudio/plugins";
  if (existsSync(p2)) return p2;
  return process.env.TALEND_STUDIO_PATH ?? p1;
}

function findProviderDir(pluginsDir: string): string | null {
  try {
    const dirs = readdirSync(pluginsDir);
    const provider = dirs.find((d) => d.startsWith("org.talend.designer.components.localprovider_"));
    return provider ? join(pluginsDir, provider) : null;
  } catch { return null; }
}

function findLocalComponentsDir(pluginsDir: string): string | null {
  const pd = findProviderDir(pluginsDir);
  if (!pd) return null;
  const cd = join(pd, "components");
  return existsSync(cd) ? cd : null;
}

function listComponentDirs(cd: string): string[] {
  try {
    return readdirSync(cd).filter((d) => {
      try { return statSync(join(cd, d)).isDirectory() && !d.startsWith("."); }
      catch { return false; }
    });
  } catch { return []; }
}

function extract(xml: string, pt: RegExp, fallback: string): string {
  const m = pt.exec(xml);
  if (!m) return fallback;
  return (m[1] as string) ?? fallback;
}

function extractOpt(xml: string, pt: RegExp): string | null {
  const m = pt.exec(xml);
  if (!m) return null;
  return (m[1] as string) ?? null;
}

function extractBool(xml: string, pt: RegExp, fallback: boolean): boolean {
  const m = pt.exec(xml);
  if (!m) return fallback;
  return (m[1] as string) === "true";
}

function extractNum(xml: string, pt: RegExp): number | undefined {
  const m = pt.exec(xml);
  if (!m) return undefined;
  const n = parseInt(m[1] as string, 10);
  return isNaN(n) ? undefined : n;
}

export function parseComponentXml(xml: string): {
  name: string; version: string; family: string;
  parameters: JarParameter[]; connectors: JarConnector[];
  schemas: JarSchemas; capabilities: JarCapabilities; limitations: string[];
} {
  const parameters: JarParameter[] = [];
  const connectors: JarConnector[] = [];
  const schemas: JarSchemas = { hasInputSchema: false, hasOutputSchema: false, hasDynamicSchema: false };
  const capabilities: JarCapabilities = { canStartFlow: false, canReceiveFlow: false, canOutputFlow: false, canUseReject: false, canUseIterate: false };
  const limitations: string[] = [];

  const name = extract(xml, /<NAME>([^<]+)<\/NAME>/, "");
  const version = extract(xml, /<VERSION>([^<]+)<\/VERSION>/, "1.0");
  const family = extract(xml, /<FAMILY>([^<]+)<\/FAMILY>/, "Unknown");

  for (const mx of xml.matchAll(/<PARAMETER[^>]*>([\s\S]*?)<\/PARAMETER>/g)) {
    const px = mx[1] as string;
    const pName = extractOpt(px, /<NAME>([^<]+)<\/NAME>/);
    if (!pName) continue;
    parameters.push({
      name: pName,
      field: extract(px, /<FIELD>([^<]+)<\/FIELD>/, "id_String"),
      required: extractBool(px, /<REQUIRED>([^<]+)<\/REQUIRED>/, false),
      defaultValue: extract(px, /<DEFAULT>([^<]*)<\/DEFAULT>/, "") || null,
      show: extractBool(px, /<SHOW>([^<]+)<\/SHOW>/, true),
      repositoryValue: extractOpt(px, /<REPOSITORY_VALUE>([^<]*)<\/REPOSITORY_VALUE>/),
    });
  }

  for (const mx of xml.matchAll(/<CONNECTOR[^>]*>([\s\S]*?)<\/CONNECTOR>/g)) {
    const cx = mx[1] as string;
    const cName = extract(cx, /<NAME>([^<]+)<\/NAME>/, "FLOW");
    const ct = extract(cx, /<TYPE>([^<]+)<\/TYPE>/, "FLOW").toUpperCase() as JarConnector["type"];
    connectors.push({ name: cName, type: ct || "UNKNOWN", maxInput: extractNum(cx, /<MAX_INPUT>([^<]+)<\/MAX_INPUT>/), maxOutput: extractNum(cx, /<MAX_OUTPUT>([^<]+)<\/MAX_OUTPUT>/) });
    if (ct === "FLOW") { capabilities.canReceiveFlow = true; capabilities.canOutputFlow = true; }
    else if (ct === "ITERATE") { capabilities.canUseIterate = true; }
    else if (ct === "REJECT") { capabilities.canUseReject = true; }
  }

  if (extractBool(xml, /<STARTABLE>([^<]+)<\/STARTABLE>/, false)) capabilities.canStartFlow = true;
  if (extractBool(xml, /<INPUT_SCHEMA>([^<]+)<\/INPUT_SCHEMA>/, false)) schemas.hasInputSchema = true;
  if (extractBool(xml, /<OUTPUT_SCHEMA>([^<]+)<\/OUTPUT_SCHEMA>/, false)) schemas.hasOutputSchema = true;
  if (extractBool(xml, /<DYNAMIC_SCHEMA>([^<]+)<\/DYNAMIC_SCHEMA>/, false)) schemas.hasDynamicSchema = true;

  return { name, version, family, parameters, connectors, schemas, capabilities, limitations };
}

function scanComponentDir(dirName: string, cd: string, src: string): ComponentJarEntry | null {
  for (const xn of [dirName + "_java.xml", dirName + ".xml", "component.xml"]) {
    const xp = join(cd, dirName, xn);
    if (existsSync(xp)) {
      try { const p = parseComponentXml(readFileSync(xp, "utf8")); return { componentName: p.name || dirName, family: p.family, version: p.version, sourcePlugin: src, definitionFiles: [xp], parameters: p.parameters, connectors: p.connectors, schemas: p.schemas, capabilities: p.capabilities, limitations: p.limitations }; }
      catch { return null; }
    }
  }
  return null;
}

export async function scanInstalledPlugins(options?: { pluginsDir?: string }): Promise<ScanPluginsResult> {
  const errors: string[] = [];
  const scannedPlugins: string[] = [];
  const entries: ComponentJarEntry[] = [];
  const pluginsDir = options?.pluginsDir ?? getTalendStudioPath();
  const cd = findLocalComponentsDir(pluginsDir);
  if (!cd) return { scannedPlugins: [], entries: [], errors: ["Cannot find Talend components dir at " + pluginsDir] };
  try { for (const d of readdirSync(pluginsDir).filter((d) => d.startsWith("org.talend.designer.") || d.startsWith("org.talend.l"))) scannedPlugins.push(d); }
  catch (e) { errors.push("Cannot read plugins: " + e); }
  for (const dn of listComponentDirs(cd)) { const e = scanComponentDir(dn, cd, basename(cd)); if (e) entries.push(e); }
  return { scannedPlugins, entries, errors };
}

export function entriesToCatalogFormat(entries: ComponentJarEntry[], scannedPlugins: string[], errors: string[], talendStudioHome: string): {
  generatedAt: number; talendStudioHome: string; entries: ComponentJarEntry[]; errors: string[]; scannedPlugins: string[];
} { return { generatedAt: Date.now(), talendStudioHome, entries, errors, scannedPlugins }; }
