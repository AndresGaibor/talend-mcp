# Guia del agente: usar el MCP para construir y ejecutar jobs de Talend

Para un agente (o una persona) que **usa** el MCP contra un Talend Studio abierto. Si lo que vas a
hacer es cambiar el codigo del repo, empieza por [AGENTS.md](../AGENTS.md); aqui se explica como
operar Studio.

## Punto de entrada para un agente nuevo

En una sesion MCP, empieza por `talend_guide { mode: "overview" }`. El servidor tambien entrega
instrucciones durante `initialize`. Para ver una tarea concreta, usa
`talend_guide { mode: "task", task: "crear-job" }`; para buscar por lenguaje natural, usa
`talend_guide { mode: "search", query: "contextos" }`. La guia avisa si el preset activo oculta
alguna tool requerida. Para agentes nuevos, `TALEND_MCP_FILTER=agent` expone las herramientas del
ciclo habitual de un job; `all` expone las capacidades avanzadas.

El catalogo generado de tools, argumentos y requisitos esta en
[CATALOGO-DE-TOOLS.md](CATALOGO-DE-TOOLS.md). Para aprender el codigo de este repositorio, consulta
[ARQUITECTURA.md](ARQUITECTURA.md) y [PLAN-DE-TRABAJO.md](PLAN-DE-TRABAJO.md).

La regla que resume todo: **los jobs se crean y se modifican con la API de Studio (via el
bridge), nunca escribiendo el `.item` a mano.** Cuando se escribio el XML por fuera, Studio
dejo el modelo en memoria obsoleto, aparecieron tipos que no existen (`id_Decimal`), valores
corruptos (`Main1100Main1`) y jobs vacios. Con la API, cada nodo nace con todos sus parametros
por defecto y Studio escribe el archivo.

## 1. Las piezas y como hablan

```
cliente MCP  --HTTP-->  servidor MCP (Bun)  --HTTP + Bearer-->  bridge (plugin Java)  -->  APIs de Studio
              :3927/mcp                                         127.0.0.1:3930
```

| Pieza | Que es | Donde |
|---|---|---|
| Servidor MCP | ~220 tools `talend_*`. Las de lectura trabajan sobre los `.item` del workspace | `index.ts`, `src/` |
| Bridge | Plugin Java dentro de Studio. Crea y edita jobs con la API nativa, ejecuta, cierra modales | `talend-studio-bridge/` |
| Config del bridge | `~/.talend-bridge/config.json` (`readOnly`, `unsafeActions`, `port`) | maquina local |
| Token del bridge | `~/.talend-bridge/token`; el MCP lo lee solo | maquina local |

Dos familias de tools, con reglas distintas:

- **Lectura y analisis sobre disco** (`talend_jobs_list`, `talend_jobs_read`, `talend_errors_*`,
  `talend_validation_*`, `talend_secrets_*`...). No necesitan Studio abierto.
- **Operar Studio en vivo** (`talend_job_*_in_studio`, `talend_job_add_node`,
  `talend_job_connect_nodes`, `talend_jobs_create`, `talend_studio_*`, `talend_bridge_*`). **Necesitan Studio
  abierto con el bridge cargado.** Son las que crean y modifican jobs.

`talend_jobs_list` y `talend_jobs_read` leen el proyecto del disco (no hace falta Studio): la lista trae nombre,
version, carpeta, fecha, tamano y numero de componentes de cada job, y la lectura trae los componentes con sus
parametros y las conexiones. `talend_jobs_create` **si** necesita Studio: crea el job con la API del IDE, no
escribiendo el `.item` a mano.

## 2. Antes de empezar: comprobar el entorno

1. Talend Studio abierto, con el proyecto cargado.
2. Servidor MCP arriba: `bun run start:server` (o `bun run start`).
3. Bridge vivo: tool `talend_bridge_ping`, o `bun run scripts/mcp-call.ts talend_bridge_ping '{}'`.
   Debe devolver `plugin: com.andres.talend.bridge`, y `unsafeActions: true` si vas a usar
   `talend_studio_run_code`. **Mira la `version`**: si es anterior a la ultima compilacion del
   plugin, Studio acaba de arrancar y ha cargado el bundle instalado, no el de la carga en
   caliente; reinstala antes de automatizar (INTERNALS 56).
