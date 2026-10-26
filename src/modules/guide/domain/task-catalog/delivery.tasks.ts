import type { GuideTask } from "../guide.types";

/** Tareas de calidad y entregables. */
export const DELIVERY_TASKS: GuideTask[] = [
  {
    id: "calidad-y-entregables",
    title: "Validar calidad y preparar entregables",
    goal: "Dejar el job listo para entrega: sin secretos, sin antipatrones y con evidencia.",
    whenToUse: "Antes de entregar, despues de un cambio grande o para una auditoria.",
    requires: ["project"],
    aliases: ["entrega", "auditoria", "calidad", "validar", "evidencia", "paquete", "zip"],
    steps: [
      {
        tool: "talend_validation_validate_design",
        purpose: "Validar el diseno contra las reglas configuradas. Recibe el spec del job, no el nombre.",
      },
      {
        tool: "talend_validation_validate_context_usage",
        purpose: "Comprobar que el job usa los contextos requeridos. Tambien recibe el spec.",
      },
      {
        tool: "talend_secrets_scan_project",
        purpose: "Buscar credenciales en claro en .item y .properties.",
      },
      {
        tool: "talend_job_quality_report",
        purpose: "Puntaje de calidad con hallazgos y soluciones.",
        input: { jobId: "MI_JOB" },
      },
      {
        tool: "talend_deliverables_export_job",
        purpose: "Preparar el paquete de entregable del job.",
        input: { jobName: "MI_JOB" },
      },
      {
        tool: "talend_deliverables_validate",
        purpose: "Validar que el job cumple los requisitos de entregable.",
        optional: true,
      },
      {
        tool: "talend_deliverables_create_package",
        purpose: "Crear el ZIP final del entregable.",
        optional: true,
      },
      {
        tool: "talend_evidence_pack_build",
        purpose: "Armar el paquete de evidencia de una ejecucion o auditoria.",
        optional: true,
      },
    ],
    pitfalls: [
      "Un entregable sin evidencia de ejecucion no demuestra que el job corre: guarda la salida de `talend_job_execute`.",
    ],
    doneWhen: "Validaciones en verde, sin secretos detectados y el paquete generado.",
  },
];
