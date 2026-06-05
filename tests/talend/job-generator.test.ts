import { describe, expect, test } from "bun:test";
import { buildJobItemXml, buildJobPropertiesXml, validateJobSpec } from "../../src/talend/job-generator";
import { parseJobItem } from "../../src/talend/job-parser";
import { parseJobProperties } from "../../src/talend/repository";
import { validateJobDesign, DEFAULT_VALIDATION_CONTEXT } from "../../src/talend/validation/job-design-validator";


describe("Talend job generator", () => {
  test("buildJobItemXml genera XML válido con componentes y conexiones", () => {
    const { xml } = buildJobItemXml({
      jobName: "test_job",
      version: "0.1",
      defaultContext: "Default",
      components: [
        {
          uniqueName: "tFileInputDelimited_1",
          componentName: "tFileInputDelimited",
          posX: 80,
          posY: 160,
          parameters: { FILENAME: "data.csv" },
          schema: {
            name: "tFileInputDelimited_1",
            connector: "FLOW",
            columns: [
              { name: "id", type: "id_Integer" },
              { name: "name", type: "id_String", length: 100 },
            ],
          },
        },
        {
          uniqueName: "tLogRow_1",
          componentName: "tLogRow",
          posX: 300,
          posY: 160,
        },
      ],
      connections: [
        { source: "tFileInputDelimited_1", target: "tLogRow_1", label: "row1", uniqueName: "row1" },
      ],
    });

    expect(xml).toContain("talendfile:ProcessType");
    expect(xml).toContain("tFileInputDelimited");
    expect(xml).toContain("tLogRow");
    expect(xml).toContain("UNIQUE_NAME");
    expect(xml).toContain("tFileInputDelimited_1");
    expect(xml).toContain("tLogRow_1");
    expect(xml).toContain("FILENAME");
    expect(xml).toContain("data.csv");
  });

  test("buildJobItemXml genera XML con contexto por defecto", () => {
    const { xml } = buildJobItemXml({
      jobName: "simple_job",
      version: "0.1",
      defaultContext: "Production",
      components: [
        { uniqueName: "tDBInput_1", componentName: "tDBInput" },
      ],
    });

    expect(xml).toContain('defaultContext="Production"');
    expect(xml).toContain("Production");
  });

  test("buildJobPropertiesXml genera properties válido", () => {
    const spec = {
      jobName: "my_job",
      version: "0.1",
      label: "My Custom Job",
      description: "Este job hace algo",
      purpose: "etl",
      components: [],
    };
    const { rootId } = buildJobItemXml(spec);
    const xml = buildJobPropertiesXml(spec, rootId);

    expect(xml).toContain("TalendProperties:Property");
    expect(xml).toContain('label="My Custom Job"');
    expect(xml).toContain("0.1");
    expect(xml).toContain("my_job_0.1.item");
  });

  test("validateJobSpec acepta spec válido", () => {
    const spec = {
      jobName: "test_job",
      components: [
        { uniqueName: "tFileInputDelimited_1", componentName: "tFileInputDelimited" },
        { uniqueName: "tLogRow_1", componentName: "tLogRow" },
      ],
      connections: [
        { source: "tFileInputDelimited_1", target: "tLogRow_1", label: "row1" },
      ],
    };

    const result = validateJobSpec(spec);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("validateJobSpec rechaza spec sin jobName", () => {
    const spec = {
      components: [],
    };

    const result = validateJobSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("jobName"))).toBe(true);
  });

  test("validateJobSpec rechaza uniqueNames duplicados", () => {
    const spec = {
      jobName: "test_job",
      components: [
        { uniqueName: "tFileInputDelimited_1", componentName: "tFileInputDelimited" },
        { uniqueName: "tFileInputDelimited_1", componentName: "tLogRow" },
      ],
    };

    const result = validateJobSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("Duplicate"))).toBe(true);
  });

  test("validateJobSpec rechaza spec sin components", () => {
    const spec = {
      jobName: "test_job",
    };

    const result = validateJobSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("components"))).toBe(true);
  });

  test("XML generado es parseable por parseJobItem", () => {
    const spec = {
      jobName: "test_job",
      version: "0.1",
      components: [
        { uniqueName: "tFileInputDelimited_1", componentName: "tFileInputDelimited" },
        { uniqueName: "tLogRow_1", componentName: "tLogRow" },
      ],
    };

    const { xml } = buildJobItemXml(spec);
    const job = parseJobItem(xml, "test.item");

    expect(job.components.length).toBeGreaterThan(0);
  });

  test("validateJobDesign valida requerimiento de parámetros de componentes", () => {
    const spec = {
      jobName: "TestValidateDesign",
      pattern: "batch" as any,
      description: "Validation test",
      components: [
        {
          name: "tRESTClient_1",
          componentName: "tRESTClient",
          type: "input" as const,
          connections: [],
          parameters: {
            URL: '"https://api.example.com"',
            METHOD: "GET",
          },
        },
      ],
      contexts: [],
    };

    // Válido
    const resValid = validateJobDesign(spec, DEFAULT_VALIDATION_CONTEXT);
    expect(resValid.valid).toBe(true);

    // Inválido (falta parámetro requerido METHOD para tRESTClient)
    const badSpec = {
      ...spec,
      components: [
        {
          name: "tRESTClient_1",
          componentName: "tRESTClient",
          type: "input" as const,
          connections: [],
          parameters: {
            URL: '"https://api.example.com"',
          },
        },
      ],
    };

    const resInvalid = validateJobDesign(badSpec, DEFAULT_VALIDATION_CONTEXT);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.errors.length).toBe(1);
    expect(resInvalid.errors[0].message).toContain("requiere el parámetro 'METHOD'");
  });
});
