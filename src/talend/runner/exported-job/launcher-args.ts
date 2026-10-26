/**
 * Argumentos del launcher de Talend: `--context=<nombre>` y `--context_param <clave>=<valor>` por cada
 * parametro. El launcher no lee variables de entorno: lo que no va como argumento no llega al job.
 */
export function buildLauncherArgs(options: { contextName?: string; params?: Record<string, string> }): string[] {
  const args: string[] = [];
  if (options.contextName) {
    args.push(`--context=${options.contextName}`);
  }
  for (const [key, value] of Object.entries(options.params ?? {})) {
    args.push("--context_param", `${key}=${value}`);
  }
  return args;
}
