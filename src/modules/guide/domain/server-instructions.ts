import { GUIDE_TASKS } from "./task-catalog";

/**
 * Instrucciones que el servidor MCP entrega en `initialize`.
 *
 * Es lo primero que lee un agente externo. Debe ser corto (se inyecta en el
 * contexto de cada conversacion) y responder a tres preguntas: que es esto,
 * cual es la regla que no se puede romper y por donde se empieza.
 */
export function buildServerInstructions(): string {
  const tasks = GUIDE_TASKS.map((task) => task.id).join(", ");

  return [
    "MCP de Qlik Talend Studio: lee, crea, edita, ejecuta y verifica jobs (.item/.properties).",
    "",
    "EMPIEZA: talend_guide { mode: \"overview\" }. Tareas: " + tasks + ".",
    "Tarea: talend_guide { mode: \"task\", task: \"crear-job\" }. Reglas: { mode: \"rules\" }. Buscar: { mode: \"search\", query: \"...\" }. Entorno: { mode: \"environment\" }.",
    "",
    "CANONICAS (preset agent): talend_job_inspect, talend_component_describe, talend_job_plan (dryRun+diff), talend_job_edit (mode auto), talend_job_run (confirm), talend_run_status, talend_search/describe/execute (Code Mode), talend_job_verify, talend_jobs_list. Resto en `all` vía Code Mode.",
    "",
    "ESTRATEGIA MIXTA: OFFLINE para lotes/jobs cerrados (talend_jobs_create_from_spec, talend_jobs_create_batch, talend_job_edit_offline, talend_jobs_edit_batch, talend_job_build_batch, talend_job_verify run:false). STUDIO EN VIVO para jobs abiertos y tMap (talend_job_create_in_studio, add_node, configure_node, connect_nodes). Nunca edites en disco un job abierto: Studio lo pisa al guardar.",
    "VERIFICAR: talend_job_verify { job, run: false } siempre tras cambios; run:true solo con efectos externos aceptados. Informa de cada aviso (findings), no solo del verdict.",
    "Envelope: { ok, source, confidence, data, errors, nextActions }. SEGURIDAD: validación+autorización en dispatchValidated (TALEND_MCP_ALLOW_*, confirm, auditoría .talend-mcp/audit.jsonl).",
  ].join("\n");
}
