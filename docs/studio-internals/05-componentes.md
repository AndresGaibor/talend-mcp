# Internals de Talend Studio: Componentes y catalogo

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

## 24. Componentes que no generan codigo valido en Talend 8.0.1

El `tFileInputPositional` y el `tFileInputJSON` generan un job que **no
compila** cuando el job tiene un output con trigger de error:

```
The method tFileInputPositional_2_onSubJobError(Exception, String, Map<String,Object>)
is undefined for the type MI_JOB
```

**Por que**: el output genera el handler `tLogRow_2_error`, que llama al
metodo `onSubJobError` del componente que falla. Ese metodo solo se genera
para los componentes que tienen trigger de error, y un input no lo tiene.

Lo que decide es el `DIE_ON_ERROR` **del componente del catalogo**, que en
estos dos componentes viene en `true` (en el `tFileInputDelimited` viene en
`false`, y ese compila). El MCP pone el parametro del nodo a `false` (y el
`.item` lo refleja), pero el generador consulta el componente, no el nodo, y
el componente del catalogo es compartido: no se puede cambiar sin afectar a
todos los jobs.

**Como se salva**: usando el `tFileInputDelimited` en lugar de estos dos, o
esperando a que Talend lo corrija. No es un problema del MCP: el `.item` que
genera es correcto.

## 25. Descargar artefactos de Maven

Hay componentes cuyo runtime no viene con Studio. El `tFileInputJSON`, por
ejemplo, necesita `com.jayway.jsonpath:json-path:2.9.0`, y sin el el build
falla con:

```
El contenedor Maven Dependencies referencia biblioteca ...json-path-2.9.0.jar inexistente
Offline / Missing artifact com.jayway.jsonpath:json-path:jar:2.9.0
```

Studio usa como repositorio local el de su propia instalacion
(`<instalacion>/configuration/.m2/repository`), asi que descargar ahi es lo que
hace que el build lo encuentre. La tool `talend_studio_install_artifact` lo
hace desde Maven Central.

**Ojo**: el `tMap` necesita el modulo `talend-tmap-dataset-1.2.16.jar`, que
**no esta en Maven Central** (es de Talend Exchange y pide credenciales). Con el
instalador se comprueba enseguida: devuelve 404 para todos los group id
habituales (`org.talend.components`, `org.talend.libraries`, ...).

**Automatizado.** `talend_job_compile` con `installMissing: true` lee la coordenada del error
(`Missing artifact g:a:jar:v`), la descarga con `installArtifact` y vuelve a compilar. Si la descarga
falla, no se recompila y la respuesta lo dice por componente. `talend_job_run_by_name` con
`installMissing: true` pulsa, ademas, la descarga de modulos de terceros de Studio cuando su dialogo
bloquea el lanzamiento (seccion 77 de INTERNALS 08). Para el `tMap`, la via prevista es ese dialogo de
modulos: no se verifico con un job que use `tMap`.
## 26. Que no puede entrar al hilo de la UI

Todo lo que corre en `UiThread.sync` ocupa el hilo de la interfaz de Studio: mientras dura, Studio
no pinta, no responde y los modales no se pueden cerrar (el sistema lo marca "No responde"). Por
eso la regla es: **al hilo de la UI solo entra lo que toca widgets o el modelo del job, y en
trozos de milisegundos.**

| Operacion | Donde corre | Por que |
|---|---|---|
| Alta, conexion, edicion, borrado de nodos; crear, abrir y borrar jobs | UI (trozo corto) | Tocan el editor y el modelo EMF |
| `talend_job_execute` (lanza una JVM y espera hasta minutos) | Hilo de trabajo HTTP | Solo lee el workspace; en la UI congelaba Studio todo lo que durara el job |
| `talend_studio_install_artifact` (descarga de Maven Central) | Hilo de trabajo HTTP | Es red y disco, sin widgets |
| `talend_studio_coverage` (1294 componentes) | Hilo de trabajo; **una llamada corta a la UI por componente** | Si el bucle entero iba en la UI, Studio quedaba congelado minutos |

Detalles de `UiThread.sync`:

- Espera con un `CountDownLatch`: despierta en el instante en que la UI termina (antes sondeaba
  cada 20 ms y eso se sumaba a cada llamada).
- Tiene tiempo maximo (10 s por defecto). Si vence, la accion que seguia en cola **se descarta**
  en vez de ejecutarse tarde.
- Si ya se esta en el hilo de la UI (`Display.getCurrent() != null`), ejecuta directo.

Al agregar una ruta nueva al bridge: si no toca widgets ni el modelo, no la envuelvas en
`UiThread.sync`. Si necesita la UI varias veces, haz una llamada corta por unidad de trabajo,
no una larga para todo.

