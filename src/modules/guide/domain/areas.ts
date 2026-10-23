import type { GuideArea } from "./guide.types";

/**
 * Familias de tools que ve un agente.
 *
 * `areaForTool` clasifica por el nombre, sin listas exhaustivas: una tool nueva
 * cae en su familia sin tocar este archivo. El orden de las reglas importa: la
 * primera que coincide gana.
 */
export const GUIDE_AREAS: GuideArea[] = [
  { id: "guide", name: "Orientacion", useFor: "Saber que hacer, en que orden y con que tool." },
  { id: "environment", name: "Entorno", useFor: "Comprobar proyecto, Studio, bridge y permisos de lectura." },
  { id: "contexts", name: "Contextos", useFor: "Entornos y variables de un job o del proyecto." },
  { id: "bridge", name: "Bridge (IDE en vivo)", useFor: "Estado y control del workbench de Studio." },
  { id: "commands", name: "Comandos del IDE", useFor: "Ejecutar comandos de Eclipse permitidos." },
  { id: "runs", name: "Ejecuciones", useFor: "Lanzar jobs y leer su salida, log e historial." },
  { id: "errors", name: "Errores", useFor: "Explicar un error, mapearlo a un componente y sugerir el fix." },
  { id: "validation", name: "Validacion", useFor: "Revisar diseno, contextos, performance y columnas de auditoria." },
  { id: "secrets", name: "Secretos", useFor: "Detectar credenciales en claro y migrarlas a contextos." },
  { id: "datasets", name: "Datasets", useFor: "Inspeccionar CSV, inferir schemas y generar mapeos a tablas raw." },
  { id: "deliverables", name: "Entregables", useFor: "Reunir archivos, validar y empaquetar un job para entrega." },
  { id: "evidence", name: "Evidencia", useFor: "Armar y exportar el paquete de evidencia de una ejecucion." },
  { id: "reports", name: "Reportes", useFor: "Generar fragmentos de texto sobre jobs." },
  { id: "snapshots", name: "Snapshots", useFor: "Listar, leer, comparar y restaurar copias del proyecto." },
  { id: "repo", name: "Repositorios git", useFor: "Clonar, cambiar, actualizar y revisar el repo del proyecto." },
  { id: "mastery", name: "Mastery de componentes", useFor: "Aprender y validar componentes contra Studio." },
  { id: "components", name: "Componentes", useFor: "Descubrir componentes, sus parametros, conectores y schemas." },
  { id: "connections", name: "Conexiones", useFor: "Construir perfiles de conexion a base de datos y aplicarlos." },
  { id: "studio", name: "Studio (utilidades)", useFor: "Instalar artefactos, medir memoria y cerrar dialogos." },
  { id: "live", name: "Watcher", useFor: "Detectar cambios del workspace en vivo." },
  { id: "sync", name: "Sincronizacion", useFor: "Preparar el estado antes de editar archivos." },
  { id: "task", name: "Tareas de proyecto", useFor: "Analizar requerimientos y armar planes." },
  { id: "coverage", name: "Cobertura", useFor: "Medir cuanto de Talend automatiza el MCP." },
  { id: "analysis", name: "Analisis en disco", useFor: "Leer jobs, flujos, DQ y logs sin abrir Studio." },
  { id: "jobs", name: "Jobs", useFor: "Crear, listar, duplicar y editar jobs." },
  { id: "other", name: "Otros", useFor: "Utilidades que no encajan en otra familia." },
];

const AREA_NAMES = new Map(GUIDE_AREAS.map((area) => [area.id, area.name]));

type AreaRule = { area: string; match: (name: string) => boolean };

const starts = (...prefixes: string[]) =>
  (name: string) => prefixes.some((prefix) => name.startsWith(prefix));

const contains = (...needles: string[]) =>
  (name: string) => needles.some((needle) => name.includes(needle));

