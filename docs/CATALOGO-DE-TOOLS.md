# Catalogo de tools MCP para Talend

> Generado con `bun run docs:tools`. Fuente de verdad: registro de tools y `talend_guide`.
> En tiempo de ejecucion, llama `talend_guide` para conocer el preset y las capacidades realmente expuestas.

Tools registradas en el preset actual: **233**.

## Empezar

- `talend_guide { mode: "overview" }`: mapa de tareas, familias y estado basico.
- `talend_guide { mode: "task", task: "crear-job" }`: secuencia de tools, argumentos de ejemplo y reglas.
- `talend_guide { mode: "search", query: "contextos" }`: buscar por lenguaje natural.
- `talend_guide { mode: "tool", tool: "talend_jobs_list" }`: schema y condiciones de una tool.
- `talend_guide { mode: "rules" }`: reglas de Talend que evitan fallos silenciosos.

## Flujos habituales

### Orientarse y comprobar el entorno (`orientarse`)

Saber con que proyecto se trabaja, si Studio y el bridge estan vivos y que se puede hacer.

**Cuando:** Primera llamada de cualquier sesion, o cuando una tool falla por no encontrar el proyecto o el IDE.

1. `talend_guide`: Ver el mapa de tareas y que tools estan expuestas.
   - Ejemplo: `{"mode":"overview"}`
2. `talend_diagnose_environment`: Plataforma, workspace, proyecto, metadata, proceso de Studio y estado del bridge.
3. `talend_bridge_ping`: Confirmar que el plugin responde y mirar `version` y `unsafeActions`.
4. `talend_jobs_list` (opcional): Confirmar que el proyecto se lee y ver los jobs disponibles.
   - Ejemplo: `{"limit":20}`

Evita:
- Sin proyecto configurado, define TALEND_PROJECT (la carpeta que contiene talend.project) en el entorno del servidor.
- Si el bridge no responde, abre Talend Studio con el proyecto cargado y reinstala el plugin con `bun run scripts/start.ts --install-bridge`.

**Completado cuando:** `talend_diagnose_environment` devuelve el proyecto y `talend_bridge_ping` responde ok.

### Crear un job y dejarlo ejecutando (`crear-job`)

Un job nuevo en el proyecto, con componentes, schema, conexiones y una ejecucion verificada.

**Cuando:** Cuando el job no existe. Si ya existe, usa la tarea `editar-job`.

1. `talend_studio_list_components`: Saber que componentes hay en la paleta (filtra por nombre para no traer 897).
   - Ejemplo: `{"filter":"Delimited"}`
2. `talend_components_definition`: Leer del disco que parametros exige el componente y que conexiones admite. No adivines.
   - Ejemplo: `{"name":"tFileInputDelimited"}`
3. `talend_studio_component_parameters` (opcional): Ver los parametros reales del catalogo de Studio, con tipo y valor por defecto.
   - Ejemplo: `{"name":"tFileInputDelimited"}`
4. `talend_job_create_in_studio`: Crear el job vacio con la API del IDE y abrirlo en el editor.
   - Ejemplo: `{"name":"MI_JOB","folder":"","replace":false}`
5. `talend_job_add_node`: Anadir cada componente. Devuelve su `uniqueName`, que es la clave de los pasos siguientes.
   - Ejemplo: `{"type":"tFixedFlowInput"}`
6. `talend_job_set_schema`: Definir las columnas del origen (y `values` si el componente genera filas).
   - Ejemplo: `{"uniqueName":"tFixedFlowInput_1","columns":[{"name":"id","type":"id_Integer"},{"name":"ciudad","type":"id_String"}],"values":[["1","Bogota"]]}`
7. `talend_job_connect_nodes`: Conectar por `uniqueName` con el conector real del componente (FLOW, UNIQUE, REJECT...).
   - Ejemplo: `{"source":"tFixedFlowInput_1","target":"tLogRow_1","type":"FLOW"}`
8. `talend_job_problems`: Comprobar la vista Problemas antes de compilar. `clean: true` es lo que buscas.
   - Ejemplo: `{"job":"MI_JOB"}`
9. `talend_job_compile`: Generar el codigo y verificar que compila, sin ejecutar.
   - Ejemplo: `{"job":"MI_JOB"}`
10. `talend_job_run_by_name`: Compilar y lanzar el job en Studio.
   - Ejemplo: `{"jobName":"MI_JOB","waitForTermination":true}`
11. `talend_job_execute`: Relanzar y obtener `exitCode`, `stdout` y las `lines` para comparar con lo esperado.
   - Ejemplo: `{"name":"MI_JOB"}`

Evita:
- No escribas el .item a mano: crea y edita con las tools de Studio.
- Sin schema, la conexion no propaga columnas y el codigo generado no compila.
- En tMap, tAggregateRow, tNormalize y tJavaRow el schema y el modelo se aplican al final, despues de conectar.
- No lances un job mientras Studio lo esta compilando: deja el classpath bloqueado.

**Completado cuando:** `talend_job_problems` devuelve `clean: true`, `talend_job_compile` devuelve `compiles: true` y `talend_job_execute` trae la salida esperada.

### Modificar un job existente (`editar-job`)

Cambiar parametros, schema, etiquetas o conexiones de un job sin recrearlo.

**Cuando:** Cuando el job ya existe y hay que retocarlo. Para uno nuevo, usa `crear-job`.

1. `talend_jobs_read`: Ver el job en disco antes de tocarlo (componentes, conexiones y XML).
   - Ejemplo: `{"jobName":"MI_JOB"}`
2. `talend_job_open_in_studio`: Abrir el job en el editor. Sin esto no se pueden operar sus nodos.
   - Ejemplo: `{"name":"MI_JOB"}`
3. `talend_job_list_nodes`: Obtener los `uniqueName` y el tipo de cada nodo.
   - Ejemplo: `{"job":"MI_JOB"}`
4. `talend_job_configure_node`: Cambiar parametros, tablas, schema o el modelo del tMap de un nodo.
   - Ejemplo: `{"uniqueName":"tFileInputDelimited_1","parameters":{"FILENAME":{"value":"\"C:/datos/entrada.csv\""}}}`
5. `talend_job_update_node` (opcional): Cambiar solo la etiqueta o un conjunto pequeno de parametros; guarda el job.
6. `talend_job_problems`: Verificar que el job sigue sin errores de diseno.
   - Ejemplo: `{"job":"MI_JOB"}`
7. `talend_job_compile`: Confirmar que el cambio genera codigo valido.
   - Ejemplo: `{"job":"MI_JOB"}`

Evita:
- Los valores de texto son literales Java: una ruta va entre comillas (`"C:/datos/a.csv"`) o usa `literal: true`.
- Al conectar, Studio propaga el schema del destino hacia atras; revisa el schema del origen despues de conectar.
- El nombre de la conexion lo pone el bridge (`row1`, `row2`...) y es el que usan las tablas del tMap.

**Completado cuando:** `talend_job_problems` sin errores y `talend_job_compile` con `compiles: true`.

### Ejecutar un job y verificar la salida (`ejecutar-y-verificar`)

Saber si el job corre, con que codigo termina y que datos produjo.

**Cuando:** Despues de crear o cambiar un job, o para reproducir un fallo reportado.

1. `talend_job_compile`: Verificar que compila antes de gastar una ejecucion.
   - Ejemplo: `{"job":"MI_JOB"}`
2. `talend_job_run_by_name`: Lanzar el job por su launch config; con `waitForTermination` espera el final.
   - Ejemplo: `{"jobName":"MI_JOB","waitForTermination":true,"timeoutMs":120000}`
3. `talend_job_execute`: Relanzar y traer `exitCode` y `stdout`. Es la unica forma de leer la salida desde el MCP.
   - Ejemplo: `{"name":"MI_JOB"}`
4. `talend_job_wait_run` (opcional): Esperar un launch ya iniciado cuando no se espero en el paso anterior.
5. `talend_runs_list` (opcional): Ver el historial de ejecuciones guardadas y sus identificadores.
6. `talend_runs_read` (opcional): Leer el detalle de una ejecucion por `runId`.

Evita:
- `talend_job_run_by_name` no devuelve la salida: usa `talend_job_execute` para leerla.
- Si el job escribe un fichero, borra la salida anterior o usa `FILE_EXIST_EXCEPTION=false`.

**Completado cuando:** `exitCode` es 0 y las `lines` de `talend_job_execute` coinciden con lo esperado.

### Diagnosticar un job que falla (`diagnosticar-error`)

Pasar de un sintoma (job que no corre, error de compilacion, filas vacias) a una causa concreta.

**Cuando:** Cuando el job compila pero falla, o cuando el resultado no es el esperado.

1. `talend_job_problems`: Primero los errores de diseno de la vista Problemas, sin ejecutar nada.
   - Ejemplo: `{"job":"MI_JOB"}`
2. `talend_job_compile`: Si compila, el problema es de datos o de configuracion en tiempo de ejecucion.
   - Ejemplo: `{"job":"MI_JOB"}`
3. `talend_errors_explain`: Explicar el mensaje de error (o el `runId`) y mapearlo a un componente.
   - Ejemplo: `{"errorMessage":"column \"null\" does not exist"}`
4. `talend_errors_suggest_fix`: Obtener el fix sugerido con el nivel de confianza.
5. `talend_job_quality_report` (opcional): Revisar antipatrones y hallazgos de calidad del job.
   - Ejemplo: `{"jobId":"MI_JOB"}`
6. `talend_bridge_problems_markers` (opcional): Leer los markers de Eclipse cuando el fallo es del IDE y no del job.

Evita:
- Si el job termina con codigo 0 pero no hay filas, sospecha del conector: `tUniqRow` sale por `UNIQUE`, no por `FLOW`.
- Errores `cannot be resolved to a variable` casi siempre significan schema sin definir o columna mal escrita.
- Un trigger dibujado desde el medio del subjob no se ejecuta nunca, aunque el job compile.

**Completado cuando:** Hay una causa identificada, el fix aplicado y una nueva ejecucion con la salida esperada.

### Gestionar contextos, entornos y variables (`contextos`)

Que el job lea rutas, credenciales y parametros de contexto y no de valores fijos.

**Cuando:** Al parametrizar un job, antes de un entregable, o para mover un job entre entornos.

