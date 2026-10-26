# Montar un job con el arnes

[Volver al indice](../GUIA-AGENTE.md)

### Montar un job con el arnes (`scripts/execution-check.ts`)

El arnes monta un job entero desde una declaracion en JSON, lo ejecuta y **compara la salida con la esperada**
(declarada antes de ejecutar). Los escenarios estan en `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json` y el informe sale
en `testdata/resultados-l5.csv`.

```bash
bun run scripts/execution-check.ts                  # todos los escenarios
bun run scripts/execution-check.ts --validar        # solo valida los fixtures, sin Studio
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
