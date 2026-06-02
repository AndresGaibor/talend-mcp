import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDQAnalysis } from "./dq-analysis";
import { updateDQAnalysisPropertiesXml, updateDQAnalysisXml, type DQAnalysisMetadataEditOptions } from "./dq-editor";

function analysesDir(projectPath: string): string {
  return join(projectPath, "TDQ_Data Profiling", "Analyses");
}

function analysisBaseName(name: string, version = "0.1"): string {
  return `${name}_${version}`;
}

function findAnalysisFile(projectPath: string, analysisName: string): { anaPath: string; propertiesPath: string; version: string } {
  const dir = analysesDir(projectPath);
  if (!existsSync(dir)) throw new Error(`No existe el directorio de analysis: ${dir}`);

  const files = readdirSync(dir).filter((file) => file.endsWith(".ana"));
  const match = files.find((file) => {
    const base = basename(file, ".ana");
    return base === analysisName || base.startsWith(`${analysisName}_`);
  });

  if (!match) throw new Error(`Analysis no encontrado: ${analysisName}`);

  const anaPath = join(dir, match);
  const propertiesPath = anaPath.replace(/\.ana$/, ".properties");
  const version = basename(match, ".ana").slice(analysisName.length + 1) || "0.1";

  return { anaPath, propertiesPath, version };
}

export function updateDQAnalysisFiles(
  projectPath: string,
  analysisName: string,
  options: DQAnalysisMetadataEditOptions,
): { anaPath: string; propertiesPath: string } {
  const target = findAnalysisFile(projectPath, analysisName);

  const anaXml = readFileSync(target.anaPath, "utf8");
  const propsXml = readFileSync(target.propertiesPath, "utf8");

  const updatedAna = updateDQAnalysisXml(anaXml, options);
  const updatedProps = updateDQAnalysisPropertiesXml(propsXml, options);

  writeFileSync(target.anaPath, updatedAna);
  writeFileSync(target.propertiesPath, updatedProps);

  return { anaPath: target.anaPath, propertiesPath: target.propertiesPath };
}

export function duplicateDQAnalysisFiles(
  projectPath: string,
  sourceAnalysisName: string,
  targetAnalysisName: string,
  options: Omit<DQAnalysisMetadataEditOptions, "name"> = {},
): { anaPath: string; propertiesPath: string } {
  const source = findAnalysisFile(projectPath, sourceAnalysisName);
  const sourceParsed = parseDQAnalysis(source.anaPath);
  if (!sourceParsed) throw new Error(`No se pudo leer el analysis fuente: ${sourceAnalysisName}`);

  const targetVersion = options.version ?? source.version;
  const targetBase = analysisBaseName(targetAnalysisName, targetVersion);
  const dir = analysesDir(projectPath);
  const anaPath = join(dir, `${targetBase}.ana`);
  const propertiesPath = join(dir, `${targetBase}.properties`);

  const updatedAna = updateDQAnalysisXml(readFileSync(source.anaPath, "utf8"), {
    ...options,
    name: targetAnalysisName,
    version: targetVersion,
  });
  const updatedProps = updateDQAnalysisPropertiesXml(readFileSync(source.propertiesPath, "utf8"), {
    ...options,
    name: targetAnalysisName,
    version: targetVersion,
    fileName: `${targetBase}.ana`,
  });

  writeFileSync(anaPath, updatedAna);
  writeFileSync(propertiesPath, updatedProps);

  return { anaPath, propertiesPath };
}
