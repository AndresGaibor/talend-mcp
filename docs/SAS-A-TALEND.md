# Del flujo SAS al flujo Talend: qué debe poder hacer el MCP

Fuente: transcripción `SAS_y_flujo_transcripcion.md` (video `VID_20261023_143320`), que describe
cómo trabaja el equipo funcional con SAS Studio, SAS Grid, la LZ en Cloudera, el bucket S3 y
GoAnywhere MFT.

Este documento contrasta cada capacidad que muestra la transcripción con lo que el MCP puede
hacer hoy. El estado se toma del código y de las mediciones, no de la intención:

- Escenarios L5 (el job corre y la salida coincide): `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json`.
  Último run completo: **72 de 76 correctos**. Los cuatro fallos son de SQS y DynamoDB sobre Moto con Java 21,
  ya conocidos (PLAN-DE-PRUEBAS, fila 13). Informe: `testdata/resultados-l5.csv`.
- Niveles L1 a L4 (crear, configurar, conectar, compilar): `testdata/cobertura*.csv`.
- Huecos ya reconocidos: [ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md).

Niveles, según [ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md) sección 0: L1 crear, L2
configurar, L3 conectar, L4 compilar, L5 ejecutar con salida verificada.

## 1. Resumen

**Lo que el MCP ya hace y está verificado a L5:**

- Leer y escribir archivos: CSV, JSON, ancho fijo, XML, XLS y XLSX (lectura), y expresiones regulares.
- Postgres: leer, insertar, actualizar, borrar, upsert, commit explícito, rollback y recrear tabla.
- Transformar: filtrar, quitar duplicados, unir, agregar, `tMap`, `tJoin`, `tNormalize`,
  `tDenormalize`, `tReplicate`, `tRowGenerator`, `tJavaFlex`.
- Control de flujo: `tDie`, `tWarn`, `tLogCatcher`, trigger de error, reintento con `tSleep`,
  `tPrejob`/`tPostjob`, `tRunJob` padre-hijo, contextos por entorno, variables globales, convertir
  filas en iteraciones y cronometrar una espera.
- Conciliar origen y destino: conteo de filas (`NB_LINE`) y comparación de ficheros (`tFileCompare`),
  con fallo si no coinciden.
- Repetir una carga en bucle acumulando filas en un fichero: 15 vueltas de 500 mil filas en 9,6 s.
- S3 contra un emulador local (Moto): crear bucket, subir, bajar, listar por prefijo, comprobar,
  copiar, borrar objeto y borrar bucket.
- Build Job: `talend_deliverables_build_job` construye un zip autónomo del job. Su launcher corre sin
  Studio, con parámetros de contexto (`--context_param`), y `talend_runs_start_exported` lo ejecuta.
- Correos de inicio, fin OK y fin con error (`tSendMail`), entregados a un sumidero SMTP local.

**Lo que aún no puede hacer y el caso SAS lo necesita:**

1. Dejar un job programado y desatendido (cinco ejecuciones al día, semanal, mensual, trimestral).
   El Build Job ya existe; falta el programador (decisión del equipo) y la API de TMC no está conectada.
2. Avisar por correo a un SMTP real. Los tres correos están validados contra un sumidero local; falta
   probar el servidor de correo de ustedes.
3. Probar Hive, Impala y la carga masiva a la LZ. El cluster de Cloudera no está disponible aquí.
4. Esperar a que aparezca un archivo (`tWaitForFile`) y reintentar con ese criterio. El reintento
   tras un fallo sí está a L5; la espera a un archivo, no.
5. Macros reutilizables. Los joblets no están creados (ROADMAP P1).
6. Gobierno de metadata: conexiones de base de datos compartidas y schemas de archivo del
   repositorio (ROADMAP P0 fila 8 y P1).

## 2. Mapa de capacidades SAS a Talend

