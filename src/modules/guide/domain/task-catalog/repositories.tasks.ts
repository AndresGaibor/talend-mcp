import type { GuideTask } from "../guide.types";

/** Tareas de repositorios Git de Talend. */
export const REPOSITORIES_TASKS: GuideTask[] = [
  {
    id: "repositorios-git",
    title: "Preparar y actualizar un repositorio Talend",
    goal: "Clonar o seleccionar un repositorio, revisar su estado y actualizarlo sin perder de vista el proyecto activo.",
    whenToUse: "Al conectar un proyecto Git nuevo, cambiar entre repositorios o traer cambios remotos.",
    requires: [],
    aliases: ["git", "repositorio", "clonar", "pull", "rama", "cambiar proyecto"],
    steps: [
      {
        tool: "talend_repo_sources",
        purpose: "Ver los repositorios Talend que ya están disponibles en la caché.",
      },
      {
        tool: "talend_repo_setup",
        purpose: "Clonar un origen remoto o descubrir un proyecto en una ruta local.",
        input: { source: "<URL Git, owner/repo o ruta local>", branch: "<rama opcional>" },
      },
      {
        tool: "talend_repo_status",
        purpose: "Comprobar rama, último commit y proyecto detectado antes de operar.",
        input: { repoPath: "<ruta del repositorio>" },
      },
      {
        tool: "talend_repo_pull",
        purpose: "Actualizar el repositorio activo mediante fast-forward y volver a descubrir el proyecto.",
        input: { repoPath: "<ruta del repositorio>" },
        optional: true,
      },
      {
        tool: "talend_repo_switch",
        purpose: "Seleccionar un repositorio local ya existente para esta sesión.",
        input: { repoPath: "<ruta del repositorio>" },
        optional: true,
      },
    ],
    pitfalls: [
      "Antes de hacer pull, revisa si hay cambios locales y confirma que la ruta corresponde al repositorio esperado.",
      "`talend_repo_setup` acepta URL, owner/repo o ruta local; `branch` es opcional.",
    ],
    doneWhen: "La ruta del repositorio, el proyecto Talend descubierto y la rama quedaron confirmados.",
  },
];
