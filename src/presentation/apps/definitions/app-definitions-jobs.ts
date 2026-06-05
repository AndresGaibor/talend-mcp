import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";

export const JOB_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "job-designer",
    title: "Talend Job Designer",
    description: "Crea y revisa jobs con foco en diseño y estructura.",
    resourceUri: "ui://talend/job-designer.html",
    launcherToolName: "talend_app_job_designer",
    launchMessage: "Abriendo el diseñador de jobs.",
    actions: [
      createJsonAction("Create job", "talend_create_job", "Crea un job nuevo.", { jobName: "new_job" }, { requiresConfirmation: true }),
      createTextAction("Read job", "talend_jobs_read", "Lee un job existente.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Show flow", "talend_show_flow", "Muestra el flujo entre componentes.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createJsonAction("Apply pipeline spec", "talend_job_apply_pipeline_spec", "Genera y escribe archivos .item/.properties.", { pattern: "multi_csv_raw_loader", name: "new_job", folderPath: "Process" }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "visual-job-designer",
    title: "Talend Visual Job Designer",
    description: "Diseñador visual para estructuras, nodos y conexiones.",
    resourceUri: "ui://talend/visual-job-designer.html",
    launcherToolName: "talend_app_visual_job_designer",
    launchMessage: "Abriendo el diseñador visual.",
    actions: [
      createJsonAction("Create job", "talend_create_job", "Crea un job nuevo.", { jobName: "new_job" }, { requiresConfirmation: true }),
      createJsonAction("Patch component", "talend_patch_component", "Parchea propiedades de un componente.", { jobName: "myJob", uniqueName: "tMap_1", patch: { LABEL: "Nuevo valor" } }, { requiresConfirmation: true }),
      createJsonAction("Add connection", "talend_add_connection", "Agrega una conexión.", { jobName: "myJob", sourceUniqueName: "tInput_1", targetUniqueName: "tMap_1", label: "row", connectorName: "FLOW", metaname: "", uniqueName: "connection_1" }, { requiresConfirmation: true }),
      createJsonAction("Apply pipeline spec", "talend_job_apply_pipeline_spec", "Genera y escribe archivos .item/.properties.", { pattern: "multi_csv_raw_loader", name: "new_job", folderPath: "Process" }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "job-browser",
    title: "Talend Job Browser",
    description: "Navegador para jobs, contexto y actividad reciente.",
    resourceUri: "ui://talend/job-browser.html",
    launcherToolName: "talend_app_job_browser",
    launchMessage: "Abriendo el navegador de jobs.",
    actions: [
      createNoInputAction("List jobs", "talend_jobs_list", "Lista los jobs disponibles."),
      createTextAction("Read job", "talend_jobs_read", "Lee un job por nombre.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Read contexts", "talend_read_contexts", "Lee los contextos de un job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
    ],
  },
  {
    id: "pattern-gallery",
    title: "Talend Pattern Gallery",
    description: "Galería de patrones de diseño y composición de jobs.",
    resourceUri: "ui://talend/pattern-gallery.html",
    launcherToolName: "talend_app_pattern_gallery",
    launchMessage: "Abriendo la galería de patrones.",
    actions: [
      createTextAction("Validate job design", "talend_job_validate_design", "Valida el diseño del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createJsonAction("Generate job", "talend_job_generate_from_pipeline_spec", "Genera job desde spec.", { pattern: "multi_csv_raw_loader", name: "myJob" }, { requiresConfirmation: true }),
      createJsonAction("Preview pipeline", "talend_job_preview_pipeline_spec", "Previsualiza una spec.", { pattern: "multi_csv_raw_loader", name: "myJob" }),
    ],
  },
  {
    id: "pipeline-spec-editor",
    title: "Talend Pipeline Spec Editor",
    description: "Editor de especificaciones para jobs y pipelines generados.",
    resourceUri: "ui://talend/pipeline-spec-editor.html",
    launcherToolName: "talend_app_pipeline_spec_editor",
    launchMessage: "Abriendo el editor de pipeline spec.",
    uiMode: "react",
    actions: [
      createJsonAction("Validate spec", "talend_job_validate_pipeline_spec", "Valida una spec de pipeline.", { spec: { pattern: "multi_csv_raw_loader", name: "new_job" } }),
      createJsonAction("Preview spec", "talend_job_preview_pipeline_spec", "Previsualiza una spec de pipeline.", { pattern: "multi_csv_raw_loader", name: "new_job" }),
      createJsonAction("Apply pipeline spec", "talend_job_apply_pipeline_spec", "Genera y escribe archivos .item/.properties en el proyecto.", { pattern: "multi_csv_raw_loader", name: "new_job", folderPath: "Process" }, { requiresConfirmation: true }),
    ],
  },
];
