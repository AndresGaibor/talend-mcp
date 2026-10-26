import type { GuideTask } from "../guide.types";

/** Tareas de análisis de Data Quality. */
export const DATA_QUALITY_TASKS: GuideTask[] = [
  {
    id: "data-quality",
    title: "Revisar análisis de Data Quality",
    goal: "Encontrar, leer y mantener los análisis de perfilado de datos del proyecto Talend.",
    whenToUse: "Cuando se necesita consultar o actualizar un análisis DQ (.ana) sin abrir Studio.",
    requires: ["project"],
    aliases: ["dq", "data quality", "perfilado", "analisis de datos", "indicadores"],
    steps: [
      {
        tool: "talend_list_analyses",
        purpose: "Listar los análisis DQ del proyecto.",
        input: { projectPath: "<ruta del proyecto Talend>" },
      },
      {
        tool: "talend_read_analysis",
        purpose: "Leer un análisis concreto por la ruta .ana devuelta por el listado.",
        input: { analysisPath: "<ruta del archivo .ana>" },
      },
      {
        tool: "talend_update_analysis",
        purpose: "Actualizar metadatos del análisis cuando sea necesario.",
        input: { analysisPath: "<ruta del archivo .ana>", description: "<descripción>" },
        optional: true,
      },
      {
        tool: "talend_duplicate_analysis",
        purpose: "Crear una copia del análisis con otro nombre, preservando el original.",
        input: { analysisPath: "<ruta del archivo .ana>", newName: "<nuevo nombre>" },
        optional: true,
      },
    ],
    pitfalls: [
      "`talend_update_analysis` modifica el archivo .ana; confirma el proyecto y la ruta antes de usarlo.",
      "El listado requiere `projectPath`, pero las tools de lectura y edición reciben la ruta del análisis.",
    ],
    doneWhen: "El análisis solicitado quedó identificado y sus metadatos o contenido fueron verificados.",
  },
];
