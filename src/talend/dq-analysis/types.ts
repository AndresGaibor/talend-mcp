/** Tipos del análisis de calidad de datos (`.ana` de Talend). */

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

export interface DQAnalysis {
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

/** Nodo del XML ya parseado. */
export type XmlRecord = Record<string, unknown>;
