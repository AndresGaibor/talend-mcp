# Internals de Talend Studio: Componentes avanzados, bases de datos y ejecucion

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

## 41. El tAggregateRow: la primera tabla de metadata es la de salida

El `tAggregateRow` (y el `tAggregateSortedRow`) son componentes "virtuales": en el IDE son un par
(`tAggregateIn` + `tAggregateOut`) y su codigo se genera con las plantillas de esos dos. La plantilla
`tAggregateOut_main.javajet` saca la tabla de salida asi:

```java
List<IMetadataTable> mestadataTableListOut = node.getMetadataList();
outputMetadataTable = mestadataTableListOut.get(0);   // <-- la PRIMERA
outputColumns = outputMetadataTable.getListColumns();
```

La tabla de entrada, en cambio, sale de la **conexion**:

```java
inputMetadataTable = conn.getMetadataTable();
inputColumns = inputMetadataTable.getListColumns();
```

De ahi las cuatro reglas para configurar un agregado:

1. **La tabla de salida va la primera** de la lista de metadata del nodo. En el spec del bridge, el orden de
   `esquemas` es el orden de la lista: la primera entrada es la de salida.
2. **El origen se queda con una sola tabla**: la de salida del agregado. La tabla de entrada es la de la
   conexion, no hace falta declararla (y declararla crea una tabla suelta que no usa nadie).
3. **Las tablas del agregado (`GROUPBYS`, `OPERATIONS`) usan el nombre simple de la columna**, no
   `row1.columna`: la plantilla busca con `column.getLabel().equals(columnname)`. Y las funciones van en
   minusculas (`sum`, `count`, `max`...), porque las compara con `("avg").equals(fun)`.
4. **El numero de columnas del origen tiene que ser el mismo que el de la salida del agregado**. El generador
   del `tFileInputDelimited` asigna los valores del fichero por posicion contra el esquema del destino: si el
   origen tiene mas columnas que la salida del destino, falla con
   `Index N out of bounds for length N` (en `TFileInputDelimitedBeginJava.codeForValueToConnWithD`).

## 42. Conectar propaga el esquema del destino hacia atras

Al conectar dos componentes, Talend sincroniza el origen con el destino. Si el destino ya tiene un esquema
(el `tAggregateRow` con sus columnas de salida), **el origen se queda con esas columnas** y su tabla de
rechazo tambien. Es el comportamiento del IDE (alli sale un aviso), pero por API pasa en silencio.

Consecuencia: el esquema del origen hay que ponerlo **despues de conectar**, como hace el IDE. En el
arnes (`scripts/execution-check.ts`) el nodo se marca con `"schemaDespuesDeConectar": true`, y los
esquemas "despues" se aplican **con los origenes al final**: son los que se han quedado descolocados.

Ademas, la tabla de rechazo (`REJECT`) del origen queda con las columnas del destino, y el generador del
lector falla (`Index N out of bounds`). El bridge lo arregla solo: en `applySchema`, si la tabla de
rechazo tiene columnas que no son del propio nodo, se la deja con las dos de error (`errorCode` y
`errorMessage`).

## 43. El nombre de la columna en la base de datos: `setOriginalDbColumnName`

Un `IMetadataColumn` tiene tres nombres: la etiqueta (`getLabel`), el id (`getId`) y el nombre de la
columna en la base de datos (`getColumnName`). **No hay `setColumnName`**: el nombre de la BD se pone con
`setOriginalDbColumnName`.

Si no se pone, el `tDBOutput` genera el INSERT con los nombres de columna a null:

```sql
INSERT INTO "l5_salida" (null,null,null,null) VALUES (('1'::int4),('Ana'),('Bogota'),('100.5'::double precision))
```

que el Postgres rechaza con `column "null" does not exist`. Ojo: `getColumnName()` **cae en la etiqueta**
cuando no hay nombre de BD, asi que el sintoma (nombres a null) viene de otro sitio: el generador usa el
nombre de la BD, no el de la etiqueta.

El puente lo pone en los dos caminos que crean columnas: `ComponentConfigurator` (el `schema` de un
componente) y `SchemaOperations` (el `schema` con filas de un `tFixedFlowInput`). Si solo se pusiera en
uno, el esquema se contagia por la conexion y el bug vuelve.

## 44. Los parametros de lista no se entrecomillan

El IDE escribe los valores de un parametro de tipo lista **sin comillas** (`value="TRUNCATE"`) y
los de tipo `TEXT` o `DBTABLE` **con comillas** (`value="&quot;l5_salida&quot;"`). El puente los
entrecomillaba todos, y con las comillas ninguna comparacion de la plantilla encaja: el `TABLE_ACTION` de
un `tDBOutput` valia `"TRUNCATE"` y la accion de tabla no se ejecutaba (sin ningun error visible).

Lo mismo con `COMPONENT_LIST` y con `PREV_COLUMN_LIST` (la columna a normalizar de un `tNormalize`:
con comillas salia `fila."columna"`).

La regla del bridge es general: **si el tipo del campo acaba en `_LIST`, el valor va sin comillas**;
el resto, como hasta ahora. Ojo: esto es para los **parametros**. Los valores de las **celdas de una
tabla** tienen su propia regla (seccion 46).

## 45. Escribir en una base de datos: como se hace

El camino que funciona (probado contra un Postgres):

1. El `tDBOutput` (o `tPostgresqlOutput`) con `USE_EXISTING_CONNECTION=true` y la conexion compartida.
2. La conexion con `AUTO_COMMIT=true`. El `tDBOutput` no hace commit por su cuenta: escribe el lote al
   final (en la seccion "end" del componente) y, sin commit, al cerrar la conexion se pierde todo.
