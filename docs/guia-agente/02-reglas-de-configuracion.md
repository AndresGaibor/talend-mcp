# Reglas de configuracion que hacen fallar jobs

[Volver al indice](../GUIA-AGENTE.md)

## 4. Reglas de configuracion que hacen fallar jobs (leerlas antes de configurar)

- **Los valores de texto son literales Java.** Una ruta va entre comillas (`"C:/datos/a.csv"`) o el
  codigo generado no compila. El bridge entrecomilla solo lo que no es numero, booleano ni ya
  viene entre comillas; usa `literal: true` en el parametro para forzarlo.
- **`HEADER` de `tFileInputDelimited` es un numero** (lineas de cabecera, `"1"`), no un booleano.
- **Tipos de columna validos:** `id_String`, `id_Integer`, `id_Long`, `id_Double`, `id_BigDecimal`,
  `id_Boolean`, `id_Date` (y alias que normaliza el bridge). `id_Decimal` **no existe**: es
  `id_BigDecimal`.
- **Sin schema no hay columnas.** Un nodo sin schema no propaga columnas y el codigo generado sale
  mal (`... cannot be resolved to a variable`). Define el schema del origen antes de conectar.
- **`tLogRow` hereda el schema** del componente que le manda el flujo; no se lo pongas a mano.
- **`tMap`:** el nombre de cada tabla del modelo es el de **su conexion**, y el modelo se aplica
  **al final** (despues de crear y conectar), porque al conectar Talend rehace sus tablas.
- **Conexiones:** el tipo de conexion es el **conector** del componente (`FLOW`, `UNIQUE`, `REJECT`,
  `ITERATE`...), no un texto libre: el `tUniqRow` saca sus filas por `UNIQUE`, y conectar por `FLOW`
  compila pero no sale ninguna fila. `talend_job_connect_nodes` lo comprueba antes de conectar y avisa
  del conector que toca. El **nombre** de la conexion lo pone el bridge (`row1`, `row2`...), y es el que
  usan las tablas de los componentes (`row1.monto`). Ver INTERNALS 32.
- **Triggers (`SUBJOB_OK`, `COMPONENT_OK`, `RUN_IF`...): dibujalos desde el PRIMER componente del subjob.**
  Studio solo genera la llamada al destino cuando la conexion sale del arranque del subjob; si sale de un
  componente de en medio (un `tDBOutput`, un `tLogRow`), la conexion se guarda, el job compila y el destino
  **no se ejecuta nunca**, sin ningun error. La llamada se emite al final del subjob, asi que para un commit
  explicito el `tDBCommit` se cuelga del `tFixedFlowInput`, no del `tDBOutput`. El bridge devuelve un aviso
  cuando detecta el caso. Ver INTERNALS 53.
- **El destino de un trigger tambien tiene que poder arrancar subjob.** Un trigger no puede apuntar a un
  `tDBOutput`, un `tFileOutputDelimited` ni un `tLogRow` (necesitan entrada): Studio rechaza la conexion.
  `talend_job_connect_nodes` falla con el motivo en vez de responder `ok`. Si el manejador tiene que escribir,
  cuelga el trigger de un `tFixedFlowInput` y pon el `tFileOutputDelimited` debajo, en su subjob.
- **Un trigger de error necesita un fallo que lance**: con un `tDie` el manejador corre; con un
  `tFileInputDelimited` que apunta a un fichero inexistente, no (el job registra `[ERROR]` y termina con
  codigo 0).
- **`tPrejob` y `tPostjob` solo tienen conector `COMPONENT_OK`**, no `FLOW`: se cuelgan con `OnComponentOk` del
  `tFixedFlowInput` que arranca su subjob. El orden de ejecucion es prejob, subjobs normales, postjob.
- **El fichero de salida**: si el escenario lo comprueba, el arnes lo borra antes de relanzar; aun asi, el primer
  `tFileOutputDelimited` que escribe con `APPEND=false` va con `FILE_EXIST_EXCEPTION=false` (el Run de Studio ya
  lo ha escrito antes).
- **No ejecutar un job mientras Studio lo esta compilando**: Studio carga el job en su JVM y deja el
  `classpath.jar` bloqueado; el build siguiente falla al borrarlo y la carpeta se queda sin codigo (INTERNALS 55).
