import type { GuideTask } from "../guide.types";

/** Tareas de diseno: decidir como se construye un job antes de escribirlo. */
export const DESIGN_TASKS: GuideTask[] = [
  {
    id: "disenar-job",
    title: "Disenar un job antes de crearlo",
    goal: "Saber que se reutiliza, que se crea nuevo y que contexto usa el job, con el usuario confirmado en los huecos.",
    whenToUse:
      "Antes de crear un job nuevo en un proyecto existente, para reutilizar jobs, contextos y conexiones ya presentes. Si el job ya existe, usa `editar-job`; si ya sabes el diseno, usa `crear-job`.",
    requires: ["project"],
    aliases: ["disenar", "diseñar", "antes de crear", "reutilizar", "buenas practicas", "criterio", "convenciones"],
    steps: [
      {
        tool: "talend_project_profile",
        purpose: "Inventario, convenciones, huecos y candidatos de reutilizacion del proyecto, sin Studio.",
        input: { limit: 25 },
      },
      {
        tool: "talend_jobs_list",
        purpose: "Inventario de jobs, carpetas y prefijos. Solo FALLBACK si `talend_project_profile` no esta disponible.",
        input: { limit: 50 },
        optional: true,
      },
      {
        tool: "talend_job_inspect",
        purpose: "Copiar la estructura de un job parecido: componentes, conexiones y contextos.",
        input: { job: "NOMBRE_DE_UN_JOB_PARECIDO" },
        optional: true,
      },
      {
        tool: "talend_list_repository_contexts",
        purpose: "Contextos de proyecto del repositorio. Requiere Studio.",
        optional: true,
      },
      {
        tool: "talend_list_repository_connections",
        purpose: "Conexiones compartidas que ya existen en el repositorio. Requiere Studio.",
        optional: true,
      },
      {
        tool: "talend_job_plan",
        purpose: "Validar el diseno con `dryRun` antes de escribir nada.",
      },
      {
        tool: "talend_job_verify",
        purpose: "Cerrar con la verificacion del job creado: diseno, compilacion y avisos.",
        input: { job: "NOMBRE_DEL_JOB" },
      },
    ],
    pitfalls: [
      "No hagas una bateria de preguntas generica: pregunta solo por huecos del inventario",
      "Sin joblets en el proyecto, la logica comun va en un job hijo con tRunJob",
      "Las convenciones se deducen de los nombres existentes: si dudas de una, confirmala con el usuario antes de copiarla.",
    ],
    doneWhen: "Se sabe que se reutiliza, que se crea y que se le ha preguntado al usuario; `talend_job_verify` no devuelve error.",
  },
];