| # | Capacidad en SAS (transcripción) | Equivalente Talend | Estado en talend-mcp | Brecha |
|---|---|---|---|---|
| 1 | Leer y escribir datasets de librerías permanentes (`.sas7bdat`, gobernadas en metadata) | Tablas Hive o Impala en la LZ; base relacional; archivos; repositorio | Postgres a L5. Hive: `tHiveInput` y `tHiveLoad` compilan (L4), `tHiveRow` compila en una medición y falla en otra. Impala: solo L1/L2 | Sin cluster para L5. Conexiones compartidas no creables |
| 2 | Dataset temporal en `WORK` (intermedio que no se guarda) | `tHashOutput` / `tHashInput`, o flujo entre subjobs | `tHashOutput` compila (L4). `tHashInput` dio error de compilación en una medición. Sin L5 | Escenario L5 |
| 3 | Borrar la tabla si existe y regenerarla desde cero | `TABLE_ACTION` `DROP_IF_EXISTS_AND_CREATE` del componente de salida | **L5** (`bd/recrear-la-tabla-en-cada-ejecucion`). `DROP_CREATE` emite un `DROP TABLE` sin `IF EXISTS` y falla si la tabla no existe (sección 7) | Ninguna para Postgres |
| 4 | Filtros, conteos y agregados (`PROC SQL`, `SELECT COUNT`) | `tFilterRow`, `tAggregateRow`, `tDBInput` con SQL | L5 | Dialecto Hive o Impala sin probar |
| 5 | Cruces y homologación de tablas | `tMap`, `tJoin` | L5 | Ninguna para el caso local |
| 6 | Generar un dataset grande duplicándolo 15 veces con `append` (478 filas a 14 M, 2 GB) | `tFlowToIterate` + `tRunJob` por vuelta, con salida delimitada en modo append | **L5** con 15 vueltas de 500 mil filas (7,5 M filas, 417 MB): **9,6 s** por run, medido con `tChronometerStop`. Con 3 vueltas, 1,5 M filas en 1,8 s | El volumen SAS (14 M, 2 GB) no se ha probado. Un `tRowGenerator` dentro de un job hijo no genera (sección 7) |
| 7 | Verificar que lo escrito en la LZ coincide con el origen (campos y registros); fallar si no | `NB_LINE` de la entrada y la salida, `tFileCompare`, y un `tJava` que falla si no coincide | **L5**, dos escenarios: conciliación que pasa (4 filas, ficheros idénticos) y una que falla a propósito (el destino pierde filas) | Hoy se prueba con ficheros; falta con tablas de Postgres o Hive |
| 8 | Medir duración (`sys timer`, "el nodo calcula la diferencia") | `tChronometerStart` / `tChronometerStop` | **L5** (`control/cronometro-mide-una-espera`): imprime `1006 milliseconds` para una espera de 1 s | Ninguna |
| 9 | Paralelismo: dividir el dataset en partes y escribirlas en paralelo ("split 3") | `tParallelize` + `tFlowToIterate` / `tRunJob` | `tParallelize` compila (L4). Sin L5 | Escenario L5 y control de concurrencia |
| 10 | Carga masiva a la LZ ("wait for bulkload") | `tHiveLoad`, `tImpalaLoad`, o `tHDFSPut` + `LOAD DATA` | `tHiveLoad` y `tHDFSPut` compilan (L4). `tImpalaLoad` solo L1/L2 | Cluster Cloudera para L5 |
| 11 | Exportar un dataset a S3 en CSV | `tFileOutputDelimited` + `tS3Put` | `tS3Put` a L5, contra Moto, no contra S3 real | Validar con S3 real (credenciales y permisos de ustedes) |
| 12 | Importar desde S3 y listar los directorios del bucket | `S3List` (sin `t`, así aparece en el catálogo de Studio) con tabla de buckets y `ITERATE` | **L5** (`aws/listar-los-objetos-de-un-prefijo-en-s3-local`): lista solo el prefijo `l5/listado/` y no el objeto de otro prefijo | Contra S3 real, sin validar (IAM) |
| 13 | Reintentar si el archivo está "en uso" o hay un bloqueo | `tRunJob` + trigger `SUBJOB_ERROR` + `tSleep` + segundo `tRunJob` | **L5** (`control/reintento-tras-un-fallo-con-espera`): el primer intento falla con "archivo en uso" y el segundo sale bien | Esperar a un archivo que aparece (`tWaitForFile`) sin probar |
| 14 | Elegir el nodo activo entre dos de la LZ (el otro está en standby) | Contexto por entorno + `tJava` que prueba la conexión | `tContextLoad` tiene escenario **L5** (`contextos/cada-entorno-tiene-su-valor`) y pasa. La medición L4 que lo daba por roto es antigua | Elegir entre dos conexiones reales (activa y standby) |
| 15 | Correo al terminar: tres correos (inicio, OK, error) | `tSendMail` en `SUBJOB_OK` / `SUBJOB_ERROR` | **L5** contra un sumidero SMTP local (`scripts/l5/smtp-sink.ts`): `control/correo-de-inicio-y-fin` y `control/correo-de-error`. Hay que fijar `CC` y `BCC` (sección 7) | Un SMTP real de ustedes, sin probar |
| 16 | Calendarizar (cinco veces al día, semanal, mensual, trimestral) | Scheduler de TMC, o el programador del sistema con un Build Job | **Build Job** construido y ejecutado fuera de Studio: `talend_deliverables_build_job` + `talend_runs_start_exported` con `--context_param`. No hay programador ni API de TMC | Programador decidido: TMC. Falta publicar el artefacto y programar por API (Fase B, punto 10) |
| 17 | Limpieza trimestral de datos permanentes | Job con `tFileDelete`, `tS3Delete` o `DELETE`, programado | `tS3Delete` a L5. `tFileDelete` compila (L4) | Depende de la fila 16 |
| 18 | Macros reutilizables con parámetros (`%MACRO`, `%DO`, nombres generados) | Joblets con parámetros + contextos + `tRunJob` con parámetros | Contextos y padre-hijo a L5. Joblets sin crear (ROADMAP P1) | Crear y usar joblets |
| 19 | Importar Excel, validar y homologar (proyecto "Información exógena") | `tFileInputExcel` + `tSchemaComplianceCheck` | XLS 97-2003 a L5. **XLSX a L5** (`formatos/leer-productos-desde-un-xlsx`) tras instalar las dependencias de POI en el repositorio de Studio (sección 7) | `tSchemaComplianceCheck` sin probar |
| 20 | Errores de ejecución y su diagnóstico ("Error 1, filen…" de Cloudera) | `tDie`, `tWarn`, `tLogCatcher`, `OnComponentError`, logs | `tDie`, `tWarn`, `tLogCatcher` a L5. Herramientas `talend_errors_explain` y `talend_runs_collect_logs` | El mensaje exacto de Cloudera no se puede reproducir sin el cluster |
| 21 | "Generar código" para ver el programa (2 902 líneas en el proyecto de prueba) | Compilar el job (genera Java) | `talend_job_compile` verifica que el código generado compila | No hay vista para revisar el código generado. Por confirmar si hace falta |
| 22 | Inventario y uso (7 000 proyectos, 3 000 usados el último año) | Inventario de jobs y su historial de ejecución | `talend_jobs_list`, `talend_runs_list` (historial local) | El uso real vendría de TMC, no conectado |
| 23 | Estructuras de usuario con gobierno, entregadas a Tecnología | Repositorio: contextos, metadata, joblets, routines | `talend_list_repository_contexts`, `talend_list_repository_connections` (solo nombre y tipo) | Leer y crear conexiones y schemas de archivo del repositorio |

