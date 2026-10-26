import { describe, expect, test } from "bun:test";
import * as z from "zod/v4";
import { componentSpecShape } from "../../src/talend/studio/tools-job-operation-schemas";

const especificacion = z.object(componentSpecShape);

describe("schema MCP del mapper de tMap", () => {
  test("acepta tablas por conexion y variables con name, type y expression", () => {
    const resultado = especificacion.safeParse({
      mapper: {
        inputs: [{ name: "row1", columns: [{ name: "id", type: "id_Integer" }] }],
        outputs: [{ name: "row2", columns: [{ name: "id", type: "id_Integer", expression: "row1.id" }] }],
        vars: [{ name: "v", type: "id_String", expression: "'x'" }],
      },
    });

    expect(resultado.success).toBe(true);
  });

  test("una expresion puesta a nivel de tabla se rechaza y no se descarta", () => {
    const resultado = especificacion.safeParse({
      mapper: { outputs: [{ name: "row2", expression: "row1.id", columns: [] }] },
    });

    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain("expression");
  });

  test("una variable con columns se rechaza: en vars cada entrada es una variable", () => {
    const resultado = especificacion.safeParse({
      mapper: { vars: [{ name: "v", columns: [{ name: "x" }] }] },
    });

    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain("columns");
  });
});
