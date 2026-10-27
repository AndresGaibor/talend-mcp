export type CoverageSummary = {
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
  components?: Array<Record<string, unknown>>;
};

export function lineasDeResumen(data: CoverageSummary, output: string, elapsedSeconds: number): string[] {
  const lines = [
    `Catalogo de Talend:        ${data.catalogSize ?? 0} componentes`,
    `Probados:                  ${data.tested ?? 0}${data.cancelled ? " (cancelada)" : ""}`,
    `Creados:                   ${data.created ?? 0}`,
    `Con parametros aplicados:  ${data.configured ?? 0}`,
    `Guardados sin error:       ${(data.created ?? 0) - (data.saveFailed ?? 0)}`,
  ];
  if (data.compile) lines.push(`Compilan (L4):             ${data.compiled ?? 0}`);
  lines.push(
    `En el job (listados):      ${data.listed ?? 0}`,
    `Borrados del job:          ${data.deleted ?? 0}`,
    `Fallidos:                  ${data.failed ?? 0}`,
    `Detalle en:                ${output}`,
    `Tiempo:                    ${elapsedSeconds} s`,
  );
  return lines;
}

export function lineasDeFallos(rows: Array<Record<string, unknown>>): string[] {
  return rows
    .filter((row) => row.ok !== true)
    .slice(0, 15)
    .map((row) => `  ${String(row.component ?? "desconocido")}: ${String(row.error ?? row.deleteError ?? "sin detalle")}`);
}
