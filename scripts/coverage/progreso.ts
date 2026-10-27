export const LIMITE_MEMORIA_PORCENTAJE = 80;
export const UMBRAL_RECOLECCION_PORCENTAJE = 60;

export type EstadoProgreso = {
  tested?: number;
  total?: number;
  failed?: number;
  current?: string;
};

export function debeRecolectar(memoryPercent: number): boolean {
  return memoryPercent >= UMBRAL_RECOLECCION_PORCENTAJE && memoryPercent < LIMITE_MEMORIA_PORCENTAJE;
}

export function superaElLimite(memoryPercent: number): boolean {
  return memoryPercent >= LIMITE_MEMORIA_PORCENTAJE;
}

export function lineaDeProgreso(estado: EstadoProgreso, elapsedSeconds: number, memoryPercent: number): string {
  const actual = estado.current ? `, ${estado.current}` : "";
  return `${estado.tested ?? 0}/${estado.total ?? 0} componentes, ${estado.failed ?? 0} fallidos, `
    + `${elapsedSeconds} s, memoria ${memoryPercent}%${actual}`;
}