1. `talend_job_contexts_list`: Ver los entornos del job y el valor de cada variable en cada uno.
   - Ejemplo: `{"job":"MI_JOB"}`
2. `talend_job_context_create`: Crear un entorno copiando las variables del entorno por defecto.
   - Ejemplo: `{"name":"produccion","job":"MI_JOB"}`
3. `talend_job_context_set`: Crear o cambiar una variable con su valor en ese entorno.
   - Ejemplo: `{"context":"produccion","name":"ruta_entrada","value":"/datos/entrada.csv","job":"MI_JOB"}`
4. `talend_list_repository_contexts` (opcional): Ver los contextos del proyecto (items de tipo Contexts) y sus entornos.
5. `talend_read_repository_context` (opcional): Leer un contexto del proyecto completo antes de reutilizarlo.
   - Ejemplo: `{"contextName":"MI_CONTEXTO"}`
6. `talend_secrets_scan_job` (opcional): Comprobar que no quedan credenciales en claro en el job.
   - Ejemplo: `{"projectPath":"<proyecto Talend>","jobName":"MI_JOB"}`

Evita:
- Cada entorno tiene su propio valor de la misma variable: no dupliques variables con nombres distintos por entorno.
- El entorno por defecto no se puede borrar.
- Un contexto de proyecto recien creado no se puede enganchar a un job desde el MCP; enganchalo en Studio.

**Completado cuando:** `talend_job_contexts_list` muestra las variables y sus valores en todos los entornos necesarios.

### Descubrir como se configura un componente (`descubrir-componentes`)

Saber que parametros, tablas, conectores y schema tiene un componente antes de usarlo.

**Cuando:** Antes de anadir o configurar un nodo, sobre todo si el componente no lo conoces.

1. `talend_components_search`: Buscar componentes por nombre o familia en el catalogo local.
   - Ejemplo: `{"query":"aggregate"}`
2. `talend_components_definition`: Leer del XML de la instalacion los parametros obligatorios y las conexiones. Sin abrir Studio.
   - Ejemplo: `{"name":"tAggregateRow"}`
3. `talend_components_parameters`: Ver los parametros con tipo y valor por defecto.
   - Ejemplo: `{"componentName":"tAggregateRow"}`
4. `talend_components_connectors`: Listar los conectores de salida reales del componente.
   - Ejemplo: `{"componentName":"tUniqRow"}`
5. `talend_studio_component_parameters` (opcional): Cuando el componente no tiene XML (AWS, JDBC, Snowflake), preguntale al catalogo de Studio.
   - Ejemplo: `{"name":"tDBOutput"}`
6. `talend_recipe_generate` (opcional): Pedir una receta de componentes y conexiones a partir de un objetivo en lenguaje natural.
   - Ejemplo: `{"objective":"leer un CSV y cargarlo en una tabla"}`

Evita:
- El catalogo distingue variantes DI, Spark y Streaming: una variante Spark no vale en un job Standard.
- No inventes nombres de parametro: si el catalogo no lo declara, el bridge lo crea con el tipo que deduzca y puede quedar mal.

**Completado cuando:** Tienes la lista de parametros obligatorios y los conectores del componente.

### Inspeccionar jobs en disco (sin Studio) (`inspeccionar`)

Leer el proyecto sin depender del IDE: jobs, flujos, contextos, DQ y logs.

**Cuando:** Para explorar, auditar o responder preguntas cuando Studio no esta abierto.

1. `talend_jobs_list`: Listar jobs con version, carpeta, fecha y numero de componentes.
   - Ejemplo: `{"limit":50}`
2. `talend_jobs_read`: Leer un job: componentes, conexiones y XML del .item.
   - Ejemplo: `{"jobName":"MI_JOB"}`
3. `talend_show_flow`: Ver solo el flujo de datos entre componentes.
   - Ejemplo: `{"jobName":"MI_JOB"}`
4. `talend_read_contexts` (opcional): Leer los contextos declarados en el job.
   - Ejemplo: `{"jobName":"MI_JOB"}`
5. `talend_inspect_job` (opcional): Inspeccion completa: parametros, schemas y problemas de schema. Pide la ruta del .item.
   - Ejemplo: `{"jobPath":"process/MI_JOB_0.1.item"}`
6. `talend_jobs_detect_antipatterns` (opcional): Detectar antipatrones de diseno sin abrir Studio.
   - Ejemplo: `{"jobName":"MI_JOB"}`

Evita:
- `talend_jobs_read` lee el archivo: si Studio tiene cambios sin guardar, el disco puede estar desactualizado.
- Para editar no uses estas tools: el cambio se pierde o deja el modelo de Studio obsoleto.

**Completado cuando:** Tienes la lista de jobs o el detalle del job pedido.

### Preparar una carga desde CSV (`datos-csv`)

Pasar de una carpeta de CSV a un schema de tabla raw y un job de carga.

**Cuando:** Cuando el origen son ficheros CSV y hay que disenar la tabla destino.

1. `talend_datasets_inspect_csv_folder`: Ver ficheros, columnas, tipos inferidos y estadisticas de la carpeta.
   - Ejemplo: `{"folderPath":"<ruta a la carpeta de CSV>"}`
2. `talend_datasets_infer_csv_schema`: Obtener el schema de base de datos propuesto a partir de la inspeccion.
3. `talend_datasets_generate_raw_mappings`: Generar el mapeo a tabla raw con las columnas tecnicas de carga.
4. `talend_components_get_mapping_suggestions` (opcional): Sugerir el mapeo columna a columna cuando los nombres no coinciden.

Evita:
- Revisa los tipos inferidos antes de crear la tabla: un CSV con ceros a la izquierda no es un entero.

**Completado cuando:** Tienes el schema destino y el mapeo CSV a tabla.

### Validar calidad y preparar entregables (`calidad-y-entregables`)

Dejar el job listo para entrega: sin secretos, sin antipatrones y con evidencia.

**Cuando:** Antes de entregar, despues de un cambio grande o para una auditoria.

1. `talend_validation_validate_design`: Validar el diseno contra las reglas configuradas. Recibe el spec del job, no el nombre.
2. `talend_validation_validate_context_usage`: Comprobar que el job usa los contextos requeridos. Tambien recibe el spec.
3. `talend_secrets_scan_project`: Buscar credenciales en claro en .item y .properties.
4. `talend_job_quality_report`: Puntaje de calidad con hallazgos y soluciones.
   - Ejemplo: `{"jobId":"MI_JOB"}`
5. `talend_deliverables_export_job`: Preparar el paquete de entregable del job.
   - Ejemplo: `{"jobName":"MI_JOB"}`
6. `talend_deliverables_validate` (opcional): Validar que el job cumple los requisitos de entregable.
7. `talend_deliverables_create_package` (opcional): Crear el ZIP final del entregable.
8. `talend_evidence_pack_build` (opcional): Armar el paquete de evidencia de una ejecucion o auditoria.

Evita:
- Un entregable sin evidencia de ejecucion no demuestra que el job corre: guarda la salida de `talend_job_execute`.

**Completado cuando:** Validaciones en verde, sin secretos detectados y el paquete generado.

### Revisar análisis de Data Quality (`data-quality`)

Encontrar, leer y mantener los análisis de perfilado de datos del proyecto Talend.

**Cuando:** Cuando se necesita consultar o actualizar un análisis DQ (.ana) sin abrir Studio.

1. `talend_list_analyses`: Listar los análisis DQ del proyecto.
   - Ejemplo: `{"projectPath":"<ruta del proyecto Talend>"}`
2. `talend_read_analysis`: Leer un análisis concreto por la ruta .ana devuelta por el listado.
   - Ejemplo: `{"analysisPath":"<ruta del archivo .ana>"}`
3. `talend_update_analysis` (opcional): Actualizar metadatos del análisis cuando sea necesario.
   - Ejemplo: `{"analysisPath":"<ruta del archivo .ana>","description":"<descripción>"}`
4. `talend_duplicate_analysis` (opcional): Crear una copia del análisis con otro nombre, preservando el original.
   - Ejemplo: `{"analysisPath":"<ruta del archivo .ana>","newName":"<nuevo nombre>"}`

Evita:
- `talend_update_analysis` modifica el archivo .ana; confirma el proyecto y la ruta antes de usarlo.
- El listado requiere `projectPath`, pero las tools de lectura y edición reciben la ruta del análisis.

**Completado cuando:** El análisis solicitado quedó identificado y sus metadatos o contenido fueron verificados.

### Preparar y actualizar un repositorio Talend (`repositorios-git`)

Clonar o seleccionar un repositorio, revisar su estado y actualizarlo sin perder de vista el proyecto activo.

**Cuando:** Al conectar un proyecto Git nuevo, cambiar entre repositorios o traer cambios remotos.

1. `talend_repo_sources`: Ver los repositorios Talend que ya están disponibles en la caché.
2. `talend_repo_setup`: Clonar un origen remoto o descubrir un proyecto en una ruta local.
   - Ejemplo: `{"source":"<URL Git, owner/repo o ruta local>","branch":"<rama opcional>"}`
3. `talend_repo_status`: Comprobar rama, último commit y proyecto detectado antes de operar.
   - Ejemplo: `{"repoPath":"<ruta del repositorio>"}`
4. `talend_repo_pull` (opcional): Actualizar el repositorio activo mediante fast-forward y volver a descubrir el proyecto.
   - Ejemplo: `{"repoPath":"<ruta del repositorio>"}`
5. `talend_repo_switch` (opcional): Seleccionar un repositorio local ya existente para esta sesión.
   - Ejemplo: `{"repoPath":"<ruta del repositorio>"}`

Evita:
- Antes de hacer pull, revisa si hay cambios locales y confirma que la ruta corresponde al repositorio esperado.
- `talend_repo_setup` acepta URL, owner/repo o ruta local; `branch` es opcional.

**Completado cuando:** La ruta del repositorio, el proyecto Talend descubierto y la rama quedaron confirmados.

### Comparar o restaurar un snapshot del proyecto (`snapshots`)

Inspeccionar el estado guardado del proyecto y comparar sus archivos antes de decidir si restaurarlos.

**Cuando:** Cuando se necesita revisar cambios frente a un snapshot o recuperar archivos anteriores.

1. `talend_snapshots_list`: Listar snapshots disponibles; usa paginación si el proyecto tiene muchos.
   - Ejemplo: `{"limit":50,"offset":0}`
