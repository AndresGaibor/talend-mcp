export type CoverageRow = Record<string, unknown>;

export type CoverageReport = {
  catalogSize?: number;
  tested?: number;
  created?: number;
  configured?: number;
  listed?: number;
  deleted?: number;
  failed?: number;
  saveFailed?: number;
  compile?: boolean;
  compiled?: number;
  cancelled?: boolean;
  components?: CoverageRow[];
};

export type CoverageState = CoverageReport & {
  state?: string;
  total?: number;
  current?: string;
  elapsedMs?: number;
  error?: string;
  message?: string;
  alreadyRunning?: boolean;
  result?: CoverageReport;
};

/** Acepta la respuesta plana del bridge y la respuesta envuelta en `result`. */
export function desenvolver(data: unknown): CoverageState {
  if (data === null || typeof data !== "object") return {};
  const envelope = data as { result?: CoverageState };
  return envelope.result ?? (data as CoverageState);
}

/** Convierte las filas de cobertura al CSV consumido por los informes. */
export function lineasCsv(filas: CoverageRow[]): string[] {
  const lineas = [
    "componente,creado,configurado,guardado,en_el_job,borrado,parametros,montado,unique_name,error,compila,error_compilacion",
  ];
  for (const fila of filas) {
    lineas.push([
      String(fila.component ?? ""),
      fila.ok === true ? "si" : "no",
      fila.parametersApplied ? "si" : "no",
      fila.saved === false ? "no" : "si",
      fila.listed === true ? "si" : "no",
      fila.deleted === true ? "si" : "no",
      String(fila.parametersApplied ?? 0),
      String(fila.mounted ?? 0),
      String(fila.uniqueName ?? ""),
      `"${String(fila.error ?? fila.deleteError ?? "").replace(/"/g, '""')}"`,
      fila.compiles === undefined ? "" : fila.compiles === true ? "si" : "no",
      `"${String(fila.compileError ?? "").replace(/"/g, '""')}"`,
    ].join(","));
  }
  return lineas;
}
