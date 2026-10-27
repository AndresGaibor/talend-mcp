# Solucion de problemas al probar componentes

Guia para el agente que ejecuta [el plan](README.md). Cada fila sale de un problema real que ya se resolvio en este
repositorio; el detalle tecnico esta en [../TALEND-STUDIO-INTERNALS.md](../TALEND-STUDIO-INTERNALS.md) y
[../plan-de-pruebas/04-reglas-de-componentes.md](../plan-de-pruebas/04-reglas-de-componentes.md).

## 1. Metodo general (si el problema no esta en las tablas)

1. **Lee el error completo**, no el resumen. `Resultado.avisos` y la columna `detalle` de `testdata/resultados-l5.csv`
   traen la lista entera. Con `L5_KEEP_JOBS=1` el job queda en Studio.
2. **Separa la fase que falla:** montaje (la API de Studio rechaza algo), generacion de codigo (Talend no puede),
   compilacion (`javac` falla), ejecucion (codigo de salida distinto de 0) o comprobacion (la salida no coincide).
3. **Mira el codigo generado.** Esta en
   `<workspace>/<proyecto>/poms/jobs/process/<job>_<version>/src/main/java/<proyecto>/<job>_<version>/<JOB>.java`.
   Casi todo error de compilacion se entiende leyendo la linea que senala `javac`.
4. **Compara con un job hecho a mano en Studio.** Montalo en el lienzo, guardalo y lee su `.item`
   (`talend_jobs_read`). La diferencia con tu escenario es el bug. Es el metodo que mas problemas ha resuelto.
5. **Reduce.** Quita nodos hasta que quede el minimo que falla. Un componente solo con un `tFixedFlowInput` delante.
6. **Busca en el codigo del bridge** con `codegraph_explore` el nombre del parametro o del error.
7. **Si es un bug del MCP o del bridge, arreglalo con test** y anotalo en `04-reglas-de-componentes.md`.

## 2. Montaje (la API de Studio rechaza o deja el job mal)

| Sintoma | Causa | Arreglo |
|---|---|---|
| El job queda con valores como `Main1100Main1` o tipos `id_Decimal` | El `.item` se escribio por fuera con parametros que el componente no tiene | Crear con la API (`talend_job_add_node`) o copiar el `.item` que guarda Studio; usar `talend_jobs_create_*` solo con parametros que existan en la definicion |
| `nombre cannot be resolved or is not a field` al compilar | El destino y el origen no declaran las mismas columnas, o la tabla de la conexion de entrada quedo vacia | Poner el schema del origen **despues de conectar** (`schemaDespuesDeConectar: true`); en `tNormalize` entrada y salida con los mismos nombres |
| `Index N out of bounds` en el lector | La tabla `REJECT` del origen heredo columnas del destino | El bridge la deja con `errorCode` y `errorMessage`; si persiste, rehacer el schema con `talend_job_set_schema` |
| Una comparacion de la plantilla no encaja (`TRUNCATE`, columna a normalizar) | Se guardo con comillas un parametro de lista | Los parametros `*_LIST` van sin comillas; los `TEXT` con comillas |
| El generador falla con `NumberFormatException: For input string: "Main1100Main1"` en `tLogRow` | Faltan `LENGTHS`, `PRINT_CONTENT_WITH_LOG4J` o `SCHEMA_OPT_NUM` | Ya los pone el generador de jobs; si montas a mano, anadelos |
| Una celda de tabla compila mal (`"$.a[*]"` sin comillas) | Las celdas con nombres van sin comillas y las demas como literales Java | Ver "Los valores de las celdas de tabla" en `04-reglas-de-componentes.md` |
| `tMap`, `tAggregateRow`, `tNormalize`, `tJavaRow` no sacan columnas | Su schema y modelo se aplican **al final**, despues de conectar | Aplicar `mapper` / `tablas` / `esquemas` tras `talend_job_connect_nodes` |
| `tAggregateRow` no agrega | Orden de las tablas del metadata: la de salida debe ir la primera; origen y salida con el mismo numero de columnas | Reglas 1 a 4 de `04-reglas-de-componentes.md` |
| `tFileList` no lista nada | `LIST_MODE` es `FILES/DIRECTORIES/BOTH`, no el orden | El orden va en `ORDER_BY_FILENAME` y `ORDER_ACTION_ASC`; sus valores salen del `globalMap` (`<nodo>_CURRENT_FILE`) |
| `tFileInputJSON` no devuelve filas | La raiz del bucle va en `JSON_LOOP_QUERY` (JSONPATH) y el mapeo en `MAPPING_JSONPATH` | Ver la seccion del `tFileInputJSON` en las reglas |
| El `tJavaRow` no compila con columnas enteras | `row.id != null` sobre un `int` no nulo | Usar columnas `String` o que admitan nulos |
| El job de BD no escribe nada y no da error | `AUTO_COMMIT=false` sin commit, o un `tXCommit` encolado dentro del bucle de filas | Conexion con `AUTO_COMMIT=true` y **sin** commit encolado a la salida del output (commit solo con `OnSubjobOk` desde el arranque del subjob) |
| `INSERT INTO t (null,null...)` | Falta el nombre de columna en BD | El bridge pone `setOriginalDbColumnName`; si creas columnas por otra via, ponlo |
| `column "null" does not exist` | Igual que arriba | Igual |
| `TABLE_ACTION` ignorado | Valor fuera de la lista cerrada (`DELETE` no existe) | `NONE`, `DROP_CREATE`, `CREATE`, `CREATE_IF_NOT_EXISTS`, `DROP_IF_NOT_EXISTS_AND_CREATE`, `CLEAR`, `TRUNCATE` |
| `MAPPING` incorrecto | Es el **id** del mapeo (`postgres_id`, `mysql_id`), no el nombre del motor | Sacarlo de la definicion o del `.item` de Studio |

