export type CoverageArea = {
  workspace: number;
  jobs: number;
  components: number;
  contexts: number;
  dq: number;
  execution: number;
  studioBridge: number;
  uiAutomation: number;
};

export type AutomationCoverageReport = {
  overall: number;
  areas: CoverageArea;
  missing: string[];
  generatedAt: number;
};

function computeOverall(areas: CoverageArea): number {
  const weights = {
    workspace: 0.10,
    jobs: 0.20,
    components: 0.15,
    contexts: 0.10,
    dq: 0.10,
    execution: 0.15,
    studioBridge: 0.15,
    uiAutomation: 0.05,
  };

  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    total += (areas[key as keyof CoverageArea] ?? 0) * weight;
  }
  return Math.round(total);
}

export function generateCoverageReport(options?: {
  override?: Partial<CoverageArea>;
  missing?: string[];
}): AutomationCoverageReport {
  const base: CoverageArea = {
    workspace: 90,
    jobs: 75,
    components: 45,
    contexts: 60,
    dq: 50,
    execution: 55,
    studioBridge: 55,
    uiAutomation: 15,
  };

  const areas = { ...base, ...options?.override };

  const defaultMissing = [
    "No se valida ejecucion real por componente",
    "No hay UI automation para wizards",
    "Catalogo de componentes incompleto",
    "Command catalog no clasificado",
    "Plugin deep-model no implementado",
  ];

  return {
    overall: computeOverall(areas),
    areas,
    missing: options?.missing ?? defaultMissing,
    generatedAt: Date.now(),
  };
}
