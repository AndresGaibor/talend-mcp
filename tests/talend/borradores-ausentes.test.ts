import { expect, test } from "bun:test";
import { sinBorradoresAusentes } from "../../src/talend/job-batch/borradores-ausentes";

const plantilla = {
  jobName: "job_x",
  components: [
    { uniqueName: "tFileInputDelimited_1", componentName: "tFileInputDelimited" },
    { uniqueName: "tRaro_2", componentName: "tRaro", draftOnly: true, draftReason: "pendiente" },
    { uniqueName: "tLogRow_3", componentName: "tLogRow", draftOnly: false },
  ],
  connections: [
    { source: "tFileInputDelimited_1", target: "tRaro_2", label: "row1" },
    { source: "tRaro_2", target: "tLogRow_3", label: "row2" },
    { source: "tFileInputDelimited_1", target: "tLogRow_3", label: "row3" },
  ],
};

test("omite un borrador ausente del catalogo con sus conexiones y conserva el resto", () => {
  const { plantilla: limpia, omitidos, sinResolver } = sinBorradoresAusentes(plantilla, new Set(["tRaro"]));

  expect(limpia.components.map((c) => c.uniqueName)).toEqual(["tFileInputDelimited_1", "tLogRow_3"]);
  expect(limpia.connections).toEqual([{ source: "tFileInputDelimited_1", target: "tLogRow_3", label: "row3" }]);
  expect(omitidos).toHaveLength(1);
  expect(omitidos[0]).toMatchObject({ uniqueName: "tRaro_2", componentName: "tRaro" });
  expect(omitidos[0]!.motivo).toContain("catalogo");
  expect(sinResolver).toEqual([]);
});

test("quita las marcas de borrador de la plantilla que se escribe", () => {
  const { plantilla: limpia } = sinBorradoresAusentes(plantilla, new Set());

  for (const componente of limpia.components) {
    expect(Object.keys(componente)).not.toContain("draftOnly");
    expect(Object.keys(componente)).not.toContain("draftReason");
  }
});

test("un componente ausente que no es borrador sigue siendo un error", () => {
  const { sinResolver, omitidos } = sinBorradoresAusentes(plantilla, new Set(["tLogRow"]));

  expect(sinResolver).toEqual(["tLogRow"]);
  expect(omitidos).toEqual([]);
});

test("sin ausentes la plantilla queda igual salvo las marcas de borrador", () => {
  const { plantilla: limpia, omitidos } = sinBorradoresAusentes(plantilla, new Set());

  expect(limpia.components).toHaveLength(3);
  expect(limpia.connections).toHaveLength(3);
  expect(omitidos).toEqual([]);
});