## 3. Avisos de Studio (vista Problemas)

Todo aviso se **informa**. Solo se tolera si se entiende y se declara en `avisos_tolerados` con el texto exacto.

| Aviso | Causa | Estado |
|---|---|---|
| `the schema's dbType not correct for this component` | La columna tenia el tipo de Talend (`id_Integer`) donde va el tipo de BD | **Resuelto**: el bridge alinea el schema con el mapeo del nodo al guardar (`INT4`, `VARCHAR`...). Si reaparece con otro motor, comprobar que su parametro `MAPPING` tiene un id valido de `mappings/*.xml` |
| `A value must be set for Date Pattern` | Columna `id_Date` sin patron (incluidas las de los catchers) | **Resuelto**: el bridge pone `"yyyy-MM-dd HH:mm:ss"` al guardar |
| `should have outputs linked` | Un nodo que solo lee para sus disparadores (`NB_LINE`) | Esperado en conciliacion, `tAssert`, `tParallelize`; tolerar con motivo |
| `This component has too much "Row" type outputs` (`tPrejob`) | Un `tPrejob` con mas de una salida de fila | Tolerado en el escenario del `tPrejob` |
| `the schema from the input link is different` (`tDuplicateRow`, `tStandardizePhoneNumber`) | Schema de salida distinto al de entrada | Tolerado con motivo |
| `Could not find the context Default` (stderr) | Job sin variables de contexto lanzado con `--context=Default` | **Resuelto** en `JobExecutor` (no se pasa `--context` si no hay `Default.properties`) |

## 4. Compilacion y librerias

| Sintoma | Causa | Arreglo |
|---|---|---|
| `package org.jboss.marshalling does not exist` | El classpath de un item escrito por fichero no traia `jboss-marshalling` | Ya se anade en `JobBuilder`; si falla otro paquete, ver la lista de imports del `.java` y su jar en el `.m2` |
| `package routines does not exist` | Faltan `system-routines.jar` / `routines.jar` | Ya se anaden desde el `.m2` de Studio |
| `The import X cannot be resolved` (driver JDBC, SDK) | Falta una libreria del componente | `talend_job_compile` con `installMissing: true`; o `talend_studio_install_artifact` con las coordenadas Maven de la definicion (`imports` de `talend_components_definition`) |
| `components-jdbc-runtime` no se encuentra | Los componentes JDBC de generacion nueva no estan en repositorios publicos | Instalar el jar con `talend_studio_install_artifact` y `file` (si lo tiene la persona) o construir un sustituto del modulo (peldano 6 de EMULADORES.md). Mientras tanto el escenario va `pendiente` con el motivo |
| Studio muestra un dialogo "Network Issue" y el hilo no responde | La descarga de una libreria quedo bloqueada | `talend_studio_ui_dialogs` para cerrarlo; no forzar el cierre de Studio sin avisar |
| El build de Maven tarda 7-10 s por job | Se genero con Maven en vez de `javac` | Usar `talend_job_build_batch` / `build` (genera sin Maven y compila con `javac`); los jobs auxiliares (`tRunJob` hijos) usan Maven |
| El proyecto "stale" rompe todos los builds | Un job auxiliar dejo su carpeta en `poms/jobs/process/` sin item | Borrar la carpeta residual; no borrar jobs auxiliares dentro de una corrida |

