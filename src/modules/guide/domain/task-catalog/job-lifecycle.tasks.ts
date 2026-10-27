import type { GuideTask } from "../guide.types";

/** Tareas para crear y modificar jobs. */
export const JOB_LIFECYCLE_TASKS: GuideTask[] = [
  {
    id: "crear-job",
    title: "Crear un job y dejarlo ejecutando",
    goal: "Un job nuevo en el proyecto, con componentes, schema, conexiones y una ejecucion verificada.",
    whenToUse: "Cuando el job no existe y quieres montarlo en el lienzo de Studio. Para crear muchos jobs, o uno sin abrir Studio, usa `migracion-masiva` (offline). Si ya existe, usa `editar-job`.",
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
      "Para muchos jobs o jobs cerrados usa la tarea `migracion-masiva` (offline): es mucho mas rapida que montar nodo a nodo en Studio.",
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
  {
    id: "migracion-masiva",
    title: "Crear o modificar muchos jobs sin Studio (offline)",
    goal: "Decenas o miles de jobs creados o cambiados en disco y comprobados que compilan, sin abrir su editor.",
    whenToUse:
      "Migraciones, familias de jobs iguales con distinto origen o destino, y cambios repetidos en muchos jobs cerrados. Para montar un job a mano en el lienzo o editar uno abierto en un editor, usa `crear-job` o `editar-job`.",
    requires: ["project"],
    aliases: ["migracion", "migrar", "masivo", "lote", "plantilla", "muchos jobs", "offline", "sin studio"],
    steps: [
      {
        tool: "talend_jobs_create_batch",
        purpose:
          "Crear un job por fila a partir de una plantilla con {{variables}} (hasta 20000). Con dryRun valida sin escribir; con verify:true refresca Studio y compila cada job.",
        input: {
          template: {
            jobName: "MIG_{{tabla}}",
            folderPath: "migracion",
            components: [
              { uniqueName: "tFixedFlowInput_1", componentName: "tFixedFlowInput" },
              { uniqueName: "tLogRow_1", componentName: "tLogRow" },
            ],
            connections: [{ source: "tFixedFlowInput_1", target: "tLogRow_1", label: "row1" }],
          },
          rows: [{ tabla: "CLIENTES" }, { tabla: "CUENTAS" }],
          dryRun: true,
        },
      },
      {
        tool: "talend_jobs_edit_batch",
        purpose:
          "Aplicar el mismo lote de operaciones (add_node, set_params, set_schema, connect...) a muchos jobs por nombre o por regex. Cada job es atomico por separado; los abiertos en un editor se saltan.",
        input: {
          namePattern: "^MIG_",
          operations: [{ op: "set_params", uniqueName: "tLogRow_1", parameters: { TABLE_PRINT: "true" } }],
          dryRun: true,
        },
        optional: true,
      },
      {
        tool: "talend_job_edit_offline",
        purpose: "Retocar un solo job en disco con el mismo motor, con diff previo (dryRun).",
        input: { job: "MIG_CLIENTES", operations: [{ op: "move", uniqueName: "tLogRow_1", posX: 400, posY: 96 }] },
        optional: true,
      },
      {
        tool: "talend_job_build_batch",
        purpose: "Generar y compilar los jobs sin abrir su editor (~0,2 s por job, en paralelo). Devuelve cuales no compilan.",
        input: { jobs: ["MIG_CLIENTES", "MIG_CUENTAS"], parallelism: 4 },
      },
      {
        tool: "talend_job_verify",
        purpose: "Ejecutar de verdad uno o unos pocos jobs representativos y revisar sus avisos. La compilacion masiva no ejecuta.",
        input: { job: "MIG_CLIENTES" },
      },
    ],
    pitfalls: [
      "Un lote que falla la integridad no escribe ese job: lee `fallos` en la respuesta.",
      "Las tools offline se niegan a tocar un job abierto en un editor de Studio (usa force solo si sabes que no hay cambios sin guardar).",
      "Compilar no es ejecutar: verifica con `talend_job_verify` una muestra, no solo con `talend_job_build_batch`.",
      "Los componentes complejos (tMap, esquemas dinamicos) se configuran mejor con la API de Studio; combina ambos caminos.",
    ],
    doneWhen:
      "`talend_job_build_batch` (o `verify:true`) devuelve `noCompilan` vacio y una muestra pasa `talend_job_verify` con `verdict` `ok`.",
  },
];
