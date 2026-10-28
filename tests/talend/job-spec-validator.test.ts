import { describe, expect, test } from "bun:test";
import { validateJobSpec } from "../../src/talend/job-spec-validator";

const base = () => ({
  jobName: "job_valido",
  components: [
    { uniqueName: "tFileInputDelimited_1", componentName: "tFileInputDelimited" },
    { uniqueName: "tLogRow_2", componentName: "tLogRow" },
  ],
  connections: [{ source: "tFileInputDelimited_1", target: "tLogRow_2", label: "row1" }],
});

const errores = (spec: unknown) => validateJobSpec(spec).errors.join(" | ");

describe("validateJobSpec", () => {
  test("acepta una especificacion correcta, con o sin conexiones y contextos", () => {
    expect(validateJobSpec(base())).toEqual({ valid: true, errors: [] });
    expect(validateJobSpec({ jobName: "job_a", components: [] }).valid).toBe(true);
    expect(validateJobSpec({ ...base(), contexts: [{ name: "ruta", type: "id_String", value: "x" }] }).valid).toBe(true);
  });

  test("una conexion a un nodo que no existe es un error", () => {
    const spec = base();
    spec.connections = [{ source: "tFileInputDelimited_1", target: "tFantasma_9", label: "row1" }];

    expect(errores(spec)).toContain("tFantasma_9");
  });

  test("una conexion de un nodo a si mismo es un error", () => {
    const spec = base();
    spec.connections = [{ source: "tLogRow_2", target: "tLogRow_2", label: "row1" }];

    expect(errores(spec)).toContain("a si mismo");
  });

  test("dos conexiones con el mismo nombre en un job son un error", () => {
    const spec = base();
    spec.components.push({ uniqueName: "tLogRow_3", componentName: "tLogRow" });
    spec.connections = [
      { source: "tFileInputDelimited_1", target: "tLogRow_2", label: "row1" },
      { source: "tFileInputDelimited_1", target: "tLogRow_3", label: "row1" },
    ];

    expect(errores(spec)).toContain("row1");
  });

  test.each(["1empieza", "con espacio", "con-guion", "ñandú", ""])("el nombre de job %p no es un identificador valido", (jobName) => {
    expect(validateJobSpec({ ...base(), jobName }).valid).toBe(false);
  });

  test("los nombres de componente y de nodo deben ser identificadores de Talend", () => {
    expect(errores({ ...base(), components: [{ uniqueName: "con espacio", componentName: "tLogRow" }] })).toContain("uniqueName");
    expect(errores({ ...base(), components: [{ uniqueName: "tX_1", componentName: "LogRow" }] })).toContain("componentName");
  });

  test("las variables de contexto no pueden repetirse ni tener nombres invalidos", () => {
    const repetidas = { ...base(), contexts: [{ name: "a", type: "id_String", value: "" }, { name: "a", type: "id_String", value: "" }] };
    const invalida = { ...base(), contexts: [{ name: "1a", type: "id_String", value: "" }] };

    expect(errores(repetidas)).toContain("contexto");
    expect(errores(invalida)).toContain("contexto");
  });

  test("la version debe tener la forma mayor.menor", () => {
    expect(validateJobSpec({ ...base(), version: "0.1" }).valid).toBe(true);
    expect(validateJobSpec({ ...base(), version: "uno" }).valid).toBe(false);
  });
});
