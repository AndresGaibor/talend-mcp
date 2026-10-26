import type { JobSpec as GeneratorJobSpec, ComponentSpec, ConnectionSpec } from "../../job-generator";
import { DEFAULT_POS_X, DEFAULT_POS_Y, POS_X_STEP, inferTalendType } from "./mapping";
import type { MultiCsvOptions } from "./types";

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
