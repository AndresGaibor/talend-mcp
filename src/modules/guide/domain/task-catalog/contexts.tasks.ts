import type { GuideTask } from "../guide.types";

/** Tareas de contextos, entornos y variables. */
export const CONTEXTS_TASKS: GuideTask[] = [
  {
    id: "contextos",
    title: "Gestionar contextos, entornos y variables",
    goal: "Que el job lea rutas, credenciales y parametros de contexto y no de valores fijos.",
    whenToUse: "Al parametrizar un job, antes de un entregable, o para mover un job entre entornos.",
    requires: ["studio", "bridge"],
    aliases: ["contexto", "entorno", "variable", "parametro", "produccion", "dev"],
    steps: [
      {
        tool: "talend_job_contexts_list",
        purpose: "Ver los entornos del job y el valor de cada variable en cada uno.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_context_create",
        purpose: "Crear un entorno copiando las variables del entorno por defecto.",
        input: { name: "produccion", job: "MI_JOB" },
      },
      {
        tool: "talend_job_context_set",
        purpose: "Crear o cambiar una variable con su valor en ese entorno.",
        input: { context: "produccion", name: "ruta_entrada", value: "/datos/entrada.csv", job: "MI_JOB" },
      },
      {
        tool: "talend_list_repository_contexts",
        purpose: "Ver los contextos del proyecto (items de tipo Contexts) y sus entornos.",
        optional: true,
      },
      {
        tool: "talend_read_repository_context",
        purpose: "Leer un contexto del proyecto completo antes de reutilizarlo.",
        input: { contextName: "MI_CONTEXTO" },
        optional: true,
      },
      {
        tool: "talend_secrets_scan_job",
        purpose: "Comprobar que no quedan credenciales en claro en el job.",
        input: { projectPath: "<proyecto Talend>", jobName: "MI_JOB" },
        optional: true,
      },
    ],
    pitfalls: [
      "Cada entorno tiene su propio valor de la misma variable: no dupliques variables con nombres distintos por entorno.",
      "El entorno por defecto no se puede borrar.",
      "Un contexto de proyecto recien creado no se puede enganchar a un job desde el MCP; enganchalo en Studio.",
    ],
    doneWhen: "`talend_job_contexts_list` muestra las variables y sus valores en todos los entornos necesarios.",
  },
];