Fuera del alcance del MCP: GoAnywhere MFT (transferencia de archivos por usuarios), Hue (consulta
interactiva) y SSO de esos accesos.

## 3. Brechas que no son componentes

Son huecos del MCP, no de un componente de Talend:

- **Build Job.** Resuelto en la Fase B. `talend_deliverables_build_job` usa `BuildJobManager` de
  Studio (sección 64 de INTERNALS). `talend_deliverables_export_job` sigue empaquetando solo los
  `.item`, que es otra cosa. El build deja el launcher donde lo busca `talend_runs_start_exported`
  (`TALEND_BUILDS_DIR/<job>/`).
- **Programación.** No hay ninguna tool para programar ejecuciones. Las coincidencias de "cron"
  en el código son falsos positivos de "sincronización". El programador lanza el `.bat` o el `.sh`
  del build, con Java en el PATH (sección 65 de INTERNALS).
- **Resultado estructurado de cada ejecución.** `talend_runs_start` acepta contexto, timeout y
  `params`, pero no devuelve contadores de filas. Hoy los conteos salen de la salida del propio job
  (`NB_LINE` impreso con `tJava`), no de una tool. Los parámetros de `talend_runs_start_exported`
  ahora llegan al job como `--context_param` (en la Fase B se corrigió: antes se ignoraban).