- **Parametros que el catalogo no declara** (p. ej. `FILENAME` de `tFileOutputDelimited`): el bridge
  los crea con el tipo indicado o deducido.
- **Los parametros de lista van sin comillas.** Un parametro cuyo tipo acaba en `_LIST` (el
  `TABLE_ACTION` de un `tDBOutput`, la columna a normalizar de un `tNormalize`...) se escribe como el
  IDE: `value="TRUNCATE"`, sin comillas. Con comillas el valor es `"TRUNCATE"` y la accion de tabla no
  se ejecuta, sin ningun error visible. Ver INTERNALS 44.
- **Las celdas de una tabla: los nombres sin comillas.** En las tablas de metadata (`GROUPBYS`,
  `OPERATIONS`, `CONDITIONS`, `CRITERIA`, `MAPPING_JSONPATH`...) el IDE entrecomilla los literales y deja
  sin comillas los nombres: `SCHEMA_COLUMN`, `COLNAME`, `INPUT_COLUMN`, `OUTPUT_COLUMN`, `FUNCTION`,
  `OPERATOR`, `SORT`, `ORDER`, `KEY_ATTRIBUTE`, `CASE_SENSITIVE`, `PARAMETER_NAME` y `TARGET_COLUMN`.
  Los demas valores van como literales Java (con comillas), como hace el IDE. Asi la consulta JSONPath
  de un `tFileInputJSON` sale como `"$.clientes[*].id"` y compila. Ver INTERNALS 46.
- **El nombre de la columna en la base de datos** se pone con `setOriginalDbColumnName` (no hay
  `setColumnName`). Sin eso, el `tDBOutput` genera el `INSERT` con los nombres a `null` y el Postgres
  lo rechaza con `column "null" does not exist`. Ver INTERNALS 43.
- **Escribir en una base de datos:** la conexion va con `AUTO_COMMIT=true` y **no** se encola un
  componente de commit: el `tDBOutput` escribe el lote al final y, sin commit, al cerrar la conexion
  se pierde todo. Un commit encolado se ejecuta dentro del bucle de filas y rompe el lote. Ver INTERNALS 45.
- **Las listas cerradas van con su `VALUE`, no con el nombre.** `TABLE_ACTION` coincide (`TRUNCATE`), pero
  `PRIORITY` del `tWarn` no: hay que poner `"4"` (WARNING), no `"WARNING"`. Con el nombre, el valor se cuela
  como identificador en el codigo generado y el job no compila (`WARNING cannot be resolved to a variable`).
  Ver INTERNALS 57.
- **El `tFileList` no emite filas.** Su conector `FLOW` es `MAX_OUTPUT=0`: lo que deja son valores en el
  `globalMap` (`<uniqueName>_CURRENT_FILE`, `_CURRENT_FILEPATH`, ...). Para consumirlos, un `tJavaRow`
  los lee del `globalMap`. Y su `LIST_MODE` es el **tipo de listado** (`FILES`, `DIRECTORIES`, `BOTH`),
  no el orden: con `"ASC"` ahi no lista nada. Ver INTERNALS 47.
- **El `tFileInputJSON`** con `READ_BY=JSONPATH` lleva la raiz del bucle en `JSON_LOOP_QUERY` y el
  mapeo en la tabla `MAPPING_JSONPATH`. Ver INTERNALS 48.
- **El `tNormalize`** copia las columnas de la salida desde las de la entrada **por su nombre**: la
  entrada y la salida tienen que declarar las mismas columnas. La columna a partir va en
  `NORMALIZE_COLUMN` y el separador en `ITEMSEPARATOR`. Ver INTERNALS 49.
- **El `tJavaRow`** inserta el codigo tal cual, con `input_row` y `output_row` sustituidos por el nombre
  de las conexiones. Ojo: una columna entera que no admita nulos hace que el codigo generado use
  `row.id != null` sobre un `int`, y eso no compila. Ver INTERNALS 50.
- Detalle y justificacion en [TALEND-STUDIO-INTERNALS.md](../TALEND-STUDIO-INTERNALS.md) seccion 18.
