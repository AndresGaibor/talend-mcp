import { describe, expect, test } from "bun:test";
import { generateJobSpec } from "../../src/talend/jobs/pipeline-patterns";
import {
  toGeneratorSpec,
  toGeneratorSpecMultiCsv,
  validateGeneratorSpec,
} from "../../src/talend/jobs/job-spec-generator";
import type { JobSpec as GeneratorJobSpec } from "../../src/talend/job-generator";

describe("job spec generator", () => {
  test("convierte un spec lógico simple en spec del generador", () => {
    const logical = generateJobSpec("csv_to_db_with_audit_columns", "job_simple", {
      inputPath: "input",
      outputTable: "raw_table",
      batchSize: 1000,
    });

    const spec = toGeneratorSpec(logical);

    expect(spec.jobName).toBe("job_simple");
    expect(spec.folderPath).toBe("Process");
    expect(spec.components.map((c) => c.uniqueName)).toEqual([
      "tFileInputDelimited_1",
      "tMap_2",
      "tDBOutput_3",
    ]);
    expect(spec.components[0]!.posX).toBe(160);
    expect(spec.components[1]!.posX).toBe(460);
    expect(spec.components[0]!.parameters).toEqual({ FILENAME: "${context.input_path}/file.csv" });
    expect(spec.components[2]!.parameters).toEqual({
      TABLE: "raw_table",
      LOAD_APPEND_MODE: "true",
      BATCH_SIZE: "1000",
    });
    expect(spec.connections).toEqual([
      {
        source: "tFileInputDelimited_1",
        target: "tMap_2",
        label: "row_1",
        connectorName: "FLOW",
        metaname: "",
        uniqueName: "row_1",
      },
      {
        source: "tMap_2",
        target: "tDBOutput_3",
        label: "row_2",
        connectorName: "FLOW",
        metaname: "",
        uniqueName: "row_2",
      },
    ]);
  });

  test("propaga columnas técnicas y carpeta destino", () => {
    const logical = generateJobSpec("csv_to_db_with_audit_columns", "job_audit");
    const spec = toGeneratorSpec(logical, { folderPath: "Process/Clientes" });

    expect(spec.folderPath).toBe("Process/Clientes");
    const columns = spec.components[0]!.schema?.columns ?? [];
    expect(columns.map((c) => c.name)).toEqual(["_load_ts", "_load_run"]);
    expect(columns[0]!.type).toBe("id_Date");
    expect(columns[1]!.type).toBe("id_String");
    expect(spec.components[0]!.schema?.connector).toBe("FLOW");
  });

  test("genera el pipeline multi-CSV con un input, un map y un output por mapeo", () => {
    const spec = toGeneratorSpecMultiCsv("job_multi", "multi_csv_raw_loader", {
      mappings: [
        { csvFile: "a.csv", targetTable: "raw_a", columns: [{ name: "id", type: "number" }] },
        { csvFile: "b.csv", targetTable: "raw_b", columns: [{ name: "nombre" }] },
      ],
      inputPath: "input",
      batchSize: 500,
      technicalColumns: [{ name: "_load_ts", value: "TalendDate.getCurrentDate()" }],
    });

    expect(spec.components).toHaveLength(6);
    expect(spec.components[0]!.uniqueName).toBe("tFileInputDelimited_1");
    expect(spec.components[0]!.parameters?.FILENAME).toBe("${context.input_path}/a.csv");
    expect(spec.components[0]!.schema?.columns[0]!.type).toBe("id_Double");
    expect(spec.components[3]!.uniqueName).toBe("tFileInputDelimited_2");
    expect(spec.components[5]!.parameters?.BATCH_SIZE).toBe("500");

    const mapColumns = spec.components[1]!.schema?.columns ?? [];
    expect(mapColumns.map((c) => c.name)).toEqual(["id", "_load_ts"]);
    expect(mapColumns[1]!.type).toBe("id_Date");

    expect(spec.connections).toHaveLength(4);
    expect(spec.connections![1]).toEqual({
      source: "tMap_1",
      target: "tDBOutput_1",
      label: "row_0_2",
      connectorName: "FLOW",
      uniqueName: "row_0_2",
    });
  });

  test("valida nombre vacío, componentes duplicados y conexiones huérfanas", () => {
    const invalid = {
      jobName: "  ",
      components: [
        { uniqueName: "tMap_1", componentName: "tMap" },
        { uniqueName: "tMap_1", componentName: "tMap" },
      ],
      connections: [{ source: "tMap_1", target: "tDBOutput_9", label: "row_1" }],
    } as GeneratorJobSpec;

    const result = validateGeneratorSpec(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("jobName is required");
    expect(result.errors).toContain("Duplicate uniqueName: tMap_1");
    expect(result.errors).toContain("Connection target not found: tDBOutput_9");
    expect(result.errors).not.toContain("Connection source not found: tMap_1");
  });
});
