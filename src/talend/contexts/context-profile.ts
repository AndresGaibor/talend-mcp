import type { ContextProfile, ContextVariable } from "./context-types";

export const DEFAULT_PROFILES: ContextProfile[] = [
  {
    name: "raw_loader_standard",
    description: "Perfil estándar para jobs de carga CSV a raw",
    variables: [
      { name: "input_path", type: "string", defaultValue: "/data/raw", description: "Ruta base de archivos de entrada" },
      { name: "batch_size", type: "number", defaultValue: "5000", description: "Tamaño de batch para inserts" },
      { name: "run_id", type: "string", defaultValue: "1", description: "ID de ejecución del job" },
      { name: "db_host", type: "string", defaultValue: "localhost", description: "Host de base de datos" },
      { name: "db_port", type: "string", defaultValue: "5432", description: "Puerto de base de datos" },
      { name: "db_name", type: "string", defaultValue: "stg", description: "Nombre de base de datos" },
      { name: "db_user", type: "string", defaultValue: "postgres", description: "Usuario de base de datos" },
      { name: "db_pass", type: "password", defaultValue: "", description: "Password de base de datos" },
    ],
    applicableTo: ["multi_csv_raw_loader", "csv_to_db_with_audit_columns"],
  },
  {
    name: "api_loader",
    description: "Perfil para jobs que consumen APIs REST",
    variables: [
      { name: "api_base_url", type: "string", defaultValue: "", description: "URL base de la API" },
      { name: "api_key", type: "password", defaultValue: "", description: "API key si aplica" },
      { name: "batch_size", type: "number", defaultValue: "1000", description: "Batch size" },
      { name: "run_id", type: "string", defaultValue: "1", description: "Run ID" },
    ],
    applicableTo: ["api_to_db_loader"],
  },
];

export function getContextProfile(name: string): ContextProfile | null {
  return DEFAULT_PROFILES.find((p) => p.name === name) ?? null;
}

export function listContextProfiles(): ContextProfile[] {
  return [...DEFAULT_PROFILES];
}

export function createContextProfile(name: string, variables: ContextVariable[], description?: string): ContextProfile {
  return { name, description, variables };
}

export function applyContextToJobSpec(profile: ContextProfile, jobSpec: Record<string, unknown>): Record<string, unknown> {
  const contextMap: Record<string, ContextVariable> = {};
  for (const v of profile.variables) {
    contextMap[v.name] = v;
  }
  return {
    ...jobSpec,
    contexts: profile.variables.map((v) => ({
      name: v.name,
      type: v.type,
      defaultValue: v.defaultValue,
    })),
    contextVariables: contextMap,
  };
}