4. Si cambiaste Java del bridge: `bun run scripts/start.ts --install-bridge` (ver
   [AGENTS.md](../AGENTS.md) para las opciones). No hace falta reiniciar Studio.

Si el ping no responde, Studio no esta abierto o el plugin no cargo. `talend_bridge_audit_environment`
y el log de Eclipse (`<studio>/workspace/.metadata/.log`) dicen por que.

## 3. Flujo canonico: crear un job, ejecutarlo y comprobar el resultado

Orden obligatorio. Cada paso usa lo que devolvio el anterior (sobre todo los `uniqueName`).

| # | Tool | Para que |
|---|---|---|
| 1 | `talend_studio_list_components` | Saber que componentes hay: 897 de Standard (`paletteType` por defecto `DI`); las 397 variantes de Spark/Streaming solo valen en jobs de ese tipo |
| 1b | `talend_components_definition` | Que exige cada componente: parametros obligatorios con su valor, conexiones, artefactos. Se lee del XML de la instalacion de Studio, **sin abrir Studio** |
| 2 | `talend_studio_component_parameters` | Ver los parametros reales de un componente (tipo, defecto, columnas de sus tablas). **No adivines**: preguntalo |
| 3 | `talend_job_delete_in_studio` | Si el job ya existe y quieres partir de cero |
| 4 | `talend_job_create_in_studio` | Crea el job vacio (`replace: true` lo reemplaza). Lo deja abierto en el editor |
| 5 | `talend_job_add_node` | Anade un componente. Devuelve su `uniqueName` (`tFileInputDelimited_1`). Admite `parameters`, `tables`, `schema`, `mapper` |
| 6 | `talend_job_set_schema` | Columnas del nodo. En `tFixedFlowInput`, ademas `values` con las filas |
| 7 | `talend_job_connect_nodes` | Conecta por `uniqueName` (`FLOW` por defecto; tambien `REJECT`, triggers...) |
| 8 | `talend_job_configure_node` / `talend_job_update_node` | Retocar parametros, tablas, schema o tMap de un nodo existente |
| 9 | `talend_job_list_nodes` | Comprobar lo que hay en el job |
| 9b | `talend_job_problems` | Errores y avisos de diseno (los de la vista Problemas) sin ejecutar nada. `clean: true` = abre sin avisos. Ejemplos: "No schema has been defined yet", "This component should have input link(s)" |
| 9c | `talend_job_compile` | Genera el codigo y comprueba que **compila**, sin ejecutar. Devuelve `compiles` y, si falla, `error.line` y `error.message` (p. ej. `no_comillas cannot be resolved to a variable`). ~2 s; ocupa la UI mientras genera, igual que un Run |
| 9d | `talend_job_contexts_list` | Los contextos (entornos) del job y sus variables, con el valor de cada variable en cada entorno |
| 9e | `talend_job_context_create` / `talend_job_context_set` / `talend_job_context_delete` / `talend_job_context_delete_variable` | Crear un entorno, poner o cambiar una variable (con su valor en ese entorno), y borrarlos. Todo con la API de Studio, y el job se guarda |
| 9f | `talend_list_repository_contexts` / `talend_read_repository_context` / `talend_delete_repository_context` | Los contextos **del proyecto** (los items de tipo Contexts): listar y leer con sus entornos y variables, y borrar. Crear un contexto del proyecto todavia no es posible: Studio no deja enganchar el entorno a un item recien creado |
| 10 | `talend_job_run_by_name` | Genera el codigo, compila y lanza el job en Studio. **No devuelve la salida** (va a la vista Run) |
| 11 | `talend_job_execute` | Relanza el job ya compilado y **devuelve `exitCode` y la salida** (`stdout`, `lines`). Es como se comprueba el resultado |
Ejemplo minimo (humo): `tFixedFlowInput` -> `tLogRow`.

