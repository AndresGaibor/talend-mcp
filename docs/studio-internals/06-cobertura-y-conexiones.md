# Internals de Talend Studio: Cobertura, conexiones, contextos y procesos

[Indice completo](../TALEND-STUDIO-INTERNALS.md)

## 31. La cobertura con montaje: como se mide L3 y L4 de verdad

`scripts/coverage.ts` mide el catalogo Standard (897 componentes). Cada componente se crea, se configura con sus
parametros obligatorios, **se monta** (origen y destino), se compila y se borra. El plan de montaje lo calcula el
MCP, leyendo el XML de la instalacion (`planMount`): que parametros van y si hace falta un origen.

- `--family "File/Input,File/Output"`: mide solo esas familias.
- `--components a,b,c`: mide los componentes indicados.
- `--compile`: ademas genera el codigo y comprueba que compila (L4).
- `--cancel`: para la medicion en marcha.

El ritmo es de unos 4 s por componente (la primera medicion, sin montaje, iba a 19 s: lo que mas costa es
generar el codigo y que el job se ensucie).

Lo que se midio con el metodo viejo (sin parametros obligatorios ni montaje), y lo que se mide ahora:

| | Antes | Ahora |
|---|---|---|
| `tFileOutputDelimited` | No compilaba (`The constructor File() is undefined`) | Compila |
| `tFileOutputRaw`, `tFileOutputLDIF`, `tFileOutputProperties` | No compilaban (schema incompatible) | Compilan |
| `tFileOutputPositional` | No compilaba (`Syntax error on token '<'`) | Compila |
| `tFilterRow`, `tSortRow`, `tAggregateRow` | "El `.item` sale, no genera codigo" | Compilan |
| `JDBCInput` y los demas de la generacion nueva | `Missing output connection` | Compilan (con el `tLogRow` de destino) |

Lo que **no** se arregla con esto, y es un limite del entorno:

- `tFileInputARFF`, `tFileInputXML`, `tFileOutputARFF`: el componente esta escrito para otra version de Weka
  (`addStringValue(String)`, `initXPaths_0`) y la que trae Studio no encaja.
- `tFileInputMSXML`: el codigo generado sale con una llave sin cerrar.
- Los componentes de base de datos: necesitan una conexion real del repositorio para compilar.

## 32. Conectar bien: el nombre de la conexion y el del conector

Conectar dos nodos tiene **dos** nombres, y confundirlos rompe el job de formas muy distintas:

| Que | Donde | Ejemplo |
|---|---|---|
| El **conector** | El atributo `connectorName` de la conexion, y el `NAME` del `<CONNECTOR>` del XML | `FLOW`, `UNIQUE`, `DUPLICATE`, `REJECT`, `ITERATE`, `SUBJOB_OK` |
| El **nombre** de la conexion | El `label` de la conexion: es la variable de la fila en el codigo generado | `row1`, `row2`, `OnComponentOk`, `If`, `Iterate` |

### El nombre de la conexion es `row1`, `row2`... y es global al job

Es la variable de la fila en el codigo generado, y las tablas de los componentes la referencian: el
`tAggregateRow` guarda "row1.monto" en su tabla `OPERATIONS`, y el `tUniqRow` "row1.id" en su `UNIQUE_KEY`.

- El numero es **del job**, no del nodo: la numeracion se hace con las conexiones que ya tiene el proceso, no
  con las del nodo de destino. En los jobs reales se ve como "row1", "row2" repartidas por todo el job.
- Los triggers tienen nombre fijo: `COMPONENT_OK` -> "OnComponentOk", `SUBJOB_OK` -> "OnSubjobOk", `RUN_IF` ->
  "If", `ITERATE` -> "Iterate".
- **El nombre tiene que ser distinto del de la conexion de entrada del nodo.** El `tUniqRow` libera la fila de su
  conexion de salida (`<salida> = null;`) antes de leer la de entrada: si las dos se llaman "row1", el codigo
  generado lee una variable nula ("Cannot read field \"id\" because \"row1\" is null").

### No todos los componentes sacan las filas por el conector principal

El `tUniqRow` declara `<CONNECTOR CTYPE="FLOW" MAX_OUTPUT="0" MAX_INPUT="1"/>` (el principal, que no puede
emitir) y luego dos conectores mas: `UNIQUE` (las filas unicas) y `DUPLICATE` (las repetidas). Conectar la salida
por "FLOW" **no da error**: el job compila y no sale ninguna fila. El conector se saca del XML del componente.