3. **No hay que encolar un `tPostgresqlCommit`**. Si se encola (conectado a la salida del output), se
   ejecuta **dentro del bucle de filas**: el output emite cada fila al downstream, el commit hace
   `commit()` y cierra la conexion, y el lote que se escribe al final falla con
   `This connection has been closed`.
4. `TABLE_ACTION` es un valor de la lista cerrada: `NONE`, `DROP_CREATE`, `CREATE`,
   `CREATE_IF_NOT_EXISTS`, `DROP_IF_NOT_EXISTS_AND_CREATE`, `CLEAR`, `TRUNCATE`. `DELETE` no existe.
5. Las columnas que se escriben van en la tabla `FIELD_OPTIONS` (cinco campos por columna: `SCHEMA_COLUMN`,
   `UPDATE_KEY`, `DELETE_KEY`, `UPDATABLE`, `INSERTABLE`). En el spec del arnes, `FIELD_OPTIONS` es un
   parametro de tipo TABLE: va en `tablas`, no en `parameters`.
6. `MAPPING` es el **id del motor de la base**, no el nombre que se ve en la interfaz: para Postgres es
   `postgres_id` (el `DEFAULT` del parametro en el `tPostgresqlOutput_java.xml`), para MySQL
   `mysql_id`. Poner el nombre de la interfaz (`"PostgreSQL"`) es peor que no poner nada: el IDE no
   encuentra el motor, registra `DBMS Id : "PostgreSQL" can't be found` y lanza un
   `NullPointerException` en `TypesManager.checkDBType` (el `mappingTypeRetriever` es null) dentro de
   `ProcessorUtilities.generateJobInfo`. La generacion de codigo se corta ahi y deja el `.java` del job
   **vacio** (0 bytes), sin `classpath.jar` y sin ningun error en la respuesta del bridge: el sintoma es
   `El job no esta compilado: no existe target/classpath.jar`. Si no se toca, se queda el `DEFAULT` del
   componente, que es el valor bueno.

## 46. Los valores de las celdas de tabla: los nombres sin comillas

Los valores de las **tablas** de un componente (las de metadata: `GROUPBYS`, `OPERATIONS`, `CONDITIONS`,
`CRITERIA`, `UNIQUE_KEY`, `MAPPING_JSONPATH`...) van al codigo generado como literales Java. El IDE
entrecomilla las que son literales y deja sin comillas las que son nombres.

Las celdas cuyo codigo es un **nombre** van sin comillas:

| Codigo de celda | Que es |
|---|---|
| `SCHEMA_COLUMN` | La columna del esquema |
| `COLNAME` | La columna que se ordena o se filtra |
| `INPUT_COLUMN` / `OUTPUT_COLUMN` | Las columnas de entrada y de salida de una transformacion |
| `LOOKUP_COLUMN` | La columna del flujo lookup en `tJoin` |
| `FUNCTION` | La funcion de agregacion (`sum`, `count`...) |
| `OPERATOR` | El operador de una condicion (`>`, `=`...) |
| `SORT` / `ORDER` | Como se ordena (`num`, `desc`...) |
| `KEY_ATTRIBUTE` / `CASE_SENSITIVE` | Los flags de una clave unica |
| `PARAMETER_NAME` | El nombre de un parametro |
| `TARGET_COLUMN` | La columna destino |

Las demas van **como literales Java** (con comillas), como hace el IDE. Excepcion: en la tabla
`MODIF_TABLE` de `tDataMasking`, `CATEGORY`, `FUNCTION`, `METHOD` y `ALPHABET` se guardan como texto
sin comillas Java: el JavaJet del componente agrega las comillas al generar el codigo. En la tabla
`FORMATS` de `tFileOutputPositional`, `PADDING_CHAR`, `ALIGN` y `KEEP` tambien se pasan como expresiones
Java sin envolverlas en otro literal: el JavaJet inserta el caracter de relleno y compara los enums
con valores como `'L'` directamente. En `SHUFFLING_COLUMNS` y `PARTITIONING_COLUMNS` de
`tDataShuffling`, los campos `COLUMN` y `PARTITIONING_COLUMN` tambien van sin comillas porque el
JavaJet ya las agrega; si no, se genera `""cliente""` y el job no compila. Asi la consulta JSONPath de un
`tFileInputJSON` sale como `"$.clientes[*].id"` y compila: entrecomillada, el generador la buscaba con
las comillas dentro y no encontraba la ruta.

Los booleanos y los numeros tampoco llevan comillas (los reconoce el mismo codigo que los pone como
literales).

Donde esta: `ComponentConfigurator.valorDeCelda` (decide que hacer con cada celda) y
`ComponentConfigurator.esNombreDeCelda` (la lista de codigos que son nombres). Antes el bridge
entrecomillaba **todas** las celdas: por eso la consulta JSONPath salia mal.

Al aplicar schemas con varias tablas en el mismo nodo, la coincidencia usa el nombre **y** el
conector. `tDataMasking` puede tener `FLOW` y `FLOW_OUTPUT` con el mismo nombre de tabla; buscar solo
por nombre reemplaza los metadatos del conector equivocado y deja incompletas las filas generadas.

Ojo: esta regla es para las celdas de una **tabla**. Los **parametros** tienen la suya (seccion 44:
sin comillas si el tipo acaba en `_LIST`).

## 47. El tFileList en Talend 8: no emite filas, deja valores en el globalMap

El `tFileList` se declara con el conector `FLOW` como `MAX_OUTPUT=0` y `MAX_INPUT=0`: **no emite
filas**. No hay ninguna columna `CURRENT_FILE` que rellenar, y por eso no se puede encadenar a un
`tLogRow` esperando datos.