```
talend_job_create_in_studio  { "name": "MCP_Humo", "replace": true }
talend_job_add_node          { "type": "tFixedFlowInput" }          -> tFixedFlowInput_1
talend_job_add_node          { "type": "tLogRow" }                  -> tLogRow_1
talend_job_set_schema        { "uniqueName": "tFixedFlowInput_1",
                               "columns": [ {"name":"id","type":"id_Integer"},
                                            {"name":"ciudad","type":"id_String"} ],
                               "values": [["1","Bogota"],["2","Medellin"]] }
talend_job_connect_nodes     { "source": "tFixedFlowInput_1", "target": "tLogRow_1" }
talend_job_run_by_name       { "jobName": "MCP_Humo" }
talend_job_execute           { "name": "MCP_Humo" }                  -> lines: ["1|Bogota","2|Medellin"]
```

Lo mismo en una sola linea de comandos: `bun run scripts/studio-job.ts fase0`.

**Editar un job que ya existe:** `talend_job_open_in_studio` -> `talend_job_list_nodes` ->
`talend_job_update_node` / `talend_job_configure_node`. No lo recrees.

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
- Detalle y justificacion en [TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md) seccion 18.

### Montar un job con el arnes (`scripts/execution-check.ts`)

El arnes monta un job entero desde una declaracion en JSON, lo ejecuta y **compara la salida con la esperada**
(declarada antes de ejecutar). Los escenarios estan en `tests/fixtures/talend/escenarios-l5.json` y el informe sale
en `testdata/resultados-l5.csv`.

```bash
bun run scripts/execution-check.ts                  # todos los escenarios
bun run scripts/execution-check.ts agregar          # solo los que su nombre contenga "agregar"
L5_KEEP_JOBS=1 bun run scripts/execution-check.ts   # deja los jobs montados en Studio
```

En PowerShell la variable de entorno va antes: `$env:L5_KEEP_JOBS="1"; bun run scripts/execution-check.ts`. Por
defecto los jobs que monta el arnes se borran al terminar.

Un escenario declara el job, sus nodos, sus conexiones y **lo que se espera**:

| Clave | Que es |
|---|---|
| `nombre` | Nombre del escenario (es lo que filtra el comando) |
| `job` | Nombre del job que se monta en el proyecto de Studio |
| `nodos` | Los componentes, en orden |
| `conexiones` | `origen`, `destino` y, si hace falta, `tipo` (por defecto, el conector de salida del origen) |
| `espera` | `lineas` (exactas o el numero), `contiene`, `fichero`, `contextos` o `consulta` (SQL contra el Postgres de pruebas) |
| `pendiente` | Si esta, el escenario se salta y el arnes informa de por que (hoy **ningun escenario lo usa**: los 28 estan en verde) |
| `contextos` / `jobs` | Los entornos del job y los jobs auxiliares (el hijo de un `tRunJob`), que se montan antes que el principal |

Y cada nodo:

| Clave | Que es |
|---|---|
| `parameters` | Los parametros del componente: `{ "FILENAME": { "value": "..." } }`. Con `literal: true` el valor va en crudo (una `QUERY`, un `CODE`); con `literal: false` es el nombre de otro nodo (`"@uniqueName:conexion"`) |
| `tablas` | Las tablas de metadata del componente (`GROUPBYS`, `OPERATIONS`, `FIELD_OPTIONS`...): `columns` y `rows` |
| `columnas` / `columnasPorConector` | Las columnas del esquema, en el conector principal o en otro (`UNIQUE`...) |
| `esquemas` | Las tablas de metadata tal cual, para los componentes con varios conectores de datos (el `tAggregateRow`) |
| `values` | Las filas de un `tFixedFlowInput` |
| `mapper` | El modelo del `tMap` (entradas, salidas con sus expresiones y filtros) |
| `schemaDespuesDeConectar` | `true` para poner el esquema **despues** de conectar |

**`parameters` o `tablas`:** los valores sueltos van en `parameters`; los que son tablas de metadata van en `tablas`.
El `TABLE` de un `tDBOutput` (que es la tabla `FIELD_OPTIONS`) es un parametro de tipo TABLE: va en `tablas`.

**El orden de los esquemas:** al conectar, Talend propaga el esquema del destino hacia atras, asi que el origen se
queda con las columnas del destino. Por eso el esquema del origen se pone **despues de conectar** (con
`"schemaDespuesDeConectar": true`), y los esquemas "despues" se aplican **con los nodos origen al final**: son los que
se han quedado descolocados. Los nodos que ademas tienen filas (un `tFixedFlowInput`) se reponen tambien despues de
conectar: al conectar, el esquema del destino se propaga hacia atras y se lleva las columnas del origen. Ver INTERNALS 42.

