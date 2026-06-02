import { describe, expect, test } from "bun:test";
import { readTextFile } from "../../src/talend/files";
import { parseJobItem } from "../../src/talend/job-parser";
import {
  buildTalendComponentEditPreview,
  duplicateTalendComponentXml,
  addTalendConnectionXml,
  buildTalendContextEditPreview,
  buildTalendContextDeletePreview,
  buildTalendJobPropertiesEditPreview,
  updateTalendContextParameterXml,
  upsertTalendContextParameterXml,
  deleteTalendContextParameterXml,
  updateTalendJobPropertiesXml,
  updateTalendComponentParameterXml,
  updateTalendSchemaColumnXml,
} from "../../src/talend/editor";

describe("Talend editor", () => {
  test("actualiza un parametro existente de un componente", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = updateTalendComponentParameterXml(xml, {
      uniqueName: "tDBOutput_1",
      parameterName: "TABLE_ACTION",
      value: "UPDATE",
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const component = job.components.find((item) => item.uniqueName === "tDBOutput_1");

    expect(component?.parameters.TABLE_ACTION).toBe("UPDATE");
  });

  test("crea un parametro si no existe", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = updateTalendComponentParameterXml(xml, {
      uniqueName: "tDBOutput_1",
      parameterName: "NEW_PARAM",
      value: "abc",
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const component = job.components.find((item) => item.uniqueName === "tDBOutput_1");

    expect(component?.parameters.NEW_PARAM).toBe("abc");
  });

  test("actualiza una columna del schema", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = updateTalendSchemaColumnXml(xml, {
      uniqueName: "tDBOutput_1",
      schemaName: "tDBOutput_1",
      columnName: "load_source",
      patch: { nullable: true, length: 99 },
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const component = job.components.find((item) => item.uniqueName === "tDBOutput_1");
    const column = component?.schemas[0]?.columns.find((item) => item.name === "load_source");

    expect(column?.nullable).toBe(true);
    expect(column?.length).toBe(99);
  });

  test("genera preview con diff", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const preview = buildTalendComponentEditPreview(xml, {
      kind: "parameter",
      uniqueName: "tDBOutput_1",
      parameterName: "TABLE_ACTION",
      value: "UPDATE",
    });

    expect(preview.changed).toBe(true);
    expect(preview.diff).toContain("TABLE_ACTION");
    expect(preview.diff).toContain("UPDATE");
  });

  test("duplica un componente con un uniqueName nuevo", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = duplicateTalendComponentXml(xml, {
      sourceUniqueName: "tFileInputDelimited_1",
      targetUniqueName: "tFileInputDelimited_2",
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const original = job.components.find((item) => item.uniqueName === "tFileInputDelimited_1");
    const clone = job.components.find((item) => item.uniqueName === "tFileInputDelimited_2");

    expect(original).toBeDefined();
    expect(clone).toBeDefined();
    expect(clone?.parameters.UNIQUE_NAME).toBe("tFileInputDelimited_2");
    expect(clone?.componentName).toBe("tFileInputDelimited");
  });

  test("agrega una conexion entre componentes", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = addTalendConnectionXml(xml, {
      sourceUniqueName: "tFileInputDelimited_1",
      targetUniqueName: "tDBOutput_1",
      label: "row_new",
      connectorName: "FLOW",
      metaname: "FLOW",
      uniqueName: "row_new",
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    expect(job.connections.some((connection) => connection.source === "tFileInputDelimited_1" && connection.target === "tDBOutput_1" && connection.uniqueName === "row_new")).toBe(true);
  });

  test("actualiza un contexto existente", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = updateTalendContextParameterXml(xml, {
      contextName: "Default",
      parameterName: "DB_HOST",
      value: "127.0.0.1",
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    expect(job.contexts.find((contexto) => contexto.name === "DB_HOST")?.value).toBe("127.0.0.1");
  });

  test("crea un contexto si no existe", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = upsertTalendContextParameterXml(xml, {
      contextName: "Default",
      parameterName: "NEW_CONTEXT",
      type: "id_String",
      value: "hello",
      prompt: "Nuevo contexto",
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    const context = job.contexts.find((item) => item.name === "NEW_CONTEXT");

    expect(context?.value).toBe("hello");
    expect(context?.prompt).toBe("Nuevo contexto");
  });

  test("actualiza metadatos del job", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");

    const updatedXml = updateTalendJobPropertiesXml(xml, {
      label: "lab04_olist_orders_to_staging_v2",
      description: "Descripcion nueva",
      purpose: "Carga incremental",
    });

    expect(updatedXml).toContain('label="lab04_olist_orders_to_staging_v2"');
    expect(updatedXml).toContain('description="Descripcion nueva"');
    expect(updatedXml).toContain('purpose="Carga incremental"');
  });

  test("genera preview de contexto", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const preview = buildTalendContextEditPreview(xml, {
      mode: "upsert",
      contextName: "Default",
      parameterName: "NEW_CONTEXT",
      value: "hello",
      type: "id_String",
      prompt: "Nuevo contexto",
    });

    expect(preview.changed).toBe(true);
    expect(preview.diff).toContain("NEW_CONTEXT");
  });

  test("genera preview de metadata del job", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.properties");

    const preview = buildTalendJobPropertiesEditPreview(xml, {
      label: "lab04_olist_orders_to_staging_v2",
      description: "Descripcion nueva",
    });

    expect(preview.changed).toBe(true);
    expect(preview.diff).toContain("lab04_olist_orders_to_staging_v2");
    expect(preview.diff).toContain("Descripcion nueva");
  });

  test("borra un contexto existente", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const updatedXml = deleteTalendContextParameterXml(xml, {
      contextName: "Default",
      parameterName: "DB_HOST",
    });

    const job = parseJobItem(updatedXml, "tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");
    expect(job.contexts.find((contexto) => contexto.name === "DB_HOST")).toBeUndefined();
  });

  test("genera preview para borrar contexto", async () => {
    const xml = await readTextFile("tests/fixtures/talend/lab04_olist_orders_to_staging_0.1.item");

    const preview = buildTalendContextDeletePreview(xml, {
      contextName: "Default",
      parameterName: "DB_HOST",
    });

    expect(preview.changed).toBe(true);
    expect(preview.diff).toContain("DB_HOST");
  });
});
