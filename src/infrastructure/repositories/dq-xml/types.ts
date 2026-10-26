/** Tipos del repositorio XML de análisis DQ (`.ana` y `.properties`). */

export interface DQIndicator {
  name: string;
  type: string;
  computed: boolean;
  count?: number;
  length?: number;
  distinctValueCount?: number;
  valueToFreq?: string;
  analyzedElement: string;
}

export interface DqAnalysis {
  name: string;
  status: string;
  purpose: string;
  description: string;
  version: string;
  author: string;
  defaultContext: string;
  lastRunOk: boolean;
  lastRunDate?: string;
  lastRunDuration?: number;
  connectionName: string;
  connectionPath: string;
  columnCount: number;
  analyzedColumns: string[];
  indicators: DQIndicator[];
  filePath: string;
}

export type DqAnalysisMetadataUpdate = Partial<Pick<DqAnalysis, "name" | "status" | "purpose" | "description" | "version" | "author" | "defaultContext">>;

/** Nodo del XML ya parseado. */
export type XmlRecord = Record<string, unknown>;