**Cuando hace falta `schemaDespuesDeConectar`:** en el `tAggregateRow` (la tabla de salida va la primera), en el
`tJavaRow` (su salida la define el parametro `SCHEMA`) y en el `tNormalize` (la entrada y la salida declaran las
columnas con el mismo nombre).

**Un componente que no va en el flujo:** el `tFileList` no emite filas, asi que se declara en el job **suelto**
(sin conexion) y sus valores se leen del `globalMap`. El codigo del `tJavaRow` que los lee lleva el `uniqueName`
del nodo, no el nombre que le pone el escenario:

```json
{
  "type": "tFileList",
  "nombre": "lista",
  "parameters": {
    "DIRECTORY": { "value": "@TESTDATA@/l5_lista" },
    "LIST_MODE": { "value": "FILES" },
    "ORDER_BY_FILENAME": { "value": "true" },
    "ORDER_ACTION_ASC": { "value": "true" }
  }
},
{
  "type": "tJavaRow",
  "nombre": "lee",
  "parameters": {
    "CODE": { "value": "output_row.fichero = (String) globalMap.get(\"@uniqueName:lista\" + \"_CURRENT_FILE\");" }
  },
  "columnas": [{ "name": "fichero", "type": "id_String" }]
}
```

**Ejemplo: un `tAggregateRow`.** El origen declara el **mismo numero de columnas** que la salida del agregado (el
generador del `tFileInputDelimited` las asigna por posicion), y la tabla de salida del agregado va la primera en su
lista de metadata:

```json
{
  "nombre": "transformaciones: agregar por ciudad",
  "job": "MCP_L5_Agrega",
  "nodos": [
    {
      "type": "tFileInputDelimited",
      "nombre": "lector",
      "parameters": {
        "FILENAME": { "value": "@TESTDATA@/l5_ventas.csv" },
        "FIELDSEPARATOR": { "value": ";" },
        "HEADER": { "value": "1" }
      },
      "schemaDespuesDeConectar": true,
      "esquemas": [
        {
          "conector": "FLOW",
          "nombre": "@uniqueName",
          "columnas": [
            { "name": "ciudad", "type": "id_String" },
            { "name": "monto", "type": "id_Double" },
            { "name": "cliente", "type": "id_Integer" }
          ]
        }
      ]
    },
    {
      "type": "tAggregateRow",
      "nombre": "agrega",
      "esquemas": [
        {
          "conector": "FLOW",
          "nombre": "@uniqueName",
          "columnas": [
            { "name": "ciudad", "type": "id_String" },
            { "name": "total_monto", "type": "id_Double" },
            { "name": "num_clientes", "type": "id_Integer" }
          ]
        }
      ],
      "tablas": {
        "GROUPBYS": {
          "columns": ["OUTPUT_COLUMN", "INPUT_COLUMN"],
          "rows": [{ "OUTPUT_COLUMN": "ciudad", "INPUT_COLUMN": "ciudad" }]
        },
        "OPERATIONS": {
          "columns": ["OUTPUT_COLUMN", "FUNCTION", "INPUT_COLUMN", "IGNORE_NULL"],
          "rows": [
            { "OUTPUT_COLUMN": "total_monto", "FUNCTION": "sum", "INPUT_COLUMN": "monto", "IGNORE_NULL": "true" },
            { "OUTPUT_COLUMN": "num_clientes", "FUNCTION": "count", "INPUT_COLUMN": "cliente", "IGNORE_NULL": "true" }
          ]
        }
      }
    },
    { "type": "tLogRow", "nombre": "salida" }
  ],
  "conexiones": [
    { "origen": "lector", "destino": "agrega" },
    { "origen": "agrega", "destino": "salida" }
  ],
  "espera": { "contiene": ["Bogota|201.0|2", "Medellin|200.25|1", "Cali|300.0|1"] }
}
```

Las cuatro reglas del agregado (INTERNALS 41): la tabla de salida va la primera; el origen se queda con una sola
tabla; las tablas usan el **nombre simple** de la columna (`monto`, no `row1.monto`) y las funciones en minusculas
(`sum`, `count`); y el numero de columnas del origen es el de la salida del agregado.