Lo que hace es listar la carpeta y **dejar los valores en el `globalMap`**, con el nombre del
componente delante:

| Clave | Que es |
|---|---|
| `<uniqueName>_CURRENT_FILE` | El nombre del fichero |
| `<uniqueName>_CURRENT_FILEPATH` | La ruta completa |
| `<uniqueName>_CURRENT_FILEDIRECTORY` | La carpeta |
| `<uniqueName>_CURRENT_FILEEXTENSION` | La extension |
| `<uniqueName>_NB_FILE` | Cuantos ficheros ha listado |

El `uniqueName` es el del nodo (`tFileList_2`, no el nombre que le pone el arnes): para leer un valor
hay que ir al `globalMap` con esa clave.

Dos trampas:

1. **El `LIST_MODE` es el tipo de listado, no el orden**: `FILES`, `DIRECTORIES` o `BOTH`. Si se le
   pone `"ASC"`, el componente **no lista nada**: el codigo generado se queda con la lista vacia (sin
   error visible). El orden va en otros parametros (`ORDER_BY_FILENAME`, `ORDER_ACTION_ASC`).
2. Como no emite filas, el `tFileList` va **suelto** en el job (no conectado al flujo de datos). Para
   consumir sus valores, un `tJavaRow` (o cualquier codigo) lee el `globalMap`.

## 48. El tFileInputJSON: la raiz del bucle y el mapeo

Con `READ_BY=JSONPATH` (no `XPATH`):

1. **La raiz del bucle es el parametro `JSON_LOOP_QUERY`** (`$.clientes[*]`). `LOOP_QUERY` es del
   modo `XPATH`: con `JSONPATH` no se usa, y sin el `JSON_LOOP_QUERY` el componente no encuentra
   nada.
2. **El mapeo de columnas va en la tabla `MAPPING_JSONPATH`**, con dos columnas: `SCHEMA_COLUMN` (la
   columna del esquema) y `QUERY` (la ruta dentro del elemento, `$.id`). El valor de `QUERY` es un
   literal: va con comillas (seccion 46).
3. El **pom del job si hereda las librerias** que declara el componente (`json-path`, `json-smart`,
   `accessors-smart`, `slf4j`), si el nodo se crea con la API de Studio. Antes el build no las anadia
   y el codigo no compilaba (`org.json.simple.JSONValue cannot be resolved to a type`).

## 49. El tNormalize: la salida copia las columnas de la entrada por su nombre

El codigo generado del `tNormalize` copia las columnas de la salida desde las de la entrada **por el
mismo nombre**:

```java
row2.nombre = row1.nombre;
```

asi que **la salida tiene que declarar las mismas columnas que la entrada**. Si no, el error es
`apellido cannot be resolved or is not a field`.

Los dos parametros que importan:

| Parametro | Que es |
|---|---|
| `NORMALIZE_COLUMN` | La columna que se parte. Es de tipo `PREV_COLUMN_LIST`: va **sin comillas** (seccion 44) |
| `ITEMSEPARATOR` | El separador de los elementos (`;`) |

El componente **multiplica filas**: una por cada elemento de la columna, repitiendo las demas.

| Entrada | Salida |
|---|---|
| `nombre=Ana`, `etiquetas=rojo;verde` | `Ana|rojo` y `Ana|verde` |
| `nombre=Jose`, `etiquetas=azul` | `Jose|azul` |

## 50. El tJavaRow: el codigo se inserta tal cual

El codigo del `tJavaRow` (el parametro `CODE`) se inserta **tal cual** en el job, sustituyendo
`input_row` y `output_row` por el **nombre de las conexiones** (`row1`, `row2`...):

```java
output_row.nombre_mayus = input_row.nombre.toUpperCase();
```

La fila de entrada sale de la **conexion** y la de salida, del **esquema del nodo** (por eso el
esquema del `tJavaRow` hay que ponerlo despues de conectar).

**Trampa**: si una columna del esquema es entera y **no admite nulos**, el codigo generado hace
`row.id != null` sobre un `int`, y eso no compila. Usa columnas `String` (o que admitan nulos).

## 51. Al compilar: `Child module ... does not exist` (el agregador Maven y el heap)

Studio compila cada job con Maven a traves de un agregador que genera al vuelo. Con el heap cargado
ese agregador sale mal: referencia un modulo que ya no existe (el de un job que se borro) y
**todas** las compilaciones siguientes fallan con el mismo error, aunque el job este bien:

```
[ERROR] Child module C:\...\poms\jobs\process\mcp_coverage_0.1 of C:\...\poms\build-aggregator.pom does not exist
```

Paso midiendo 77 componentes de golpe: tras unos 33, el agregador quedo apuntando a un proyecto
que se habia borrado y los 42 siguientes fallaron con ese texto. El error es del build, no del
componente: al repetir esos 42 en tandas, con el heap por debajo del 60 %, **compilaron todos**.

Que hacer:

- **La causa de fondo es el heap.** `scripts/coverage.ts` fuerza un recolector cuando pasa del
  60 % (ver abajo) y corta al 80 %; asi una tanda de 21 componentes termina sobrada. Sin el
  recolector se rompia al segundo componente.
- Medir **por tandas** (una familia o dos por corrida), no las 17 de una vez.
- Si aun asi aparece el error, lo medido en esa tanda no vale: **repetir esos componentes en una
  corrida nueva**. No hay que recrear el job ni reiniciar Studio: el agregador se regenera al
  volver a compilar (fue lo que se hizo con los 42, y compilaron).

El sintoma se reconoce porque `error_compilacion` trae `Child module ... does not exist` y no un
error de Java.

