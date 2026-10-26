import type { GuideTask } from "../guide.types";

/** Tareas de consulta del nivel de validación de componentes. */
export const MASTERY_TASKS: GuideTask[] = [
  {
    id: "dominio-componentes",
    title: "Consultar el nivel de validación de componentes",
    goal: "Entender qué capacidades de un componente se han comprobado y qué evidencias o validaciones faltan.",
    whenToUse: "Cuando se evalúa si un componente está descubierto, se puede configurar o fue probado en Studio.",
    requires: [],
    aliases: ["mastery", "madurez", "cobertura de componentes", "componente validado"],
    steps: [
      {
        tool: "talend_mastery_component",
        purpose: "Consultar el nivel y las capacidades conocidas de un componente específico.",
        input: { componentName: "tFileInputDelimited" },
      },
      {
        tool: "talend_mastery_report",
        purpose: "Consultar el informe agregado de mastery ya registrado.",
      },
      {
        tool: "talend_mastery_all_components",
        purpose: "Ejecutar el análisis de todos los componentes y regenerar el informe agregado.",
        optional: true,
      },
    ],
    pitfalls: [
      "El informe agregado puede estar vacío hasta que se hayan aprendido o validado componentes.",
      "La operación sobre todos los componentes puede tardar; usa primero la consulta de un componente concreto.",
    ],
    doneWhen: "Se conoce el nivel del componente y las capacidades o evidencias pendientes.",
  },
];