**Ejemplo: escribir en un Postgres.** La conexion va con `AUTO_COMMIT=true` y **no** hay ningun componente de commit
encolado (INTERNALS 45):

```json
{
  "nombre": "bases de datos: escribir en un Postgres y verificar",
  "job": "MCP_L5_Escritura",
  "nodos": [
    {
      "type": "tFixedFlowInput",
      "nombre": "entrada",
      "columnas": [
        { "name": "id", "type": "id_Integer" },
        { "name": "nombre", "type": "id_String" },
        { "name": "ciudad", "type": "id_String" },
        { "name": "monto", "type": "id_Double" }
      ],
      "values": [
        ["1", "Ana", "Bogota", "100.5"],
        ["2", "Jose", "Medellin", "200.25"]
      ]
    },
    {
      "type": "tPostgresqlConnection",
      "nombre": "conexion",
      "parameters": {
        "HOST": { "value": "localhost" },
        "PORT": { "value": "5433" },
        "USER": { "value": "talend" },
        "PASS": { "value": "talend" },
        "DBNAME": { "value": "talend_test" },
        "AUTO_COMMIT": { "value": "true" }
      }
    },
    {
      "type": "tPostgresqlOutput",
      "nombre": "escribe",
      "parameters": {
        "USE_EXISTING_CONNECTION": { "value": "true" },
        "CONNECTION": { "value": "@uniqueName:conexion", "literal": false },
        "TABLE": { "value": "l5_salida" },
        "TABLE_ACTION": { "value": "TRUNCATE" },
        "END_OF_FLOW": { "value": "false" }
      },
      "tablas": {
        "FIELD_OPTIONS": {
          "columns": ["SCHEMA_COLUMN", "UPDATE_KEY", "DELETE_KEY", "UPDATABLE", "INSERTABLE"],
          "rows": [
            { "SCHEMA_COLUMN": "id", "UPDATE_KEY": "false", "DELETE_KEY": "false", "UPDATABLE": "true", "INSERTABLE": "true" },
            { "SCHEMA_COLUMN": "nombre", "UPDATE_KEY": "false", "DELETE_KEY": "false", "UPDATABLE": "true", "INSERTABLE": "true" },
            { "SCHEMA_COLUMN": "ciudad", "UPDATE_KEY": "false", "DELETE_KEY": "false", "UPDATABLE": "true", "INSERTABLE": "true" },
            { "SCHEMA_COLUMN": "monto", "UPDATE_KEY": "false", "DELETE_KEY": "false", "UPDATABLE": "true", "INSERTABLE": "true" }
          ]
        }
      }
    }
  ],
  "conexiones": [{ "origen": "entrada", "destino": "escribe" }],
  "espera": {
    "consulta": { "sql": "SELECT count(*)::int FROM l5_salida", "valor": 2 }
  }
}
```

Cinco detalles que no se ven en el JSON pero deciden si esto funciona:

- `TABLE_ACTION` es un valor de **lista cerrada**: va **sin comillas**. Con comillas el `TRUNCATE` no se ejecutaba.
- `FIELD_OPTIONS` va en `tablas` (es un parametro de tipo TABLE), no en `parameters`.
- `CONNECTION` necesita `literal: false` (es el nombre del nodo de conexion) y la `QUERY` de un `tDBInput` necesita
  `literal: true` (va en crudo).
- **No se encola un `tPostgresqlCommit`**: se ejecutaria dentro del bucle de filas y el lote final fallaria con
  `This connection has been closed`. El commit lo hace la conexion con `AUTO_COMMIT=true`.
- `MAPPING` **no se toca**: su `DEFAULT` es el id del motor (`postgres_id`, `mysql_id`), y poner el nombre
  que se ve en la interfaz (`"PostgreSQL"`) deja el job sin codigo generado: el IDE no encuentra el motor
  (`DBMS Id : "PostgreSQL" can't be found`), salta un `NullPointerException` en `TypesManager.checkDBType`
  y el `.java` del job se queda en 0 bytes (INTERNALS 45.6).

El Postgres de pruebas es el de `testdata/docker-compose.yml` (puerto 5433):
`docker compose -f testdata/docker-compose.yml up -d`.

