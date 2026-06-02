import { describe, expect, test } from "bun:test";
import { formatDQAnalysesDetails } from "../../src/talend/dq-analysis";

describe("DQ analysis report", () => {
  test("une el detalle de varios analysis con separadores", () => {
    const report = formatDQAnalysesDetails([
      {
        name: "Analisis Uno",
        status: "Draft",
        purpose: "Probar reporte",
        description: "",
        version: "0.1",
        author: "autor@example.com",
        defaultContext: "Default",
        lastRunOk: false,
        connectionName: "fuente1",
        connectionPath: "ruta1",
        columnCount: 2,
        analyzedColumns: [],
        indicators: [],
        filePath: "/tmp/uno.ana",
      },
      {
        name: "Analisis Dos",
        status: "Draft",
        purpose: "",
        description: "",
        version: "0.1",
        author: "autor@example.com",
        defaultContext: "Default",
        lastRunOk: false,
        connectionName: "fuente2",
        connectionPath: "ruta2",
        columnCount: 3,
        analyzedColumns: [],
        indicators: [],
        filePath: "/tmp/dos.ana",
      },
    ]);

    expect(report).toContain("Analisis Uno");
    expect(report).toContain("Analisis Dos");
    expect(report).toContain("---");
  });
});
