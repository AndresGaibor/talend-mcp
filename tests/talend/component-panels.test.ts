import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseMessagesProperties } from "../../src/modules/component-definitions/infrastructure/definition-xml/messages";
import { DefinitionIndexRepository, elegirDefinicion } from "../../src/modules/component-definitions/infrastructure/definition-index.repository";
import {
  buildComponentPanelsSnapshot,
  collectComponentNames,
  panelTabs,
} from "../../src/modules/component-definitions/application/component-panels";

/** Plugins de prueba: `plugin/components/<nombre>/<nombre>_java.xml`. Son pequeños y propios del repo. */
const PLUGINS = join(import.meta.dir, "..", "fixtures", "component-panels");

async function indexDemo() {
  const repository = new DefinitionIndexRepository({ pluginsDir: PLUGINS });
  return repository.scan().components;
}

describe("parseMessagesProperties", () => {
  test("lee clave=valor, ignora comentarios y blancos, y desescapa \\\" y \\\\", () => {
    const text = [
      "﻿# comentario",
      "! otro comentario",
      "",
      "FIELDSEPARATOR.NAME=Field Separator",
      "CSVROWSEPARATOR.ITEM.LF=LF(\\\"\\\\n\\\")",
      "  INDENTADA.NAME=Con sangria\r",
    ].join("\r\n");
    const messages = parseMessagesProperties(text);
    expect(messages["FIELDSEPARATOR.NAME"]).toBe("Field Separator");
    expect(messages["CSVROWSEPARATOR.ITEM.LF"]).toBe('LF("\\n")');
    expect(messages["INDENTADA.NAME"]).toBe("Con sangria");
    expect(Object.keys(messages)).toHaveLength(3);
  });
});

describe("DefinitionIndexRepository.scan con etiquetas", () => {
  test("rellena la etiqueta del componente y su clave de ayuda", async () => {
    const demo = (await indexDemo()).find((component) => component.name === "tPanelDemo");
    expect(demo?.label).toBe("Demo de paneles");
    expect(demo?.helpKey).toBe("org.talend.help.tPanelDemo");
  });

  test("etiqueta de parametro, ayuda, numRow y grupo", async () => {
    const demo = (await indexDemo()).find((component) => component.name === "tPanelDemo")!;
    const separator = demo.parameters.find((parameter) => parameter.name === "SEPARATOR")!;
    expect(separator.label).toBe("Field Separator");
    expect(separator.help).toBe("Caracter que separa los campos");
    expect(separator.numRow).toBe(10);

    const sinFila = demo.parameters.find((parameter) => parameter.name === "SIN_FILA")!;
    expect(sinFila.numRow).toBeUndefined();
    expect(sinFila.group).toBe("AUTHENTICATION");
    expect(sinFila.label).toBeUndefined();
  });

  test("etiqueta de opcion de lista", async () => {
    const demo = (await indexDemo()).find((component) => component.name === "tPanelDemo")!;
    const separator = demo.parameters.find((parameter) => parameter.name === "CSVROWSEPARATOR")!;
    expect(separator.options).toEqual([
      { name: "LF", value: '"\\n"', label: 'LF("\\n")' },
      { name: "CR", value: '"\\r"', label: 'CR("\\r")' },
    ]);
  });

  test("etiqueta de columna de tabla y de su opcion", async () => {
    const demo = (await indexDemo()).find((component) => component.name === "tPanelDemo")!;
    const table = demo.parameters.find((parameter) => parameter.name === "MAPEO")!.table!;
    expect(table.columns[0]).toMatchObject({ name: "COL", label: "Columna" });
    const func = table.columns[1]!;
    expect(func.label).toBe("Funcion");
    expect(func.options).toEqual([
      { name: "AVG", value: "avg", label: "promedio" },
      { name: "SUM", value: "sum" },
    ]);
  });

  test("etiqueta ausente cuando no hay properties", async () => {
    const sin = (await indexDemo()).find((component) => component.name === "tPanelSinProps")!;
    expect(sin.label).toBeUndefined();
    expect(sin.helpKey).toBeUndefined();
    const encoding = sin.parameters.find((parameter) => parameter.name === "ENCODAJE")!;
    expect(encoding.label).toBeUndefined();
    expect(encoding.numRow).toBe(20);
  });

  test("elegirDefinicion prefiere la paleta pedida, luego DI", () => {
    const base = { name: "t", family: "F", families: ["F"], startable: false, pluginId: "p", definitionPath: "", parameters: [], requiredParameters: [], connectors: [], imports: [], returns: [] };
    const di = { ...base, palette: "DI" as const };
    const spark = { ...base, palette: "SPARK" as const };
    expect(elegirDefinicion([spark, di])).toBe(di);
    expect(elegirDefinicion([spark, di], "SPARK")).toBe(spark);
    expect(elegirDefinicion([])).toBeNull();
  });
});

