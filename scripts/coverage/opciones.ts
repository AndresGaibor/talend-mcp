export type CoverageOptions = {
  filtro?: string;
  max?: number;
  compilar: boolean;
  salida: string;
  familia?: string;
  componentes?: string[];
  conDefinicion: boolean;
  sinArtefacto: boolean;
  soloPendientes: boolean;
  cancelar: boolean;
};

function valorDe(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

/** Interpreta las banderas del CLI de cobertura sin depender de process.argv. */
export function leerOpciones(args: string[]): CoverageOptions {
  const maxRaw = valorDe(args, "--max");
  const maxValue = maxRaw === undefined ? undefined : Number(maxRaw);
  return {
    filtro: valorDe(args, "--filter"),
    max: maxValue !== undefined && Number.isFinite(maxValue) && Number.isInteger(maxValue) && maxValue > 0
      ? maxValue
      : undefined,
    compilar: args.includes("--compile"),
    salida: valorDe(args, "--out") ?? "testdata/cobertura.csv",
    familia: valorDe(args, "--family"),
    componentes: valorDe(args, "--components")?.split(",").map((name) => name.trim()).filter(Boolean),
    conDefinicion: args.includes("--con-definicion"),
    sinArtefacto: args.includes("--sin-artefacto"),
    soloPendientes: args.includes("--solo-pendientes"),
    cancelar: args.includes("--cancel"),
  };
}