## 27. Problemas de diseno de un job

Los avisos que Studio marca en el lienzo y lista en la vista Problemas (`No schema has been defined yet`,
`This component should have input link(s)`) viven en la clase estatica
`org.talend.designer.core.ui.views.problems.Problems`. La lista es **global** (todos los jobs abiertos) y
Studio solo la recalcula al editar, asi que para leerla desde el bridge:

1. `Problems.refreshProcessAllNodesStatus(process)` fuerza el recalculo del job.
2. `Problems.getProblemsBySeverity(ProblemStatus)` (`ERROR`, `WARNING`, `INFO`) devuelve los problemas.
3. Se filtran por `problem.getJobInfo().getJobName()`, porque la lista mezcla los jobs abiertos.
4. De cada `Problem`: `getDescription()`, `getNodeName()`, `getComponentName()`, `getType()`.

`JobProblems.java` lo hace y la tool es `talend_job_problems`. Verificado: un `tFileInputDelimited` sin
conectar da 3 avisos (sin schema, sin salida, y el `tLogRow` sin entrada) y con schema, `FILENAME` y la
conexion queda limpio. Son problemas de **diseno**; los de compilacion Java del codigo generado son
otra cosa (ver `/problems/markers` y la seccion 14).

Dato util al probar con `talend_studio_run_code`: `PlatformUI.getWorkbench().getActiveWorkbenchWindow()`
es `null` cuando Studio no tiene el foco; usa `getWorkbenchWindows()[0]`.

## 28. Compilar un job sin ejecutarlo

Studio genera el codigo antes de un Run con `ProcessorUtilities.generateCode` y luego comprueba los errores
de compilacion. Las dos cosas se pueden hacer sin lanzar el job (`JobCompiler.java`, tool `talend_job_compile`):

1. `ProcessorUtilities.generateCode(IProcess, IContext, statistics=false, trace=false, properties=true)`, con el
   contexto por defecto (`process.getContextManager().getDefaultContext()`). Tarda ~2 s en un job pequeno.
2. `JobErrorsChecker.checkLastGenerationHasCompilationError(true)`. **Esta clase esta en otro bundle**
   (`org.talend.designer.runprocess`): se carga con `Platform.getBundle(...).loadClass(...)`, no con el
   classloader de `org.talend.core`.
3. Si hay errores lanza `ProcessorException` con `Error Line: N` y `Detail Message: ...`; `generateCode` ya puede
   lanzarla por si mismo (el check interno es el de `generateBuildInfo`).

**Tiene que ir en el hilo de la UI.** `generateBuildInfo` llama a `JavaProcessor.syntaxCheck` ->
`TalendJavaEditor.validateSyntax`, que toca widgets; desde otro hilo da `SWTException: Invalid thread access`.
Studio lo hace igual, dentro de un `ProgressMonitorDialog` en el hilo de UI. Es la excepcion consciente a la regla
de la seccion 26: dura segundos, se pide explicitamente y la ruta usa un tiempo de espera de 180 s.

Verificado: un `tFileInputDelimited` con `FILENAME` sin comillas da `Syntax error on token ":"` (linea 874) y con
`literal: true` compila. Un `tFixedFlowInput` -> `tLogRow` compila sin errores.

**Lectura de los fallos:** un componente de salida a archivo sin `FILENAME` da `The constructor File() is
undefined`: es un parametro obligatorio sin rellenar, no un fallo del MCP. Lo mismo `FileWriter()` en
`tFileOutputJSON`. Al medir L4 hay que darle a cada componente sus parametros obligatorios.

## 29. El catalogo tiene una variante de cada componente por tipo de job

El catalogo de Studio (`IComponentsFactory.getComponents()`) devuelve **1294 entradas**, pero no son 1294
componentes distintos: el mismo nombre aparece una vez por tipo de job, y `IComponent.getPaletteType()` dice cual.

| `getPaletteType()` | Entradas | Para que job |
|---|---|---|
| `DI` | 897 | Standard (Data Integration) |
| `SPARK` | 166 | Spark Batch |
| `SPARKSTREAMING` | 171 | Spark Streaming |
| `STRUCTUREDSTREAMING` | 60 | Structured Streaming |

Las variantes **no son intercambiables**: tienen parametros distintos. Con `tFileOutputDelimited`, la variante
Standard declara `FILENAME` (`REQUIRED="true"`, tipo `FILE`) y la de Spark declara `FOLDER`
(`DIRECTORY_HADOOP`). Buscar "el primero que case" por nombre devolvia a veces la de Spark, y el job Standard
quedaba con parametros que no son suyos. Por eso:

