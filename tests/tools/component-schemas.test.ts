import { describe, expect, test } from "bun:test";
import { DefinitionIndexRepository } from "../../src/modules/component-definitions/infrastructure/definition-index.repository";
import { GetComponentDefinitionsUseCase } from "../../src/modules/component-definitions/application/get-component-definitions.use-case";
import { validateComponentParams } from "../../src/modules/jobs/tools/job-plan-edit.tool";

describe("extracción de schemas de los 50 componentes en código", () => {
  test("tFileInputDelimited: parámetros, tipos y valores válidos desde el XML", async () => {
    const useCase = new GetComponentDefinitionsUseCase(new DefinitionIndexRepository());
    const view = await useCase.get("tFileInputDelimited");
    expect(view).not.toBeNull();
    expect(view!.parameters.length).toBeGreaterThan(10);
    const names = view!.parameters.map((p) => p.name);
    expect(names).toContain("FILENAME");
    expect(names).toContain("FIELDSEPARATOR");
    expect(names).toContain("ROWSEPARATOR");
    const separator = view!.parameters.find((p) => p.name === "FIELDSEPARATOR");
    expect(separator?.field).toBeDefined();
  });

  test("tMap: conectores y estructura declarados", async () => {
    const useCase = new GetComponentDefinitionsUseCase(new DefinitionIndexRepository());
    const view = await useCase.get("tMap");
    expect(view).not.toBeNull();
    expect(view!.connectors.length).toBeGreaterThan(0);
  });

  test("validateComponentParams: un parámetro desconocido salta en código", async () => {
    const result = await validateComponentParams([
      { op: "add_node", uniqueName: "tFileInputDelimited_1", componentName: "tFileInputDelimited", parameters: { FILENAME: '"x.csv"', PARAMETRO_INVENTADO: '"1"' } },
    ]);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("desconocidos");
  });

  test("validateComponentParams: un valor fuera de la lista cerrada salta en código", async () => {
    const useCase = new GetComponentDefinitionsUseCase(new DefinitionIndexRepository());
    const view = await useCase.get("tFileInputDelimited");
    const withOptions = view!.parameters.find((p) => p.options?.length);
    if (!withOptions) return;
    const result = await validateComponentParams([
      { op: "add_node", uniqueName: "X_1", componentName: "tFileInputDelimited", parameters: { [withOptions.name]: '"valor_invalido_xyz"' } },
    ]);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(withOptions.name);
  });
});
