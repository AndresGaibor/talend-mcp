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
        tool: "talend_job_compile",
        purpose: "Verificar que compila antes de gastar una ejecucion.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_run_by_name",
        purpose: "Lanzar el job por su launch config; con `waitForTermination` espera el final.",
        input: { jobName: "MI_JOB", waitForTermination: true, timeoutMs: 120000 },
      },
      {
        tool: "talend_job_execute",
        purpose: "Relanzar y traer `exitCode` y `stdout`. Es la unica forma de leer la salida desde el MCP.",
        input: { name: "MI_JOB" },
      },
      {
        tool: "talend_job_wait_run",
        purpose: "Esperar un launch ya iniciado cuando no se espero en el paso anterior.",
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
    ],
    pitfalls: [
      "`talend_job_run_by_name` no devuelve la salida: usa `talend_job_execute` para leerla.",
      "Si el job escribe un fichero, borra la salida anterior o usa `FILE_EXIST_EXCEPTION=false`.",
    ],
    doneWhen: "`exitCode` es 0 y las `lines` de `talend_job_execute` coinciden con lo esperado.",
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
        tool: "talend_job_problems",
        purpose: "Primero los errores de diseno de la vista Problemas, sin ejecutar nada.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_compile",
        purpose: "Si compila, el problema es de datos o de configuracion en tiempo de ejecucion.",
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