### La memoria: se puede forzar una recoleccion

El endpoint `/automation/memory` acepta `{"gc": true}` y llama a `System.gc()`. Ojo: **los
porcentajes que devuelve son los de antes de recolectar** (mide y luego recoge), asi que hay que
volver a consultarlo para ver el efecto real:

```
POST /automation/memory {"gc": true}  ->  {"usedPercent": 83, "gc": true}
POST /automation/memory {}            ->  {"usedPercent": 51}
```

`scripts/coverage.ts` lo aprovecha: cuando el heap pasa del 60 % pide una recoleccion y usa el
valor posterior para decidir si cancela (corta al 80 %). Sin el recolector, una corrida de 21
componentes se quedaba en 2; con el, la tanda avanza mucho mas antes de necesitar un reinicio.

## 52. El driver de la base no hace falta para compilar, solo para ejecutar

Los componentes de base de datos declaran el driver en los `IMPORT` obligatorios del XML:

```xml
<IMPORT NAME="Driver-DB2" MODULE="db2jcc4.jar" MVN="mvn:org.talend.libraries/db2jcc4/6.0.0" REQUIRED="true" />
```

De ahi se deduce (mal) que sin ese jar el componente no compila. **Si compila**: el codigo que genera
Talend no usa los tipos del driver, lo carga por nombre al ejecutar. Medido con las ocho familias de
`DB Specifics` que no tienen driver en el `.m2` (DB2, Greenplum, Informix, Ingres, Netezza, Sybase,
Teradata y Vertica): **102 componentes, 101 compilan** sin instalar nada.

Lo que el jar resuelve es la **ejecucion** (L5): sin driver y sin servidor, ese job no corre.

La consecuencia para la medicion: L4 de las familias de base de datos se puede medir entera sin
descargar drivers; lo que no se puede prometer es L5. El unico fallo de esas ocho familias fue
`tIngresBulkExec`, y no es el driver: el codigo generado referencia una variable que Talend no
declara (`executableFilePath_tDBBulkExec_4 cannot be resolved`), que es un fallo de generacion del
componente.

Como se consulta que pide un componente, sin abrir el IDE:

```powershell
# El driver (y demas artefactos) que exige un componente
Select-String -Path <plugins>\...\components\tTeradataInput\TeradataInput_java.xml -Pattern 'MVN="[^"]+"[^>]*REQUIRED="true"'
```

Solo cuentan los `IMPORT` con `REQUIRED="true"` (los que llevan `REQUIRED_IF` son condicionales).

## 53. Un trigger solo se genera si sale del **arranque** del subjob

El generador de Studio emite la llamada al destino de un trigger dentro del metodo del **primer componente**
del subjob (el que la plantilla reconoce con `INode.isDesignSubjobStartNode()`). Un trigger que sale de un
componente de en medio del flujo **se guarda en el job, compila y no se ejecuta nunca**: no hay aviso, la
conexion esta ahi con su `lineStyle="1"` y el destino simplemente no aparece en el `main` generado.

Medido con tres jobs de dos o tres nodos:

| Job | Conexion | Codigo generado |
|---|---|---|
| `tJava_2` -> `tJava_4` (`SUBJOB_OK`) | el origen es el arranque | `tJava_4Process(globalMap);` dentro de `tJava_2Process` |
| `tFixedFlowInput` -> `tLogRow`, `tLogRow` -> `tJava` | el origen esta a mitad de flujo | nada; `tJava_2Process` no se llama en ningun sitio |
| `tFixedFlowInput` -> `tLogRow`, **`tFixedFlowInput`** -> `tJava` | el origen es el arranque | `tJava_2Process(globalMap);` al final del metodo del subjob, despues del `tLogRow` |

De ahi la regla practica: **el trigger se dibuja desde el primer componente del subjob**, no desde el ultimo.
Para un commit explicito, el `tDBCommit` se cuelga del `tFixedFlowInput` (o del componente de arranque que sea),
no del `tDBOutput`: la llamada se emite al final del subjob, cuando la escritura ya ha terminado.

El bridge devuelve un aviso (`warnings`) cuando el origen de un trigger no es el arranque del subjob, porque el
fallo es mudo.

El otro detalle es el orden de las conexiones: el generador recorre las salidas del arranque y emite el flujo
y el trigger en la misma pasada; por eso el nombre de la conexion del trigger (`OnSubjobOk`) no puede coincidir
con el de la fila.

### El destino de un trigger tiene que poder arrancar su propio subjob

`ConnectionManager.canConnectToTarget` rechaza las conexiones `ON_SUBJOB_OK` y `ON_SUBJOB_ERROR` cuando el
destino no es el arranque de su propio subjob:

```java
if (!target.getUniqueName().equals(target.getDesignSubjobStartNode().getUniqueName())) {
  return false;
}
```

Un `tFileOutputDelimited`, un `tDBOutput` o un `tLogRow` necesitan entrada, asi que no arrancan subjob: si se
les cuelga el trigger directamente, **Studio no crea la conexion**. El patron correcto es colgar el trigger de
un componente que pueda empezar subjob (`tFixedFlowInput`, `tJava`, `tDBCommit`...) y, si el manejador tiene que
escribir o transformar, montar debajo un subjob normal (`tFixedFlowInput` -> `tFileOutputDelimited`).

Y el rechazo es **mudo**: `CommandStack.execute` comprueba `canExecute()` y, si devuelve `false`, no hace nada y
no lanza. Por eso el bridge ahora llama a `canExecute()` antes de ejecutar (y falla con un mensaje que explica
el motivo) y despues comprueba que la conexion esta en el modelo (`target.getIncomingConnections()`); antes
respondia `ok` sin haber conectado nada.

