import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDQAnalysis } from "./parse";
import type { DQAnalysis } from "./types";

/** Lista los análisis DQ (`.ana`) de un proyecto de Talend. */
export function listDQAnalyses(projectPath: string): DQAnalysis[] {
  const analysesDir = join(projectPath, "TDQ_Data Profiling", "Analyses");
  if (!existsSync(analysesDir)) return [];

  const files = readdirSync(analysesDir).filter((f) => f.endsWith(".ana") && !f.endsWith(".properties"));
  const analyses: DQAnalysis[] = [];

  for (const file of files) {
    const ana = parseDQAnalysis(join(analysesDir, file));
    if (ana) analyses.push(ana);
  }

  return analyses;
}
