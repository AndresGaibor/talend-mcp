import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listTalendJobs } from "../../infrastructure/repositories/job-xml/job-properties-xml";

type Parametro = string | { value: string; field?: string };
type ComponenteDePlantilla = { componentName: string; parameters?: Record<string, Parametro> };

/** Nombre tecnico del proyecto (`talend.project`): es el prefijo del id de un item (`PRJ:_abc`). */
function proyectoTecnico(projectPath: string): string {
  const archivo = join(projectPath, "talend.project");
  if (existsSync(archivo)) {
    const coincidencia = /technicalLabel="([^"]+)"/.exec(readFileSync(archivo, "utf8"));
    if (coincidencia) return coincidencia[1]!;
  }
  return basename(projectPath);
}

/** El `id` del item de un job, que Studio usa para enlazarlo desde un `tRunJob`. */
function idDelItem(propertiesPath: string): string | undefined {
  if (!existsSync(propertiesPath)) return undefined;
  return /<TalendProperties:Property\b[^>]*?\sid="([^"]+)"/.exec(readFileSync(propertiesPath, "utf8"))?.[1];
}

const valorDe = (parametro: Parametro | undefined) => (typeof parametro === "string" ? parametro : parametro?.value);

/**
 * Enlaza cada `tRunJob` con su job hijo como lo hace Studio.
 *
 * Studio guarda el nombre del hijo (`PROCESS`) y ademas tres parametros tecnicos: el id del item del hijo
 * (`PRJ:_abc`), su contexto y la version. Sin ellos el `tRunJob` queda con "Parameter (Trabajo) is empty but is
 * required". El hijo debe existir ya en el proyecto (se escribe antes que el padre); si no existe se avisa y el
 * `tRunJob` se deja sin enlazar.
 */
export async function enlazarTRunJob<T extends { components: ComponenteDePlantilla[] }>(
  projectPath: string,
  plantilla: T,
): Promise<{ plantilla: T; avisos: string[] }> {
  const hayTRunJob = plantilla.components.some(
    (componente) => componente.componentName === "tRunJob" && valorDe(componente.parameters?.PROCESS),
  );
  if (!hayTRunJob) return { plantilla, avisos: [] };

  const avisos: string[] = [];
  // Un proyecto recien creado todavia no tiene la carpeta process/: no hay hijos que enlazar.
  const existentes = existsSync(join(projectPath, "process")) ? await listTalendJobs(projectPath) : [];
  const hijos = new Map(existentes.map((job) => [job.label, job]));
  const proyecto = proyectoTecnico(projectPath);

  const components = plantilla.components.map((componente) => {
    const proceso = componente.componentName === "tRunJob" ? valorDe(componente.parameters?.PROCESS) : undefined;
    if (!proceso) return componente;
    const hijo = hijos.get(proceso);
    const id = hijo ? idDelItem(hijo.propertiesPath) : undefined;
    if (!id) {
      avisos.push(`tRunJob: el job hijo '${proceso}' no existe todavia en el proyecto; el enlace queda sin hacer`);
      return componente;
    }
    const parameters = { ...componente.parameters };
    parameters["PROCESS:PROCESS_TYPE_PROCESS"] = { value: `${proyecto}:${id}`, field: "TECHNICAL" };
    parameters["PROCESS:PROCESS_TYPE_CONTEXT"] ??= { value: "Default", field: "TECHNICAL" };
    parameters["PROCESS:PROCESS_TYPE_VERSION"] ??= { value: "Latest", field: "TECHNICAL" };
    return { ...componente, parameters };
  });
  return { plantilla: { ...plantilla, components } as T, avisos };
}