### Un fallo no siempre dispara el trigger de error

Medido con dos jobs iguales salvo el origen del fallo:

| Fallo | Resultado |
|---|---|
| `tDie` en el flujo | el manejador de `SUBJOB_ERROR` corre y el job termina con codigo 1 |
| `tFileInputDelimited` con un fichero que no existe | el job registra `[ERROR]`, **no** ejecuta el manejador y termina con codigo **0** |

Para probar un trigger de error hace falta un fallo que lance de verdad (`tDie`, `tAssertCatcher`...). Un
`tFileInputDelimited` sin fichero deja el subjob a medias sin pasar por el manejador.

### El orden importa: primero los flujos, despues los triggers

`canConnectToTarget` tambien rechaza un **flujo** cuando el arranque del subjob ya tiene un trigger de subjob
(`ON_SUBJOB_OK`/`ON_SUBJOB_ERROR`) y el destino del flujo no puede arrancar subjob. Es decir: si primero se
cuelga el trigger y despues se intenta conectar el flujo, la conexion de datos falla. Se montan primero las
conexiones de datos y al final los triggers.

## 54. Donde acaba el codigo generado de un job

Hay dos sitios posibles y no depende del tipo de job sino del estado del proyecto Maven:

| Carpeta | Cuando aparece |
|---|---|
| `poms/jobs/process/<JOB>/<job>_<version>/` | lo normal: el proyecto Maven del job esta montado y se genera ahi |
| `PRJ_<PROYECTO>_<JOB>_<VERSION>/` (en la raiz del workspace, job en mayusculas) | el proyecto Maven del job existe pero esta **vacio**; el generador deja el codigo en un proyecto suelto con el mismo layout |

En los dos casos el layout es el mismo (`src/main/java/<paquete>/<Job>.java`, `target/classes`,
`target/classpath.jar`). Lo que cambia es donde hay que buscar el `classpath.jar` para relanzar el job a mano:
si solo se mira `poms`, un job que se ha generado en el proyecto suelto "no esta compilado" aunque acabe de
compilarse y ejecutarse desde el IDE.

El sintoma tipico: en `poms/jobs/process/<JOB>/` hay una carpeta `mcp_<job>_0.1` vacia (sin `src` ni `target`)
y el `MCP_<JOB>.java` esta en `PRJ_<PROYECTO>_MCP_<JOB>_0.1/src/main/java/...`.

## 55. Studio bloquea el `classpath.jar` del job que ha cargado

Cuando Studio carga las clases de un job en su propia JVM (el `Run` remoto o embebido), el
`target/classpath.jar` se queda abierto mientras viva Studio. El siguiente build intenta limpiar la carpeta
y falla antes de generar nada:

```
java.nio.file.FileSystemException: ...\target\classpath.jar: El proceso no tiene acceso al archivo.
  at org.talend.designer.runprocess.java.TalendProcessJavaProject.cleanFolder
  at org.talend.designer.maven.tools.MavenPomSynchronizer.cleanMavenFiles
```

La carpeta se queda con el `pom.xml`, `src/main/java` **vacio** y un `classpath.jar` de 1 KB (solo el
manifiesto). A partir de ahi el job responde `No se encontro la clase principal del job en target/classes`
en todos los intentos, `compile` contesta `compiles: true` porque no hay nada que compilar y la carpeta
tampoco se puede borrar desde fuera (`Remove-Item` da acceso denegado). Lo unico que lo suelta es
**reiniciar Studio**: no hay forma de liberar el jar desde el MCP.

Medido con un job de tres nodos (`tFixedFlowInput` -> `tWarn` -> `tLogRow`): el primer Run lo dejo bloqueado
y los builds siguientes ya no generaron codigo.

Consecuencia practica: no lanzar `executeJob` mientras Studio esta compilando ese job. El arnes lo hace para
saber si el build ha terminado, y justo ahi esta el riesgo: abre el jar en el momento en que Studio lo va a
reemplazar.

## 56. Al reiniciar Studio carga el bundle **instalado**, no el de la carga en caliente

La carga en caliente (`~/.talend-bridge/hot/bridge.jar` + `Bundle.update`) solo vale para la sesion en curso.
Al arrancar, Studio monta el bundle que tiene instalado; si los ultimos cambios se aplicaron solo en caliente,
tras reiniciar vuelve el jar viejo.

Sintoma: `/ping` contesta `ok` pero con una `version` antigua (el numero final es la marca de compilacion), y el
bridge "funciona" a medias. Medido: `job/create` crea el job, `nodes/add` contesta `ok` con un `uniqueName`,
pero el `.item` se queda **vacio** (196 bytes, solo la cabecera XMI). El job compila igual (es el esqueleto de
Talend, ~50 KB de codigo generado) y al ejecutarlo no imprime nada: el arnes lo reporta como
`las lineas no son las esperadas: ... y salio []`. Los 25 escenarios fallaron asi, sin un solo error del bridge.

Comprobacion y arreglo:

```bash
bun run scripts/bridge-call.ts /ping          # la 'version' tiene que ser la ultima compilacion
bun run bridge:install --force
```

Regla: despues de cada reinicio de Studio, mirar la `version` del ping (o reinstalar el bridge) antes de
automatizar. El `--force` recompila y recarga sin reiniciar Studio.

## 57. Las listas cerradas se guardan con su `VALUE`, no con el nombre

Un parametro de lista cerrada no guarda el texto que se ve en la interfaz, sino el `VALUE` de su `<ITEM>`.
Cuando `NAME` y `VALUE` coinciden (`TABLE_ACTION`: `NONE`, `TRUNCATE`...) no se nota; cuando no coinciden,
el valor equivocado se cuela en el codigo generado como si fuera un identificador Java y el job no compila.

