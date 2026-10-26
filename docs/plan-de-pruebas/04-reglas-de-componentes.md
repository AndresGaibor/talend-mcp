# Reglas para configurar un componente

[Volver al indice](../PLAN-DE-PRUEBAS.md)

## Reglas para configurar un componente

Las reglas que hacen que un job compile y se ejecute. Salen de los casos que ya estan resueltos; el detalle de cada
una esta en [TALEND-STUDIO-INTERNALS.md](../TALEND-STUDIO-INTERNALS.md), secciones 41 a 50.

### El `tAggregateRow`: cuatro reglas

El `tAggregateRow` (y el `tAggregateSortedRow`) es un componente "virtual": en el IDE es un par (`tAggregateIn` +
`tAggregateOut`) y su codigo se genera con las plantillas de esos dos.

1. **La tabla de salida va la primera** de la lista de metadata del nodo. En el spec del arnes, el orden de
   `esquemas` es el orden de la lista: la primera entrada es la de salida.
2. **El origen se queda con una sola tabla**: la de salida del agregado. La tabla de entrada es la de la conexion,
   no hace falta declararla (y declararla crea una tabla suelta que no usa nadie).
3. **Las tablas del agregado (`GROUPBYS`, `OPERATIONS`) usan el nombre simple de la columna**, no `row1.columna`, y
   las funciones van en minusculas (`sum`, `count`, `max`...).
4. **El numero de columnas del origen tiene que ser el mismo que el de la salida del agregado**: el generador del
   `tFileInputDelimited` asigna los valores del fichero por posicion contra el esquema del destino.

Por el punto 4, el escenario del agregado lee `testdata/l5_ventas.csv` (`ciudad;monto;cliente`): el origen declara
las tres columnas y la salida del agregado declara tres.

### El orden de los esquemas: los origenes al final

Al conectar dos componentes, Talend sincroniza el origen con el destino: si el destino ya tiene esquema, **el
origen se queda con esas columnas** (y su tabla de rechazo tambien). Es el comportamiento del IDE (alli sale un
aviso), pero por API pasa en silencio.

Por eso el esquema del origen se pone **despues de conectar**. En el arnes el nodo se marca con
`"schemaDespuesDeConectar": true`, y los esquemas "despues" se aplican **con los nodos origen al final**: son los que
se han quedado descolocados.

Ademas, la tabla de rechazo (`REJECT`) del origen queda con las columnas del destino y el generador del lector
falla (`Index N out of bounds`). El bridge lo arregla solo: si la tabla de rechazo tiene columnas que no son del
propio nodo, la deja con las dos de error (`errorCode` y `errorMessage`).

### El nombre de la columna en la base de datos

Un `IMetadataColumn` tiene tres nombres: la etiqueta (`getLabel`), el id (`getId`) y el nombre de la columna en la
base de datos (`getColumnName`). **No hay `setColumnName`**: el nombre de la BD se pone con
`setOriginalDbColumnName`. Sin eso, el `tDBOutput` genera el `INSERT` con los nombres de columna a null:

```sql
INSERT INTO "l5_salida" (null,null,null,null) VALUES (('1'::int4),('Ana'),('Bogota'),('100.5'::double precision))
```

que el Postgres rechaza con `column "null" does not exist`. El bridge lo pone en los dos caminos que crean
columnas (`ComponentConfigurator` y `SchemaOperations`): si solo se pusiera en uno, el esquema se contagia por la
conexion y el bug vuelve.

### Los parametros de lista, sin comillas

El IDE escribe los valores de un parametro de tipo lista (`CLOSED_LIST`, `COMPONENT_LIST`, `PREV_COLUMN_LIST`)
**sin comillas** (`value="TRUNCATE"`) y los de tipo `TEXT` o `DBTABLE` **con comillas**
(`value="&quot;l5_salida&quot;"`). Con comillas, ninguna comparacion de la plantilla encaja: el `TABLE_ACTION` de un
`tDBOutput` valia `"TRUNCATE"` y la accion de tabla no se ejecutaba, sin ningun error visible. Lo mismo pasaba con la
columna a normalizar del `tNormalize` (`PREV_COLUMN_LIST`): con comillas salia `fila."columna"`.

La regla del bridge es general: **todo parametro cuyo tipo acaba en `_LIST` se guarda sin comillas**; el resto, como
hasta ahora.

### Los valores de las celdas de tabla: los nombres sin comillas

Los valores de las **tablas** de un componente (`GROUPBYS`, `OPERATIONS`, `CONDITIONS`, `CRITERIA`, `UNIQUE_KEY`,
`MAPPING_JSONPATH`...) van al codigo generado como literales Java, y ahi el IDE **entrecomilla** los que son
literales y deja **sin comillas** los que son nombres.

Las celdas que son nombres van sin comillas: `SCHEMA_COLUMN`, `COLNAME`, `INPUT_COLUMN`, `OUTPUT_COLUMN`,
`FUNCTION`, `OPERATOR`, `SORT`, `ORDER`, `KEY_ATTRIBUTE`, `CASE_SENSITIVE`, `PARAMETER_NAME` y `TARGET_COLUMN`.
Las demas, como literales Java (con comillas), como hace el IDE. Asi la consulta JSONPath de un `tFileInputJSON`
sale como `"$.clientes[*].id"` y compila.

