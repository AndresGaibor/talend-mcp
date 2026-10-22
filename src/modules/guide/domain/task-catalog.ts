import type { GuideRule, GuideTask } from "./guide.types";

/**
 * Catalogo de tareas: la respuesta a "quiero hacer X, que tools uso y en que
 * orden". Es la fuente unica de verdad: la tool `talend_guide`, las
 * instrucciones del servidor y `docs/CATALOGO-DE-TOOLS.md` salen de aqui.
 *
 * Al cambiar una tool, actualiza su paso. El test
 * `tests/tools/agent-guide.test.ts` falla si un paso apunta a una tool que no
 * existe.
 */
export const GUIDE_TASKS: GuideTask[] = [
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
        tool: "talend_job_problems",
        purpose: "Comprobar la vista Problemas antes de compilar. `clean: true` es lo que buscas.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_compile",
        purpose: "Generar el codigo y verificar que compila, sin ejecutar.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_run_by_name",
        purpose: "Compilar y lanzar el job en Studio.",
        input: { jobName: "MI_JOB", waitForTermination: true },
      },
      {
        tool: "talend_job_execute",
        purpose: "Relanzar y obtener `exitCode`, `stdout` y las `lines` para comparar con lo esperado.",
        input: { name: "MI_JOB" },
      },
    ],
    pitfalls: [
      "No escribas el .item a mano: crea y edita con las tools de Studio.",
      "Sin schema, la conexion no propaga columnas y el codigo generado no compila.",
      "En tMap, tAggregateRow, tNormalize y tJavaRow el schema y el modelo se aplican al final, despues de conectar.",
      "No lances un job mientras Studio lo esta compilando: deja el classpath bloqueado.",
    ],
    doneWhen: "`talend_job_problems` devuelve `clean: true`, `talend_job_compile` devuelve `compiles: true` y `talend_job_execute` trae la salida esperada.",
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
        tool: "talend_job_problems",
        purpose: "Verificar que el job sigue sin errores de diseno.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_compile",
        purpose: "Confirmar que el cambio genera codigo valido.",
        input: { job: "MI_JOB" },
      },
    ],
    pitfalls: [
      "Los valores de texto son literales Java: una ruta va entre comillas (`\"C:/datos/a.csv\"`) o usa `literal: true`.",
      "Al conectar, Studio propaga el schema del destino hacia atras; revisa el schema del origen despues de conectar.",
      "El nombre de la conexion lo pone el bridge (`row1`, `row2`...) y es el que usan las tablas del tMap.",
    ],
    doneWhen: "`talend_job_problems` sin errores y `talend_job_compile` con `compiles: true`.",
  },
  {
    id: "ejecutar-y-verificar",
    title: "Ejecutar un job y verificar la salida",
    goal: "Saber si el job corre, con que codigo termina y que datos produjo.",
    whenToUse: "Despues de crear o cambiar un job, o para reproducir un fallo reportado.",
    requires: ["studio", "bridge"],
    aliases: ["run", "correr", "lanzar", "probar", "salida", "resultado", "exit code"],
    steps: [
      {
        tool: "talend_job_compile",
        purpose: "Verificar que compila antes de gastar una ejecucion.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_run_by_name",
        purpose: "Lanzar el job por su launch config; con `waitForTermination` espera el final.",
        input: { jobName: "MI_JOB", waitForTermination: true, timeoutMs: 120000 },
      },
      {
        tool: "talend_job_execute",
        purpose: "Relanzar y traer `exitCode` y `stdout`. Es la unica forma de leer la salida desde el MCP.",
        input: { name: "MI_JOB" },
      },
      {
        tool: "talend_job_wait_run",
        purpose: "Esperar un launch ya iniciado cuando no se espero en el paso anterior.",
        optional: true,
      },
      {
        tool: "talend_runs_list",
        purpose: "Ver el historial de ejecuciones guardadas y sus identificadores.",
        optional: true,
      },
      {
        tool: "talend_runs_read",
        purpose: "Leer el detalle de una ejecucion por `runId`.",
        optional: true,
      },
    ],
    pitfalls: [
      "`talend_job_run_by_name` no devuelve la salida: usa `talend_job_execute` para leerla.",
      "Si el job escribe un fichero, borra la salida anterior o usa `FILE_EXIST_EXCEPTION=false`.",
    ],
    doneWhen: "`exitCode` es 0 y las `lines` de `talend_job_execute` coinciden con lo esperado.",
  },
  {
    id: "diagnosticar-error",
    title: "Diagnosticar un job que falla",
    goal: "Pasar de un sintoma (job que no corre, error de compilacion, filas vacias) a una causa concreta.",
    whenToUse: "Cuando el job compila pero falla, o cuando el resultado no es el esperado.",
    requires: ["studio", "bridge"],
    aliases: ["error", "falla", "no compila", "excepcion", "depurar", "debug", "no salen filas"],
    steps: [
      {
        tool: "talend_job_problems",
        purpose: "Primero los errores de diseno de la vista Problemas, sin ejecutar nada.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_compile",
        purpose: "Si compila, el problema es de datos o de configuracion en tiempo de ejecucion.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_errors_explain",
        purpose: "Explicar el mensaje de error (o el `runId`) y mapearlo a un componente.",
        input: { errorMessage: "column \"null\" does not exist" },
      },
      {
        tool: "talend_errors_suggest_fix",
        purpose: "Obtener el fix sugerido con el nivel de confianza.",
      },
      {
        tool: "talend_job_quality_report",
        purpose: "Revisar antipatrones y hallazgos de calidad del job.",
        input: { jobId: "MI_JOB" },
        optional: true,
      },
      {
        tool: "talend_bridge_problems_markers",
        purpose: "Leer los markers de Eclipse cuando el fallo es del IDE y no del job.",
        optional: true,
      },
    ],
    pitfalls: [
      "Si el job termina con codigo 0 pero no hay filas, sospecha del conector: `tUniqRow` sale por `UNIQUE`, no por `FLOW`.",
      "Errores `cannot be resolved to a variable` casi siempre significan schema sin definir o columna mal escrita.",
      "Un trigger dibujado desde el medio del subjob no se ejecuta nunca, aunque el job compile.",
    ],
    doneWhen: "Hay una causa identificada, el fix aplicado y una nueva ejecucion con la salida esperada.",
  },
  {
    id: "contextos",
    title: "Gestionar contextos, entornos y variables",
    goal: "Que el job lea rutas, credenciales y parametros de contexto y no de valores fijos.",
    whenToUse: "Al parametrizar un job, antes de un entregable, o para mover un job entre entornos.",
    requires: ["studio", "bridge"],
    aliases: ["contexto", "entorno", "variable", "parametro", "produccion", "dev"],
    steps: [
      {
        tool: "talend_job_contexts_list",
        purpose: "Ver los entornos del job y el valor de cada variable en cada uno.",
        input: { job: "MI_JOB" },
      },
      {
        tool: "talend_job_context_create",
        purpose: "Crear un entorno copiando las variables del entorno por defecto.",
        input: { name: "produccion", job: "MI_JOB" },
      },
      {
        tool: "talend_job_context_set",
        purpose: "Crear o cambiar una variable con su valor en ese entorno.",
        input: { context: "produccion", name: "ruta_entrada", value: "/datos/entrada.csv", job: "MI_JOB" },
      },
      {
        tool: "talend_list_repository_contexts",
        purpose: "Ver los contextos del proyecto (items de tipo Contexts) y sus entornos.",
        optional: true,
      },
      {
        tool: "talend_read_repository_context",
        purpose: "Leer un contexto del proyecto completo antes de reutilizarlo.",
        input: { contextName: "MI_CONTEXTO" },
        optional: true,
      },
      {
        tool: "talend_secrets_scan_job",
        purpose: "Comprobar que no quedan credenciales en claro en el job.",
        input: { projectPath: "<proyecto Talend>", jobName: "MI_JOB" },
        optional: true,
      },
    ],
    pitfalls: [
      "Cada entorno tiene su propio valor de la misma variable: no dupliques variables con nombres distintos por entorno.",
      "El entorno por defecto no se puede borrar.",
      "Un contexto de proyecto recien creado no se puede enganchar a un job desde el MCP; enganchalo en Studio.",
    ],
    doneWhen: "`talend_job_contexts_list` muestra las variables y sus valores en todos los entornos necesarios.",
  },
  {
    id: "descubrir-componentes",
    title: "Descubrir como se configura un componente",
    goal: "Saber que parametros, tablas, conectores y schema tiene un componente antes de usarlo.",
    whenToUse: "Antes de anadir o configurar un nodo, sobre todo si el componente no lo conoces.",
    requires: [],
    aliases: ["componente", "parametros", "conector", "paleta", "que componentes hay", "tmap"],
    steps: [
      {
        tool: "talend_components_search",
        purpose: "Buscar componentes por nombre o familia en el catalogo local.",
        input: { query: "aggregate" },
      },
      {
        tool: "talend_components_definition",
        purpose: "Leer del XML de la instalacion los parametros obligatorios y las conexiones. Sin abrir Studio.",
        input: { name: "tAggregateRow" },
      },
      {
        tool: "talend_components_parameters",
        purpose: "Ver los parametros con tipo y valor por defecto.",
        input: { componentName: "tAggregateRow" },
      },
      {
        tool: "talend_components_connectors",
        purpose: "Listar los conectores de salida reales del componente.",
        input: { componentName: "tUniqRow" },
      },
      {
        tool: "talend_studio_component_parameters",
        purpose: "Cuando el componente no tiene XML (AWS, JDBC, Snowflake), preguntale al catalogo de Studio.",
        input: { name: "tDBOutput" },
        optional: true,
      },
      {
        tool: "talend_recipe_generate",
        purpose: "Pedir una receta de componentes y conexiones a partir de un objetivo en lenguaje natural.",
        input: { objective: "leer un CSV y cargarlo en una tabla" },
        optional: true,
      },
    ],
    pitfalls: [
      "El catalogo distingue variantes DI, Spark y Streaming: una variante Spark no vale en un job Standard.",
      "No inventes nombres de parametro: si el catalogo no lo declara, el bridge lo crea con el tipo que deduzca y puede quedar mal.",
    ],
    doneWhen: "Tienes la lista de parametros obligatorios y los conectores del componente.",
  },
  {
    id: "inspeccionar",
    title: "Inspeccionar jobs en disco (sin Studio)",
    goal: "Leer el proyecto sin depender del IDE: jobs, flujos, contextos, DQ y logs.",
    whenToUse: "Para explorar, auditar o responder preguntas cuando Studio no esta abierto.",
    requires: ["project"],
    aliases: ["leer", "explorar", "listar", "sin studio", "auditar", "revisar proyecto"],
    steps: [
      {
        tool: "talend_jobs_list",
        purpose: "Listar jobs con version, carpeta, fecha y numero de componentes.",
        input: { limit: 50 },
      },
      {
        tool: "talend_jobs_read",
        purpose: "Leer un job: componentes, conexiones y XML del .item.",
        input: { jobName: "MI_JOB" },
      },
      {
        tool: "talend_show_flow",
        purpose: "Ver solo el flujo de datos entre componentes.",
        input: { jobName: "MI_JOB" },
      },
      {
        tool: "talend_read_contexts",
        purpose: "Leer los contextos declarados en el job.",
        input: { jobName: "MI_JOB" },
        optional: true,
      },
      {
        tool: "talend_inspect_job",
        purpose: "Inspeccion completa: parametros, schemas y problemas de schema. Pide la ruta del .item.",
        input: { jobPath: "process/MI_JOB_0.1.item" },
        optional: true,
      },
      {
        tool: "talend_jobs_detect_antipatterns",
        purpose: "Detectar antipatrones de diseno sin abrir Studio.",
        input: { jobName: "MI_JOB" },
        optional: true,
      },
    ],
    pitfalls: [
      "`talend_jobs_read` lee el archivo: si Studio tiene cambios sin guardar, el disco puede estar desactualizado.",
      "Para editar no uses estas tools: el cambio se pierde o deja el modelo de Studio obsoleto.",
    ],
    doneWhen: "Tienes la lista de jobs o el detalle del job pedido.",
  },
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
  {
    id: "calidad-y-entregables",
    title: "Validar calidad y preparar entregables",
    goal: "Dejar el job listo para entrega: sin secretos, sin antipatrones y con evidencia.",
    whenToUse: "Antes de entregar, despues de un cambio grande o para una auditoria.",
    requires: ["project"],
    aliases: ["entrega", "auditoria", "calidad", "validar", "evidencia", "paquete", "zip"],
    steps: [
      {
        tool: "talend_validation_validate_design",
        purpose: "Validar el diseno contra las reglas configuradas. Recibe el spec del job, no el nombre.",
      },
      {
        tool: "talend_validation_validate_context_usage",
        purpose: "Comprobar que el job usa los contextos requeridos. Tambien recibe el spec.",
      },
      {
        tool: "talend_secrets_scan_project",
        purpose: "Buscar credenciales en claro en .item y .properties.",
      },
      {
        tool: "talend_job_quality_report",
        purpose: "Puntaje de calidad con hallazgos y soluciones.",
        input: { jobId: "MI_JOB" },
      },
      {
        tool: "talend_deliverables_export_job",
        purpose: "Preparar el paquete de entregable del job.",
        input: { jobName: "MI_JOB" },
      },
      {
        tool: "talend_deliverables_validate",
        purpose: "Validar que el job cumple los requisitos de entregable.",
        optional: true,
      },
      {
        tool: "talend_deliverables_create_package",
        purpose: "Crear el ZIP final del entregable.",
        optional: true,
      },
      {
        tool: "talend_evidence_pack_build",
        purpose: "Armar el paquete de evidencia de una ejecucion o auditoria.",
        optional: true,
      },
    ],
    pitfalls: [
      "Un entregable sin evidencia de ejecucion no demuestra que el job corre: guarda la salida de `talend_job_execute`.",
    ],
    doneWhen: "Validaciones en verde, sin secretos detectados y el paquete generado.",
  },
  {
    id: "data-quality",
    title: "Revisar análisis de Data Quality",
    goal: "Encontrar, leer y mantener los análisis de perfilado de datos del proyecto Talend.",
    whenToUse: "Cuando se necesita consultar o actualizar un análisis DQ (.ana) sin abrir Studio.",
    requires: ["project"],
    aliases: ["dq", "data quality", "perfilado", "analisis de datos", "indicadores"],
    steps: [
      {
        tool: "talend_list_analyses",
        purpose: "Listar los análisis DQ del proyecto.",
        input: { projectPath: "<ruta del proyecto Talend>" },
      },
      {
        tool: "talend_read_analysis",
        purpose: "Leer un análisis concreto por la ruta .ana devuelta por el listado.",
        input: { analysisPath: "<ruta del archivo .ana>" },
      },
      {
        tool: "talend_update_analysis",
        purpose: "Actualizar metadatos del análisis cuando sea necesario.",
        input: { analysisPath: "<ruta del archivo .ana>", description: "<descripción>" },
        optional: true,
      },
      {
        tool: "talend_duplicate_analysis",
        purpose: "Crear una copia del análisis con otro nombre, preservando el original.",
        input: { analysisPath: "<ruta del archivo .ana>", newName: "<nuevo nombre>" },
        optional: true,
      },
    ],
    pitfalls: [
      "`talend_update_analysis` modifica el archivo .ana; confirma el proyecto y la ruta antes de usarlo.",
      "El listado requiere `projectPath`, pero las tools de lectura y edición reciben la ruta del análisis.",
    ],
    doneWhen: "El análisis solicitado quedó identificado y sus metadatos o contenido fueron verificados.",
  },
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
  {
    id: "pipeline-spec",
    title: "Validar y previsualizar una especificación de pipeline",
    goal: "Comprobar la estructura de un pipeline declarativo y revisar sus componentes y conexiones transformados.",
    whenToUse: "Cuando otro sistema o agente entrega un pipeline spec antes de aplicar cambios a un job.",
    requires: [],
    aliases: ["pipeline spec", "especificacion", "pipeline declarativo", "validar json"],
    steps: [
      {
        tool: "talend_jobs_validate_pipeline_spec",
        purpose: "Validar la estructura de la especificación y corregir errores antes de continuar.",
        input: {
          spec: {
            name: "<nombre>",
            version: "0.1",
            stages: [{ id: "stage-1", name: "<etapa>", components: [], connections: [] }],
          },
        },
      },
      {
        tool: "talend_jobs_preview_pipeline_spec",
        purpose: "Previsualizar componentes y conexiones transformados; esta operación es de solo lectura.",
        input: {
          spec: {
            name: "<nombre>",
            version: "0.1",
            stages: [{ id: "stage-1", name: "<etapa>", components: [], connections: [] }],
          },
        },
      },
    ],
    pitfalls: [
      "Cada componente requiere `id`, `name`, `type` y `configuration`; cada conexión requiere identificadores de origen y destino.",
      "Validar o previsualizar no aplica el spec ni garantiza que los componentes existan en la instalación local de Studio.",
      "No hay una tool activa que aplique directamente este pipeline spec; para materializarlo, usa el flujo `crear-job` con las tools de Studio.",
    ],
    doneWhen: "La especificación no tiene errores y su preview se revisó antes de cualquier operación de escritura.",
  },
  {
    id: "dominio-componentes",
    title: "Consultar el nivel de validación de componentes",
    goal: "Entender qué capacidades de un componente se han comprobado y qué evidencias o validaciones faltan.",
    whenToUse: "Cuando se evalúa si un componente está descubierto, se puede configurar o fue probado en Studio.",
    requires: [],
    aliases: ["mastery", "madurez", "cobertura de componentes", "componente validado"],
    steps: [
      {
        tool: "talend_mastery_component",
        purpose: "Consultar el nivel y las capacidades conocidas de un componente específico.",
        input: { componentName: "tFileInputDelimited" },
      },
      {
        tool: "talend_mastery_report",
        purpose: "Consultar el informe agregado de mastery ya registrado.",
      },
      {
        tool: "talend_mastery_all_components",
        purpose: "Ejecutar el análisis de todos los componentes y regenerar el informe agregado.",
        optional: true,
      },
    ],
    pitfalls: [
      "El informe agregado puede estar vacío hasta que se hayan aprendido o validado componentes.",
      "La operación sobre todos los componentes puede tardar; usa primero la consulta de un componente concreto.",
    ],
    doneWhen: "Se conoce el nivel del componente y las capacidades o evidencias pendientes.",
  },
];

