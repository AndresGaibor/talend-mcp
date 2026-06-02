import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { updateDQAnalysisPropertiesXml, updateDQAnalysisXml } from "../../src/talend/dq-editor";

const baseDir = "/Applications/TalendStudio-8.0.1/studio/workspace/aliware-calidad-1916860628/ALIWARECALIDAD/TDQ_Data Profiling/Analyses";

describe("DQ analysis editor", () => {
  test("actualiza metadata en ana y properties", () => {
    const ana = readFileSync(`${baseDir}/Basic_Column_Analysis_orders_0.1.ana`, "utf8");
    const props = readFileSync(`${baseDir}/Basic_Column_Analysis_orders_0.1.properties`, "utf8");

    const anaEditado = updateDQAnalysisXml(ana, {
      name: "Analisis_Cambiado",
      status: "Production",
      purpose: "Nuevo proposito",
      description: "Nueva descripcion",
      version: "0.2",
      defaultContext: "Default",
      author: "nuevo.autor@example.com",
    });

    const propsEditado = updateDQAnalysisPropertiesXml(props, {
      name: "Analisis_Cambiado",
      purpose: "Nuevo proposito",
      version: "0.2",
      status: "Production",
    });

    expect(anaEditado).toContain('name="Analisis_Cambiado"');
    expect(anaEditado).toContain('tag="Status" value="Production"');
    expect(anaEditado).toContain('tag="Purpose" value="Nuevo proposito"');
    expect(propsEditado).toContain('label="Analisis_Cambiado"');
    expect(propsEditado).toContain('purpose="Nuevo proposito"');
    expect(propsEditado).toContain('version="0.2"');
    expect(propsEditado).toContain('statusCode="Production"');
  });
});
