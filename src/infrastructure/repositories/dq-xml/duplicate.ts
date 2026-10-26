import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseXml } from "../../xml/xml-utils";
import { parseDQAnalysisFromXml } from "./read";
import type { XmlRecord } from "./types";
import { updateDQAnalysisPropertiesXmlInternal, updateDQAnalysisXmlInternal } from "./update";

/** Duplica un análisis DQ con un nombre nuevo, conservando su versión. */
export async function duplicateDqAnalysis(analysisPath: string, newName: string): Promise<{ anaPath: string; propertiesPath: string }> {
  const anaPath = analysisPath.endsWith(".ana") ? analysisPath : `${analysisPath}.ana`;
  const propsPath = anaPath.replace(/\.ana$/, ".properties");

  if (!existsSync(anaPath)) throw new Error(`Archivo .ana no encontrado: ${anaPath}`);

  const content = readFileSync(anaPath, "utf-8");
  const parsed = parseXml(content) as XmlRecord;
  const analysis = parseDQAnalysisFromXml(parsed, anaPath);
  if (!analysis) throw new Error("No se pudo leer el análisis fuente");

  const dir = join(anaPath, "..").replace(/[/\\][^/\\]+$/, "");
  const version = analysis.version || "0.1";
  const newBase = `${newName}_${version}`;
  const newAnaPath = join(dir, `${newBase}.ana`);
  const newPropsPath = join(dir, `${newBase}.properties`);

  const updatedAna = updateDQAnalysisXmlInternal(content, { name: newName, version });
  const propsContent = readFileSync(propsPath, "utf8");
  const updatedProps = updateDQAnalysisPropertiesXmlInternal(propsContent, {
    name: newName,
    version,
    fileName: `${newBase}.ana`,
  });

  writeFileSync(newAnaPath, updatedAna);
  writeFileSync(newPropsPath, updatedProps);

  return { anaPath: newAnaPath, propertiesPath: newPropsPath };
}
