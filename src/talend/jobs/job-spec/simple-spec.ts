import type { JobSpec as LogicalJobSpec, JobSpecComponent } from "../job-spec-types";
import type { JobSpec as GeneratorJobSpec, ComponentSpec, ConnectionSpec } from "../../job-generator";
import { buildTechnicalColumns, generatePositions } from "./mapping";

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