Ojo: esta regla es para las celdas de una tabla. Los **parametros** tienen la suya (los que acaban en `_LIST`, sin
comillas).

### El `tNormalize`: la entrada y la salida con las mismas columnas

El codigo generado del `tNormalize` copia las columnas de la salida desde las de la entrada **por el mismo nombre**
(`row2.nombre = row1.nombre`), asi que la entrada y la salida tienen que declarar las columnas con el mismo nombre
(antes decia `apellido cannot be resolved or is not a field`).

La columna a normalizar va en un parametro de lista (`NORMALIZE_COLUMN`, de tipo `PREV_COLUMN_LIST`, sin comillas) y el
separador en el `ITEMSEPARATOR`. El componente **parte esa columna en filas**, repitiendo las demas:

| Entrada | Salida |
|---|---|
| `nombre=Ana`, `etiquetas=rojo;verde` | `Ana\|rojo` y `Ana\|verde` |
| `nombre=Jose`, `etiquetas=azul` | `Jose\|azul` |

### El `tFileList`: no emite filas, deja los valores en el `globalMap`

El conector `FLOW` del `tFileList` es `MAX_OUTPUT=0`/`MAX_INPUT=0`: **no emite filas**, asi que no hay ninguna
columna `CURRENT_FILE` que rellenar. Lo que deja son valores en el `globalMap`, con el `uniqueName` del nodo
delante: `<uniqueName>_CURRENT_FILE`, `_CURRENT_FILEPATH`, `_CURRENT_FILEDIRECTORY`, `_CURRENT_FILEEXTENSION` y
`_NB_FILE`.

Para consumirlos, un `tJavaRow` los lee del `globalMap` (`globalMap.get("<uniqueName>_CURRENT_FILE")`).

Ademas, el `LIST_MODE` es el **tipo de listado** (`FILES`, `DIRECTORIES`, `BOTH`), no el orden: con `"ASC"` ahi el
componente **no lista nada** (el codigo generado se queda con la lista vacia). El orden va en
`ORDER_BY_FILENAME` y `ORDER_ACTION_ASC`.

### El `tFileInputJSON`: la raiz del bucle y el mapeo

Con `READ_BY=JSONPATH`:

1. La raiz del bucle va en el parametro `JSON_LOOP_QUERY` (`$.clientes[*]`). `LOOP_QUERY` es del modo `XPATH`.
2. El mapeo de columnas va en la tabla `MAPPING_JSONPATH` (`SCHEMA_COLUMN` y `QUERY`). El valor de `QUERY` es un
   literal: va con comillas.
3. El pom del job si hereda las librerias del componente (`json-path`, `json-smart`, `accessors-smart`, `slf4j`).

### El `tJavaRow`: el codigo se inserta tal cual

El codigo (parametro `CODE`) va tal cual al job, con `input_row` y `output_row` sustituidos por el nombre de las
conexiones (`row1`, `row2`...). La fila de entrada sale de la conexion y la de salida, del esquema del nodo.

Trampa: si una columna del esquema es **entera y no admite nulos**, el codigo generado hace `row.id != null` sobre un
`int` y no compila. Usa columnas `String` (o que admitan nulos).

### Escribir en una base de datos

1. El `tDBOutput` (o `tPostgresqlOutput`) con `USE_EXISTING_CONNECTION=true` y la conexion compartida.
2. La conexion con `AUTO_COMMIT=true`. El `tDBOutput` no hace commit por su cuenta: escribe el lote al final (en la
   seccion "end" del componente) y, sin commit, al cerrar la conexion se pierde todo.
3. **No hay que encolar un `tPostgresqlCommit`**. Si se encola (conectado a la salida del output), se ejecuta
   **dentro del bucle de filas**: el output emite cada fila al downstream, el commit hace `commit()` y cierra la
   conexion, y el lote que se escribe al final falla con `This connection has been closed`.
4. `TABLE_ACTION` es un valor de la lista cerrada: `NONE`, `DROP_CREATE`, `CREATE`, `CREATE_IF_NOT_EXISTS`,
   `DROP_IF_NOT_EXISTS_AND_CREATE`, `CLEAR`, `TRUNCATE`. `DELETE` no existe.
5. Las columnas que se escriben van en la tabla `FIELD_OPTIONS` (cinco campos por columna: `SCHEMA_COLUMN`,
   `UPDATE_KEY`, `DELETE_KEY`, `UPDATABLE`, `INSERTABLE`). En el spec del arnes, `FIELD_OPTIONS` es un parametro de
   tipo TABLE: va en `tablas`, no en `parameters`.
6. `MAPPING` es el id del motor (`PostgreSQL`, `MySQL`...), no el nombre del componente.

### Como se comprueba cada cosa

| Que | Como |
|---|---|
| Montar y ejecutar un escenario L5 | `bun run scripts/execution-check.ts [filtro]` (el informe sale en `testdata/resultados-l5.csv`) |
| Levantar el Postgres de pruebas | `docker compose -f testdata/docker-compose.yml up -d` |
| Recargar el plugin Java (los arreglos del bridge) | `bun run bridge:install` (no con una medicion en marcha) |
| Medir la cobertura de unos componentes | `bun run scripts/coverage.ts --components <lista> --compile --out <csv>` |