/** Orden de evaluacion: de la familia mas especifica a la mas general. */
const RULES: AreaRule[] = [
  { area: "guide", match: (name) => name === "talend_guide" },
  { area: "environment", match: (name) =>
    name.includes("environment") || name.startsWith("talend_can_read_") || name === "talend_studio_process" },
  { area: "contexts", match: contains("context") },
  { area: "bridge", match: contains("bridge_") },
  { area: "commands", match: contains("command") },
  { area: "runs", match: (name) =>
    name.startsWith("talend_runs_") || name.startsWith("talend_run_") ||
    name.includes("run_by_name") || name.includes("wait_run") || name.includes("run_log") ||
    name.includes("run_output") || name.includes("latest_run") },
  { area: "errors", match: contains("error") },
  { area: "validation", match: (name) => name.startsWith("talend_validation_") },
  { area: "secrets", match: contains("secret") },
  { area: "datasets", match: contains("dataset") },
  { area: "deliverables", match: contains("deliverable") },
  { area: "evidence", match: contains("evidence") },
  { area: "reports", match: contains("report_snippet") },
  { area: "snapshots", match: contains("snapshot") },
  { area: "repo", match: starts("talend_repo_") },
  { area: "mastery", match: contains("mastery") },
  { area: "components", match: starts("talend_components_") },
  { area: "connections", match: starts("talend_connection_") || contains("repository_connections") },
  { area: "studio", match: starts("talend_studio_") },
  { area: "live", match: (name) => name.startsWith("talend_live_") || name === "talend_latest_changes" },
  { area: "sync", match: starts("talend_sync_") },
  { area: "task", match: starts("talend_task_") },
  { area: "coverage", match: starts("talend_coverage") },
  { area: "analysis", match: (name) =>
    name.startsWith("talend_analyze_") || name.startsWith("talend_inspect_") ||
    name.includes("_analysis") || name === "talend_show_flow" || name === "talend_diagnose_job" ||
    name.startsWith("talend_read_analysis") || name.startsWith("talend_list_analyses") },
  { area: "jobs", match: (name) => name.includes("job") },
];

/** Devuelve `true` si la tool necesita Talend Studio abierto con el bridge. */
export function requiresStudio(toolName: string): boolean {
  const studioJobTools = new Set([
    "talend_jobs_create",
    "talend_job_create_in_studio",
    "talend_job_delete_in_studio",
    "talend_job_open_in_studio",
    "talend_job_add_node",
    "talend_job_configure_node",
    "talend_job_connect_nodes",
    "talend_job_contexts_list",
    "talend_job_context_create",
    "talend_job_context_set",
    "talend_job_context_delete_variable",
    "talend_job_context_delete",
    "talend_job_update_node",
    "talend_job_set_schema",
    "talend_job_execute",
    "talend_job_compile",
    "talend_job_problems",
    "talend_job_list_nodes",
    "talend_job_run_by_name",
    "talend_job_wait_run",
    "talend_list_repository_contexts",
    "talend_read_repository_context",
    "talend_create_repository_context",
    "talend_delete_repository_context",
    "talend_delete_repository_context_parameter",
    "talend_upsert_repository_context_parameter",
    "talend_list_repository_connections",
  ]);

  return (
    studioJobTools.has(toolName) ||
    toolName.startsWith("talend_studio_") ||
    toolName.startsWith("talend_bridge_") ||
    toolName === "talend_mastery_validate_in_studio" ||
    toolName === "talend_mastery_validate_run" ||
    toolName === "talend_auto_run_active_job" ||
    toolName === "talend_commands_execute_safe"
  );
}

/** Familia a la que pertenece una tool. */
export function areaForTool(toolName: string): string {
  for (const rule of RULES) {
    if (rule.match(toolName)) return rule.area;
  }
  return "other";
}

/** Nombre legible de una familia. */
export function areaName(areaId: string): string {
  return AREA_NAMES.get(areaId) ?? areaId;
}
