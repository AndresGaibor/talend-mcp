import {
  JOBS_EXTRA,
  LEGACY_TALEND_ALIASES,
  PRESET_AGENT,
  PRESET_CORE,
  RUNS_TOOLS,
} from "./preset-sets";

/**
 * Reglas de cada preset. Agregar un preset es agregar una entrada aca: el
 * filtro, `knownPresets` y las pruebas se derivan del mismo mapa.
 */
const PRESET_RULES: Record<string, (name: string) => boolean> = {
  all: (name) => name.startsWith("talend_"),
  canonical: (name) => name.startsWith("talend_") && !LEGACY_TALEND_ALIASES.has(name),
  agent: (name) => PRESET_AGENT.has(name),
  core: (name) => PRESET_CORE.has(name),
  jobs: (name) => name.startsWith("talend_jobs_") || JOBS_EXTRA.has(name),
  runs: (name) => name.startsWith("talend_runs_") || RUNS_TOOLS.has(name),
  bridge: (name) => name.startsWith("talend_bridge_"),
  components: (name) => name.startsWith("talend_components_"),
  errors: (name) => name.startsWith("talend_errors_"),
  validation: (name) => name.startsWith("talend_validation_"),
  secrets: (name) => name.startsWith("talend_secrets_"),
  datasets: (name) => name.startsWith("talend_datasets_"),
  deliverables: (name) => name.startsWith("talend_deliverables_"),
  requirements: (name) => name.startsWith("talend_requirements_") || name.startsWith("talend_task_"),
  evidence: (name) => name.startsWith("talend_evidence_"),
  reports: (name) => name.startsWith("talend_report_snippets_"),
  snapshots: (name) => name.startsWith("talend_snapshots_"),
};

export function isKnownPreset(name: string): boolean {
  return Object.hasOwn(PRESET_RULES, name.trim().toLowerCase());
}

export function knownPresets(): string[] {
  return Object.keys(PRESET_RULES);
}

export function applyFilter<T extends { name: string } | { definition: { name: string } }>(
  items: T[],
  filterStr: string | undefined
): T[] {
  if (!filterStr) return items;

  const patterns = filterStr.split(",").map((pattern) => pattern.trim().toLowerCase()).filter(Boolean);
  const rules = patterns.filter(isKnownPreset).map((preset) => PRESET_RULES[preset]!);
  const customPatterns = patterns.filter((pattern) => !isKnownPreset(pattern));

  return items.filter((item) => {
    const name = ("name" in item ? item.name : (item as any).definition.name).toLowerCase();

    // La guia debe estar disponible con cualquier preset: reduce las llamadas
    // iniciales a `tools/list` sin ocultar el mapa de orientacion del agente.
    if (name === "talend_guide") return true;

    if (rules.some((rule) => rule(name))) return true;

    // Nombre exacto o comodin (`talend_bridge_*`).
    return customPatterns.some((pattern) => {
      if (pattern.endsWith("*")) return name.startsWith(pattern.slice(0, -1));
      return name === pattern;
    });
  });
}
