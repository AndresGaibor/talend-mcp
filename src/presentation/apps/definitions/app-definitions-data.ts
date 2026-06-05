import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";

export const DATA_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "dataset-inspector",
    title: "Talend Dataset Inspector",
    description: "Inspecciona datasets y revisa estructura, componentes y errores.",
    resourceUri: "ui://talend/dataset-inspector.html",
    launcherToolName: "talend_app_dataset_inspector",
    launchMessage: "Abriendo el inspector de datasets.",
    uiMode: "react",
    actions: [
      createTextAction("Inspect CSV folder", "talend_datasets_inspect_csv_folder", "Inspecciona una carpeta de CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createJsonAction("Infer CSV schema", "talend_datasets_infer_csv_schema", "Infiere schema para una carpeta.", { folderPath: "/data/csvs", tableName: "raw_my_table" }),
      createTextAction("Generate raw mappings", "talend_datasets_generate_raw_mappings", "Genera mappings raw por archivo.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
    ],
  },
  {
    id: "dataset-inspector-pro",
    title: "Talend Dataset Inspector Pro",
    description: "Inspección avanzada de datasets, tablas raw y esquemas.",
    resourceUri: "ui://talend/dataset-inspector-pro.html",
    launcherToolName: "talend_app_dataset_inspector_pro",
    launchMessage: "Abriendo el inspector pro de datasets.",
    uiMode: "react",
    actions: [
      createTextAction("Inspect CSV folder", "talend_datasets_inspect_csv_folder", "Inspecciona CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createJsonAction("Infer CSV schema", "talend_datasets_infer_csv_schema", "Infiere el schema de CSVs.", { folderPath: "/data/csvs", tableName: "raw_my_table" }),
      createTextAction("Generate raw mappings", "talend_datasets_generate_raw_mappings", "Genera mappings raw.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
    ],
  },
  {
    id: "csv-preview",
    title: "Talend CSV Preview",
    description: "Vista rápida de CSVs, delimitadores y encabezados.",
    resourceUri: "ui://talend/csv-preview.html",
    launcherToolName: "talend_app_csv_preview",
    launchMessage: "Abriendo la vista previa de CSV.",
    actions: [
      createTextAction("Inspect CSV folder", "talend_datasets_inspect_csv_folder", "Inspecciona CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createTextAction("Generate raw mappings", "talend_datasets_generate_raw_mappings", "Genera mappings raw.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
      createJsonAction("Infer CSV schema", "talend_datasets_infer_csv_schema", "Infiere schema para raw tables.", { folderPath: "/data/csvs", tableName: "raw_my_table" }),
    ],
  },
  {
    id: "mapping-builder",
    title: "Talend Mapping Builder",
    description: "Construye mappings y analiza componentes tMap/tDBOutput.",
    resourceUri: "ui://talend/mapping-builder.html",
    launcherToolName: "talend_app_mapping_builder",
    launchMessage: "Abriendo el builder de mappings.",
    actions: [
      createNoInputAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza salidas de base de datos."),
      createTextAction("Inspect component", "talend_components_inspect", "Inspecciona un componente.", "componentName", { inputLabel: "Component name", inputPlaceholder: "tMap" }),
      createTextAction("Generate template", "talend_components_generate_template", "Genera plantilla para un componente.", "componentName", { inputLabel: "Component name", inputPlaceholder: "tMap" }),
    ],
  },
  {
    id: "tmap-designer",
    title: "Talend tMap Designer",
    description: "Diseñador centrado en mapeos, schemas y conexiones.",
    resourceUri: "ui://talend/tmap-designer.html",
    launcherToolName: "talend_app_tmap_designer",
    launchMessage: "Abriendo el diseñador de tMap.",
    actions: [
      createTextAction("Inspect component", "talend_components_inspect", "Inspecciona un componente.", "componentName", { inputLabel: "Component name", inputPlaceholder: "tMap" }),
      createJsonAction("Preview schema", "talend_preview_schema_column", "Previsualiza un cambio de schema.", { jobName: "myJob", uniqueName: "tMap_1", schemaName: "Schema", columnName: "id", patch: { type: "id_Integer" } }),
      createJsonAction("Patch component", "talend_patch_component", "Aplica un patch al componente.", { jobName: "myJob", uniqueName: "tMap_1", patch: { LABEL: "Nuevo valor" } }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "raw-mapping-matrix",
    title: "Talend Raw Mapping Matrix",
    description: "Matriz de mapeos raw para columnas técnicas y datasets.",
    resourceUri: "ui://talend/raw-mapping-matrix.html",
    launcherToolName: "talend_app_raw_mapping_matrix",
    launchMessage: "Abriendo la matriz de mappings raw.",
    actions: [
      createNoInputAction("Analyze tDBOutput", "talend_analyze_tdboutput", "Analiza salidas a base de datos."),
      createJsonAction("Preview pipeline", "talend_job_preview_pipeline_spec", "Previsualiza la spec.", { pattern: "multi_csv_raw_loader", name: "myJob" }),
      createTextAction("Generate raw mappings", "talend_datasets_generate_raw_mappings", "Genera mappings raw.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/data/csvs" }),
    ],
  },
];
