import { describe, expect, test } from "bun:test";
import { componentsThatCompiled, filterUncompiled } from "../../scripts/coverage-selection";

describe("seleccion de componentes pendientes de cobertura", () => {
  test("acumula solo compilaciones exitosas de reportes con nivel L4", () => {
    const reports = [
      "componente,creado,compila,error_compilacion\ntFileInputDelimited,si,si,\ntFileInputXML,si,no,error",
      "componente,creado,configurado\ntFileOutputDelimited,si,si",
      "componente,compila\ntFileInputXML,si\ntJoin,no",
    ];

    expect(componentsThatCompiled(reports)).toEqual(new Set(["tFileInputDelimited", "tFileInputXML"]));
  });

  test("omite los verdes y conserva fallidos y no medidos", () => {
    const reports = ["componente,compila\ntFileInputDelimited,si\ntFileInputXML,no"];
    expect(filterUncompiled(["tFileInputDelimited", "tFileInputXML", "tJoin"], reports)).toEqual([
      "tFileInputXML", "tJoin",
    ]);
  });
});