- `TalendApi.findCatalogComponent(nombre)` busca la variante `DI` (con respaldo a la primera que case).
- `ComponentCatalog.list` devuelve por defecto solo `DI` y sin duplicados; `paletteType: "*"` devuelve todas y
  `byPaletteType` da el recuento.
- Los componentes de Spark/Streaming solo tienen sentido en un job de ese tipo, que el MCP aun no crea.

### Donde estan las definiciones

Cada componente tiene su definicion en disco: `plugins/org.talend.designer.components.localprovider_*/components/<nombre>/`
(Standard; tambien `sparkprovider` y `sparkstrprovider`), con `<nombre>_java.xml` (parametros, `REQUIRED`,
`DEFAULT`, `SHOW_IF`) y las plantillas `*.javajet` que generan el codigo. Son la fuente mas fiable para saber que
parametros exige un componente y como se usan, y se pueden leer sin abrir Studio.

### Leer los parametros de un componente suelto

`new Node(component)` necesita un proceso: su `init` le pide un nombre unico y da NPE si no lo hay. Se usa el
constructor `Node(IComponent, IProcess2)` con el proceso del job activo o, si no hay ninguno, el del job de
trabajo `MCP_Scratch` (se crea la primera vez). El nodo no se anade al job. Los parametros de cada elemento dicen
`required` (`isRequired()`), `show` (`isShow(lista)`) y `readOnly`: `isRequired` es muy generoso (tambien marca
casillas), asi que para rellenar se usa obligatorio **y** visible **y** editable **y** de tipo texto, archivo o
carpeta **y** con valor vacio.

## 30. La definicion de cada componente esta en el XML de la instalacion

Cada componente deja su definicion en el disco de la instalacion de Studio:

```
<studio>/plugins/org.talend.designer.components.<proveedor>_<version>/components/<nombre>/<nombre>_java.xml
```

Los proveedores son `localprovider` (Standard), `bigdata`, `tisprovider`, `tdqprovider`, `ipaas`,
`publish.cloud`, `sparkprovider`, `sparkstrprovider` y `structuredstreamprovider`. Cada uno trae su copia de
`<nombre>_java.xml` y las plantillas `*.javajet` que generan el codigo. **El XML es la fuente autoritativa de lo
que un componente exige**, y se puede leer sin abrir Studio.

### Que se lee de cada XML

| Que | Donde | Para que |
|---|---|---|
| Parametros | `<PARAMETERS>` y `<ADVANCED_PARAMETERS>` | Que hay que rellenar |
| Obligatorio | `REQUIRED="true"` | Sin esto el codigo no compila |
| Valor por defecto | `<DEFAULT>...</DEFAULT>` (elemento hijo, no atributo) | El valor con el que se rellena |
| Visibilidad | `SHOW`, `SHOW_IF`, `NOT_SHOW_IF` | Que parametros se ven de verdad |
| Valores de una lista | `<ITEMS><ITEM NAME= VALUE=/></ITEMS>` | Los valores posibles |
| Conexiones | `<CONNECTORS><CONNECTOR NAME= CTYPE= MAX_INPUT= MAX_OUTPUT=/></CONNECTORS>` | Que conexiones admite |
| Artefactos | `<CODEGENERATION><IMPORTS><IMPORT MVN= REQUIRED=/></IMPORTS>` | Lo que le hace falta instalado |
| Columnas de salida | `<RETURNS><RETURN NAME= TYPE=/></RETURNS>` | Que devuelve |
| Familia | `<FAMILIES><FAMILY>...</FAMILY></FAMILIES>` | En que grupo esta (puede estar en varias) |
| Arranca un flujo | `HEADER STARTABLE="true"` | Si se puede usar como origen |

Detalles que surprises y que costan tiempo:

- **El valor por defecto es un elemento hijo**, `<DEFAULT>";"</DEFAULT>`, y ya es un literal de Java: lleva sus
  comillas. Un `DEFAULT` de atributo es otra cosa (no existe en estos XML).
- **El conector tiene dos nombres**: `NAME` es el que se usa al conectar (`FLOW`, `REJECT`, `ITERATE`,
  `UNIQUE`...) y `CTYPE` es el tipo de enlace. El conector principal no lleva `NAME`: se llama como su tipo.
- **El `MAX_INPUT`/`MAX_OUTPUT` del conector principal**: `MAX_INPUT=0` significa que el componente no puede
  recibir flujo (es un origen); `MAX_INPUT>=1` significa que consume. El `MAX_OUTPUT` del conector principal
  suele valer 1, asi que **no dice por si solo si el componente produce**: hay que mirar si tiene un conector
  propio (`REJECT`, `UNIQUE`, `DUPLICATE`...). El `FLOW` del `tUniqRow` tiene `MAX_OUTPUT="0"`: sus filas salen
  por `UNIQUE`.