Lo mismo pasa con las tablas: el `tUniqRow` tiene una tabla por columna del schema (`BASED_ON_SCHEMA="true"`), y
la columna que forma la clave se marca con `KEY_ATTRIBUTE="true"`. La tabla del `tSortRow` (`CRITERIA`) usa los
valores de su XML: `SORT` es "num"/"alpha"/"date" y `ORDER` es "asc"/"desc" (en minusculas). Con otros valores, el
generador falla con "Index 0 out of bounds for length 0".

### El formato de las tablas de transformacion (resuelto)

Con el job montado a mano y con estos valores, el `tUniqRow` y el `tSortRow` generan codigo que compila y
ejecuta:

| Componente | Tabla | Columnas | Filas |
|---|---|---|---|
| `tUniqRow` | `UNIQUE_KEY` | `SCHEMA_COLUMN`, `KEY_ATTRIBUTE`, `CASE_SENSITIVE` | Una por columna del schema. `SCHEMA_COLUMN` es **la conexion de entrada mas la columna** ("row1.id"), y `KEY_ATTRIBUTE` va a "true" en las columnas que forman la clave |
| `tSortRow` | `CRITERIA` | `COLNAME`, `SORT`, `ORDER` | `COLNAME` es **solo el nombre de la columna** ("monto"), sin el prefijo de la conexion. `SORT` es "num"/"alpha"/"date" y `ORDER` es "asc"/"desc" |

Los dos detalles que mas costan:

- El prefijo de la conexion: en el `tUniqRow` va ("row1.id") y en el `tSortRow` no ("monto"). Con el prefijo
  equivocado, el `tSortRow` falla con "Index 0 out of bounds for length 0" (busca la tabla del nombre de la
  conexion y no la encuentra).
- **El schema de salida va en el conector que le toca**: el `tUniqRow` tiene dos conectores de datos, `FLOW` (la
  entrada) y `UNIQUE` (la salida), y su schema de salida va en `UNIQUE`. Si se deja vacio, el codigo generado no
  tiene struct de salida y no compila ("monto cannot be resolved or is not a field").

### El `tAggregateRow`: dos tablas de metadata y una conexion que cambia de tabla

El `tAggregateRow` es el caso dificil: tiene una tabla de entrada y otra de salida, y las dos van en el conector
`FLOW`. Ademas, **la conexion guarda la tabla de metadata por referencia**: al rellenar el schema del nodo, la
tabla que tiene la conexion de entrada se sustituye, y el generador deja de encontrar las columnas de entrada
("inputColumn is null").

Lo que se ha probado:

- El schema de salida (las columnas que produce: las del `GROUPBYS` y las del `OPERATIONS`) tiene que estar en
  el nodo, y **la primera** de las tablas: si no, el generador no encuentra la columna de salida ("outputColumn is
  null").
- La tabla de entrada tiene que traer las columnas del origen.

Lo que falta: hacer que el relleno del schema **no** rompa la tabla que la conexion tiene asignada (habria que
fusionar el schema con el que ya tiene el nodo en vez de sustituirlo) y saber que nombre espera el generador
para la tabla de entrada. Queda como pendiente.

### El conector es el del origen, no tiene que existir en el destino

El `connectorName` de la conexion es el conector **de salida del origen**. El destino usa su conector de
entrada principal, que no tiene por que llamarse igual: el `REJECT` del `tFileInputDelimited` entra en el
`FLOW` de un `tLogRow`, y el `UNIQUE` del `tUniqRow` tambien.

Por eso, al conectar, hay que mirar:
- que el conector sea una salida **del origen** (y que pueda emitir: el `FLOW` del `tUniqRow` tiene
  `MAX_OUTPUT="0"`);
- que el destino tenga algun conector de entrada.

Conectar por un conector que el origen no tiene (o que no puede emitir) **no da error**: el job se guarda,
compila y no sale ninguna fila. La tool `talend_job_connect_nodes` lo comprueba con las definiciones del XML
y avisa (con `skipValidation` se puede saltarse).

Al conectar, Talend rehace las tablas del componente con las del origen y se pierde lo que se habia puesto antes.
Es lo que pasa con el `tMap` (su modelo se aplica al final) y con las tablas de transformacion: se conectan los
nodos y despues se rellenan las tablas.

## 33. Ejecutar un job y leer su salida

Para comprobar el resultado de un job (L5) hacen falta dos pasos, porque la vista Run de Studio no se puede leer:

1. **Generar y compilar**: el Run de Studio (`/automation/run-active-job`) genera el codigo, lo compila y lo
   ejecuta. Deja el job compilado en `<proyecto>/poms/jobs/process/<job>/<job>_<version>/`, con un
   `target/classpath.jar` que lleva el classpath completo en su MANIFEST.
   - El Run es **asincrono** y el tracker del bridge no ve la terminacion: no hay que esperarlo (`waitForTermination`
     se queda esperando el tiempo entero).
   - La launch config se crea sola si no existe (`MCP_L5_Humo 0.1`).
2. **Relanzar para leer la salida**: `/automation/job/execute` ejecuta el job ya compilado en otra JVM y devuelve
   su `exitCode` y sus lineas.

El script `scripts/execution-check.ts` hace los dos y compara la salida con la esperada. Los escenarios estan en
`tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json`.

## 34. Los jobs de Big Data (Spark)

Un job de Spark no es un job Standard con otros componentes: se declara en tres sitios a la vez.

| Donde | Que |
|---|---|
| El `.item` | `<talendfile:ProcessType ... jobType="Big_Data_Batch" framework="Spark">` |
| El `.properties` | El item es un `<MapRedProperties:MapReduceProcessItem>` (no un `ProcessItem`) y la propiedad lleva `<additionalProperties key="FRAMEWORK" value="Spark"/>` |
| El repositorio | El item se registra con el tipo `PROCESS_MR` ("Big Data Batch"), no con `PROCESS` ("Job Designs") |

Y sus archivos van en `process_mr`, **sin carpeta propia**: `process_mr/<job>_<version>.item`, al lado de los demas.
Los jobs normales van en `process/<job>/<job>_<version>.item`.

El item de Big Data no lo crea el modelo base: es
`org.talend.designer.mapreduce.mapRedProperties.MapRedPropertiesFactory` (plugin `org.talend.designer.mapreduce`).
Y el mapa de propiedades de EMF (`EcoreEMap`) **no es un `java.util.Map`**: para anadir el `FRAMEWORK` hay que
llamarle al `put` por reflexion.

El MCP ya crea estos jobs con `jobType` y `framework` (`talend_job_create_in_studio`), y los archivos salen
identicos a los de un job de Spark hecho a mano. **Pero este workspace no los puede abrir**: ni el job de Spark del
usuario (`prueba_3_Spark`) ni el del MCP abren, con "No se pudo resolver el ProcessItem para ...item. Verifique
que el job este en el repositorio Talend activo". Es un estado del repositorio del proyecto (los items de Big
Data no estan indexados), no del MCP. Los 397 componentes de Spark y Streaming siguen sin poder usarse.

## 35. Conectar con una base de datos

En Talend 8 la conexion se hace con **dos nodos**: un componente de conexion (`tPostgresqlConnection`,
`tMysqlConnection`, `tJDBCConnection`...) y el componente que usa la conexion (`tPostgresqlInput`,
`tMysqlOutput`...).

| Nodo | Parametros |
|---|---|
| `tPostgresqlConnection` | `HOST`, `PORT`, `USER`, `PASS`, `DBNAME` (no `DATABASE`), `ENCODING` |
| `tPostgresqlInput` | `USE_EXISTING_CONNECTION` a "true", `CONNECTION` con el nombre unico del nodo de conexion, `TABLE` o `QUERY` |

Tres detalles que cuestan un rato:

- **El driver tiene que estar en el `.m2` de Studio**, con la version exacta que pide el build. El build
  avisa por el log ("missing jar:postgresql-42.7.13.jar") y sale un modal "Error found". Se instala con la
  tool de artefactos (`talend_studio_install_artifact`, que deja el jar en
  `<instalacion>/configuration/.m2/repository`).
- **La `QUERY` es un memo** y los memos no se entrecomillan solos (el codigo Java del `tJavaRow` va en crudo).
  Una consulta SQL si necesita comillas: hay que pedirlo con `literal: true`. Si no, el codigo generado sale
  como `String dbquery = select id from clientes;` y no compila.