2. `talend_snapshots_read`: Leer el manifiesto de un snapshot y confirmar qué estado contiene.
   - Ejemplo: `{"snapshotId":"<id del snapshot>"}`
3. `talend_snapshots_diff`: Comparar los archivos actuales con el snapshot antes de restaurar.
   - Ejemplo: `{"snapshotId":"<id del snapshot>"}`
4. `talend_snapshots_restore` (opcional): Restaurar archivos desde el snapshot seleccionado.
   - Ejemplo: `{"snapshotId":"<id del snapshot>"}`

Evita:
- Restaurar cambia archivos del proyecto; revisa primero el manifiesto y el diff, y confirma la intención del usuario.
- Estas tools usan el proyecto detectado si no se proporciona `projectPath`; el `snapshotId` debe venir del listado.

**Completado cuando:** El contenido y las diferencias del snapshot quedaron revisados; si se autorizó restaurar, se verificaron los archivos restaurados.

### Validar y previsualizar una especificación de pipeline (`pipeline-spec`)

Comprobar la estructura de un pipeline declarativo y revisar sus componentes y conexiones transformados.

**Cuando:** Cuando otro sistema o agente entrega un pipeline spec antes de aplicar cambios a un job.

1. `talend_jobs_validate_pipeline_spec`: Validar la estructura de la especificación y corregir errores antes de continuar.
   - Ejemplo: `{"spec":{"name":"<nombre>","version":"0.1","stages":[{"id":"stage-1","name":"<etapa>","components":[],"connections":[]}]}}`
2. `talend_jobs_preview_pipeline_spec`: Previsualizar componentes y conexiones transformados; esta operación es de solo lectura.
   - Ejemplo: `{"spec":{"name":"<nombre>","version":"0.1","stages":[{"id":"stage-1","name":"<etapa>","components":[],"connections":[]}]}}`

Evita:
- Cada componente requiere `id`, `name`, `type` y `configuration`; cada conexión requiere identificadores de origen y destino.
- Validar o previsualizar no aplica el spec ni garantiza que los componentes existan en la instalación local de Studio.
- No hay una tool activa que aplique directamente este pipeline spec; para materializarlo, usa el flujo `crear-job` con las tools de Studio.

**Completado cuando:** La especificación no tiene errores y su preview se revisó antes de cualquier operación de escritura.

### Consultar el nivel de validación de componentes (`dominio-componentes`)

Entender qué capacidades de un componente se han comprobado y qué evidencias o validaciones faltan.

**Cuando:** Cuando se evalúa si un componente está descubierto, se puede configurar o fue probado en Studio.

1. `talend_mastery_component`: Consultar el nivel y las capacidades conocidas de un componente específico.
   - Ejemplo: `{"componentName":"tFileInputDelimited"}`
2. `talend_mastery_report`: Consultar el informe agregado de mastery ya registrado.
3. `talend_mastery_all_components` (opcional): Ejecutar el análisis de todos los componentes y regenerar el informe agregado.

Evita:
- El informe agregado puede estar vacío hasta que se hayan aprendido o validado componentes.
- La operación sobre todos los componentes puede tardar; usa primero la consulta de un componente concreto.

**Completado cuando:** Se conoce el nivel del componente y las capacidades o evidencias pendientes.

## Todas las tools

### Orientacion

Saber que hacer, en que orden y con que tool.

#### `talend_guide`

Punto de entrada para agentes: mapa de tareas de Talend con la secuencia exacta de tools, busqueda de tools, reglas de configuracion que evitan fallos silenciosos y estado del proyecto y del bridge. Empieza por mode=overview.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `mode` (string, opcional): overview (mapa de tareas), task (pasos de una tarea), tool (detalle de una tool), search (buscar), rules (reglas de configuracion), environment (proyecto y bridge)
- `task` (string, opcional): Solo con mode=task: id de la tarea (crear-job, editar-job...) o texto libre como 'crear un job'
- `tool` (string, opcional): Solo con mode=tool: nombre de la tool (talend_jobs_list o jobs_list)
- `query` (string, opcional): Solo con mode=search: texto a buscar en nombres y descripciones
- `limit` (number, opcional): Solo con mode=search: maximo de tools a devolver
- `includeSchema` (boolean, opcional): Solo con mode=tool: incluir el schema de entrada

### Entorno

Comprobar proyecto, Studio, bridge y permisos de lectura.

#### `talend_bridge_audit_environment`

Audita el entorno de Talend Studio.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_can_read_metadata`

Verifica si se puede leer el directorio .metadata del workspace.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_can_read_process`

Verifica si se puede leer el directorio de procesos del proyecto.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_can_read_project`

Verifica si se puede leer el proyecto actual.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_diagnose_environment`

Diagnostica el entorno de Talend: plataforma, workspace, proyecto, metadata y proceso del Studio.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_studio_process`

Detecta si Talend Studio está corriendo como proceso en el sistema.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

### Contextos

Entornos y variables de un job o del proyecto.

#### `talend_context_profile_apply_to_job`

Aplica un perfil de contexto a una especificación de job.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `profileName` (string, obligatorio): Nombre del perfil de contexto
- `jobSpec` (object, obligatorio): Especificación del job

#### `talend_context_profile_get`

Obtiene un perfil de contexto por nombre.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `profileName` (string, obligatorio): Nombre del perfil

#### `talend_context_profile_list`

Lista todos los perfiles de contexto disponibles.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_context_profile_load_from_file`

Carga un perfil de contexto desde un archivo JSON externo.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `filePath` (string, obligatorio): Ruta al archivo .context.json

#### `talend_create_repository_context`

Crea un contexto del proyecto de Talend (un item de tipo Contexts) con su entorno y sus variables. Si ya existe uno con la misma etiqueta, lo reemplaza.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend (opcional: se usa el que este abierto)
- `name` (string, obligatorio): Etiqueta del contexto
- `version` (string, opcional): Version del contexto (default: 0.1)
- `context` (string, opcional): Nombre del entorno (default: Default)
- `parameters` (array, opcional): Las variables del entorno
- `purpose` (string, opcional): Proposito del contexto
- `description` (string, opcional): Descripcion del contexto

#### `talend_delete_repository_context`

Elimina un contexto completo del proyecto de Talend.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend (opcional: se usa el que este abierto)
- `contextName` (string, obligatorio): Etiqueta del contexto a eliminar

#### `talend_delete_repository_context_parameter`

Elimina una variable de un entorno de un contexto del proyecto de Talend.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend (opcional: se usa el que este abierto)
- `contextName` (string, obligatorio): Etiqueta del contexto
- `parameterName` (string, obligatorio): Nombre de la variable a eliminar
- `contextName_param` (string, opcional): Nombre del entorno (default: Default)

#### `talend_job_context_create`

Crea un contexto (un entorno) en el job, copiando las variables del entorno por defecto. Se edita con la API de Studio y el job se guarda.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre del contexto nuevo (por ejemplo, 'produccion')
- `job` (string, opcional): Job donde crear el contexto

#### `talend_job_context_delete`

Borra un contexto (un entorno) del job. El entorno por defecto no se puede borrar.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre del contexto
- `job` (string, opcional): Job donde borrarlo

#### `talend_job_context_delete_variable`

Borra una variable de un contexto del job.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `context` (string, obligatorio): Contexto (entorno) de la variable
- `name` (string, obligatorio): Nombre de la variable
- `job` (string, opcional): Job donde borrarla

#### `talend_job_context_set`

Crea o cambia una variable de un contexto del job (su nombre, su tipo y su valor). Cada entorno puede tener un valor distinto de la misma variable.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `context` (string, obligatorio): Contexto (entorno) al que pertenece la variable
- `name` (string, obligatorio): Nombre de la variable
- `value` (string, obligatorio): Valor de la variable en ese contexto
- `type` (string, opcional): Tipo: id_String (por defecto), id_Integer, id_Double, id_Boolean, id_Date...
- `job` (string, opcional): Job donde editarla

#### `talend_job_contexts_list`

Lista los contextos (entornos) del job y sus variables, con el valor de cada variable en cada entorno. Los contextos se leen del modelo de Studio, no del archivo.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `job` (string, opcional): Job a consultar (si no, el que este abierto)

#### `talend_list_project_contexts`

Lista los contextos definidos en los jobs de un proyecto Talend.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, obligatorio): Ruta al proyecto Talend

#### `talend_list_repository_contexts`

Lista los contextos del proyecto de Talend (los items de tipo Contexts), con sus entornos y sus variables.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend (opcional: se usa el que este abierto)

#### `talend_read_contexts`

Lee los contextos y parámetros de un job.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job

#### `talend_read_repository_context`

Lee un contexto del proyecto de Talend: sus entornos y las variables de cada uno, con su valor.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend (opcional: se usa el que este abierto)
- `contextName` (string, obligatorio): Nombre (etiqueta) del contexto

#### `talend_secrets_suggest_context_migration`

Sugiere cómo migrar secretos hardcoded a context profiles.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, obligatorio): Ruta del proyecto Talend
- `jobName` (string, obligatorio): Nombre del job

#### `talend_upsert_repository_context_parameter`

Crea o actualiza una variable de un contexto del proyecto de Talend, en el entorno indicado.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend (opcional: se usa el que este abierto)
- `contextName` (string, obligatorio): Etiqueta del contexto
- `parameterName` (string, obligatorio): Nombre de la variable
- `value` (string, obligatorio): Valor de la variable
- `contextName_param` (string, opcional): Nombre del entorno (default: Default)
- `type` (string, opcional): Tipo de la variable (id_String, id_Integer...)
- `prompt` (string, opcional): Prompt para el parametro

#### `talend_validation_validate_context_usage`

Valida que el job use los contextos requeridos.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `spec` (object, obligatorio): Especificación del job
- `requiredContexts` (array, opcional): Contextos requeridos

### Bridge (IDE en vivo)

Estado y control del workbench de Studio.

#### `talend_bridge_activate_editor`

Activa un editor por su título.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `title` (string, obligatorio): Título exacto del editor

#### `talend_bridge_active_component_connections`

Obtiene las conexiones entrantes y salientes de un componente activo.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente

#### `talend_bridge_active_component_details`

Obtiene los detalles completos de un componente del job activo en Talend Studio (parámetros, schemas, conexiones).

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente
- `includeRaw` (boolean, opcional): Incluir metadatos raw