- **Allowlist del migrador.** `migrador-sasgrid-qlik/src/sas_grid_migrator/talend_adapter/policy.py`
  solo permite 22 tools de lectura y una de escritura (`talend_job_apply_custom_spec`). Cada tool
  nueva que el migrador deba usar hay que añadirla ahí.
- **Patrones de pipeline.** `talend_jobs_preview_pipeline_spec` ofrece seis patrones (carga de CSV
  a base de datos, copia entre bases, orquestación SQL, etc.). Ninguno cubre conciliación,
  notificación por correo, reintento, recrear tabla ni duplicación de datos. Son candidatos
  naturales a nuevos patrones.

El formato `talend_job_apply_custom_spec` sí admite lo necesario para escribir esos patrones:
componentes con parámetros, tablas, schema, conexiones con conector (incluidos los triggers) y
`childJobs`. Los escenarios de la Fase A ya lo demuestran a L5 con los mismos componentes.

## 4. Propuesta por fases

### Fase A: verificable en local (Postgres, CSV y el emulador S3). Hecha

Cada punto tiene su escenario L5 en verde en el último run completo.

1. **Conciliación de conteos y campos** (filas 7 y 8): `conciliacion/el-destino-tiene-las-mismas-filas-y-campos-que-el-origen`
   y `conciliacion/el-destino-pierde-filas-y-la-conciliacion-falla`. El segundo espera el error.
2. **Reintento tras un fallo** (fila 13): `control/reintento-tras-un-fallo-con-espera`. No cubre
   `tWaitForFile`: el reintento es por error del intento anterior, no por espera a un archivo.
3. **Recrear tabla** (fila 3): `bd/recrear-la-tabla-en-cada-ejecucion`, con `DROP_IF_EXISTS_AND_CREATE`.
4. **Cronómetro** (fila 8): `control/cronometro-mide-una-espera`.
5. **Listado de S3** (fila 12): `aws/listar-los-objetos-de-un-prefijo-en-s3-local`.
6. **Dataset por duplicación** (fila 6): `transformaciones/15-vueltas-de-500-mil-filas-acumuladas-en-un-fichero`.
   Medido: 15 vueltas, 7,5 M filas, 9,6 s por run. Escala casi lineal con el volumen (3 vueltas,
   1,5 M filas, 1,8 s). El volumen SAS (14 M, 2 GB) no se ha probado.
7. **XLSX** (fila 19): `formatos/leer-productos-desde-un-xlsx`. Pasa tras instalar `poi-ooxml`,
   `poi-ooxml-lite` y `poi-scratchpad` 5.4.1, `xmlbeans` 5.3.0 y `curvesapi` 1.08 desde Maven Central.
8. **`tContextLoad`** (fila 14): ya tenía escenario y pasa. No hacía falta investigarlo.