## 5. Ejecucion

| Sintoma | Causa | Arreglo |
|---|---|---|
| `InaccessibleObjectException` (`MethodHandles$Lookup`) en AWS | Java 21 sin `--add-opens` | `JobExecutor` ya pasa `--add-opens java.base/java.lang=ALL-UNNAMED` y `java.lang.invoke` |
| Codigo de salida 1 sin salida | La causa esta en stderr | El arnes ya la muestra; mira `stderr` completo |
| El job no termina a tiempo | Studio sin memoria o un dialogo abierto | Reiniciar Studio (`--reiniciar-studio`), `talend_studio_ui_dialogs` |
| `Status Code: 100` al subir a S3 local | `Expect: 100-continue` no soportado por el emulador (moto) | Cambiar a LocalStack o MinIO para ese caso (EMULADORES.md, seccion 3) |
| `NumberFormatException` leyendo atributos de SQS | El emulador devuelve un atributo con decimales | Igual: LocalStack, que devuelve enteros |
| El job de FTP no lista/baja | Modo pasivo: el contenedor FTP debe publicar `30000-30009` | Ver `testdata/docker-compose.yml` |
| Dos casos se ensucian entre si | Datos o tablas compartidas | Que cada escenario cree y borre lo que usa (nodo de creacion + `SUBJOB_OK`) |

## 6. Memoria y rendimiento de Studio

- Studio retiene ~13 MB por job abierto en un editor (mas de 180 editores quedan vivos tras cerrarlos). La corrida
  completa se para al 80 % del heap y pide reiniciar.
- **Usa `--reiniciar-studio`** en corridas largas: cierra sin forzar, reabre, espera al bridge y reinstala el plugin
  (~70 s).
- Para medir compilacion de **muchos** componentes no abras editores: usa el metodo offline y `build-batch`
  (no crece la memoria). Ver README, seccion 5.2.
- Si Studio lleva tiempo sin responder, **no lo mates**: pregunta a la persona. Cerrar con `CloseMainWindow` es lo unico
  aceptado sin permiso.
- No publiques el bridge (`bridge:install`) mientras corre una corrida: la recarga la rompe.

## 7. Cuando "no puedo ejecutarlo": antes de rendirte

Regla del plan: **nada se queda sin probar**. Un componente que no ejecuta no esta terminado. Recorre
[la escalera de emulacion](EMULADORES.md) y registra el peldano usado.

| Situacion | Que hacer |
|---|---|
| El producto es propietario o de pago (Teradata, Netezza, Sybase, AS400, SAP HANA) | Peldano 4: **driver shim** hacia Postgres/H2; el codigo generado real corre. Anotar que el dialecto no se valida |
| No hay imagen oficial pero si protocolo compatible (Greenplum, Redshift, Aurora, Vertica) | Peldano 2: probar contra Postgres/MySQL; anotar el sustituto |
| El componente usa una API de pago (Salesforce, ServiceNow, Dropbox, Box, CRM) | Peldano 5: servidor falso con respuestas grabadas; si el SDK fija la URL, proxy + truststore de prueba |
| Lo que falta es un programa externo (`sqlldr`, `bcp`, `FastLoad`, `gpload`) | Script falso con el mismo nombre en el `PATH` que valida argumentos y carga el fichero |
| Usa un SDK nativo (SAP JCo) | Peldano 6: doble de la libreria con las clases que usa el codigo generado |
| Es de interfaz (`tMsgBox`) | Ejecutar con escritorio y cerrar el dialogo desde el propio job (`Robot`); documentar el caso sin escritorio |
| Compila pero el emulador se comporta distinto del real (`Status 100`, decimales en SQS) | Cambiar de emulador (LocalStack / MinIO) antes de marcar nada |
| Falla por un bug del MCP o del bridge | Arreglarlo con test; un bug propio nunca justifica una excepcion |
| Se agotaron todos los peldanos | **X**: fila en `EXCEPCIONES.md` y avisar. La persona decide; el agente no cierra excepciones |