#### `talend_bridge_active_component_parameters`

Obtiene todos los parámetros de configuración de un componente activo.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente

#### `talend_bridge_active_component_schemas`

Obtiene los schemas y columnas de un componente activo.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente

#### `talend_bridge_active_editor_introspect`

Introspecciona el editor activo.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_active_job_dependencies`

Lista rutinas, módulos y bibliotecas que Talend declara para el job activo. Omite rutas locales y credenciales.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_active_job_details`

Obtiene los detalles profundos del job activo en Talend Studio (componentes con posiciones, conexiones).

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_active_job_model`

Obtiene el modelo del job activo en Studio.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_capabilities`

Obtiene las capacidades del plugin bridge.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_close_editor`

Cierra un editor abierto.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `title` (string, obligatorio): Título del editor
- `save` (boolean, opcional): Si debe guardar antes de cerrar

#### `talend_bridge_commands`

Lista los comandos disponibles en el bridge.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_events_clear`

Limpia los eventos del bridge.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_events_recent`

Obtiene eventos recientes del bridge.

**Uso:** solo lectura; requiere Studio + bridge.

#### `talend_bridge_execute_command`

Ejecuta un comando en el bridge.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `commandId` (string, obligatorio): ID del comando a ejecutar
- `dryRun` (boolean, opcional): Si es dry run

#### `talend_bridge_find_editor`

Busca editores abiertos en el workbench.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `titleContains` (string, obligatorio): Texto que contiene el título del editor

#### `talend_bridge_get_selected_components_schemas`

Obtiene los schemas de entrada y salida de los componentes indicados en Talend Studio. Si no se indican, se infieren del job activo.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `uniqueNames` (array, opcional): UNIQUE_NAME de los componentes. Si se omite, se usa el componente de entrada y el de salida del job activo.

#### `talend_bridge_launch_configs`

Lista las configuraciones de launch disponibles.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_launch_runs`

Lista las ejecuciones recientes.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_launch_status`

Obtiene el estado de una ejecución.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `launchId` (string, obligatorio): ID de la launch

#### `talend_bridge_open_component_settings`

Abre la configuración de un componente en Talend Studio.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `componentId` (string, obligatorio): UNIQUE_NAME del componente

#### `talend_bridge_open_resource`

Abre un recurso en el workbench.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `path` (string, obligatorio): Ruta del recurso a abrir

#### `talend_bridge_ping`

Verifica si el bridge de Talend Studio estÃ¡ disponible.

**Uso:** solo lectura; requiere Studio + bridge.

#### `talend_bridge_probe_classes`

Probe de clases de Talend.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_problems_markers`

Obtiene los markers de problemas.

**Uso:** solo lectura; requiere Studio + bridge.

#### `talend_bridge_refresh_workspace`

Refresca el workspace.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_run_launch_config`

Ejecuta una configuraciÃ³n de launch.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre de la launch config
- `mode` (string, opcional): Modo de ejecuciÃ³n
- `dryRun` (boolean, opcional): Si es dry run

#### `talend_bridge_save_active_editor`

Guarda el editor activo.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_save_all`

Guarda todos los editores.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_select_component`

Selecciona y revela un componente en el editor activo de Talend Studio.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente a seleccionar

#### `talend_bridge_selection`

Obtiene la selecciÃ³n actual en el workbench.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_show_view`

Muestra una vista específica en el workbench.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `viewId` (string, obligatorio): ID de la vista (ej: org.eclipse.ui.views.ProblemView)

#### `talend_bridge_views`

Lista las vistas abiertas en el workbench.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_bridge_workbench_state`

Obtiene el estado actual del workbench.

**Uso:** solo lectura; requiere Studio + bridge.

#### `talend_bridge_workspace_state`

Obtiene el estado del workspace.

**Uso:** solo lectura; requiere Studio + bridge.

### Comandos del IDE

Ejecutar comandos de Eclipse permitidos.

#### `talend_commands_allow`

Permite un comando peligroso.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `commandId` (string, obligatorio): ID del comando a permitir

#### `talend_commands_block`

Bloquea un comando peligroso.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `commandId` (string, obligatorio): ID del comando a bloquear

#### `talend_commands_catalog`

Lista el catálogo de comandos disponibles.

**Uso:** escribe/ejecuta; funciona sin Studio.

#### `talend_commands_execute_safe`

Ejecuta un comando solo si está permitido y es seguro. Los comandos danger requieren allowDanger=true.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `commandId` (string, obligatorio): ID del comando
- `dryRun` (boolean, opcional): Si es dry run
- `allowDanger` (boolean, opcional): Permitir ejecutar comandos peligrosos

#### `talend_commands_scan`

Sincroniza el catálogo de comandos con los comandos disponibles en el bridge.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_commands_search`

Busca comandos por nombre o categoría.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `query` (string, obligatorio): Texto a buscar

### Ejecuciones

Lanzar jobs y leer su salida, log e historial.

#### `talend_job_run_by_name`

Ejecuta un job por nombre de launch config. Antes de lanzar comprueba si Studio tiene un dialogo modal abierto (STUDIO_DIALOG_OPEN). Con installMissing:true, si lo que bloquea son los modulos de terceros, pulsa la descarga y espera a que termine antes de lanzar (autoInstalledModules lo indica).

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job o launch config
- `dryRun` (boolean, opcional): Si es dry run
- `saveBefore` (boolean, opcional): Guardar antes de ejecutar
- `waitForTermination` (boolean, opcional): Esperar a que termine
- `timeoutMs` (number, opcional): Timeout en ms
- `ignoreDialogs` (boolean, opcional): Lanzar aunque haya dialogos abiertos que bloquean Studio (no recomendado)
- `installMissing` (boolean, opcional): Si Studio pide los modulos de terceros, pulsar la descarga y esperar a que termine antes de lanzar

#### `talend_job_wait_run`

Espera a que un launch termine. `terminated: true` solo si Studio lo confirma; `WAIT_TIMEOUT` si sigue en marcha y `WAIT_UNOBSERVED` si el bridge no lo vigila (no se puede confirmar el fin).

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `launchId` (string, obligatorio): ID del launch a esperar
- `timeoutMs` (number, opcional): Timeout en ms

#### `talend_read_run_log`

Lee y parsea el último run log de un job mostrando command line y errores.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `logPath` (string, obligatorio): Ruta al archivo de log
- `jobName` (string, obligatorio): Nombre del job para filtrar el log

#### `talend_runs_analyze_output`

Analiza los outputs generados por una ejecucion.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `runId` (string, obligatorio): ID del run cuyos outputs se analizaran

#### `talend_runs_collect_logs`

Recolecta los logs de una ejecucion especifica.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `runId` (string, obligatorio): ID del run cuyos logs se recolectaran

#### `talend_runs_list`

Lista las ejecuciones de jobs guardadas en el historial local.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional): Filtrar por nombre de job (opcional)
- `limit` (number, opcional): Límite de resultados (default: 20)

#### `talend_runs_read`

Lee el detalle de una ejecución guardada por su runId.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `runId` (string, obligatorio): ID de la ejecución (runId)

#### `talend_runs_start`

Ejecuta un job de Talend Studio localmente en el proyecto configurado.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional): Nombre del job a ejecutar (opcional, usa el primer job si no se especifica)
- `contextName` (string, opcional): Nombre del contexto (default: Default)
- `timeoutMs` (number, opcional): Timeout en ms (default: 300000)
- `params` (object, opcional): Parámetros como TALEND_PARAM_<key>

#### `talend_runs_start_exported`

Ejecuta un job exportado (compilado) desde el directorio de builds.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job exportado
- `scriptPath` (string, opcional): Ruta explícita al script (opcional)
- `contextName` (string, opcional): Nombre del contexto (default: Default)
- `timeoutMs` (number, opcional): Timeout en ms (default: 300000)
- `params` (object, opcional): Parámetros de contexto del job, pasados al launcher como --context_param <clave>=<valor>

#### `talend_tail_run_output`

Lee las últimas líneas de stdout/stderr de una ejecución.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `runId` (string, obligatorio): ID de la ejecución
- `stream` (string, opcional)
- `maxLines` (number, opcional)

### Errores

Explicar un error, mapearlo a un componente y sugerir el fix.

#### `talend_error_map_to_component`

Asocia un error a un componente del job.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `errorMessage` (string, obligatorio): Mensaje de error
- `itemPath` (string, obligatorio): Ruta al archivo .item

#### `talend_errors_explain`

Explica un error de Talend. Se puede proveer el mensaje directo o el ID de la ejecución (runId).

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `errorMessage` (string, opcional): Mensaje de error
- `runId` (string, opcional): ID de la ejecución (runId)

#### `talend_errors_stats`