### Fase B: build y programación. 9 y 11 hechas; 10 pendiente de decisión

9. **Build Job** (fila 16). **Hecho.** `BuildJobManager.buildJob` (INTERNALS 64) se expone en el bridge
   (`/automation/build-job`) y en la tool `talend_deliverables_build_job`. Verificado: el zip (5,7 MB,
   38 entradas) se construye en 8 a 13 s, su launcher corre fuera de Studio con código 0 y
   `talend_runs_start_exported` lo ejecuta. Con `--context_param L5_PARAM=desde-mcp` el job imprime
   `parametro: desde-mcp` (escenario `contextos/parametro-de-contexto-llega-al-job`).
10. **Programar en TMC** (fila 16). **Decidido: el programador es TMC.** Lo que documenta Talend Cloud
    (guía local de la skill `qlik-talend-cloud`):
    - *Publicar el artefacto.* Desde Studio: clic derecho en el job, **Publish to Cloud**, elegir space. Crea
      la tarea automáticamente con el mismo nombre. El nombre no puede contener `SNAPSHOT` ni repetir una
      tarea del space. Requiere el rol Operator y el permiso *Publish: Publish artifacts*. Otras vías: Maven
      (perfil `cloud-publisher`) o Talend CommandLine. No hay endpoint público documentado para subir el zip.
    - *Programar.* En la UI, un plan con triggers Cron o semanal. Por API: `POST /orchestration/schedules`
      con triggers `ONCE`, `DAY_OF_WEEK` o `CRON`, y luego `PUT /orchestration/executables/tasks/{taskId}/schedule`
      con `{"scheduleId": ...}`. Intervalo mínimo de 5 min, un schedule por tarea.
    - *Ejecutar ya.* `POST /processing/executions` con `{"executable": taskId, "logLevel": "WARN"}`.
    - *Autenticación.* Token de cuenta de servicio (`POST /security/oauth/token`, caduca a los 30 min) o token
      personal como `Bearer`. La cuenta necesita TMC_OPERATOR (o TMC_ENGINE_USE) y Operator (Execute) en el space.
    - *Qué falta para implementarlo:* región y environment, space, nombre del Remote Engine, cuenta de servicio,
      y decidir cómo llega el artefacto a TMC (ver sección 5).
11. **Resumen de ejecución** (fila 15). **Hecho contra un sumidero local.** Tres correos: inicio, fin OK
    y fin con error (`control/correo-de-inicio-y-fin`, `control/correo-de-error`). El sumidero es
    `scripts/l5/smtp-sink.ts`: hay que levantarlo antes de correr esos escenarios. Falta probar el SMTP
    real de ustedes y el contador de filas en el correo.

### Fase C: requiere acceso de ustedes

12. **Hive, Impala y carga masiva** (filas 1 y 10): validar a L5 contra el cluster de Cloudera
    (o un Hive local, si existe). Requiere host, puerto, usuario y forma de autenticación.
13. **TMC** (fila 16): conectar la API para publicar y programar. Requiere credenciales.
14. **Repositorio** (fila 23): crear conexiones de base de datos compartidas y schemas de archivo.
    Hoy no se ha encontrado la clase del modelo en Talend 8 (ROADMAP P0 fila 8).
15. **Joblets** (fila 18): crear y reutilizar joblets para las macros.

## 5. Datos de la transcripción que hay que confirmar

La propia transcripción marca varias dudas. Conviene resolverlas antes de implementar:

- **LZ o LSZ.** Aparecen las dos siglas. El documento usa LZ.
- **Formato de exportación a S3.** Se dice "cvxtxml o xlsx", pero el ejercicio usó CSV.
- **Duración de la escritura.** Se mencionan 1 min 43 s y 113 s. Son 103 s y 113 s, no lo mismo.
- **Nombre de la tabla.** "Cards" (probablemente `CARS`) y 17 o 15 columnas.
- **"Euse, entuser, compute".** No se identifica el término. Puede ser un tipo de estructura
  de usuario (joblet, rutina o contexto); confirmar con el equipo.