describe("panelTabs y snapshot", () => {
  test("ordena por numRow, deja los sin fila al final y omite LABEL sin etiqueta", async () => {
    const demo = (await indexDemo()).find((component) => component.name === "tPanelDemo")!;
    const { basic, advanced } = panelTabs(demo);
    // Filas 10, 20, 30 y 40; SIN_FILA no tiene fila y va al final.
    expect(basic.map((parameter) => parameter.name)).toEqual([
      "SEPARATOR",
      "FILENAME",
      "CSVROWSEPARATOR",
      "MAPEO",
      "SIN_FILA",
    ]);
    expect(basic.some((parameter) => parameter.name === "SEPARATOR_DECO")).toBe(false);
    expect(advanced.map((parameter) => parameter.name)).toEqual(["AVANZADO"]);
  });

  test("el snapshot respeta el formato del contrato", async () => {
    const index = await indexDemo();
    const { snapshot, missing } = buildComponentPanelsSnapshot({
      studioVersion: "8.0.1",
      names: ["tPanelDemo", "tNoExiste", "tPanelSinProps"],
      find: (name) => index.find((component) => component.name === name) ?? null,
    });
    expect(missing).toEqual(["tNoExiste"]);
    expect(snapshot.version).toBe(1);
    expect(snapshot.generatedFrom).toBe("Talend Studio 8.0.1");
    expect(Object.keys(snapshot.components).sort()).toEqual(["tPanelDemo", "tPanelSinProps"]);

    const demo = snapshot.components.tPanelDemo!;
    expect(demo.label).toBe("Demo de paneles");
    expect(demo.family).toBe("File/Output");
    const separator = demo.tabs.basic.find((parameter) => parameter.name === "SEPARATOR")!;
    expect(separator).toEqual({
      name: "SEPARATOR",
      label: "Field Separator",
      field: "TEXT",
      required: true,
      show: true,
      showIf: null,
      notShowIf: null,
      defaultValue: '";"', // literal Java, con sus comillas, como en el XML
      numRow: 10,
      group: null,
      repositoryValue: null,
      options: null,
      table: null,
    });
    expect(demo.tabs.advanced[0]!.name).toBe("AVANZADO");

    const sin = snapshot.components.tPanelSinProps!;
    expect(sin.label).toBeNull();
    expect(sin.tabs.basic.map((parameter) => parameter.label)).toEqual([null, null]);
  });

  test("collectComponentNames saca nombres t[A-Z] de valores y claves", () => {
    const names = collectComponentNames({
      core: ["tMap", "tFileInputDelimited", "tFileInputDelimited", "notAComponent", "tmin"],
      engines: { oracle: { input: "tOracleInput" } },
      tMySQLFake: true,
    });
    expect([...names].sort()).toEqual(["tFileInputDelimited", "tMap", "tMySQLFake", "tOracleInput"]);
  });
});