Medido con el `tWarn`:

```xml
<ITEM NAME="WARNING" VALUE="4" />
```

- Con `"PRIORITY": "WARNING"` el build falla en la generacion: `The Job "MCP_L5_Aviso" has wrong
  configuration` con `Detail Message: WARNING cannot be resolved to a variable` (y no aparece ningun
  `classpath.jar`: el sintoma en el arnes es `El job no esta compilado`).
- Con `"PRIORITY": "4"` compila y el job escribe en la salida estandar:
  `[WARN ] 12:06:43 prj_bancolombia.mcp_l5_aviso_0_1.MCP_L5_Aviso- tWarn_2 - Message: cuidado con el dato. Code: W001`

El `tWarn` se usa como subjob propio (`tFixedFlowInput` -> `tLogRow` y `OnSubjobOk` del arranque hacia el
`tWarn`): avisa y el job sigue con codigo 0. El mensaje y el codigo salen en la misma linea, con el nivel
del `PRIORITY`; la marca de tiempo impide comparar la linea completa, se comprueba por subcadena.

## 58. Inspeccionar definiciones instaladas de componentes

Los `.java.xml` y `.javajet` activos estan dentro del plugin de componentes de la instalacion de Studio. El
sufijo del plugin cambia entre versiones, por lo que no conviene guardar en notas o scripts una ruta completa
como `org.talend.designer.components.localprovider_<version>`. Para localizar e imprimir las definiciones se usa:

```powershell
bun run scripts/inspect-component.ts --plugins-dir "<ruta-de-Studio>/plugins" --file begin tLogCatcher tJoin
bun run scripts/inspect-component.ts --plugins-dir "<ruta-de-Studio>/plugins" --file xml tLogCatcher
bun run scripts/inspect-component.ts --plugins-dir "<ruta-de-Studio>/plugins" tJoin
```

`--file` acepta `xml`, `begin`, `main`, `end` o `all`; si se omite, muestra todos los archivos existentes. El
script busca el componente en todos los plugins que tengan `components/<nombre>` y presenta todas las coincidencias,
con numeros de linea. La ruta se recibe como argumento; no hay una ruta de maquina fija.

Este metodo permitio diagnosticar `tSetGlobalVar`: el `begin` de `tJava` se genera antes de que empiece el bucle
del flujo, aunque el nodo se haya conectado despues de `tSetGlobalVar`. Por eso no sirve para observar ahi una
variable que se asigna por fila. El consumidor debe ejecutarse en el flujo (por ejemplo, `tJavaRow`); el escenario
L5 confirma que entonces puede leer `l5_global=Talend`.

## 59. Inventario del repositorio y dependencias del job

### Conexiones compartidas

`ProxyRepositoryFactory.getInstance().getMetadataConnectionsItem()` devuelve los items de conexión de
metadatos y permite obtener la etiqueta y el tipo de conexión. No es equivalente a
`getAll(ERepositoryObjectType.METADATA_CONNECTIONS)`: en la instalación probada, esta última consulta devolvió
cero, mientras `getAll(METADATA_FILE_DELIMITED)` devolvió un item. Para inventariar conexiones se usa el método
específico `getMetadataConnectionsItem()` y no se asume que todos los tipos del enum se comporten igual.

El item expone `getConnection()`. Los modelos de conexión pueden contener valores sensibles, como
`getPassword()` y `getFilePath()`. `talend_list_repository_connections` solo devuelve etiqueta, versión, clase del
item y tipo de conexión; no serializar el objeto de conexión completo ni sus parámetros.

La prueba en el workspace disponible encontró una conexión de archivo delimitado y ninguna conexión de base de
datos. Por eso el listado quedó validado en vivo para ese tipo; la presencia y lectura de conexiones DB debe
probarse en un proyecto que contenga esos items.

### Dependencias declaradas por un job

El modelo `IProcess2` permite consultar:

| Método | Resultado observado |
|---|---|
| `getNeededRoutines()` | Conjunto de nombres de rutinas Talend. |
| `getNeededModules(int)` | Conjunto de `ModuleNeeded`, con nombre, indicador `isRequired()` y estado `getStatus()`. |
| `getNeededLibraries(int)` | Nombres de las bibliotecas requeridas por el proceso. |

Los métodos de módulos y bibliotecas reciben un `int`, no un `boolean`; pasar `true`/`false` produce
`IllegalArgumentException`. El bridge usa `0` y solo expone nombres, obligatoriedad y estado, sin rutas locales.
Si Studio proporciona una versión explícita, también se incluye. La consulta está disponible en
`/talend/active-job/dependencies` y en la tool
`talend_bridge_active_job_dependencies`.

### Bundle de origen de una clase

`Bundle.loadClass()` puede delegar la carga a otro bundle. El bundle desde el que se hizo la consulta no tiene por
qué ser el propietario de la clase: en esta instalación varias clases Talend aparecían incorrectamente como
pertenecientes a `com.cedarsoftware.json-io`. Para identificar el bundle real, usar
`FrameworkUtil.getBundle(loadedClass)`; `TalendClassProbeService` ya aplica esa regla.

## 60. `DROP_CREATE` no es idempotente

Con `TABLE_ACTION = DROP_CREATE`, el componente de salida de base de datos genera `DROP TABLE <tabla>` sin `IF EXISTS`. Si la tabla no existe, el job falla con `table "<tabla>" does not exist`. Para recrear de forma idempotente hay que usar `DROP_IF_EXISTS_AND_CREATE`.

