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
    "Servidor MCP de Qlik Talend Studio: lee, crea, edita, ejecuta y verifica jobs de un proyecto Talend (.item/.properties).",
    "",
    "EMPIEZA AQUI: llama talend_guide { mode: \"overview\" }. Devuelve el proyecto configurado, las tareas disponibles y las tools expuestas.",
    `Tareas: ${tasks}.`,
    "Para una tarea concreta: talend_guide { mode: \"task\", task: \"crear-job\" }.",
    "Antes de configurar un componente: talend_guide { mode: \"rules\" }.",
    "Para encontrar una tool: talend_guide { mode: \"search\", query: \"contexto\" }.",
    "Para comprobar proyecto, Studio y bridge: talend_guide { mode: \"environment\" }.",
    "",
    "REGLA DE ORO: los jobs se crean y se modifican con la API de Studio (talend_job_create_in_studio, talend_job_add_node, talend_job_configure_node, talend_job_connect_nodes), nunca escribiendo el .item. Escribir el XML por fuera deja el modelo de Studio obsoleto y corrompe el job.",
    "",
    "Flujo canonico para crear un job: talend_studio_list_components -> talend_components_definition -> talend_job_create_in_studio -> talend_job_add_node -> talend_job_set_schema -> talend_job_connect_nodes -> talend_job_verify.",
    "El schema del origen es obligatorio antes de conectar; en tMap, tAggregateRow, tNormalize y tJavaRow el schema y el modelo se aplican despues de conectar.",
    "Conecta con el conector real del componente (FLOW, UNIQUE, REJECT, ITERATE): con el equivocado el job compila pero no pasa nada.",
    "",
    "VERIFICAR: tras crear o cambiar un job, llama SIEMPRE talend_job_verify { job }. En una sola llamada revisa el diseno (vista Problemas), compila, ejecuta y busca [WARN], [ERROR], [FATAL] y excepciones en la salida aunque el codigo de salida sea 0. Devuelve verdict (ok | ok_con_avisos | error) y findings: informa de cada aviso al usuario, no los des por ruido. Un ok: true o un job que termina bien NO significa que no haya avisos. Para mas detalle: talend_job_execute (tambien devuelve findings), talend_tail_run_output, talend_analyze_logs y talend_bridge_log_tail (Error Log de Studio).",
    "",
    "Dos familias de tools: las de disco (talend_jobs_list/read, talend_read_contexts, talend_validation_*, talend_secrets_*) funcionan sin Studio; las de Studio en vivo (talend_job_*, talend_studio_*, talend_bridge_*) requieren Talend Studio abierto con el plugin bridge en 127.0.0.1:3930.",
    "Toda tool devuelve el envelope { ok, source, confidence, data, warnings, errors, nextActions }. Si `ok` es false, lee `errors`; si trae `nextActions`, sigue esa secuencia.",
  ].join("\n");
}
