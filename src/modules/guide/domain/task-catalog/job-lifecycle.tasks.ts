import type { GuideTask } from "../guide.types";

/** Tareas para crear y modificar jobs. */
export const JOB_LIFECYCLE_TASKS: GuideTask[] = [
  {
    id: "crear-job",
    title: "Crear un job y dejarlo ejecutando",
    goal: "Un job nuevo en el proyecto, con componentes, schema, conexiones y una ejecucion verificada.",
    whenToUse: "Cuando el job no existe. Si ya existe, usa la tarea `editar-job`.",
    requires: ["studio", "bridge"],
    aliases: ["nuevo job", "job nuevo", "montar job", "construir job", "pipeline", "etl"],
    steps: [
      {
        tool: "talend_studio_list_components",
        purpose: "Saber que componentes hay en la paleta (filtra por nombre para no traer 897).",
        input: { filter: "Delimited" },
      },
      {
        tool: "talend_components_definition",
        purpose: "Leer del disco que parametros exige el componente y que conexiones admite. No adivines.",
        input: { name: "tFileInputDelimited" },
      },
      {
        tool: "talend_studio_component_parameters",
        purpose: "Ver los parametros reales del catalogo de Studio, con tipo y valor por defecto.",
        input: { name: "tFileInputDelimited" },
        optional: true,
      },
      {
        tool: "talend_job_create_in_studio",
        purpose: "Crear el job vacio con la API del IDE y abrirlo en el editor.",
        input: { name: "MI_JOB", folder: "", replace: false },
      },
      {
        tool: "talend_job_add_node",
        purpose: "Anadir cada componente. Devuelve su `uniqueName`, que es la clave de los pasos siguientes.",
        input: { type: "tFixedFlowInput" },
      },
      {
        tool: "talend_job_set_schema",
        purpose: "Definir las columnas del origen (y `values` si el componente genera filas).",
        input: {
          uniqueName: "tFixedFlowInput_1",
          columns: [
            { name: "id", type: "id_Integer" },
            { name: "ciudad", type: "id_String" },
          ],
          values: [["1", "Bogota"]],
        },
      },
      {
        tool: "talend_job_connect_nodes",
        purpose: "Conectar por `uniqueName` con el conector real del componente (FLOW, UNIQUE, REJECT...).",
        input: { source: "tFixedFlowInput_1", target: "tLogRow_1", type: "FLOW" },
      },
      {
        tool: "talend_job_verify",
        purpose: "Todo en una llamada: diseno (Problemas), compilacion, ejecucion y revision de avisos. `verdict: ok` es lo que buscas; informa de los `findings`.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_execute",
        purpose: "Solo si `verify` no capturo la salida: obtener `exitCode`, `stdout` y `findings`.",
        input: { name: "MI_JOB" },
        optional: true,
      },
    ],
    pitfalls: [
      "No escribas el .item a mano: crea y edita con las tools de Studio.",
      "Sin schema, la conexion no propaga columnas y el codigo generado no compila.",
      "En tMap, tAggregateRow, tNormalize y tJavaRow el schema y el modelo se aplican al final, despues de conectar.",
      "No lances un job mientras Studio lo esta compilando: deja el classpath bloqueado.",
    ],
    doneWhen: "`talend_job_verify` devuelve `verdict` `ok` (o `ok_con_avisos` con los avisos informados) y las `lines` coinciden con lo esperado.",
  },
  {
    id: "editar-job",
    title: "Modificar un job existente",
    goal: "Cambiar parametros, schema, etiquetas o conexiones de un job sin recrearlo.",
    whenToUse: "Cuando el job ya existe y hay que retocarlo. Para uno nuevo, usa `crear-job`.",
    requires: ["studio", "bridge"],
    aliases: ["cambiar job", "retocar", "parametro", "conexion", "schema", "modificar"],
    steps: [
      {
        tool: "talend_jobs_read",
        purpose: "Ver el job en disco antes de tocarlo (componentes, conexiones y XML).",
        input: { jobName: "MI_JOB" },
      },
      {
        tool: "talend_job_open_in_studio",
        purpose: "Abrir el job en el editor. Sin esto no se pueden operar sus nodos.",
        input: { name: "MI_JOB" },
      },
      {
        tool: "talend_job_list_nodes",
        purpose: "Obtener los `uniqueName` y el tipo de cada nodo.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_configure_node",
        purpose: "Cambiar parametros, tablas, schema o el modelo del tMap de un nodo.",
        input: {
          uniqueName: "tFileInputDelimited_1",
          parameters: { FILENAME: { value: "\"C:/datos/entrada.csv\"" } },
        },
      },
      {
        tool: "talend_job_update_node",
        purpose: "Cambiar solo la etiqueta o un conjunto pequeno de parametros; guarda el job.",
        optional: true,
      },
      {
        tool: "talend_job_verify",
        purpose: "Confirmar que el cambio no deja avisos de diseno y genera codigo valido. Con `run: false` no ejecuta el job.",
        input: { job: "MI_JOB", run: false },
      },
    ],
    pitfalls: [
      "Los valores de texto son literales Java: una ruta va entre comillas (`\"C:/datos/a.csv\"`) o usa `literal: true`.",
      "Al conectar, Studio propaga el schema del destino hacia atras; revisa el schema del origen despues de conectar.",
      "El nombre de la conexion lo pone el bridge (`row1`, `row2`...) y es el que usan las tablas del tMap.",
    ],
    doneWhen: "`talend_job_verify` con `verdict` `ok` (o `ok_con_avisos` con los avisos informados).",
  },
];