Obtiene estadísticas de errores conocidos.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_errors_suggest_fix`

Sugiere un fix automático para un error.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `errorMessage` (string, opcional): Mensaje de error detectado
- `error` (string, opcional): Mensaje de error detectado (alternativo)
- `jobId` (string, opcional): ID del job (opcional)
- `componentId` (string, opcional): ID del componente (opcional)

### Validacion

Revisar diseno, contextos, performance y columnas de auditoria.

#### `talend_validation_validate_audit_columns`

Valida que el job tenga columnas de audit configuradas correctamente.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `spec` (object, obligatorio): Especificación del job

#### `talend_validation_validate_design`

Valida el diseño de un job contra reglas configurables.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `spec` (object, obligatorio): Especificación del job
- `context` (object, opcional): Contexto de validación

#### `talend_validation_validate_performance`

Valida configuración de performance del job (batch size, commits, etc).

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `spec` (object, obligatorio): Especificación del job
- `maxBatchSize` (number, opcional): Batch size máximo esperado

### Secretos

Detectar credenciales en claro y migrarlas a contextos.

#### `talend_secrets_scan_job`

Escanea un job específico en busca de secretos expuestos.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, obligatorio): Ruta del proyecto Talend
- `jobName` (string, obligatorio): Nombre del job a escanear

#### `talend_secrets_scan_project`

Escanea todo el proyecto en busca de secretos expuestos en archivos .item y .properties.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, obligatorio): Ruta del proyecto Talend

### Datasets

Inspeccionar CSV, inferir schemas y generar mapeos a tablas raw.

#### `talend_datasets_generate_raw_mappings`

Genera mappings completos CSV → tabla raw con columnas técnicas (_load_ts, _load_run).

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `folderPath` (string, obligatorio): Ruta a la carpeta con CSVs
- `tableName` (string, opcional): Nombre de la tabla raw destino (para un solo CSV)
- `targetSchema` (string, opcional): Schema destino (ej: raw, stg)
- `namingStrategy` (string, opcional): Estrategia para nombrar tablas
- `forceStringTypes` (boolean, opcional): Forzar todos los tipos a string
- `addTechnicalColumns` (boolean, opcional): Agregar _load_ts y _load_run

#### `talend_datasets_infer_csv_schema`

Infiere el schema de base de datos a partir de la inspección de un folder de CSVs.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `folderPath` (string, obligatorio): Ruta a la carpeta con CSVs
- `tableName` (string, opcional): Nombre de la tabla destino (opcional)

#### `talend_datasets_inspect_csv_folder`

Inspecciona una carpeta con CSVs y devuelve schema, tipos inferidos y estadísticas.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `folderPath` (string, obligatorio): Ruta a la carpeta con CSVs

### Entregables

Reunir archivos, validar y empaquetar un job para entrega.

#### `talend_deliverables_build_job`

Construye un job como Build Job: zip autonomo con launcher (_run.bat/_run.sh), jar, lib/ y contexto, extraido en la carpeta de builds. Ejecutalo sin Studio con talend_runs_start_exported. Guarda el job en Studio antes de construirlo.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job, ya compilado en Studio
- `contextName` (string, opcional): Contexto que usa el launcher por defecto
- `version` (string, opcional): Version del job
- `destinationDir` (string, opcional): Carpeta del build. Por defecto, TALEND_BUILDS_DIR/<jobName>

#### `talend_deliverables_collect`

Recolecta los archivos asociados a un job para entrega.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job

#### `talend_deliverables_create_package`

Crea un paquete ZIP de entregable.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `files` (array, obligatorio): Lista de archivos a incluir
- `destinationDir` (string, opcional): Directorio destino para el ZIP

#### `talend_deliverables_export_job`

Prepara un paquete de entregable para un job.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `destinationDir` (string, opcional): Directorio destino para el paquete

#### `talend_deliverables_validate`

Valida que un job cumpla con los requisitos de entregable.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `hasContexts` (boolean, opcional): Si tiene archivos de contexto
- `hasSchema` (boolean, opcional): Si tiene documentación de schema
- `hasDocumentation` (boolean, opcional): Si tiene README
- `outputTable` (string, opcional): Nombre de tabla de output
- `auditColumns` (boolean, opcional): Si usa columnas de audit
- `batchSize` (number, opcional): Batch size configurado

### Evidencia

Armar y exportar el paquete de evidencia de una ejecucion.

#### `talend_evidence_pack_build`

Genera un paquete de evidencia para auditorias y entregas.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job para generar evidence pack
- `includeLogs` (boolean, opcional): Incluir logs de ejecucion
- `includeScreenshots` (boolean, opcional): Incluir capturas de pantalla
- `includeConfig` (boolean, opcional): Incluir configuracion

#### `talend_evidence_pack_export`

Exporta un paquete de evidencia generado a una ruta específica.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `packId` (string, obligatorio): ID del paquete de evidencia a exportar
- `destinationPath` (string, opcional): Ruta de destino (opcional)

#### `talend_evidence_pack_generate`

Genera un paquete de evidencia para una ejecucion.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `runId` (string, obligatorio): ID del run para generar evidencia

### Reportes

Generar fragmentos de texto sobre jobs.

#### `talend_report_snippets_generate`

Genera fragmentos de texto listos para usar en reportes académicos sobre jobs de Talend.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional): Nombre del job
- `category` (string, opcional): Categoría del snippet
- `section` (string, opcional): Sección del reporte (alternativo para compatibilidad)
- `mode` (string, opcional): Modo de generación
- `customText` (string, opcional): Texto personalizado

#### `talend_report_snippets_list`

Lista las secciones y categorías de snippets disponibles.

**Uso:** solo lectura; funciona sin Studio.

### Snapshots

Listar, leer, comparar y restaurar copias del proyecto.

#### `talend_snapshots_diff`

Muestra las diferencias entre un snapshot y los archivos actuales.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend
- `snapshotId` (string, obligatorio): ID del snapshot a comparar

#### `talend_snapshots_list`

Lista los snapshots disponibles para el proyecto.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend
- `limit` (number, opcional): Máximo de snapshots a devolver
- `offset` (number, opcional): Cantidad de snapshots a omitir

#### `talend_snapshots_read`

Lee el contenido de un snapshot específico.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend
- `snapshotId` (string, obligatorio): ID del snapshot a leer

#### `talend_snapshots_restore`

Restaura archivos desde un snapshot.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend
- `snapshotId` (string, obligatorio): ID del snapshot a restaurar

### Repositorios git

Clonar, cambiar, actualizar y revisar el repo del proyecto.

#### `talend_repo_pull`

Hace pull en un repositorio y descubre el proyecto Talend.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `repoPath` (string, obligatorio): Ruta al repositorio

#### `talend_repo_setup`

Clona o configura un repositorio Talend desde una fuente remota o local.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `source` (string, obligatorio): URL git, path local o格式 'owner/repo'
- `branch` (string, opcional): Rama opcional a clonar

#### `talend_repo_sources`

Lista los repositorios en caché local.

**Uso:** escribe/ejecuta; funciona sin Studio.

#### `talend_repo_status`

Obtiene el estado de un repositorio Talend (branch, commit, remote).

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `repoPath` (string, obligatorio): Ruta al repositorio

#### `talend_repo_switch`

Cambia a un repositorio ya clonado y descubre el proyecto Talend.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `repoPath` (string, obligatorio): Ruta al repositorio

### Mastery de componentes

Aprender y validar componentes contra Studio.

#### `talend_mastery_all_components`

Ejecuta mastery para todos los componentes del catálogo.

**Uso:** escribe/ejecuta; funciona sin Studio.

#### `talend_mastery_batch_continue`

Continúa una sesión de aprendizaje por lotes.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `sessionId` (string, obligatorio): ID de la sesión de batch
- `batchToken` (string, obligatorio): Token del batch activo
- `fromIndex` (number, obligatorio): Índice desde donde continuar

#### `talend_mastery_batch_start`

Inicia una sesión de aprendizaje por lotes de componentes.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `sessionId` (string, obligatorio): ID único de la sesión de batch

#### `talend_mastery_batch_status`

Obtiene el estado de una sesión de aprendizaje por lotes.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `sessionId` (string, obligatorio): ID de la sesión de batch

#### `talend_mastery_component`

Ejecuta mastery para un componente específico.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_mastery_generate_fixture`

Genera un fixture para probar un componente.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_mastery_learn_component`

Aprende un componente específico y guarda su mastery.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_mastery_report`

Genera un reporte de mastery.

**Uso:** escribe/ejecuta; funciona sin Studio.

#### `talend_mastery_validate_in_studio`

Valida que un componente abre en Studio.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_mastery_validate_roundtrip`

Valida round-trip para un componente.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente
- `itemPath` (string, obligatorio): Ruta al archivo .item

#### `talend_mastery_validate_run`

Valida que un componente ejecuta correctamente.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente
- `itemPath` (string, obligatorio): Ruta al archivo .item
- `jobName` (string, opcional): Nombre del job

### Componentes

Descubrir componentes, sus parametros, conectores y schemas.

#### `talend_components_apply_patch`

Aplica un parche de parámetros a un componente Talend. Requiere confirmationToken si el preview indica alto riesgo.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Ruta de la carpeta del job
- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente
- `patch` (object, obligatorio): Patch de parámetros (clave-valor)
- `confirmationToken` (string, opcional): Token de confirmación (requerido si riskLevel es high)

#### `talend_components_catalog_rebuild`

Reconstruye el catálogo de componentes instalados reescaneando los plugins de Talend Studio. Modifica la caché local.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `pluginsDir` (string, opcional): Directorio de plugins de Talend Studio
- `talendStudioHome` (string, opcional): Raíz de la instalación de Talend Studio

#### `talend_components_catalog_status`

Obtiene el estado del catálogo de componentes.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_components_compare_schemas`

Compara los schemas de dos componentes y devuelve las diferencias de columnas y tipos. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `schemaFromId` (string, obligatorio): Componente origen del schema
- `schemaToId` (string, obligatorio): Componente destino del schema

#### `talend_components_connectors`

Lista los conectores de un componente.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_components_definition`

Devuelve la definicion de un componente de Talend leida de la instalacion de Studio: que parametros son obligatorios y con que valor rellenarlos, que conexiones admite y que artefactos necesita. Funciona sin abrir Studio. Es la forma de saber como se configura un componente sin adivinar.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `name` (string, opcional): Nombre del componente (por ejemplo tFileOutputDelimited)
- `filter` (string, opcional): Texto que tiene que aparecer en el nombre o en la familia
- `family` (string, opcional): Filtra por familia exacta (por ejemplo 'File/Output')
- `palette` (string, opcional): Tipo de job de la variante del componente. Por defecto, la Standard (DI)
- `limit` (number, opcional): Maximo de componentes a devolver en modo lista
- `refresh` (boolean, opcional): Relee el indice de disco en vez de usar el cache

#### `talend_components_extract_schema`

Extrae la definición de schema (nombre, tipo y columnas) de un componente del catálogo. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `componentId` (string, obligatorio): Nombre del componente del catálogo

#### `talend_components_generate_template`

Genera una plantilla de job para un componente.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_components_get_mapping_suggestions`

Sugiere mapeos entre las columnas de dos schemas con un nivel de confianza. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `schemaFromId` (string, obligatorio): Componente origen del schema
- `schemaToId` (string, obligatorio): Componente destino del schema

#### `talend_components_inspect`