- **La `CONNECTION` es una lista de componentes**: su valor va **en crudo**, sin comillas (`literal: false`). Con
  comillas, el codigo sale como `globalMap.get("conn_"tDBConnection_2"")` y no compila.

El Postgres de pruebas se levanta con Docker (`testdata/docker-compose.yml`, puerto 5433) y sus datos tienen una
trampa a proposito: una transaccion que apunta a un cliente que no existe. La clave foranea se anade al final de
la carga y "NOT VALID", para que la carga no falle.

## 36. Los contextos (los entornos) de un job

Un job tiene contextos: "Default", "produccion"... Cada contexto tiene las mismas variables con **su propio
valor**. Son lo que se edita en la pestana Contexts de Studio.

La API de Studio (paquete `org.talend.core.model.context`):

| Que | Como |
|---|---|
| El gestor | `process.getContextManager()` -> `JobContextManager` |
| Los contextos | `manager.getListContext()` (un `ArrayList` mutable) |
| El entorno por defecto | `manager.getDefaultContext()` |
| Un contexto | `manager.getContext(indice)`, `context.getName()`, `context.setName(n)` |
| Crear un contexto | `new JobContext(nombre)` (el constructor recibe el nombre) |
| Las variables | `context.getContextParameterList()`, `context.getContextParameter(nombre)` |
| Crear una variable | `new JobContextParameter()` y `setName`/`setType`/`setValue` |
| Avisar del cambio | `manager.setModified(true)` y `manager.fireContextsChangedEvent()` |

El MCP los edita con esa API (no escribiendo el XML a mano) y guarda el job con `JobPersistence.persist`, asi que
el `.item` queda como lo dejaria el IDE:

```xml
<context confirmationNeeded="false" hide="false" name="produccion">
  <contextParameter name="DB_HOST" promptNeeded="false" repositoryContextId="" type="id_String" value="db.produccion.local" internalId="..."/>
</context>
```

**Los valores no viajan en el codigo generado**: la clase `ContextProperties` del job generado declara los campos
("will be instanciated by MS") y los injecta el runtime. Por eso un job relanzado a mano (`java -cp classpath.jar`)
no ve los valores del contexto, aunque su build tenga el `contexts/Default.properties` con ellos. Para comprobar
un contexto hay que leerlo del modelo (`talend_job_contexts_list`), no de la salida del job.

El runtime los acepta como argumentos: `--context=NOMBRE` y `--context_type CLAVE=VALOR` (por cada variable). El
bridge los lee del modelo y se los pasa al relanzar, asi que un job con contextos si se puede comprobar.

## 37. Los contextos del proyecto (los items de tipo "Contexts")

Son los items de la carpeta `context` del proyecto: un `.item` con un `ContextType` por entorno (y sus
`contextParameter`) y un `.properties` con las referencias (`<context href="...#xmi:id"/>`).

| Que | Como |
|---|---|
| El tipo del item | `ERepositoryObjectType.CONTEXT` ("Contexts") |
| El item del repositorio | `PropertiesFactory.createContextItem()` |
| Un entorno | `TalendFileFactory.createContextType()` |
| Una variable | `TalendFileFactory.createContextParameterType()` |
| Las variables de un entorno | No estan en la contencion: estan en la caracteristica `contextParameter` del `ContextType` (con `eGet`), y la lista solo admite cambios cuando el item ya esta guardado |

Dos cosas que se-ahead por el camino:

- **El `eGet` hay que buscarlo por el tipo de su argumento**: `eGet` tiene sobrecargas (por indice y por
  caracteristica), y la clase del modelo puede venir de otro classloader (el del plugin y el del puente), asi que
  buscar el metodo por nombre y llamarlo con la caracteristica falla con "argument type mismatch".
- **Crear un contexto del proyecto por la API no funciona**: el item se registra (el `.properties` sale) pero el
  entorno no se puede enganchar (las referencias del item solo admiten cambios cuando ya esta guardado y no hay
  forma de forzarlo). Por eso la tool falla con un error claro y borra lo creado, en vez de dejar un contexto
  vacio en el proyecto. Crear y leer si se pueden hacer con la API; los entornos y sus variables se leen del
  `.item` de cada item.

Y el orden de los entornos: el que trae `defaultContext="Default"` en el `.properties` es el de por defecto.



## 38. El proyecto Maven duplicado: "duplicated in the reactor"

