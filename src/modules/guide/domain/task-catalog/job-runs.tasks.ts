import type { GuideTask } from "../guide.types";

/** Tareas de ejecución y diagnóstico de fallos. */
export const JOB_RUNS_TASKS: GuideTask[] = [
  {
    id: "ejecutar-y-verificar",
    title: "Ejecutar un job y verificar la salida",
    goal: "Saber si el job corre, con que codigo termina y que datos produjo.",
    whenToUse: "Despues de crear o cambiar un job, o para reproducir un fallo reportado.",
    requires: ["studio", "bridge"],
    aliases: ["run", "correr", "lanzar", "probar", "salida", "resultado", "exit code"],
    steps: [
      {
        tool: "talend_job_verify",
        purpose: "Todo en una llamada: diseno (Problemas), compilacion, ejecucion y revision de avisos. Devuelve `verdict` y `findings`. Usala siempre primero.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_execute",
        purpose: "Relanzar y traer `exitCode`, `stdout` y `findings` (avisos y errores de la salida), si `verify` no capturo la salida.",
        input: { name: "MI_JOB" },
        optional: true,
      },
      {
        tool: "talend_runs_list",
        purpose: "Ver el historial de ejecuciones guardadas y sus identificadores.",
        optional: true,
      },
      {
        tool: "talend_runs_read",
        purpose: "Leer el detalle de una ejecucion por `runId`.",
        optional: true,
      },
      {
        tool: "talend_tail_run_output",
        purpose: "Leer stdout y stderr de una ejecucion guardada, para buscar `[WARN]`, `[ERROR]` y excepciones.",
        input: { runId: "RUN_ID", stream: "both" },
        optional: true,
      },
      {
        tool: "talend_bridge_log_tail",
        purpose: "Error Log de Studio: avisos de componentes y plugins que no salen en la salida del job.",
        input: { lines: 200 },
        optional: true,
      },
    ],
    pitfalls: [
      "Un job con `exitCode` 0 puede llevar avisos: busca `[WARN]`, `[ERROR]`, `[FATAL]` y excepciones en la salida y en `talend_bridge_log_tail`, e informa de cada uno.",
      "Si `verify` termina por tiempo (`timedOut`), sube `timeoutMs`; el job puede seguir corriendo en Studio.",
      "Si el job escribe un fichero, borra la salida anterior o usa `FILE_EXIST_EXCEPTION=false`.",
    ],
    doneWhen: "`talend_job_verify` devuelve `verdict` `ok` (o `ok_con_avisos` con los avisos informados), `exitCode` es 0, las `lines` de `talend_job_execute` coinciden con lo esperado y no hay `[ERROR]`, `[FATAL]` ni excepciones sin explicar (los `[WARN]` se informan).",
  },
  {
    id: "diagnosticar-error",
    title: "Diagnosticar un job que falla",
    goal: "Pasar de un sintoma (job que no corre, error de compilacion, filas vacias) a una causa concreta.",
    whenToUse: "Cuando el job compila pero falla, o cuando el resultado no es el esperado.",
    requires: ["studio", "bridge"],
    aliases: ["error", "falla", "no compila", "excepcion", "depurar", "debug", "no salen filas"],
    steps: [
      {
        tool: "talend_job_verify",
        purpose: "Diseno, compilacion, ejecucion y avisos de una vez: `problems`, `compileDetail`, `findings` y `lines` dicen donde falla.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_errors_explain",
        purpose: "Explicar el mensaje de error (o el `runId`) y mapearlo a un componente.",
        input: { errorMessage: "column \"null\" does not exist" },
      },
      {
        tool: "talend_errors_suggest_fix",
        purpose: "Obtener el fix sugerido con el nivel de confianza.",
      },
      {
        tool: "talend_job_quality_report",
        purpose: "Revisar antipatrones y hallazgos de calidad del job.",
        input: { jobId: "MI_JOB" },
        optional: true,
      },
      {
        tool: "talend_bridge_problems_markers",
        purpose: "Leer los markers de Eclipse cuando el fallo es del IDE y no del job.",
        optional: true,
      },
    ],
    pitfalls: [
      "Si el job termina con codigo 0 pero no hay filas, sospecha del conector: `tUniqRow` sale por `UNIQUE`, no por `FLOW`.",
      "Errores `cannot be resolved to a variable` casi siempre significan schema sin definir o columna mal escrita.",
      "Un trigger dibujado desde el medio del subjob no se ejecuta nunca, aunque el job compile.",
    ],
    doneWhen: "Hay una causa identificada, el fix aplicado y una nueva ejecucion con la salida esperada.",
  },
];