Inspecciona un componente específico.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_components_parameters`

Lista los parámetros de un componente.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente

#### `talend_components_preview_patch`

Muestra la previsualización (diff) de aplicar un parche de parámetros a un componente.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Ruta de la carpeta del job
- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente
- `patch` (object, obligatorio): Patch de parámetros (clave-valor)

#### `talend_components_rename_label`

Cambia el label (nombre visible) de un componente Talend de forma segura.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Ruta de la carpeta del job
- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente
- `newLabel` (string, obligatorio): Nuevo LABEL visible

#### `talend_components_rename_unique_name_apply`

Aplica el cambio en cascada de UNIQUE_NAME usando un token de confirmación.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Ruta de la carpeta del job
- `oldUniqueName` (string, obligatorio): UNIQUE_NAME actual
- `newUniqueName` (string, obligatorio): UNIQUE_NAME propuesto
- `confirmationToken` (string, obligatorio): Token de confirmación

#### `talend_components_rename_unique_name_preview`

Genera la previsualización del cambio en cascada de UNIQUE_NAME.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Ruta de la carpeta del job
- `oldUniqueName` (string, obligatorio): UNIQUE_NAME actual
- `newUniqueName` (string, obligatorio): UNIQUE_NAME propuesto

#### `talend_components_scan_installed`

Escanea los componentes instalados en Talend Studio.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `pluginsDir` (string, opcional): Directorio de plugins de Talend

#### `talend_components_search`

Busca componentes en el catálogo.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `query` (string, obligatorio): Texto a buscar
- `maxResults` (number, opcional): Máximo de resultados

#### `talend_components_update_position`

Actualiza la posición posX y posY de un componente Talend.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Ruta de la carpeta del job
- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente
- `posX` (number, obligatorio): Nueva posición X
- `posY` (number, obligatorio): Nueva posición Y

#### `talend_components_validate_usage`

Valida el uso de un componente en el proyecto.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `componentName` (string, obligatorio): Nombre del componente
- `projectPath` (string, opcional): Ruta al proyecto

### Conexiones

Construir perfiles de conexion a base de datos y aplicarlos.

#### `talend_connection_apply_to_job`

Aplica un perfil de conexión a una especificación de job.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `profile` (object, obligatorio): Perfil de conexión
- `jobSpec` (object, obligatorio): Especificación del job

#### `talend_connection_build_profile`

Construye un perfil de conexión a base de datos.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `connectionType` (string, obligatorio): Tipo de base de datos
- `host` (string, obligatorio): Host de la base de datos
- `port` (number, obligatorio): Puerto
- `database` (string, obligatorio): Nombre de la base de datos
- `user` (string, obligatorio): Usuario
- `schema` (string, opcional): Schema opcional

#### `talend_connection_detect_available_db_components`

Detecta los componentes de base de datos disponibles para un tipo de conexión.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `connectionType` (string, obligatorio): Tipo de base de datos

### Studio (utilidades)

Instalar artefactos, medir memoria y cerrar dialogos.

#### `talend_studio_component_parameters`

Devuelve los parametros de un componente del catalogo de Talend, con su tipo y su valor por defecto. Es la forma de saber como se configura un componente sin adivinar.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre del componente

#### `talend_studio_coverage`

Mide cuantos componentes del catalogo de Talend se pueden crear, configurar y borrar con el MCP. Tarda minutos, asi que no espera: 'start' la arranca y devuelve enseguida; 'status' da el progreso y, al terminar, el informe; 'cancel' la para.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `action` (string, opcional): start (por defecto), status o cancel
- `filter` (string, opcional): Solo con start: texto que tiene que aparecer en el nombre del componente
- `max` (number, opcional): Solo con start: maximo de componentes que probar
- `compile` (boolean, opcional): Solo con start: ademas genera el codigo de cada componente y comprueba que compila (nivel L4, ~2 s mas por componente)

#### `talend_studio_dismiss_dialogs`

Cierra los dialogos modales que bloquean Talend Studio PULSANDO su boton: 'Jobname Error' y 'Save Resource' responden Yes (reemplaza el job o guarda los cambios pendientes). NO es de solo lectura. Para ver que dialogos hay sin tocarlos usa talend_studio_ui_inventory. El plugin ya lo hace solo; esta tool lo fuerza bajo demanda.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_studio_install_artifact`

Descarga un artefacto de Maven Central al repositorio local de Talend Studio. Necesario para los componentes cuyo runtime no viene con Studio (por ejemplo el tFileInputJSON, que necesita com.jayway.jsonpath:json-path). Con `file` se instala un jar que ya este en el equipo: los componentes de Talend Exchange (el tMap necesita talend-tmap-dataset) no estan en Maven Central y su dominio no se resuelve desde todas las redes.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `groupId` (string, obligatorio): Group id de Maven, por ejemplo com.jayway.jsonpath
- `artifactId` (string, obligatorio): Artifact id de Maven, por ejemplo json-path
- `version` (string, obligatorio): Version, por ejemplo 2.9.0
- `file` (string, opcional): Ruta de un jar local ya descargado. Si se da, no se descarga de Maven

#### `talend_studio_install_modules`

Instala los modulos de terceros que Studio echa de menos. Necesario para los componentes cuyo runtime no esta descargado (tMap, tJavaRow, tSortRow, tAggregateRow...). Descarga de internet, asi que hay que pedirlo de forma explicita.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

#### `talend_studio_list_components`

Lista los componentes del catalogo de Talend Studio. Sirve para saber que componentes hay disponibles antes de crear un job.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `filter` (string, opcional): Texto que tiene que aparecer en el nombre del componente
- `limit` (number, opcional): Maximo de componentes a devolver

#### `talend_studio_memory`

Dice cuanto heap de memoria lleva usado el JVM de Talend Studio. Las mediciones largas (el codigo generado de cada job) llenan la memoria y el IDE deja de responder: con esta tool se comprueba antes y despues, y con `gc` se pide una recoleccion.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `gc` (boolean, opcional): Fuerza una recoleccion de basura antes de medir

#### `talend_studio_run_code`

Compila y ejecuta codigo Java dentro de Talend Studio, con acceso a las APIs del IDE. El codigo debe tener una clase con 'public static Object run()'. Requiere unsafeActions=true en el bridge.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `code` (string, obligatorio): Codigo fuente Java con un metodo estatico 'public static Object run()'
- `className` (string, opcional): Nombre de la clase. Si se omite, se deduce del codigo

#### `talend_studio_ui_dialogs`

Lista los dialogos abiertos en Talend Studio (titulo, si son modales, botones y textos) y marca cuales bloquean el IDE, con la accion sugerida. Solo lectura: no pulsa ni cierra nada, y responde al momento. Es la misma comprobacion que hacen talend_job_run_by_name y talend_job_compile antes de actuar.

**Uso:** solo lectura; requiere Studio + bridge.

#### `talend_studio_ui_inventory`

Inventario de solo lectura de la interfaz de Talend Studio: menus, pestanas de editor y paneles, barras de herramientas, perspectivas, vistas registradas y clases de dialogos y asistentes por bundle. No pulsa, no cierra ni guarda nada. Requiere unsafeActions=true en el bridge.

**Uso:** solo lectura; requiere Studio + bridge.

### Watcher

Detectar cambios del workspace en vivo.

#### `talend_latest_changes`

Obtiene los últimos cambios detectados por el watcher (archivo modificado, job abierto, error de Studio).

**Uso:** escribe/ejecuta; funciona sin Studio.

#### `talend_live_start`

Inicia el watcher reactivo para detectar cambios en el workspace.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, opcional): Ruta del proyecto (opcional)
- `workspacePath` (string, opcional): Ruta del workspace (opcional)

#### `talend_live_status`

Obtiene el estado actual del watcher de archivos.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_live_stop`

Detiene el watcher de archivos activo.

**Uso:** escribe/ejecuta; funciona sin Studio.

### Sincronizacion

Preparar el estado antes de editar archivos.

#### `talend_sync_before_file_edit`

Prepara el estado antes de editar un archivo.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `itemPath` (string, obligatorio): Ruta al archivo .item
- `propertiesPath` (string, obligatorio): Ruta al archivo .properties
- `projectPath` (string, opcional): Ruta al proyecto

#### `talend_sync_status`

Obtiene el estado de sincronización actual.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, opcional): Ruta al proyecto Talend

### Tareas de proyecto

Analizar requerimientos y armar planes.

#### `talend_task_analyze_requirements`

Analiza los requisitos técnicos del proyecto y genera un reporte de cumplimiento.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, obligatorio): Ruta al proyecto Talend

#### `talend_task_build_execution_plan`

Construye un checklist de requisitos técnicos con items auditables.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `requirements` (array, obligatorio): Lista de requisitos para generar el checklist

#### `talend_task_extract_talend_responsibilities`

Extrae solo las responsabilidades específicas de Talend del análisis de un requerimiento.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `enunciado` (string, obligatorio): Enunciado del taller

### Cobertura

Medir cuanto de Talend automatiza el MCP.

#### `talend_coverage_report`

Genera un reporte de cobertura de la automatización.

**Uso:** escribe/ejecuta; funciona sin Studio.

### Analisis en disco

Leer jobs, flujos, DQ y logs sin abrir Studio.

#### `talend_analyze_job`

Analiza un job Talend y retorna información sobre componentes, conexiones, contextos y problemas.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobPath` (string, obligatorio)

#### `talend_analyze_logs`

Analiza los logs de un job para detectar errores y generar sugerencias.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job para buscar sus logs

#### `talend_analyze_tdboutput`

Analiza los componentes tDBOutput (tMysqlOutput, tDBOutput) de un job para mostrar configuración de base de datos.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobPath` (string, obligatorio): Ruta al archivo .item del job

#### `talend_diagnose_job`

Diagnostica un job: componentes, conexiones, contextos, schemas y errores recientes.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional)

#### `talend_duplicate_analysis`

Duplica un análisis DQ existente con un nuevo nombre.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `analysisPath` (string, obligatorio): Ruta completa al archivo .ana del análisis a duplicar
- `newName` (string, obligatorio): Nombre para el nuevo análisis duplicado

#### `talend_full_analysis`

Realiza un análisis completo de un job Talend incluyendo componentes, conexiones, contextos, issues de schema y análisis de columnas.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobPath` (string, obligatorio): Ruta al archivo .item del job

#### `talend_inspect_component`

Inspecciona un componente específico de un job Talend mostrando sus parámetros, schemas y conexiones.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobPath` (string, obligatorio): Ruta al archivo .item del job
- `uniqueName` (string, obligatorio): Nombre único del componente a inspeccionar
- `includeRaw` (boolean, opcional): Incluir atributos crudos del nodo

#### `talend_inspect_job`

Inspecciona un job completo mostrando todos sus componentes, conexiones, contextos y issues de schema.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobPath` (string, obligatorio): Ruta al archivo .item del job

