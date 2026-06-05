import type { PresentationAppDefinition } from "../app-types";
import { createJsonAction, createTextAction, createNoInputAction } from "./action-helpers";
import { TOOL_NAMES } from "../../../tools/tool-names";

export const DATA_APP_DEFINITIONS: PresentationAppDefinition[] = [
  {
    id: "dataset-inspector",
    title: "Talend Dataset Inspector",
    description: "Inspector de datasets con soporte para CSVs y schemas.",
    resourceUri: "ui://talend/dataset-inspector.html",
    launcherToolName: "talend_app_dataset_inspector",
    launchMessage: "Abriendo el inspector de datasets.",
    uiMode: "react",
    actions: [
      createTextAction("Inspect CSV folder", TOOL_NAMES.DATASETS.INSPECT_CSV_FOLDER, "Inspecciona una carpeta CSV.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/path/to/csv" }),
      createTextAction("Infer schema", TOOL_NAMES.DATASETS.INFER_CSV_SCHEMA, "Infers schema de CSVs.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/path/to/csv" }),
      createJsonAction("Generate raw mappings", TOOL_NAMES.DATASETS.GENERATE_RAW_MAPPINGS, "Genera mappings raw.", { folderPath: "/path/to/csv" }),
    ],
  },
  {
    id: "csv-preview",
    title: "Talend CSV Preview",
    description: "Previsualiza archivos CSV y sus datos.",
    resourceUri: "ui://talend/csv-preview.html",
    launcherToolName: "talend_app_csv_preview",
    launchMessage: "Abriendo la previsualización CSV.",
    actions: [
      createTextAction("Inspect CSV folder", TOOL_NAMES.DATASETS.INSPECT_CSV_FOLDER, "Inspecciona carpeta CSV.", "folderPath", { inputLabel: "Folder path", inputPlaceholder: "/path/to/csv" }),
    ],
  },
  {
    id: "raw-mapping-matrix",
    title: "Talend Raw Mapping Matrix",
    description: "Matriz de mapeo raw entre CSVs y tablas destino.",
    resourceUri: "ui://talend/raw-mapping-matrix.html",
    launcherToolName: "talend_app_raw_mapping_matrix",
    launchMessage: "Abriendo la matriz de mapeo raw.",
    actions: [
      createJsonAction("Generate raw mappings", TOOL_NAMES.DATASETS.GENERATE_RAW_MAPPINGS, "Genera mappings raw.", { folderPath: "/path/to/csv", tableName: "my_table" }),
    ],
  },
  {
    id: "mapping-builder",
    title: "Talend Mapping Builder",
    description: "Construye y visualiza mapeos entre CSVs y tablas.",
    resourceUri: "ui://talend/mapping-builder.html",
    launcherToolName: "talend_app_mapping_builder",
    launchMessage: "Abriendo el constructor de mapeos.",
    actions: [
      createTextAction("Inspect CSV folder", TOOL_NAMES.DATASETS.INSPECT_CSV_FOLDER, "Inspecciona carpeta CSV.", "folderPath"),
      createJsonAction("Generate raw mappings", TOOL_NAMES.DATASETS.GENERATE_RAW_MAPPINGS, "Genera mappings raw.", { folderPath: "/path/to/csv" }),
    ],
  },
  {
    id: "tmap-designer",
    title: "Talend tMap Designer",
    description: "Diseñador visual para transformaciones tMap.",
    resourceUri: "ui://talend/tmap-designer.html",
    launcherToolName: "talend_app_tmap_designer",
    launchMessage: "Abriendo el diseñador tMap.",
    actions: [
      createJsonAction("Apply pipeline spec", TOOL_NAMES.JOBS.APPLY_PIPELINE_SPEC, "Genera spec con tMap preconfigurado.", { pattern: "single_csv_loader", name: "new_job", folderPath: "Process" }, { requiresConfirmation: true }),
    ],
  },
  {
    id: "dataset-inspector-pro",
    title: "Talend Dataset Inspector Pro",
    description: "Inspector avanzado de datasets con análisis de calidad.",
    resourceUri: "ui://talend/dataset-inspector-pro.html",
    launcherToolName: "talend_app_dataset_inspector_pro",
    launchMessage: "Abriendo el inspector de datasets profesional.",
    actions: [
      createTextAction("Inspect CSV folder", TOOL_NAMES.DATASETS.INSPECT_CSV_FOLDER, "Inspecciona carpeta CSV.", "folderPath"),
      createTextAction("Infer schema", TOOL_NAMES.DATASETS.INFER_CSV_SCHEMA, "Infers schema.", "folderPath"),
      createJsonAction("Generate raw mappings", TOOL_NAMES.DATASETS.GENERATE_RAW_MAPPINGS, "Genera mappings.", { folderPath: "/path/to/csv" }),
    ],
  },
];
