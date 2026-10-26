import type { GuideTask } from "../guide.types";

/** Tareas de preparación de datos desde CSV. */
export const DATASETS_TASKS: GuideTask[] = [
  {
    id: "datos-csv",
    title: "Preparar una carga desde CSV",
    goal: "Pasar de una carpeta de CSV a un schema de tabla raw y un job de carga.",
    whenToUse: "Cuando el origen son ficheros CSV y hay que disenar la tabla destino.",
    requires: ["project"],
    aliases: ["csv", "carga", "raw", "dataset", "inferir schema", "mapeo"],
    steps: [
      {
        tool: "talend_datasets_inspect_csv_folder",
        purpose: "Ver ficheros, columnas, tipos inferidos y estadisticas de la carpeta.",
        input: { folderPath: "<ruta a la carpeta de CSV>" },
      },
      {
        tool: "talend_datasets_infer_csv_schema",
        purpose: "Obtener el schema de base de datos propuesto a partir de la inspeccion.",
      },
      {
        tool: "talend_datasets_generate_raw_mappings",
        purpose: "Generar el mapeo a tabla raw con las columnas tecnicas de carga.",
      },
      {
        tool: "talend_components_get_mapping_suggestions",
        purpose: "Sugerir el mapeo columna a columna cuando los nombres no coinciden.",
        optional: true,
      },
    ],
    pitfalls: [
      "Revisa los tipos inferidos antes de crear la tabla: un CSV con ceros a la izquierda no es un entero.",
    ],
    doneWhen: "Tienes el schema destino y el mapeo CSV a tabla.",
  },
];