- **Las macros de Talend** (`__COMP_DEFAULT_FILE_DIR__`) y las referencias a contexto (`${...}`) no sirven como
  valor: hay que sustituirlas por una ruta real.
- **Los componentes de la generacion nueva no estan en el XML**: vienen en archivos `.car` (AWS, JDBC, Snowflake,
  Athena, Delta, DynamoDB, SQS...). Son 120 de los 897 Standard. Su definicion esta en el codigo Java, asi que
  para ellos la unica fuente es la API de Studio.

### Lo que dice el modelo de Studio, y como se compara con el XML

- Los componentes "de siempre" son `org.talend.designer.core.model.components.EmfComponent`. Su
  `getCONNECTORList()` devuelve los mismos conectores que el XML (`CONNECTORTypeImpl` con `getNAME`, `getCTYPE`,
  `getMAXINPUT`, `getMAXOUTPUT`, `getSHOWIF`, `getNOTSHOWIF`, `getBASESCHEMA`).
- Los de la generacion nueva son `org.talend.sdk.component.studio.ComponentModel` y su `getCONNECTORList()` es
  **null**: no declaran conectores en el modelo. Por eso el generador se queja con
  "Missing output connection for component JDBC#Input" cuando se compilan sueltos. La conexion se puede crear
  igual (con `ConnectionCreateCommand`) y el componente compila: lo que falta es el `tLogRow` de destino.

### Las tablas de los parametros (FORMATS, CONDITIONS, CRITERIA...)

Los parametros de tipo `TABLE` son la parte que faltaba para configurar los componentes de transformacion. El
XML los describe:

```xml
<PARAMETER NAME="FORMATS" FIELD="TABLE" REQUIRED="true" NUM_ROW="60" NB_LINES="5">
  <ITEMS BASED_ON_SCHEMA="true">
    <ITEM NAME="SIZE" VALUE="10" CONTEXT="LENGTH" />
    <ITEM NAME="PADDING_CHAR" VALUE="' '" />
    <ITEM NAME="ALIGN" FIELD="CLOSED_LIST">
      <ITEMS DEFAULT="LEFT">
        <ITEM NAME="LEFT" VALUE="'L'" />
      </ITEMS>
    </ITEM>
  </ITEMS>
</PARAMETER>
```

- `BASED_ON_SCHEMA="true"`: la tabla tiene **una fila por cada columna del schema**.
- `NB_LINES`: numero de filas cuando no depende del schema.
- Cada `ITEM` es una columna de la tabla, con su valor por defecto. Si es una lista cerrada (`FIELD="CLOSED_LIST"`),
  su valor por defecto es el del `ITEM` que marca `DEFAULT`.

**La tabla del nodo puede tener mas columnas que las del XML**: la `FORMATS` del `tFileOutputPositional` declara
cuatro (SIZE, PADDING_CHAR, ALIGN, KEEP) y en el nodo hay cinco, con `SCHEMA_COLUMN` delante. Por eso las filas
se tienen que alinear con los codigos del nodo (`getListItemsDisplayCodeName`), no con los del XML.

Sin filas, el codigo generado sale con un hueco: el `tFileOutputPositional` genera
`tempLengthBx<<` y da "Syntax error on token '<'". Con las filas puestas, compila.

### El orden en que hay que montar un componente

Para medir si un componente compila (L4), el componente no puede estar solo:

1. Se anade el componente.
2. Se rellenan sus parametros obligatorios (los del XML, con su valor por defecto cuando existe).
3. Si **consume** (`MAX_INPUT >= 1`), se anade un `tFixedFlowInput` **con schema** y se conecta. El schema va
   antes de conectar: al conectar, Talend rehace las tablas del componente con las del origen. Si el componente
   tiene schema fijo (el `tFileOutputRaw`, que solo escribe una columna `content`), el origen tiene que traer
   esas mismas columnas: si no, "content cannot be resolved or is not a field".
4. Se rellenan las tablas del plan, ahora que ya se sabe cuantas columnas tiene el schema.
5. Se compila. Si el fallo es "Missing output connection", se anade un `tLogRow` y se compila otra vez.
6. Se borra todo.

### Las condiciones de visibilidad

`SHOW_IF` y `NOT_SHOW_IF` usan la sintaxis de expresiones de Talend: comparaciones de un parametro con un valor
entrecomillado, unidas con `and` y `or`, agrupadas con parentesis. Se pueden evaluar en el MCP:

```
(APPEND=='false') and (SPLIT=='false')
```

Un parametro cuya condicion no se puede decidir (porque depende de otro que no se conoce) se rellena con su
valor por defecto: es inofensivo.
