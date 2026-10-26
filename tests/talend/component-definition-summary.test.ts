import { describe, expect, test } from "bun:test";
import {
  mensajeNoEncontrado,
  resumenParaAgente,
  textoResumen,
} from "../../src/modules/component-definitions/application/resumen-para-agente";
import type { DefinitionParameter } from "../../src/modules/component-definitions/domain/component-definition.types";
import type { RequiredParametersPlan } from "../../src/modules/component-definitions/application/plan-required-parameters/types";

function parametro(partial: Partial<DefinitionParameter> & { name: string; field: string }): DefinitionParameter {
  return { required: true, show: true, advanced: false, ...partial } as DefinitionParameter;
}

// Un componente con los casos que hay que distinguir:
// - FILENAME: un fichero, lo pone quien usa el componente aunque tenga valor sugerido.
// - SCHEMA: el esquema, lo pone quien usa el componente.
// - DECIMAL: obligatorio sin valor posible, sin condicion: lo pone quien usa el componente.
// - FIELDSEPARATOR: obligatorio con valor por defecto: no hay que tocarlo.
// - TEMP_DIR (oculto) y ESCAPE_CHAR (solo si USE_ESCAPE=true): se ignoran con los valores por defecto.
const useEscape = parametro({ name: "USE_ESCAPE", field: "CHECK", required: false, defaultValue: "false" });
const requeridos: DefinitionParameter[] = [
  parametro({ name: "FILENAME", field: "FILE", defaultValue: "\"/tmp/x.csv\"" }),
  parametro({ name: "SCHEMA", field: "SCHEMA_TYPE" }),
  parametro({ name: "DECIMAL", field: "TEXT" }),
  parametro({ name: "FIELDSEPARATOR", field: "TEXT", defaultValue: "\";\"" }),
  parametro({ name: "TEMP_DIR", field: "DIRECTORY", show: false }),
  parametro({ name: "ESCAPE_CHAR", field: "TEXT", showIf: "USE_ESCAPE == 'true'" }),
];

const plan: RequiredParametersPlan = {
  component: "tFileInputDelimited",
  parameters: [
    { name: "FILENAME", field: "FILE", kind: "value", value: "\"/tmp/x.csv\"", literal: true, source: "default" },
    { name: "FIELDSEPARATOR", field: "TEXT", kind: "value", value: "\";\"", literal: true, source: "default" },
  ],
  skipped: [
    { name: "SCHEMA", field: "SCHEMA_TYPE", reason: "hace falta un valor real de tipo SCHEMA_TYPE" },
    { name: "DECIMAL", field: "TEXT", reason: "sin valor posible" },
    { name: "TEMP_DIR", field: "DIRECTORY", reason: "el parametro esta oculto en el formulario (SHOW=false)" },
    { name: "ESCAPE_CHAR", field: "TEXT", reason: "no se ve con los valores actuales (SHOW_IF/NOT_SHOW_IF)" },
  ],
};