#### `talend_list_analyses`

Lista todos los análisis DQ (Data Profiling) en un proyecto Talend.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, obligatorio): Ruta del proyecto Talend

#### `talend_read_analysis`

Lee y retorna el contenido de un análisis DQ específico.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `analysisPath` (string, obligatorio): Ruta completa al archivo .ana del análisis

#### `talend_show_flow`

Muestra el flujo de datos (conexiones) de un job.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job

#### `talend_update_analysis`

Actualiza los metadatos de un análisis DQ (name, status, purpose, description, version, author).

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `analysisPath` (string, obligatorio): Ruta completa al archivo .ana del análisis
- `name` (string, opcional): Nuevo nombre del análisis
- `status` (string, opcional): Estado del análisis
- `purpose` (string, opcional): Propósito del análisis
- `description` (string, opcional): Descripción del análisis
- `version` (string, opcional): Versión del análisis
- `author` (string, opcional): Autor del análisis
- `defaultContext` (string, opcional): Contexto por defecto

### Jobs

Crear, listar, duplicar y editar jobs.

#### `talend_auto_run_active_job`

Ejecuta el job activo en Studio.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `dryRun` (boolean, opcional): Si es dry run
- `saveBefore` (boolean, opcional): Guardar antes de ejecutar
- `waitForTermination` (boolean, opcional): Esperar a que termine
- `timeoutMs` (number, opcional): Timeout en ms

#### `talend_delete_job`

Elimina un job existente (item + properties).

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job a eliminar
- `folderPath` (string, opcional): Carpeta del job

#### `talend_detect_open_jobs`

Detecta los jobs abiertos en Talend Studio desde los archivos workbench XMI.

**Uso:** escribe/ejecuta; funciona sin Studio.

#### `talend_duplicate_job`

Duplica un job existente con un nombre nuevo.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `sourceJobName` (string, obligatorio): Nombre del job origen
- `sourceFolderPath` (string, opcional): Carpeta del job origen
- `targetJobName` (string, obligatorio): Nombre del job duplicado
- `targetVersion` (string, opcional): Versión del duplicado
- `targetFolderPath` (string, opcional): Carpeta destino del duplicado

#### `talend_find_exported_jobs`

Busca scripts de jobs exportados (*_run.sh, *_run.bat) en TALEND_BUILDS_DIR.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional): Filtrar por nombre de job específico (opcional)
- `buildsDir` (string, opcional): Directorio de builds (default: TALEND_BUILDS_DIR)

#### `talend_get_probable_active_job`

Detecta el job que probablemente está abierto en Talend Studio.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_job_add_node`

Anade un componente al job abierto. El componente se crea con la API de Studio, con todos sus parametros por defecto, y se configura de forma declarativa (parametros, tablas, schema y, en el tMap, sus transformaciones).

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `type` (string, obligatorio): Nombre del componente: tFileInputDelimited, tLogRow, tMap, tMysqlOutput...
- `label` (string, opcional): Etiqueta del componente
- `position` (object, opcional): Posicion en el lienzo
- `parameters` (object, opcional): Parametros del componente
- `tables` (object, opcional): Tablas del componente (parametros de tipo TABLE)
- `schema` (array, opcional): Metadata del nodo, por conector y por tabla
- `mapper` (object, opcional): Modelo del tMap: transformaciones, filtros y joins
- `job` (string, opcional): Job a abrir si no hay ninguno abierto

#### `talend_job_apply_custom_spec`

Crea o completa una estructura de Jobs con la API de Studio. Valida componentes y conexiones, conserva valores existentes y rechaza destinos ajenos. No compila, ejecuta ni publica Jobs.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio)
- `version` (string, opcional)
- `defaultContext` (string, opcional)
- `folderPath` (string, opcional)
- `description` (string, opcional)
- `purpose` (string, opcional)
- `components` (array, obligatorio)
- `connections` (array, opcional)
- `contexts` (array, opcional)
- `childJobs` (array, opcional)
- `instructions` (object, opcional)
- `replaceManagedTodoContexts` (boolean, opcional)

#### `talend_job_compile`

Genera el codigo Java del job y comprueba que compila, sin ejecutarlo. Devuelve 'compiles' y, si falla, la linea y el mensaje del error (por ejemplo 'no_comillas cannot be resolved to a variable'). Es la forma de saber si una configuracion genera codigo valido antes de correr el job. Si faltan dependencias Maven las lista en 'missingArtifacts'; con installMissing:true las descarga de Maven Central y vuelve a compilar. Se bloquea con STUDIO_DIALOG_OPEN si hay un dialogo modal abierto en Studio. Tarda unos segundos y ocupa el hilo de la interfaz de Studio mientras genera, igual que un Run.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `job` (string, opcional): Job a compilar. Si se omite, el job activo
- `installMissing` (boolean, opcional): Descargar lo que falte (modulos de terceros de Studio y dependencias Maven de Maven Central) y volver a compilar
- `ignoreDialogs` (boolean, opcional): Compilar aunque haya dialogos abiertos que bloquean Studio (no recomendado)

#### `talend_job_configure_node`

Configura un componente ya anadido al job: sus parametros, sus tablas, su schema o las transformaciones de un tMap. Es la via para retocar un job existente sin recrearlo.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): Unique name del nodo
- `parameters` (object, opcional): Parametros del componente
- `tables` (object, opcional): Tablas del componente (parametros de tipo TABLE)
- `schema` (array, opcional): Metadata del nodo, por conector y por tabla
- `mapper` (object, opcional): Modelo del tMap: transformaciones, filtros y joins

#### `talend_job_connect_nodes`

Conecta dos nodos del job abierto. Antes de conectar comprueba que el conector sea legal: el tUniqRow saca sus filas por UNIQUE (no por FLOW) y conectar por FLOW compila pero no pasa ninguna fila.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `source` (string, obligatorio): Unique name del nodo origen
- `target` (string, obligatorio): Unique name del nodo destino
- `type` (string, opcional): Conector: FLOW, REJECT, UNIQUE, ITERATE...
- `name` (string, opcional): Nombre de la conexion (por defecto, row1, row2...)
- `job` (string, opcional): Job donde estan los nodos
- `skipValidation` (boolean, opcional): Conectar sin comprobar el conector

#### `talend_job_create_in_studio`

Crea un job vacio en el repositorio de Talend y lo abre en el editor. El job se crea con la API del IDE, no escribiendo el XML a mano. Con jobType se elige el tipo de job (Standard, Big_Data_Batch para Spark Batch, Big_Data_Stream para Spark Streaming), que decide que paleta de componentes usa el editor.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre del job. Solo letras, digitos y guion bajo
- `version` (string, opcional): Version del job
- `folder` (string, opcional): Carpeta dentro de process/
- `description` (string, opcional): Descripcion del job
- `replace` (boolean, opcional): Reemplaza el job si ya existe con esa etiqueta
- `jobType` (string, opcional): Tipo de job: Standard (por defecto), Big_Data_Batch (Spark Batch), Big_Data_Stream (Spark Streaming)
- `framework` (string, opcional): Framework del job: Spark, Storm, MapReduce

#### `talend_job_delete_in_studio`

Borra un job del repositorio de Talend, con sus archivos. Se borra desde el repositorio, no desde el disco, para que no quede un item fantasma.

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre del job
- `version` (string, opcional): Version del job

#### `talend_job_execute`

Ejecuta un job ya generado y devuelve su salida (las filas que imprime el tLogRow). Sirve para comprobar que el resultado es el esperado: la vista Run de Studio no se puede leer desde el MCP.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre del job
- `version` (string, opcional): Version del job
- `context` (string, opcional): Contexto con el que se ejecuta
- `timeoutMs` (number, opcional): Tiempo maximo de espera en milisegundos

#### `talend_job_generate_from_pipeline_spec`

Genera un job de Talend a partir de una especificación de pipeline.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `pattern` (string, obligatorio): Patrón del pipeline
- `name` (string, obligatorio): Nombre del job a generar
- `inputPath` (string, opcional): Ruta de entrada de archivos
- `outputTable` (string, opcional): Tabla de base de datos destino
- `batchSize` (number, opcional): Batch size para inserts
- `auditColumns` (boolean, opcional): Usar columnas de audit

#### `talend_job_info`

Obtiene información de ejecución de un job: ruta del item, propiedades y script.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional): Nombre del job (opcional, usa el primer job si no se especifica)

#### `talend_job_list_nodes`

Lista los nodos del job abierto en Studio.

**Uso:** solo lectura; requiere Studio + bridge.

Argumentos principales:

- `job` (string, opcional): Job a abrir si no hay ninguno abierto

#### `talend_job_measure_runtime`

Mide el tiempo de ejecuciÃ³n de un job consultando runs anteriores.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job o launch config
- `targetMs` (number, opcional): Tiempo objetivo en ms para comparar
- `latestOnly` (boolean, opcional): Solo devolver el Ãºltimo run

#### `talend_job_open_in_studio`

Abre un job del proyecto en el editor de Talend. Necesario antes de operar sobre sus nodos.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `name` (string, obligatorio): Nombre del job
- `version` (string, opcional): Version del job

#### `talend_job_problems`

Errores y avisos de diseno de un job, los de la vista Problemas de Studio (por ejemplo 'No schema has been defined yet' o 'This component should have input link(s)'). Se calculan sin ejecutar el job: sirven para comprobar que abre sin avisos antes de compilarlo. 'clean' es true cuando no hay errores ni avisos.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `job` (string, opcional): Job a comprobar. Si se omite, el job activo

#### `talend_job_quality_issues`

Lista los hallazgos de calidad de un job Talend con severidad y solución sugerida. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobId` (string, opcional): Nombre del job. Si se omite, se intenta detectar el job activo.

#### `talend_job_quality_report`