## 5. Verificar el resultado, no el `ok`

Una operacion puede devolver `ok: true` y no haber escrito nada. Despues de escribir:

1. `talend_job_list_nodes` y comparar con lo esperado, y `talend_job_problems` para que no haya avisos.
2. Mirar el `.item`: un job vacio pesa ~196 bytes; si no cambia de tamano tras anadir nodos, no
   llego al disco.
3. Ejecutar con `talend_job_execute` y **comparar la salida contra lo que definiste antes de
   ejecutar**. Es el criterio del [plan de pruebas](PLAN-DE-PRUEBAS.md).

## 6. Dialogos y bloqueos de Studio

- El bridge trae un **guardian de modales** que cierra solo los dialogos que bloquean el IDE
  (`Jobname Error`, `Save Resource`, avisos nativos de Windows...). Si Studio queda en "No
  responde" por un dialogo, usa `talend_studio_dismiss_dialogs`.
- Para no provocarlos: `talend_job_create_in_studio` con `replace: true` en vez de reusar la
  etiqueta de un job existente.
- Studio puede tardar en responder mientras compila un job; la espera tiene tiempo maximo y
  devuelve error en vez de colgarse. Reintenta.
- Lo que hace el bridge **no debe bloquear el hilo de UI** (ver
  [INTERNALS seccion 26](TALEND-STUDIO-INTERNALS.md)): ejecutar jobs, descargar artefactos y
  recorrer el catalogo corren fuera de la UI.

## 7. Cuando el MCP no tiene una tool: `talend_studio_run_code`

Compila y ejecuta Java **dentro de Studio**, con acceso a todas sus APIs. Requiere
`unsafeActions: true` en `~/.talend-bridge/config.json`. El codigo debe tener una clase con
`public static Object run()`.

Es la forma rapida de explorar y probar una API interna **sin recompilar el bridge** (que es lo
lento). Flujo recomendado: probar con `run_code`, y cuando funcione, llevarlo al bridge como
operacion con su tool y su documentacion. No dejes logica solo en un `run_code`: quien clone el
repo no la tendra.

## 8. API directa del bridge (sin pasar por el MCP)

Un agente puede hablar con Studio sin el servidor MCP, por dos niveles:

1. **HTTP del bridge**: `http://127.0.0.1:3930`, cabecera `Authorization: Bearer <token>` (el token
   esta en `~/.talend-bridge/token`; `/ping` es la unica ruta sin token). Cada ruta acepta
   `GET` o `POST` con cuerpo JSON. Atajo: `scripts/bridge-call.ts`.

   ```bash
   bun run scripts/bridge-call.ts /ping
   bun run scripts/bridge-call.ts /automation/components '{"filter":"tFile","limit":5}'
   bun run scripts/bridge-call.ts /automation/nodes/add '{"type":"tLogRow","job":"MCP_Humo"}'
   ```

   En **PowerShell** las comillas dobles del JSON en linea se pierden y falla con "Cuerpo
   invalido": guarda el JSON en un archivo y pasa `@cuerpo.json`.

   La respuesta usa el sobre del bridge: `ok`, `source`, `endpoint`, `result` (o `error`).
   Cada tool `talend_job_*` / `talend_studio_*` es un envoltorio de una de estas rutas, con el
   mismo cuerpo.

2. **API Java de Studio**: `POST /automation/run-code` (tool `talend_studio_run_code`) compila y
   ejecuta Java dentro de Studio, con acceso a cualquier clase de Talend y Eclipse. Es la salida
   para lo que ninguna ruta cubre. Requiere `unsafeActions: true`.

