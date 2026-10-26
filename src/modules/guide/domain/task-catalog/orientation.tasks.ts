import type { GuideTask } from "../guide.types";

/** Tareas de orientación inicial y diagnóstico del entorno. */
export const ORIENTATION_TASKS: GuideTask[] = [
  {
    id: "orientarse",
    title: "Orientarse y comprobar el entorno",
    goal: "Saber con que proyecto se trabaja, si Studio y el bridge estan vivos y que se puede hacer.",
    whenToUse:
      "Primera llamada de cualquier sesion, o cuando una tool falla por no encontrar el proyecto o el IDE.",
    requires: ["project"],
    aliases: ["empezar", "estado", "diagnostico", "conectar", "setup", "hola"],
    steps: [
      {
        tool: "talend_guide",
        purpose: "Ver el mapa de tareas y que tools estan expuestas.",
        input: { mode: "overview" },
      },
      {
        tool: "talend_diagnose_environment",
        purpose: "Plataforma, workspace, proyecto, metadata, proceso de Studio y estado del bridge.",
      },
      {
        tool: "talend_bridge_ping",
        purpose: "Confirmar que el plugin responde y mirar `version` y `unsafeActions`.",
      },
      {
        tool: "talend_jobs_list",
        purpose: "Confirmar que el proyecto se lee y ver los jobs disponibles.",
        input: { limit: 20 },
        optional: true,
      },
    ],
    pitfalls: [
      "Sin proyecto configurado, define TALEND_PROJECT (la carpeta que contiene talend.project) en el entorno del servidor.",
      "Si el bridge no responde, abre Talend Studio con el proyecto cargado y reinstala el plugin con `bun run scripts/start.ts --install-bridge`.",
    ],
    doneWhen: "`talend_diagnose_environment` devuelve el proyecto y `talend_bridge_ping` responde ok.",
  },
];