Además, el `CREATE TABLE` que genera Talend (en `DROP_CREATE` y en `DROP_IF_EXISTS_AND_CREATE`) escribe `VARCHAR(-1)` cuando la columna de texto no tiene longitud. Postgres rechaza esa sintaxis (`syntax error at or near "-"`). La columna necesita `length` en su definición (por ejemplo 255). El bridge lo lee en `SchemaOperations`, con -1 por defecto.

Verificado con el escenario `bd/recrear-la-tabla-en-cada-ejecucion`.

## 61. Cada job corre dos veces en el harness

`compilarEnStudio` (`scripts/execution-check.ts`) llama a `runActiveJob` con `waitForTermination: false`. El Run de Studio compila el job y también lo ejecuta, sin esperar. Después `executeJob` lo ejecuta otra vez para capturar la salida.

Consecuencias:

- Un DDL sin `IF EXISTS` falla en la segunda ejecución, porque la primera ya lo dejó hecho (sección 60).
- Un fichero de salida puede recibir las escrituras de las dos ejecuciones. En un job de unos 40 s se midieron 3.000.000 de líneas en lugar de 1.500.000. El harness borra el fichero antes de `executeJob`, pero el primer Run puede seguir escribiendo.
- Para medir, el job debe imprimir su propio resultado (`NB_LINE` con un `tJava`), en vez de dejarlo en un fichero compartido.

Verificado con el escenario `transformaciones/15-vueltas-de-500-mil-filas-acumuladas-en-un-fichero`.

## 62. `tRowGenerator` en un job hijo

En un job llamado con `tRunJob`, el randomizer de la columna del `tRowGenerator` sale como `public String getRandomnombre() { return ; }`, que no compila (`This method must return a result of type String`). Como job principal, la misma configuración genera `return "Ana";`. La tabla `VALUES` está en el `.item` del hijo con el valor `"Ana"`.

No depende de `NB_ROWS` (falla con 3, 1000 y 100000 en el hijo) ni del componente de salida (con `tLogRow` también falla). La causa no está identificada. Mientras tanto, en jobs hijos conviene leer un fichero (`tFileInputDelimited`) en vez de generar filas.

## 63. Artefactos de POI para Excel en Studio offline

Studio 8.0.1 trae `poi-5.4.1`, `poi-ooxml-5.4.1`, `poi-ooxml-lite-5.4.1`, `poi-scratchpad-5.4.1` y `xmlbeans-5.3.0` en sus `plugins`. Pero el build de los jobs corre offline y busca las dependencias en el repositorio local de Studio (`configuration/.m2/repository`). Sin ellas, `tFileInputExcel` no genera la clase principal (`No se encontro la clase principal del job en target/classes`). Además falta `curvesapi`.

Se instalan con la ruta del bridge `/automation/artifacts/install` (`groupId`, `artifactId`, `version`):

- `org.apache.poi:poi-ooxml:5.4.1`, `poi-ooxml-lite:5.4.1` y `poi-scratchpad:5.4.1`
- `org.apache.xmlbeans:xmlbeans:5.3.0`
- `com.github.virtuald:curvesapi:1.08`

Verificado con el escenario `formatos/leer-productos-desde-un-xlsx`.

## 64. Build Job: la API y el zip que produce

El asistente Export Job de Studio ejecuta `BuildJobManager.getInstance().buildJob(destino, ProcessItem, version, contexto, Map<ExportChoice,Object>, JobExportType.POJO, IProgressMonitor)`. Es la sobrecarga de siete argumentos; la de ocho lleva un `boolean` extra.

- El mapa de opciones tiene que traer `ExportChoice.binaries`. Sin esa clave, `buildJob` falla con `NullPointerException` en `buildJob` (lee `binaries` con `Map.get` sin comprobar).
- Con `needLauncher`, `needSystemRoutine`, `needUserRoutine`, `needContext` y `contextName` se obtiene el paquete ejecutable: `<job>_<version con puntos en _>.zip` de unos 5,7 MB con 38 entradas. Tarda 8 a 13 s.
- El zip trae `<JOB>/<JOB>_run.bat`, `<JOB>_run.sh` y `<JOB>_run.ps1`, el jar del job, `lib/` (29 jars de Talend y de dependencias), `jobInfo.properties`, `log4j2.xml` y la firma `TALENDZI.*`.
- El launcher usa `../lib` relativo a su propia carpeta: el zip hay que extraerlo en la carpeta que contiene `<JOB>/`, no dentro de ella.

Lo usa el bridge en `/automation/build-job` y la tool `talend_deliverables_build_job`. Verificado con `MCP_L5_Humo`: el launcher imprime `1|Bogota` y `2|Medellin` fuera de Studio, con código 0.

## 65. El launcher no lee variables de entorno

El `.bat` y el `.sh` de un Build Job no referencian ninguna variable `TALEND_*`. Reenvían sus argumentos (`%*` y `"$@"`) a Java, después de un `--context=Default` fijo que deja el build. Los parámetros van como argumentos: `--context_param <clave>=<valor>`.

El runner del MCP pasaba `TALEND_CONTEXT` y `TALEND_PARAM_<clave>` como variables de entorno, y el launcher las ignoraba sin avisar. Desde esta fase `runExportedJob` pasa `--context=` y `--context_param`. Verificado con `MCP_L5_Parametro`: con `L5_PARAM=desde-mcp` el job imprime `parametro: desde-mcp`, y sin parámetro imprime `parametro: por-defecto`.

El launcher llama a `java` por nombre. Sin Java en el PATH sale con código 1 y el mensaje `"java" no se reconoce como un comando`. El runner lo resuelve con `TALEND_JAVA_HOME`, que antepone su `bin` al PATH del proceso. Un planificador externo tiene que tener Java en su PATH o lanzar el `.bat` con el JDK de Studio.