/**
 * Reglas que evitan fallos silenciosos. Salen de las trampas documentadas en
 * `docs/GUIA-AGENTE.md` y `docs/TALEND-STUDIO-INTERNALS.md`.
 */
export const GUIDE_RULES: GuideRule[] = [
  {
    id: "no-escribir-xml",
    rule: "Crea y edita jobs con la API de Studio, nunca escribiendo el .item.",
    detail:
      "Escribir el XML por fuera deja el modelo en memoria de Studio obsoleto: aparecen tipos inexistentes (id_Decimal), valores corruptos y jobs vacios.",
  },
  {
    id: "valores-literales-java",
    rule: "Los valores de texto son literales Java y las rutas van entre comillas.",
    detail:
      "`\"C:/datos/a.csv\"` es valido; `C:/datos/a.csv` sin comillas no compila. El bridge entrecomilla lo que no es numero, booleano o ya viene entre comillas; `literal: true` fuerza el texto en crudo.",
  },
  {
    id: "header-numerico",
    rule: "`HEADER` de tFileInputDelimited es un numero de lineas, no un booleano.",
    detail: "Con cabecera se escribe `\"1\"`; sin cabecera, `\"0\"`.",
  },
  {
    id: "tipos-de-columna",
    rule: "`id_Decimal` no existe: usa `id_BigDecimal`.",
    detail:
      "Tipos validos: id_String, id_Integer, id_Long, id_Double, id_BigDecimal, id_Boolean, id_Date.",
  },
  {
    id: "schema-obligatorio",
    rule: "Sin schema no hay columnas y el codigo generado no compila.",
    detail:
      "Define el schema del origen antes de conectar. En tMap, tAggregateRow, tNormalize y tJavaRow el schema y el modelo se aplican al final, porque al conectar Studio propaga el schema del destino hacia atras.",
  },
  {
    id: "conector-real",
    rule: "Conecta con el conector real del componente, no siempre con FLOW.",
    detail:
      "`tUniqRow` saca las filas por `UNIQUE`; `tDBOutput` puede sacar rechazos por `REJECT`; un `ITERATE` no transporta filas. Conectar por `FLOW` donde no toca compila pero no pasa nada, sin error visible.",
  },
  {
    id: "triggers-desde-arranque",
    rule: "Dibuja los triggers desde el primer componente del subjob.",
    detail:
      "Studio solo genera la llamada al destino si la conexion sale del arranque del subjob. Si sale de un componente de en medio, el job compila y el destino no se ejecuta nunca.",
  },
  {
    id: "triggers-destino",
    rule: "El destino de un trigger tiene que poder arrancar un subjob.",
    detail:
      "Un trigger no puede apuntar a tDBOutput, tFileOutputDelimited ni tLogRow: necesitan entrada y Studio rechaza la conexion.",
  },
  {
    id: "listas-sin-comillas",
    rule: "Los parametros de tipo lista van sin comillas.",
    detail:
      "Si el tipo acaba en `_LIST` (TABLE_ACTION de tDBOutput, columna de tNormalize...), escribe `TRUNCATE`, no `\"TRUNCATE\"`: con comillas la accion no se ejecuta y no hay error.",
  },
  {
    id: "columnas-de-tabla",
    rule: "En las tablas de metadata, los nombres de columna van sin comillas y los literales con comillas.",
    detail:
      "Sin comillas: SCHEMA_COLUMN, COLNAME, INPUT_COLUMN, OUTPUT_COLUMN, FUNCTION, OPERATOR, SORT, ORDER, KEY_ATTRIBUTE, CASE_SENSITIVE, PARAMETER_NAME, TARGET_COLUMN. El resto, como literal Java.",
  },
  {
    id: "db-autocommit",
    rule: "Al escribir en base de datos, la conexion va con AUTO_COMMIT=true y no se encola un commit.",
    detail:
      "El tDBOutput escribe el lote al final; sin commit, al cerrar la conexion se pierde todo. Un commit encolado se ejecuta dentro del bucle de filas y rompe el lote.",
  },
  {
    id: "db-nombre-columna",
    rule: "Revisa el nombre original de la columna en el mapeo del tDBOutput.",
    detail:
      "Si el INSERT sale con columnas `null`, el mapeo no lleva el nombre de la columna en la base de datos.",
  },
  {
    id: "tlogrow-hereda",
    rule: "`tLogRow` hereda el schema: no se lo pongas a mano.",
    detail: "Su schema lo propaga el componente que le manda el flujo.",
  },
  {
    id: "tfilelist-globalmap",
    rule: "`tFileList` no emite filas; deja valores en el globalMap.",
    detail:
      "Se declara suelto y sus valores se leen con un tJavaRow desde `<uniqueName>_CURRENT_FILE`. Su `LIST_MODE` es el tipo de listado (FILES, DIRECTORIES, BOTH), no el orden.",
  },
  {
    id: "no-ejecutar-compilando",
    rule: "No ejecutes un job mientras Studio lo esta compilando.",
    detail:
      "Studio carga el job en su JVM y bloquea el classpath.jar; el build siguiente falla al borrarlo y la carpeta se queda sin codigo.",
  },
  {
    id: "contextos-por-entorno",
    rule: "Cada entorno tiene su propio valor de la misma variable de contexto.",
    detail: "No dupliques variables con nombres distintos por entorno; usa el mismo nombre y cambia el valor.",
  },
];

/** Identificadores de las tareas, en el orden del catalogo. */
export const GUIDE_TASK_IDS = GUIDE_TASKS.map((task) => task.id);