Cuando un job se borra y se vuelve a crear, Studio deja en el workspace **dos** proyectos Maven con el mismo
nombre, y entonces **ningun job compila**:

```
[ERROR] Project 'org.example.prj_bancolombia.job:MCP_Coverage:0.1.0' is duplicated in the reactor
```

Los dos sitios posibles, bajo `poms/jobs/process` del proyecto de Eclipse:

| Sitio | Cuando pasa |
|---|---|
| `process/mcp_coverage_0.1/` | El proyecto generado, junto a los demas jobs |
| `process/MCP_Coverage/mcp_coverage_0.1/` | El proyecto generado, dentro de la carpeta del job |

La carpeta se llama `<etiqueta>_<version>` y en minusculas (`mcp_coverage_0.1`), **no** la etiqueta. Por eso el
borrado del bridge no la encontraba: buscaba una carpeta llamada `MCP_Coverage` y seakia el proyecto por debajo,
y se dejaba el otro. El fallo era silencioso: el job se creaba, se guardaba y se montaba bien, pero el build
fallaba siempre, asi que la medicion de cobertura daba **0 compilados** sin que se entendiera el por que.

Arreglo: al borrar un job se borran **todos** los proyectos generados con ese nombre (haya item en el repositorio
o no), en los dos sitios. Y si aparece el error, se mira si hay dos carpetas con el mismo `pom.xml`.

## 39. El proceso viejo: el build compila el job que no es

Al borrar un job y volverlo a crear, el **editor del proceso anterior** puede seguir abierto en Studio. Entonces el
build (`ProcessorUtilities.generateCode`) usa el proceso viejo, cuyo `JobInfo` tiene el `projectFolderName` a null, y
el agregador de Maven lista el modulo sin la carpeta del job:

```
[ERROR] Child module .../poms/jobs/process/mcp_coverage_0.1 of .../poms/build-aggregator.pom does not exist
```

El proyecto Maven, en cambio, si esta en `poms/jobs/process/MCP_Coverage/mcp_coverage_0.1` (con la carpeta). O sea:
el error no es que falte el proyecto, es que **el build esta mirando el job anterior**.

Se ve tambien en el `JobInfo` que devuelve `ProcessorUtilities.getMainJobInfo()`: `getJobName` es el job nuevo y
`getProjectFolderName` es null (en un job sano, es la carpeta del job en el arbol del repositorio).

Al borrar un job hay que hacer dos cosas, y las dos estan en `JobRepository.delete`:

1. **Cerrar sus editores** (`closeEditorsOfJob`), para que no quede el proceso viejo.
2. **Borrar el proyecto Maven generado**, como proyecto de Eclipse (`IProject.delete`), no solo la carpeta: si se
   borra la carpeta y el proyecto de Eclipse sigue dado de alta, m2e se queda con su entrada en
   `workspacestate.properties` y el build de cualquier job falla con "El recurso .../pom.xml no existe".

## 39. El heap de Studio se llena y el IDE deja de responder

Una sesion de mediciones largas (unas 150 en total: las familias de archivos, las locales, MySQL y las que se
cancelaron) dejo a Studio **sin memoria**: el heap del JVM (4 GB) estaba al 100 % y el IDE se quedo colgado
(hacia el 100 % de CPU en varios nucleos, que es el recolector de basura en espiral). La interfaz no respondia, el
bridge tampoco (todas sus rutas esperan al hilo de la UI) y al final el proceso de Studio murio.

Como se ve:

```bash
jcmd <pid> GC.heap_info
# garbage-first heap   total 4194304K, used 4191494K   <- lleno
```

Que se llena, en este orden:

| Sospechoso | Por que |
|---|---|
| El codigo generado de cada job | Cada medicion compila el job de pruebas: quedan el proyecto Maven, su `target` y el codigo fuente generados. Con 150 mediciones son cientos de megabytes que Eclipse indexa (el hilo "Indexado Java" se dispara) |
| Los proyectos Maven que se borran a posteriori | Al borrar el proyecto de Eclipse, m2e actualiza su estado (`workspacestate.properties`) y el indexer vuelve a indexar |
| El `run_code` del bridge | Cada ejecucion cargaba las clases en un `URLClassLoader` que no se cerraba nunca: las clases compiladas se quedaban en el heap |

Que se hizo para que no vuelva a pasar:

