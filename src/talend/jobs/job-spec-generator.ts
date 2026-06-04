import type { JobSpec as LogicalJobSpec, JobSpecComponent } from "./job-spec-types";
import type { JobSpec as GeneratorJobSpec, ComponentSpec, ConnectionSpec } from "../job-generator";

export interface CsvMapping {
  csvFile: string;
  targetTable: string;
  columns: Array<{ name: string; type?: string }>;
}

export interface MultiCsvOptions {
  mappings: CsvMapping[];
  inputPath: string;
  batchSize: number;
  technicalColumns?: Array<{ name: string; value: string }>;
  appendMode?: boolean;
}

const DEFAULT_POS_X = 160;
const DEFAULT_POS_Y = 96;
const POS_X_STEP = 300;
const POS_Y_STEP = 180;

function generatePositions(index: number): { posX: number; posY: number } {
  return {
    posX: DEFAULT_POS_X + index * POS_X_STEP,
    posY: DEFAULT_POS_Y + index * POS_Y_STEP,
  };
}

function inferTalendType(csvType: string | undefined): string {
  switch (csvType) {
    case "number": return "id_Double";
    case "boolean": return "id_Boolean";
    case "date": return "id_Date";
    default: return "id_String";
  }
}

function buildTechnicalColumns(technicalColumns: Array<{ name: string; value: string }> | undefined): ComponentSpec["schema"] extends { columns: infer C } ? C : never[] {
  if (!technicalColumns || technicalColumns.length === 0) {
    return [] as unknown as ComponentSpec["schema"] extends { columns: infer C } ? C : never[];
  }
  return technicalColumns.map((tc) => ({
    name: tc.name,
    type: tc.name === "_load_ts" ? "id_Date" : "id_String",
    length: tc.name === "_load_ts" ? undefined : 255,
    nullable: false,
    key: false,
  })) as unknown as ComponentSpec["schema"] extends { columns: infer C } ? C : never[];
}

export function toGeneratorSpec(logical: LogicalJobSpec, options?: { folderPath?: string }): GeneratorJobSpec {
  const components: ComponentSpec[] = [];
  const connections: ConnectionSpec[] = [];
  const version = "0.1";

  for (let i = 0; i < logical.components.length; i++) {
    const comp = logical.components[i] as JobSpecComponent;
    const pos = generatePositions(i);
    const uniqueName = `${comp.componentName}_${i + 1}`;

    const params: Record<string, string> = {};
    if (comp.parameters) {
      for (const [key, value] of Object.entries(comp.parameters)) {
        params[key] = String(value);
      }
    }

    const isInput = comp.componentName === "tFileInputDelimited" || comp.componentName === "tDBInput";
    const isOutput = comp.componentName === "tDBOutput" || comp.componentName === "tMysqlOutput" || comp.componentName === "tPostgresqlOutput";

    if (isInput && logical.inputPath) {
      params.FILENAME = `\${context.input_path}/${comp.parameters?.["FILENAME"] ?? "file.csv"}`;
    }

    if (isOutput && logical.outputTable) {
      params.TABLE = logical.outputTable;
      params.LOAD_APPEND_MODE = String(logical.appendMode ?? true);
      if (logical.batchSize) {
        params.BATCH_SIZE = String(logical.batchSize);
      }
    }

    const spec: ComponentSpec = {
      uniqueName,
      componentName: comp.componentName,
      posX: (comp.parameters?.["posX"] as number | undefined) ?? pos.posX,
      posY: (comp.parameters?.["posY"] as number | undefined) ?? pos.posY,
      parameters: params,
    };

    if (logical.technicalColumns && logical.technicalColumns.length > 0) {
      spec.schema = {
        name: uniqueName + "_schema",
        connector: "FLOW",
        columns: buildTechnicalColumns(logical.technicalColumns),
      };
    }

    components.push(spec);
  }

  for (let i = 0; i < logical.components.length - 1; i++) {
    const fromComp = logical.components[i]!;
    const toComp = logical.components[i + 1]!;
    const from = `${fromComp.componentName}_${i + 1}`;
    const to = `${toComp.componentName}_${i + 2}`;
    connections.push({
      source: from,
      target: to,
      label: `row_${i + 1}`,
      connectorName: "FLOW",
      metaname: "",
      uniqueName: `row_${i + 1}`,
    });
  }

  return {
    jobName: logical.jobName,
    version,
    defaultContext: "Default",
    label: logical.jobName,
    description: logical.description,
    folderPath: options?.folderPath ?? "Process",
    components,
    connections,
  };
}