describe("resumen de configuracion para un agente", () => {
  test("separa lo que pone quien llama, lo que ya tiene valor y lo que se ignora", () => {
    const resumen = resumenParaAgente({
      parameters: [...requeridos, useEscape],
      requiredParameters: requeridos,
      plan,
    });

    expect(resumen.tuPones).toEqual(["FILENAME", "SCHEMA", "DECIMAL"]);
    expect(resumen.yaTieneValor).toEqual(["FIELDSEPARATOR"]);
    expect(resumen.ignorables).toBe(2);
  });

  test("un obligatorio que el plan no sabe rellenar (PROCESS del tRunJob) es de quien llama, no se oculta", () => {
    const resumen = resumenParaAgente({
      parameters: [parametro({ name: "PROCESS", field: "PROCESS_TYPE" }), parametro({ name: "SCHEMA_REJECT", field: "SCHEMA_TYPE" })],
      requiredParameters: [
        parametro({ name: "PROCESS", field: "PROCESS_TYPE" }),
        parametro({ name: "SCHEMA_REJECT", field: "SCHEMA_TYPE" }),
      ],
      plan: { component: "tRunJob", parameters: [], skipped: [] },
    });

    expect(resumen.tuPones).toEqual(["PROCESS"]);
    expect(resumen.yaTieneValor).toEqual([]);
    expect(resumen.ignorables).toBe(1);
  });

  test("un esencial del registro que el XML no marca (PROCESS) lo pone quien llama", () => {
    const resumen = resumenParaAgente({
      parameters: [parametro({ name: "SCHEMA", field: "SCHEMA_TYPE" })],
      requiredParameters: [parametro({ name: "SCHEMA", field: "SCHEMA_TYPE" })],
      plan: { component: "tRunJob", parameters: [], skipped: [] },
      esenciales: ["PROCESS"],
    });

    expect(resumen.tuPones).toEqual(["SCHEMA", "PROCESS"]);
  });

  test("un esencial con valor por defecto en el registro ya tiene valor: no se le pide al agente", () => {
    const resumen = resumenParaAgente({
      parameters: [],
      requiredParameters: [],
      plan: { component: "tFileInputDelimited", parameters: [], skipped: [] },
      esenciales: ["ROWSEPARATOR", "PROCESS"],
      valoresDelRegistro: { ROWSEPARATOR: "\"\\n\"" },
    });

    expect(resumen.yaTieneValor).toEqual(["ROWSEPARATOR"]);
    expect(resumen.tuPones).toEqual(["PROCESS"]);
  });

  test("un parametro de lista sin valor por defecto no hace visible lo que depende de el", () => {
    const readBy = parametro({ name: "READ_BY", field: "CLOSED_LIST", required: false });
    const mapping = parametro({ name: "MAPPING", field: "TABLE", showIf: "READ_BY == 'JSONPATH'" });
    const resumen = resumenParaAgente({
      parameters: [readBy, mapping],
      requiredParameters: [mapping],
      plan: { component: "tFileInputJSON", parameters: [], skipped: [] },
    });

    expect(resumen.tuPones).toEqual([]);
    expect(resumen.ignorables).toBe(1);
  });

  test("un fichero visible por defecto es de quien llama aunque el XML no lo marque obligatorio", () => {
    const resumen = resumenParaAgente({
      parameters: [parametro({ name: "JSONFILE", field: "FILE", required: false })],
      requiredParameters: [],
      plan: { component: "tFileInputJSON", parameters: [], skipped: [] },
    });

    expect(resumen.tuPones).toEqual(["JSONFILE"]);
  });

  test("notShowIf solo oculta cuando se cumple: un FILENAME con notShowIf=false sigue siendo de quien llama", () => {
    const streamOff = parametro({ name: "USESTREAM", field: "CHECK", required: false, defaultValue: "false" });
    const filename = parametro({ name: "FILENAME", field: "FILE", notShowIf: "USESTREAM == 'true'" });
    const resumen = resumenParaAgente({
      parameters: [streamOff, filename],
      requiredParameters: [filename],
      plan: {
        component: "tFileOutputDelimited",
        parameters: [{ name: "FILENAME", field: "FILE", kind: "value", value: "\"/tmp/x\"", literal: true, source: "default" }],
        skipped: [],
      },
    });

    expect(resumen.tuPones).toEqual(["FILENAME"]);
    expect(resumen.ignorables).toBe(0);
  });

  test("un componente sin obligatorios lo dice", () => {
    const resumen = resumenParaAgente({
      parameters: [],
      requiredParameters: [],
      plan: { component: "tJava", parameters: [], skipped: [] },
    });

    expect(textoResumen({ name: "tJava", family: "Custom_Code", palette: "DI" }, resumen)).toBe(
      "tJava (Custom_Code, DI). Tú pones: nada obligatorio, todo tiene valor por defecto.",
    );
  });

  test("el texto final nombra cada grupo y no repite el numero bruto de obligatorios", () => {
    const texto = textoResumen(
      { name: "tFileInputDelimited", family: "File/Input", palette: "DI" },
      resumenParaAgente({ parameters: [...requeridos, useEscape], requiredParameters: requeridos, plan }),
    );

    expect(texto).toContain("Tú pones: FILENAME, SCHEMA, DECIMAL.");
    expect(texto).toContain("Ya tiene valor, no hace falta tocarlo: FIELDSEPARATOR.");
    expect(texto).toContain("2 obligatorio(s) más que están ocultos");
    expect(texto).not.toContain("Parametros obligatorios");
  });

  test("si el nombre no existe, dice donde buscar con el termino exacto", () => {
    const mensaje = mensajeNoEncontrado("tDBInput");

    expect(mensaje).toContain("'tDBInput'");
    expect(mensaje).toContain("talend_components_search");
    expect(mensaje).toContain('{"query":"DBInput"}');
    expect(mensaje).toContain("talend_studio_component_parameters");
  });
});