| Grupo | Rutas |
|---|---|
| Estado | `/ping`, `/capabilities`, `/audit/environment`, `/workspace/state`, `/workspace/refresh`, `/problems/markers`, `/events/recent`, `/events/clear` |
| Jobs | `/automation/job/create`, `/automation/job/open`, `/automation/job/delete`, `/automation/job/execute` |
| Nodos | `/automation/nodes/add`, `/connect`, `/update`, `/configure`, `/schema`, `/copy`, `/delete`, `/list` (todas bajo `/automation/nodes/`) |
| Catalogo | `/automation/components`, `/automation/components/parameters`, `/automation/coverage` |
| Ejecucion | `/automation/run-active-job`, `/launch/configs`, `/launch/run`, `/launch/runs`, `/launch/run-status`, `/launch/wait` |
| Utilidades | `/automation/run-code`, `/automation/artifacts/install`, `/workbench/dialogs`, `/workbench/modules/install` |
| Editor e IDE | `/workbench/state`, `/selection`, `/views`, `/open-resource`, `/save-active`, `/save-all`, `/close-editor`, `/activate-editor`, `/find-editor`, `/show-view` (bajo `/workbench/`), `/commands/list`, `/commands/execute` |
| Introspeccion | `/talend/active-job/model`, `/talend/active-job/details`, `/talend/active-job/select-component`, `/talend/active-component/details`, `/talend/active-editor/introspect`, `/talend/probe/classes` |

`readOnly` de `~/.talend-bridge/config.json` bloquea solo los comandos del IDE, los lanzamientos
(`/launch/run`, `/automation/run-active-job`) y `/automation/run-code`. **No protege** las rutas que
crean, editan o borran jobs y nodos (`/automation/job/*`, `/automation/nodes/*`): cualquiera con el
token puede modificar el proyecto. Los comandos del IDE solo corren si estan en `allowCommands`.

> **Talend Cloud (TMC) es otra API distinta.** Esta guia cubre Talend Studio. Las API REST de
> Talend Management Console (tareas, planes, engines) no estan conectadas a este repo.

## 9. Scripts de linea de comandos

| Script | Para que |
|---|---|
| `bun run scripts/mcp-call.ts <tool> '<json>'` | Llamar cualquier tool del MCP sin cliente MCP |
| `bun run scripts/bridge-call.ts /ruta '<json>'` | Llamar directo a la API HTTP del bridge, sin MCP (seccion 8) |
| `bun run scripts/studio-job.ts <cmd>` | Hablar directo con el bridge: `fase0`, `create`, `add`, `connect`, `schema`, `list`, `run`, `delete`, `dialogs` |
| `bun run scripts/query-bridge.ts` | Volcado del estado de Studio (ping, job activo...) |
| `bun run scripts/coverage.ts` | Mide cuantos componentes del catalogo se crean, se configuran, se montan y compilan (`--filter`, `--family`, `--components`, `--max`, `--compile`, `--out`) |
| `bun run scripts/cobertura-familias.ts` | Cruza los informes de `coverage.ts` con el catalogo instalado: por familia, cuantos compilan, cuantos fallan y cuantos no se han medido (`--todas`, `--familia <texto>`, `--pendientes`) |
| `bun run scripts/execution-check.ts [filtro]` | Monta, ejecuta y verifica los escenarios L5 (el informe sale en `testdata/resultados-l5.csv`) |
| `bun run scripts/component-definitions.ts` | Las definiciones de los componentes instalados (parametros obligatorios, conexiones) y el detalle de uno |
| `bun run scripts/make-testdata.ts` | Regenera los datos de prueba de `testdata/` |
| `bun run scripts/limpiar-mcp.ts [--simular]` | Borra los jobs `MCP_*` que dejan el arnes y la medicion (con `--simular` solo los lista), y limpia las carpetas vacias y los proyectos Maven huerfanos |
| `bun run scripts/start.ts --install-bridge` | Compila y recarga el plugin Java en caliente |

## 10. Errores frecuentes