1. **La medicion vigila la memoria**: `scripts/coverage.ts` consulta la memoria del JVM en cada vuelta y **cancela la
   medicion al 80 %** del heap, en vez de dejar que el IDE se quede sin memoria.
2. **Una ruta nueva para ver la memoria**: `/automation/memory` (y la tool `talend_studio_memory`) dicen cuanto
   heap se lleva, y con `gc: true` piden una recoleccion.
3. **El `run_code` cierra su classloader** al terminar.

Y la moraleja: **entre mediciones largas hay que reiniciar Studio**. Una medicion de 44 componentes tarda un minuto
y no pasa nada; tres o cuatro seguidas, con todo el codigo generado, pueden tumbar el IDE. Ademas, `jcmd <pid>
GC.run` recupera a un Studio que se ha quedado sin memoria (si el proceso no ha muerto todavia).

## 40. Los triggers: el conector va con el tipo del catalogo

Una conexion de trigger (el "On subjob ok" de un componente) tiene **dos** nombres, y aqui se confunden facil:

| Que | Atributo en el `.item` | Valor de un trigger |
|---|---|---|
| El **conector** | `connectorName` | `SUBJOB_OK`, `COMPONENT_OK`, `RUN_IF`... (el tipo del catalogo) |
| El **nombre de la conexion** | `label` | `OnSubjobOk`, `OnComponentOk`, `If`... |

Es decir, un trigger bien hecho se guarda asi:

```xml
<connection connectorName="SUBJOB_OK" label="OnSubjobOk" lineStyle="1"
            metaname="tDBOutput_2" source="tDBOutput_2" target="tDBCommit_2">
```

Con `connectorName="OnSubjobOk"` (el nombre "bonito") pasan tres cosas en cadena:

1. `Node.getConnectorFromName("OnSubjobOk")` devuelve `null`: la lista de conectores del nodo tiene
   `SUBJOB_OK`, no `OnSubjobOk`. El `ConnectionCreateCommand` revienta con
   `NullPointerException: nodeConnectorSource is null` (se ve en `.metadata/.log`), pero **despues** de haber
   metido la conexion en el modelo.
2. La conexion queda con `lineStyle="0"` (flujo de datos) y el `connectorName` que se le paso.
3. El generador la trata como flujo: copia la fila del origen en un struct del destino que no tiene columnas y
   el job no compila con `nombre cannot be resolved or is not a field`.

El comando saca el tipo de la linea de
`INodeConnector.getDefaultConnectionType()` del conector que se le pasa, asi que con el nombre del catalogo no
hace falta tocar el estilo a mano. Los estilos que se han medido en el `.item`, por si hay que comprobarlos:

| `lineStyle` | Tipo de conexion |
|---|---|
| 0 | `FLOW_MAIN` (`FLOW`) |
| 1 | `ON_SUBJOB_OK` (`OnSubjobOk`) |
| 4 | `ON_SUBJOB_ERROR` (`OnSubjobError`) |

Ojo: el `lineStyle` **no** es el ordinal del enum (en `EConnectionType`, `ON_SUBJOB_OK` es el 3 y
`ON_SUBJOB_ERROR` el 4). El enum tiene 24 constantes, y lo que va en el `connectorName` del `.item` es
`getName()`, no `name()`:

| `name()` | `getName()` |
|---|---|
| `FLOW_MAIN` | `FLOW` |
| `ON_SUBJOB_OK` | `SUBJOB_OK` |
| `ON_SUBJOB_ERROR` | `SUBJOB_ERROR` |
| `ON_COMPONENT_OK` | `COMPONENT_OK` |
| `ON_COMPONENT_ERROR` | `COMPONENT_ERROR` |
| `RUN_AFTER` | `AFTER` |
| `RUN_IF` | `RUN_IF` |
| `FLOW_REF` | `LOOKUP` |
| `FLOW_MERGE` | `MERGE` |
| `ITERATE` | `ITERATE` |

Todos los nodos llevan los conectores de trigger en su lista (`SUBJOB_OK`, `SUBJOB_ERROR`, `COMPONENT_OK`,
`COMPONENT_ERROR`, `RUN_IF`, `AFTER`...), aunque el componente no los use. Se consultan con
`node.getListConnector()` (`getConnectors()` no existe) y cada uno trae `getName()`, `getBaseSchema()` y
`getDefaultConnectionType()`.