- **Quién envía los tres correos.** Si lo hace el propio programa o el programador de la malla.
- **Programador de la malla.** Resuelto: será TMC (dicho por el usuario el 2026-10-26).

## 6. Recomendación

La Fase A está cerrada a L5 en local: cubre las filas 3, 6, 7, 8, 12, 13 y 19, y confirma la 14.
La Fase B está hecha salvo el programador: el Build Job ya se construye y ejecuta fuera de Studio, y
los tres correos están validados contra un sumidero local. Lo que sigue depende de ustedes:

- **Qué programador usa el equipo** (sección 5). Con eso se genera la entrada del programador (Fase B,
  punto 10). Sin esa respuesta no tiene sentido escribir esa entrega.
- La Fase C necesita el cluster de Cloudera, credenciales de TMC y un servidor SMTP de prueba.

## 7. Hallazgos de Studio y del harness durante la Fase A

Son trampas reales, no están en el roadmap. Cada una afecta a cómo se escribe un escenario:

- **`DROP_CREATE` no es idempotente.** Talend genera `DROP TABLE <t>` sin `IF EXISTS` y, para
  columnas de texto sin longitud, `CREATE TABLE ... VARCHAR(-1)`, que Postgres rechaza. Para
  recrear una tabla usar `DROP_IF_EXISTS_AND_CREATE` y dar `length` a las columnas de texto
  (`length` ya lo admite el bridge en `SchemaOperations.java`).
- **Cada job corre dos veces en el harness.** `compilarEnStudio` lanza el Run de Studio sin esperar
  (`runActiveJob`, `waitForTermination: false`) y después `executeJob` lo vuelve a ejecutar. Los
  efectos de escritura se duplican. En un job de ~40 s, el fichero de salida recibió las dos
  escrituras (3 000 000 de líneas en vez de 1 500 000). Por eso el escenario de rendimiento no
  verifica el fichero: cada run imprime sus filas escritas (`NB_LINE`) con un `tJava`.
- **`tRowGenerator` dentro de un job hijo no genera el valor.** El método del randomizer sale
  `return ;`, que no compila. La tabla `VALUES` sí está en el `.item` del hijo (`"Ana"`), y el mismo
  generador como job principal produce `"Ana"`. No es `NB_ROWS` (fallan con 1000 y con 3) ni la
  salida (con `tLogRow` también falla). No está resuelto: el escenario de rendimiento lee
  `clientes_grande.csv` en el hijo para evitarlo.
- **`CreateBucket` repetido.** Con `dieOnError=false`, el segundo intento deja trazas de error del SDK
  de AWS en la salida. El job termina con código 0 y el escenario pasa; la aserción no debe contar líneas.
- **Compilación del bridge desde HEAD.** `RepositoryConnections.java` no compilaba (una lambda capturaba
  `connectionType`, que no es efectivamente final; commit `fb76859`). `bun run scripts/start.ts --install-bridge`
  fallaba. Corregido copiando el valor a una variable final.
- **Artefactos de POI.** Studio 8.0.1 trae `poi-5.4.1` en sus plugins, pero el build es offline y
  necesita los artefactos en su `.m2`. Se instalan con `/automation/artifacts/install` (sección 4, punto 7).

Fase B, con su detalle en INTERNALS 64 a 66:

- **El launcher del build no lee variables de entorno.** El runner pasaba `TALEND_PARAM_*`, que se
  ignoraba sin avisar. Corregido: los parámetros van como `--context_param clave=valor`.
- **El launcher necesita `java` en el PATH.** Sin él sale con código 1. `TALEND_JAVA_HOME` lo resuelve
  en el runner.
- **`tSendMail` envía copias a `carbon@example.com` y `blindcarbon@example.com`** si no se fijan `CC` y
  `BCC`. Los escenarios `control/correo-*` los dejan vacíos.
