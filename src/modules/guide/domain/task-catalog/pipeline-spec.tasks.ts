import type { GuideTask } from "../guide.types";

/** Tareas de validación y previsualización de pipeline specs. */
export const PIPELINE_SPEC_TASKS: GuideTask[] = [
  {
    id: "pipeline-spec",
    title: "Validar y previsualizar una especificación de pipeline",
    goal: "Comprobar la estructura de un pipeline declarativo y revisar sus componentes y conexiones transformados.",
    whenToUse: "Cuando otro sistema o agente entrega un pipeline spec antes de aplicar cambios a un job.",
    requires: [],
    aliases: ["pipeline spec", "especificacion", "pipeline declarativo", "validar json"],
    steps: [
      {
        tool: "talend_jobs_validate_pipeline_spec",
        purpose: "Validar la estructura de la especificación y corregir errores antes de continuar.",
        input: {
          spec: {
            name: "<nombre>",
            version: "0.1",
            stages: [{ id: "stage-1", name: "<etapa>", components: [], connections: [] }],
          },
        },
      },
      {
        tool: "talend_jobs_preview_pipeline_spec",
        purpose: "Previsualizar componentes y conexiones transformados; esta operación es de solo lectura.",
        input: {
          spec: {
            name: "<nombre>",
            version: "0.1",
            stages: [{ id: "stage-1", name: "<etapa>", components: [], connections: [] }],
          },
        },
      },
    ],
    pitfalls: [
      "Cada componente requiere `id`, `name`, `type` y `configuration`; cada conexión requiere identificadores de origen y destino.",
      "Validar o previsualizar no aplica el spec ni garantiza que los componentes existan en la instalación local de Studio.",
      "No hay una tool activa que aplique directamente este pipeline spec; para materializarlo, usa el flujo `crear-job` con las tools de Studio.",
    ],
    doneWhen: "La especificación no tiene errores y su preview se revisó antes de cualquier operación de escritura.",
  },
];
