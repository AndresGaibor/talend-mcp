import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";
import { TOOL_NAMES } from "../../../tools/tool-names";

export const JOB_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "job-designer",
    title: "Talend Job Designer",
    description: "Crea y revisa jobs con foco en diseño y estructura.",
    resourceUri: "ui://talend/job-designer.html",
    launcherToolName: "talend_app_job_designer",
    launchMessage: "Abriendo el diseñador de jobs.",
    actions: [
      createJsonAction("Create job", TOOL_NAMES.JOBS.CREATE, "Crea un job nuevo.", { jobName: "new_job" }, { requiresConfirmation: true }),
      createTextAction("Read job", TOOL_NAMES.JOBS.READ, "Lee un job existente.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Show flow", TOOL_NAMES.JOBS.SHOW_FLOW, "Muestra el flujo entre componentes.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createJsonAction("Apply pipeline spec", TOOL_NAMES.JOBS.APPLY_PIPELINE_SPEC, "Genera y escribe archivos .item/.properties.", { pattern: "multi_csv_raw_loader", name: "new_job", folderPath: "Process" }, { requiresConfirmation: true }),
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
      createJsonAction("Create job", TOOL_NAMES.JOBS.CREATE, "Crea un job nuevo.", { jobName: "new_job" }, { requiresConfirmation: true }),
      createJsonAction("Patch component", TOOL_NAMES.JOBS.PATCH_COMPONENT, "Parchea propiedades de un componente.", { jobName: "myJob", uniqueName: "tMap_1", patch: { LABEL: "Nuevo valor" } }, { requiresConfirmation: true }),
      createJsonAction("Add connection", "talend_add_connection", "Agrega una conexión.", { jobName: "myJob", sourceUniqueName: "tInput_1", targetUniqueName: "tMap_1", label: "row", connectorName: "FLOW", metaname: "", uniqueName: "connection_1" }, { requiresConfirmation: true }),
      createJsonAction("Apply pipeline spec", TOOL_NAMES.JOBS.APPLY_PIPELINE_SPEC, "Genera y escribe archivos .item/.properties.", { pattern: "multi_csv_raw_loader", name: "new_job", folderPath: "Process" }, { requiresConfirmation: true }),
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
      createNoInputAction("List jobs", TOOL_NAMES.JOBS.LIST, "Lista los jobs disponibles."),
      createTextAction("Read job", TOOL_NAMES.JOBS.READ, "Lee un job por nombre.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createTextAction("Read contexts", TOOL_NAMES.CONTEXTS.READ, "Lee los contextos de un job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
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
      createTextAction("Validate job design", TOOL_NAMES.VALIDATION.VALIDATE_DESIGN, "Valida el diseño del job.", "jobName", { inputLabel: "Job name", inputPlaceholder: "myJob" }),
      createJsonAction("Generate job", TOOL_NAMES.JOBS.GENERATE_FROM_PIPELINE_SPEC, "Genera job desde spec.", { pattern: "multi_csv_raw_loader", name: "myJob" }, { requiresConfirmation: true }),
      createJsonAction("Preview pipeline", TOOL_NAMES.JOBS.PREVIEW_PIPELINE_SPEC, "Previsualiza una spec.", { pattern: "multi_csv_raw_loader", name: "myJob" }),
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
      createJsonAction("Validate spec", TOOL_NAMES.JOBS.VALIDATE_PIPELINE_SPEC, "Valida una spec de pipeline.", { spec: { pattern: "multi_csv_raw_loader", name: "new_job" } }),
      createJsonAction("Preview spec", TOOL_NAMES.JOBS.PREVIEW_PIPELINE_SPEC, "Previsualiza una spec de pipeline.", { pattern: "multi_csv_raw_loader", name: "new_job" }),
      createJsonAction("Apply pipeline spec", TOOL_NAMES.JOBS.APPLY_PIPELINE_SPEC, "Genera y escribe archivos .item/.properties en el proyecto.", { pattern: "multi_csv_raw_loader", name: "new_job", folderPath: "Process" }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "job-component-studio",
    title: "Talend Job Component Studio",
    description: "Inspecciona y edita componentes del job activo en Talend Studio.",
    resourceUri: "ui://talend/job-component-studio.html",
    launcherToolName: "talend_app_job_component_studio",
    launchMessage: "Abriendo Job Component Studio.",
    uiMode: "react",
    actions: [
      createNoInputAction("Active job details", "talend_bridge_active_job_details", "Obtiene detalles profundos del job activo."),
      createJsonAction("Component details", "talend_bridge_active_component_details", "Obtiene detalles completos de un componente.", { uniqueName: "tFileInputDelimited_1", includeRaw: false }),
      createNoInputAction("Select component", "talend_bridge_select_component", "Selecciona y revela un componente en el editor."),
      createJsonAction("Rename label", "talend_components_rename_label", "Cambia el nombre visible del componente.", { jobName: "myJob", uniqueName: "tFileInputDelimited_1", newLabel: "input_orders" }, { requiresConfirmation: true }),
      createJsonAction("Preview patch", "talend_components_preview_patch", "Previsualiza cambios en un componente.", { jobName: "myJob", uniqueName: "tMap_1", patch: { LABEL: "Nuevo valor" } }),
      createJsonAction("Apply patch", "talend_components_apply_patch", "Aplica cambios a un componente.", { jobName: "myJob", uniqueName: "tMap_1", patch: { LABEL: "Nuevo valor" } }, { requiresConfirmation: true }),
      createJsonAction("Update position", "talend_components_update_position", "Actualiza la posicion de un componente.", { jobName: "myJob", uniqueName: "tMap_1", posX: 100, posY: 200 }, { requiresConfirmation: true }),
    ],
  },
];