## 66. `tSendMail` trae CC y BCC con direcciones de ejemplo

Si no se fijan, `tSendMail` usa como valores por defecto `TO "receiver@example.com"`, `CC "carbon@example.com"`, `BCC "blindcarbon@example.com"` y `SMTP_HOST "smtp.provider.com"`. Un job que no los sobrescribe envía copias a esas direcciones. Verificado con el sumidero local: sin fijarlas, los correos llegaban a `carbon@` y `blindcarbon@`.

Fijar `CC` y `BCC` a `""` (cadena vacía en Java) y el resto de los campos de conexión. Los escenarios `control/correo-*` lo hacen y comprueban la entrega con el sumidero `scripts/l5/smtp-sink.ts`, que anota `To` y `Subject` en `testdata/l5-correos.log`. El sumidero tiene que estar levantado antes de correr esos escenarios.

## 67. Dependencias de Hive y Hadoop que Studio no trae

Los componentes `tHive*` compilan contra el cliente de Hive 2.3.10 y Hadoop 3.3.4. Studio no los trae en su `.m2`: el build offline falla sin error visible. Los jars que faltan aparecen en `.metadata/.log` como `missing jar:<archivo>`, y el `pom.xml` del job (`poms/jobs/process/<JOB>/<job>_0.1/pom.xml`) da las coordenadas exactas.

Para ver qué falta: `missing jar:` del log tras el `Command line` del job, y comparar cada dependencia del pom contra `<studio>/configuration/.m2/repository`. Se instalan con `/automation/artifacts/install`. Para Hive hicieron falta 16 artefactos (hadoop-client-api y runtime 3.3.4, hive-exec, hive-service, hive-service-rpc, hive-shims 2.3.10, htrace-core4, kerb-core y kerb-simplekdc 1.0.1, netty-handler, commons-lang 2.6, curator 2.13.0 y guava compartido de hadoop).

Verificado con `bases de datos: cargar un CSV en Hive y leerlo con tHiveInput` contra HiveServer2 (imagen `apache/hive:4.0.1`).

## 68. El driver de Impala se pide aunque el modo sea HIVE2

`tImpalaConnection` con `IMPALA_DRIVER=HIVE2` usa el driver JDBC de Hive y `auth=noSasl`. Aun así, el pom del job incluye `Impala:ImpalaJDBC42:2.6.30.1036`, el driver de Cloudera, que no está en Maven Central. Sin ese artefacto el build no genera la clase principal.

Para probar la ruta HIVE2 hace falta un jar con esa coordenada. En pruebas se usó un marcador vacío con el mismo nombre; el modo `IMPALA` sigue necesitando el driver real.

El driver HIVE2 habla `noSasl`. Un HiveServer2 con SASL (el de Hive) lo rechaza con `Socket is closed by peer`. Un impalad lo acepta. Se emula con HiveServer2 con `hive.server2.authentication=NOSASL` en el puerto 21050.

Los componentes Impala (`tImpalaRow`, `tImpalaInput`) necesitan `USE_EXISTING_CONNECTION=true` para tomar el host de `tImpalaConnection`. Sin eso usan su `HOST` vacío y fallan con `Bad URL format`.

Verificado con `bases de datos: escribir y leer Impala con el driver HIVE2` (puerto 21050).

## 69. `tAssert` y `tAssertCatcher`: expresión sin comillas y esquema completo

El `EXPRESSION` de `tAssert` es código Java tal cual, sin comillas. Con comillas el código generado no compila (`')' expected`).

`tAssertCatcher` genera una estructura con nueve columnas: `moment`, `pid`, `project`, `job`, `language`, `origin`, `status`, `substatus` y `description`. Si el esquema declara solo algunas, el código no compila (`cannot find symbol`). El resultado es `Ok` o `Fail` en `status`.

Verificado con dos escenarios: `control de flujo: tAssert valida el conteo de filas` (Ok) y `control de flujo: tAssert marca fallo cuando el conteo no coincide` (Fail).

## 70. `tHashInput` no recibe filas de `tHashOutput` (pendiente)

`tHashInput` tiene `LINK_WITH` activo por defecto, y su `LIST` debe ser el `uniqueName` del `tHashOutput`. Con esa configuración el código generado sí contiene el bucle de lectura (`tHashFile_<job>_<pid>_tHashOutput_2.iterator()`), con la misma clave que escribe el output.

Aun así el bucle no produce filas en la topología probada: `tFixedFlowInput -> tHashOutput`, `SUBJOB_OK`, `tHashInput -> tLogRow`. El job termina con código 0 y sin salida. No se ha identificado la causa. El escenario `transformaciones/hash-memoria-entre-subjobs` queda marcado como pendiente.

## 71. `tHDFSPut` en Windows: HDFS real en Docker, no el sistema de ficheros local

`FS_DEFAULT_NAME=file:///` no sirve en Windows: Hadoop busca `winutils.exe` y `HADOOP_HOME`, y el job falla con `Did not find winutils.exe`. Poner `HADOOP_HOME` obliga a reiniciar Studio para que lo vea.

La alternativa probada es un HDFS real: `apache/hadoop:3.3.6` como namenode y datanode en Docker (`testdata/docker-compose.yml`). El datanode anuncia `localhost` para que el cliente del host lo alcance (`dfs.datanode.hostname`). Con `FS_DEFAULT_NAME=hdfs://localhost:9000/` y `REMOTEDIR=/l5/destino` el fichero llega a HDFS.

Verificado con `archivos: subir un fichero con tHDFSPut a un HDFS real`.
