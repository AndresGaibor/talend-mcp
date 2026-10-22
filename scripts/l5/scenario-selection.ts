export type ScenarioSelectionInput = {
  nameFilter?: string;
  suite?: string;
  failedNames?: ReadonlySet<string>;
  changedNames?: ReadonlySet<string>;
};

export type SelectableScenario = { nombre: string; pendiente?: string };

export function suiteOf(nombre: string): string {
  const categoria = nombre.split(":", 1)[0]?.trim().toLowerCase() ?? "";
  if (categoria === "humo") return "humo";
  if (categoria === "archivos") return "archivos";
  if (categoria === "transformaciones") return "transformaciones";
  if (categoria === "bases de datos") return "bd";
  if (categoria === "control de flujo") return "control";
  if (categoria === "contextos") return "contextos";
  if (categoria === "orquestacion") return "orquestacion";
  if (categoria === "codigo") return "codigo";
  return "otros";
}

export function selectScenarios<T extends SelectableScenario>(
  scenarios: T[],
  options: ScenarioSelectionInput,
): T[] {
  const nameFilter = options.nameFilter?.toLowerCase();
  const suite = options.suite?.toLowerCase();
  return scenarios.filter((scenario) => {
    if (scenario.pendiente) return false;
    if (nameFilter && !scenario.nombre.toLowerCase().includes(nameFilter)) return false;
    if (suite && suiteOf(scenario.nombre) !== suite) return false;
    if (options.failedNames && !options.failedNames.has(scenario.nombre)) return false;
    if (options.changedNames && !options.changedNames.has(scenario.nombre)) return false;
    return true;
  });
}
