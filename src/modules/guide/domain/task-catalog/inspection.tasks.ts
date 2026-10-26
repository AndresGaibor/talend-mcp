import type { GuideTask } from "../guide.types";

/** Tareas de inspección del proyecto sin Studio. */
export const INSPECTION_TASKS: GuideTask[] = [
  {
    id: "inspeccionar",
    title: "Inspeccionar jobs en disco (sin Studio)",
    goal: "Leer el proyecto sin depender del IDE: jobs, flujos, contextos, DQ y logs.",
    whenToUse: "Para explorar, auditar o responder preguntas cuando Studio no esta abierto.",
    requires: ["project"],
    aliases: ["leer", "explorar", "listar", "sin studio", "auditar", "revisar proyecto"],
    steps: [
      {
        tool: "talend_jobs_list",
        purpose: "Listar jobs con version, carpeta, fecha y numero de componentes.",
        input: { limit: 50 },
      },
      {
        tool: "talend_jobs_read",
        purpose: "Leer un job: componentes, conexiones y XML del .item.",
        input: { jobName: "MI_JOB" },
      },
      {
        tool: "talend_show_flow",
        purpose: "Ver solo el flujo de datos entre componentes.",
        input: { jobName: "MI_JOB" },
      },
      {
        tool: "talend_read_contexts",
        purpose: "Leer los contextos declarados en el job.",
        input: { jobName: "MI_JOB" },
        optional: true,
      },
      {
        tool: "talend_inspect_job",
        purpose: "Inspeccion completa: parametros, schemas y problemas de schema. Pide la ruta del .item.",
        input: { jobPath: "process/MI_JOB_0.1.item" },
        optional: true,
      },
      {
        tool: "talend_jobs_detect_antipatterns",
        purpose: "Detectar antipatrones de diseno sin abrir Studio.",
        input: { jobName: "MI_JOB" },
        optional: true,
      },
    ],
    pitfalls: [
      "`talend_jobs_read` lee el archivo: si Studio tiene cambios sin guardar, el disco puede estar desactualizado.",
      "Para editar no uses estas tools: el cambio se pierde o deja el modelo de Studio obsoleto.",
    ],
    doneWhen: "Tienes la lista de jobs o el detalle del job pedido.",
  },
];