Genera un reporte de calidad de un job Talend con puntaje, severidad y soluciones sugeridas. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobId` (string, opcional): Nombre del job. Si se omite, se intenta detectar el job activo.

#### `talend_job_set_schema`

Define el schema (las columnas) de un nodo del job abierto. Sin schema, la conexion no propaga columnas y el codigo generado sale mal. Los componentes con schema fijo (tFixedFlowInput) necesitan ademas 'values' para sacar filas.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): Unique name del nodo
- `connector` (string, opcional): Conector al que se cuelga la tabla
- `columns` (array, obligatorio): Columnas del schema
- `values` (array, opcional): Filas de datos, una por registro, con un valor por columna

#### `talend_job_update_node`

Cambia parametros o etiqueta de un nodo del job abierto. Guarda los cambios.

**Uso:** escribe/ejecuta; requiere Studio + bridge.

Argumentos principales:

- `uniqueName` (string, obligatorio): Unique name del nodo
- `label` (string, opcional): Nueva etiqueta
- `parameters` (object, opcional): Parametros a cambiar

#### `talend_jobs_apply_pipeline_spec`

Genera y escribe archivos .item y .properties reales en el proyecto Talend.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `pattern` (string, obligatorio): Patrón del pipeline
- `name` (string, obligatorio): Nombre del job
- `inputPath` (string, opcional): Ruta de entrada
- `outputTable` (string, opcional): Tabla de salida
- `batchSize` (number, opcional): Batch size
- `auditColumns` (boolean, opcional): Incluir columnas de audit
- `folderPath` (string, opcional): Carpeta dentro de process/

#### `talend_jobs_create`

Crea un job nuevo vacío en el proyecto, con la API de Talend Studio (hace falta Studio abierto).

**Uso:** escribe/ejecuta; requiere confirmacion; requiere Studio + bridge.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `version` (string, opcional): Versión (default: 0.1)
- `defaultContext` (string, opcional): Contexto por defecto (default: Default)
- `label` (string, opcional): Etiqueta visible
- `folderPath` (string, opcional): Carpeta destino dentro de process
- `description` (string, opcional): Descripción inicial
- `purpose` (string, opcional): Propósito inicial

#### `talend_jobs_create_from_spec`

Crea un job de Talend a partir de una especificacion de componentes y conexiones, y escribe los archivos .item y .properties en el proyecto. Requiere confirmacion.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `name` (string, obligatorio): Nombre del job
- `version` (string, opcional): Version (default: 0.1)
- `folder` (string, opcional): Carpeta dentro de process, por ejemplo Pruebas/MCP
- `description` (string, opcional)
- `components` (array, obligatorio): Componentes del job
- `connections` (array, opcional): Conexiones entre componentes
- `contexts` (object, opcional): Contextos del job: nombre -> { tipo, valor, comentario }
- `openInStudio` (boolean, opcional): Abrir el job en Talend Studio al terminar

#### `talend_jobs_detect_antipatterns`

Detecta antipatrones de diseño en jobs de Talend.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job a analizar
- `folderPath` (string, opcional): Ruta opcional del folder

#### `talend_jobs_list`

Lista todos los jobs en un proyecto Talend: nombre, version, carpeta, fecha de modificacion y numero de componentes.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `projectPath` (string, opcional): Ruta del proyecto Talend (opcional, se obtiene del entorno si no se provee)
- `limit` (number, opcional): Máximo de jobs a devolver
- `offset` (number, opcional): Cantidad de jobs a omitir

#### `talend_jobs_list_patterns`

Lista los patrones de pipeline disponibles para el editor de especificaciones.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_jobs_patch_component`

Aplica un parche a múltiples parámetros de un componente Talend.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente
- `patch` (object, obligatorio): Objeto con pares parámetro=valor a aplicar

#### `talend_jobs_preview_pipeline_spec`

Previsualiza un pipeline spec. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `spec` (object, obligatorio)
- `includeUnsetDefaults` (boolean, opcional)

#### `talend_jobs_read`

Lee un job de Talend: sus componentes, sus conexiones y el XML del .item. Se lee del proyecto, sin necesidad de que Studio este abierto.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job a leer
- `folderPath` (string, opcional): Carpeta del job

#### `talend_jobs_validate_pipeline_spec`

Valida un pipeline spec. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `spec` (object, obligatorio)
- `strict` (boolean, opcional)

#### `talend_move_job_to_folder`

Mueve un job existente a otra carpeta dentro de process.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job a mover
- `folderPath` (string, obligatorio): Carpeta destino dentro de process

#### `talend_rename_job`

Renombra un job existente.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `oldJobName` (string, obligatorio): Nombre actual del job
- `newJobName` (string, obligatorio): Nuevo nombre del job
- `folderPath` (string, opcional): Carpeta del job origen

#### `talend_summarize_open_job`

Obtiene un resumen detallado del job abierto actualmente en Talend Studio.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional): Nombre específico del job a resumir (opcional)

### Otros

Utilidades que no encajan en otra familia.

#### `talend_add_connection`

Añade una conexión entre dos componentes Talend.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `sourceUniqueName` (string, obligatorio): Nombre único del componente origen
- `targetUniqueName` (string, obligatorio): Nombre único del componente destino
- `label` (string, obligatorio): Etiqueta de la conexión
- `connectorName` (string, obligatorio): Nombre del conector
- `metaname` (string, obligatorio): Nombre del meta
- `uniqueName` (string, obligatorio): Nombre único para la conexión

#### `talend_create_folder`

Crea una carpeta dentro de process para organizar jobs.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `folderPath` (string, obligatorio): Ruta de carpeta dentro de process, por ejemplo carpeta_a/subcarpeta_b

#### `talend_delete_component`

Elimina un componente Talend y sus conexiones.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente a eliminar

#### `talend_delete_connection`

Elimina una conexión entre componentes Talend.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único de la conexión a eliminar

#### `talend_duplicate_component`

Duplica un componente Talend existente.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `sourceUniqueName` (string, obligatorio): Nombre único del componente fuente
- `targetUniqueName` (string, obligatorio): Nombre único para el nuevo componente

#### `talend_list_components`

Lista todos los componentes de un job.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job

#### `talend_list_launch_configs`

Lista las launch configurations desde .metadata del workspace.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `workspacePath` (string, opcional): Ruta del workspace (opcional)

#### `talend_list_open_editors`

Lista los editores abiertos desde los archivos workbench XMI del workspace.

**Uso:** solo lectura; funciona sin Studio.

#### `talend_list_repository_connections`

Lista las conexiones compartidas del proyecto abierto en Talend Studio. Devuelve nombres y tipos, pero no rutas, parametros ni credenciales.

**Uso:** solo lectura; requiere Studio + bridge.

#### `talend_move_component`

Mueve un componente Talend a una nueva posición.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente
- `posX` (number, obligatorio): Nueva posición X
- `posY` (number, obligatorio): Nueva posición Y

#### `talend_preview_component_parameter`

Muestra una previsualización del cambio en un parámetro de componente Talend.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente
- `parameterName` (string, obligatorio): Nombre del parámetro
- `value` (string, obligatorio): Nuevo valor del parámetro

#### `talend_preview_delete_component`

Muestra previsualización de eliminación de un componente Talend.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente a eliminar

#### `talend_preview_delete_connection`

Muestra previsualización de eliminación de una conexión Talend.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único de la conexión a eliminar

#### `talend_preview_schema_column`

Muestra una previsualización del cambio en una columna de schema Talend.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente
- `schemaName` (string, obligatorio): Nombre del schema
- `columnName` (string, obligatorio): Nombre de la columna
- `patch` (object, obligatorio)

#### `talend_recipe_generate`

Genera una receta de flujo Talend (componentes y conexiones sugeridos) a partir de un objetivo en lenguaje natural. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `objective` (string, obligatorio): Objetivo del flujo, por ejemplo 'leer un CSV y cargar a base de datos'

#### `talend_recipe_get`

Obtiene una receta generada previamente por su identificador. Solo lectura.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `recipeId` (string, obligatorio): Identificador de la receta, devuelto por talend_recipe_generate

#### `talend_report_generate_snippets`

Genera fragmentos de texto listos para usar en reportes académicos sobre jobs de Talend.

**Uso:** solo lectura; funciona sin Studio.

Argumentos principales:

- `jobName` (string, opcional): Nombre del job
- `section` (string, opcional): Sección del reporte
- `customText` (string, opcional): Texto personalizado para el snippet

#### `talend_safe_add_connection`

Añade una conexión entre dos componentes de forma segura.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `itemPath` (string, obligatorio): Ruta al archivo .item del job
- `propertiesPath` (string, obligatorio): Ruta al archivo .properties del job
- `sourceUniqueName` (string, obligatorio): UNIQUE_NAME del componente origen
- `targetUniqueName` (string, obligatorio): UNIQUE_NAME del componente destino
- `connectionType` (string, obligatorio): Tipo de conexión (FLOW, Main, etc)

#### `talend_safe_edit_component_parameter`

Edita un parámetro de componente de forma segura.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `itemPath` (string, obligatorio): Ruta al archivo .item
- `propertiesPath` (string, obligatorio): Ruta al archivo .properties
- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente
- `parameterName` (string, obligatorio): Nombre del parámetro
- `value` (string, obligatorio): Nuevo valor

#### `talend_safe_patch_component`

Aplica un patch multi-parámetro a un componente de forma segura.

**Uso:** escribe/ejecuta; requiere confirmacion; funciona sin Studio.

Argumentos principales:

- `itemPath` (string, obligatorio): Ruta al archivo .item del job
- `propertiesPath` (string, obligatorio): Ruta al archivo .properties del job
- `uniqueName` (string, obligatorio): UNIQUE_NAME del componente a patchear
- `patch` (object, obligatorio): Mapa de parámetros a actualizar

#### `talend_update_component_parameter`

Actualiza un parámetro de un componente Talend.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente
- `parameterName` (string, obligatorio): Nombre del parámetro
- `value` (string, obligatorio): Nuevo valor del parámetro

#### `talend_update_schema_column`

Actualiza una columna de schema de un componente Talend.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `jobName` (string, obligatorio): Nombre del job
- `folderPath` (string, opcional): Carpeta del job
- `uniqueName` (string, obligatorio): Nombre único del componente
- `schemaName` (string, obligatorio): Nombre del schema
- `columnName` (string, obligatorio): Nombre de la columna
- `patch` (object, obligatorio)

#### `talend_view_logs`

Muestra el contenido de un archivo de log con opción de filtrar y limitar líneas.

**Uso:** escribe/ejecuta; funciona sin Studio.

Argumentos principales:

- `logPath` (string, obligatorio): Ruta al archivo de log
- `maxLines` (number, opcional): Número máximo de líneas a mostrar
- `filter` (string, opcional): Filtrar líneas que contengan este texto
- `fromLine` (number, opcional): Empezar desde esta línea

