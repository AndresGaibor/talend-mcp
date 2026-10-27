export type ScenarioSelectionInput = {
  nameFilter?: string;
  suite?: string;
  failedNames?: ReadonlySet<string>;
  changedNames?: ReadonlySet<string>;
};

export type SelectableScenario = { nombre: string; pendiente?: string };

/**
 * Categorias (prefijo antes de `:`) reconocidas y la suite a la que pertenecen.
 * Una categoria nueva se agrega aca: el archivo de escenarios, la validacion de
 * `--suite` y el filtro se derivan de este mapa.
 */
export const SCENARIO_SUITES = {
  humo: "humo",
  archivos: "archivos",
  transformaciones: "transformaciones",
  "bases de datos": "bd",
  "control de flujo": "control",
  contextos: "contextos",
  orquestacion: "orquestacion",
  codigo: "codigo",
  aws: "aws",
  mensajeria: "mensajeria",
  apis: "apis",
  privacidad: "privacidad",
  calidad: "calidad",
  formatos: "formatos",
  sistema: "sistema",
  conciliacion: "conciliacion",
} as const satisfies Record<string, string>;

export type ScenarioSuite = (typeof SCENARIO_SUITES)[keyof typeof SCENARIO_SUITES] | "otros";

export const KNOWN_SUITES: ReadonlySet<string> = new Set(Object.values(SCENARIO_SUITES));

export function suiteOf(nombre: string): ScenarioSuite {
  const categoria = nombre.split(":", 1)[0]?.trim().toLowerCase() ?? "";
  return (SCENARIO_SUITES as Record<string, ScenarioSuite>)[categoria] ?? "otros";
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