export function toGeneratorSpecMultiCsv(
  jobName: string,
  pattern: string,
  options: MultiCsvOptions,
): GeneratorJobSpec {
  const components: ComponentSpec[] = [];
  const connections: ConnectionSpec[] = [];
  const version = "0.1";

  for (let m = 0; m < options.mappings.length; m++) {
    const mapping = options.mappings[m]!;
    const offsetX = m * 50;
    const offsetY = m * 30;

    const csvUniqueName = `tFileInputDelimited_${m + 1}`;
    const mapUniqueName = `tMap_${m + 1}`;
    const dbUniqueName = `tDBOutput_${m + 1}`;

    const csvColumns = mapping.columns.map((col) => ({
      name: col.name,
      type: inferTalendType(col.type),
      length: 255,
      nullable: true,
      key: false,
    }));

    components.push({
      uniqueName: csvUniqueName,
      componentName: "tFileInputDelimited",
      posX: DEFAULT_POS_X + offsetX,
      posY: DEFAULT_POS_Y + offsetY,
      label: mapping.csvFile,
      parameters: {
        FILENAME: `\${context.input_path}/${mapping.csvFile}`,
        HEADER: "1",
        FIELDSEPARATOR: "\",\"",
        ENCODING: "UTF-8",
      },
      schema: {
        name: `${csvUniqueName}_schema`,
        connector: "FLOW",
        columns: csvColumns,
      },
    });

    const mapOutputColumns = [...csvColumns];

    if (options.technicalColumns) {
      for (const tc of options.technicalColumns) {
        mapOutputColumns.push({
          name: tc.name,
          type: tc.name === "_load_ts" ? "id_Date" : "id_String",
length: tc.name === "_load_ts" ? 0 : 255,
          nullable: false,
          key: false,
        });
      }
    }

    components.push({
      uniqueName: mapUniqueName,
      componentName: "tMap",
      posX: DEFAULT_POS_X + POS_X_STEP + offsetX,
      posY: DEFAULT_POS_Y + offsetY,
      parameters: {
        OUTPUT_TYPE: "INSERT",
        MODE: "INSERT_OR_UPDATE",
      },
      schema: {
        name: `${mapUniqueName}_out`,
        connector: "FLOW",
        columns: mapOutputColumns,
      },
    });

    components.push({
      uniqueName: dbUniqueName,
      componentName: "tDBOutput",
      posX: DEFAULT_POS_X + POS_X_STEP * 2 + offsetX,
      posY: DEFAULT_POS_Y + offsetY,
      label: mapping.targetTable,
      parameters: {
        TABLE: mapping.targetTable,
        LOAD_APPEND_MODE: String(options.appendMode ?? true),
        BATCH_SIZE: String(options.batchSize),
        DATABASE: "",
        SCHEMA: "",
      },
    });

    connections.push({
      source: csvUniqueName,
      target: mapUniqueName,
      label: `row_${m}_1`,
      connectorName: "FLOW",
      uniqueName: `row_${m}_1`,
    });

    connections.push({
      source: mapUniqueName,
      target: dbUniqueName,
      label: `row_${m}_2`,
      connectorName: "FLOW",
      uniqueName: `row_${m}_2`,
    });
  }

  return {
    jobName,
    version,
    defaultContext: "Default",
    label: jobName,
    description: pattern,
    folderPath: "Process",
    components,
    connections,
  };
}

export function validateGeneratorSpec(spec: GeneratorJobSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec.jobName || spec.jobName.trim() === "") {
    errors.push("jobName is required");
  }

  if (!spec.components || spec.components.length === 0) {
    errors.push("At least one component is required");
  }

  const uniqueNames = new Set<string>();
  for (const comp of spec.components) {
    if (!comp.uniqueName) {
      errors.push(`Component missing uniqueName`);
    } else if (uniqueNames.has(comp.uniqueName)) {
      errors.push(`Duplicate uniqueName: ${comp.uniqueName}`);
    } else {
      uniqueNames.add(comp.uniqueName);
    }
  }

  for (const conn of spec.connections ?? []) {
    if (!uniqueNames.has(conn.source)) {
      errors.push(`Connection source not found: ${conn.source}`);
    }
    if (!uniqueNames.has(conn.target)) {
      errors.push(`Connection target not found: ${conn.target}`);
    }
  }

  return { valid: errors.length === 0, errors };
}