| Sintoma | Causa | Que hacer |
|---|---|---|
| `Unknown java id type : 'id_Decimal'` | Tipo inexistente | Usa `id_BigDecimal` |
| `X cannot be resolved to a variable` (compilacion) | Valor de texto sin comillas o schema sin definir | Valores como literal Java; define el schema |
| `NumberFormatException: "Main1100Main1"` | Nodo creado fuera de la API de Studio | Recrear el nodo con `talend_job_add_node` |
| Job vacio tras anadir nodos | No se guardo (`doSave` aborta si el editor no esta "dirty") | Operar con las tools `talend_job_*`, que guardan por `saveXmlFile` |
| `Invalid class loader from a refreshed bundle` | Bridge viejo atendiendo tras recargar | Volver a ejecutar `--install-bridge` |
| `/ping` con `version` antigua; `nodes/add` contesta `ok` pero el `.item` del job queda vacio y el job no imprime nada | Studio se reinicio y cargo el bundle **instalado**, no el de la carga en caliente | `--install-bridge --force` y comprobar la `version` (INTERNALS 56) |
| `The Job ... has wrong configuration` | Error de compilacion del job | Leer `Error Line` y `Detail Message` |
| `Missing artifact ...` | Runtime del componente no incluido en Studio | `talend_studio_install_artifact` (Maven Central) |
| `Child module ... does not exist` (al compilar) | El agregador Maven salio mal porque el heap estaba lleno (pasa midiendo muchos componentes en una corrida) | Repetir esos componentes en una corrida nueva (`coverage.ts` ya fuerza un GC al 60 %); no hace falta reiniciar Studio |
| `talend-tmap-dataset-...jar` ausente | El tMap necesita un modulo de Talend Exchange | Limitacion del entorno, ver abajo |
| `El hilo de la interfaz de Studio esta ocupado` | La UI esta compilando u ocupada | Esperar y reintentar |

## 11. Limites conocidos (no es culpa del diseno)

| Tema | Estado |
|---|---|
| `tMap` | El `.item` sale correcto (expresiones, filtros, joins) pero **no compila** sin `talend-tmap-dataset-1.2.16.jar`, de Talend Exchange (no esta en Maven Central). Para generar codigo y ejecutar no hace falta: el jar solo lo usa el editor visual del mapper |
| `tFilterRow`, `tSortRow`, `tUniqRow`, `tAggregateRow` | Se configuran con el plan de la definicion (sus tablas se rellenan con las columnas del schema) y **compilan**. Ademas, **se ejecutan bien** con filas y condiciones reales (escenarios L5): el `tAggregateRow` necesita las cuatro reglas de INTERNALS 41 |
| `tFileInputPositional` | Genera codigo que no compila en 8.0.1 (usa `onSubJobError` inexistente). Usa `tFileInputDelimited` si puedes |
| `tFileInputJSON` | **Validado a L5**: lee el JSON con la ruta del escenario (`JSON_LOOP_QUERY` + tabla `MAPPING_JSONPATH`). Antes el pom del job no heredia las librerias del componente (json-simple) y el codigo no compilaba |
| `tFileList` | **Validado a L5**, con su peculiaridad: **no emite filas**, deja los valores en el `globalMap` (`<uniqueName>_CURRENT_FILE`...). Para consumirlos hace falta un `tJavaRow` (o equivalente) |
| `tFileOutputARFF`, `tFileInputARFF`, `tFileInputXML` | El componente esta escrito para otra version de Weka que la que trae Studio |
| `tFileOutputDelimited` | Necesita librerias que pueden faltar en el `.m2` de Studio |
| Cobertura del catalogo | Medida sobre los 897 componentes Standard: 877 (98 %) se crean, configuran, guardan y borran (L1/L2). Con el montaje (L3) y los parametros obligatorios del XML, 216 de los 259 medidos compilan (L4). Las 397 variantes de Spark/Streaming necesitan un job de ese tipo (no soportado). Ejecutar con la salida esperada (L5) esta verificado en **28 escenarios** |
| Componentes de la generacion nueva | Los 120 de los `.car` (AWS, JDBC, Snowflake...) no tienen XML: su definicion esta en el codigo Java y hay que preguntarsela a Studio (`talend_studio_component_parameters`) |
| Salida de la vista Run | No se puede leer; por eso existe `talend_job_execute` |

Estado fase por fase en [PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md).

## 12. Documentacion relacionada

- [PLAN-DE-PRUEBAS.md](PLAN-DE-PRUEBAS.md): fases, criterios y estado.
- [ROADMAP-DOMINIO-TALEND.md](ROADMAP-DOMINIO-TALEND.md): que falta para automatizar Talend al 100 %.
- [TALEND-STUDIO-INTERNALS.md](TALEND-STUDIO-INTERNALS.md): APIs internas de Studio, recetas y trampas.
- [ARQUITECTURA.md](ARQUITECTURA.md): capas del repo y del plugin.
- [PLAN-DE-TRABAJO.md](PLAN-DE-TRABAJO.md): recetas para cambiar el repo.
