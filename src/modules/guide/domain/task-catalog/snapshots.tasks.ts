import type { GuideTask } from "../guide.types";

/** Tareas de comparación y restauración de snapshots. */
export const SNAPSHOTS_TASKS: GuideTask[] = [
  {
    id: "snapshots",
    title: "Comparar o restaurar un snapshot del proyecto",
    goal: "Inspeccionar el estado guardado del proyecto y comparar sus archivos antes de decidir si restaurarlos.",
    whenToUse: "Cuando se necesita revisar cambios frente a un snapshot o recuperar archivos anteriores.",
    requires: ["project"],
    aliases: ["snapshot", "respaldo", "backup", "restaurar", "comparar cambios"],
    steps: [
      {
        tool: "talend_snapshots_list",
        purpose: "Listar snapshots disponibles; usa paginación si el proyecto tiene muchos.",
        input: { limit: 50, offset: 0 },
      },
      {
        tool: "talend_snapshots_read",
        purpose: "Leer el manifiesto de un snapshot y confirmar qué estado contiene.",
        input: { snapshotId: "<id del snapshot>" },
      },
      {
        tool: "talend_snapshots_diff",
        purpose: "Comparar los archivos actuales con el snapshot antes de restaurar.",
        input: { snapshotId: "<id del snapshot>" },
      },
      {
        tool: "talend_snapshots_restore",
        purpose: "Restaurar archivos desde el snapshot seleccionado.",
        input: { snapshotId: "<id del snapshot>" },
        optional: true,
      },
    ],
    pitfalls: [
      "Restaurar cambia archivos del proyecto; revisa primero el manifiesto y el diff, y confirma la intención del usuario.",
      "Estas tools usan el proyecto detectado si no se proporciona `projectPath`; el `snapshotId` debe venir del listado.",
    ],
    doneWhen: "El contenido y las diferencias del snapshot quedaron revisados; si se autorizó restaurar, se verificaron los archivos restaurados.",
  },
];
