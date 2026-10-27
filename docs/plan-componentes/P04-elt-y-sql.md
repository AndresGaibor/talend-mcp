# P04 · ELT y SQL

Nivel 6 del catalogo (44 componentes Standard, **ninguno medido todavia**). ELT significa que Talend no mueve los datos:
genera una sentencia SQL (`INSERT ... SELECT`, `MERGE`) y la ejecuta **dentro de la base**. Es la forma rapida de
transformar en banca cuando origen y destino estan en la misma base, y es muy sensible al dialecto de cada motor.

- Catalogo: [elt](../catalogo-componentes/elt.md) y las filas `tELT*`, `tSQLTemplate*`, `tCombinedSQL*` de
  [databases](../catalogo-componentes/databases.md).
- Suite L5: `bases de datos` (suite `bd`), prefijo de escenario `bases de datos: ELT ...`.
- Depende de [P03](P03-bases-de-datos-relacionales.md): cada motor ELT necesita ya su servicio y su driver.

## 1. Familias

| Familia | Componentes | Motor donde se prueba |
|---|---|---|
| ELT generico | `tELTInput`, `tELTOutput`, `tELTNode` | Postgres |
| ELT por motor | `tELT<Motor>Input`, `tELT<Motor>Map`, `tELT<Motor>Output` para Mysql, Postgresql, Oracle, MSSql, Greenplum, Netezza, Sybase, Teradata, Vertica, Hive, y los `UniteMap` de Oracle y Teradata | Cada motor (ver P03, secciones 1 y 2) |
| SQLTemplate | `tSQLTemplate`, `tSQLTemplateAggregate`, `tSQLTemplateFilterColumns`, `tSQLTemplateFilterRows`, `tSQLTemplateMerge`, `tSQLTemplateCommit`, `tSQLTemplateRollback` | Postgres y MySQL |
| Combined SQL | `tCombinedSQLInput`, `tCombinedSQLFilter`, `tCombinedSQLAggregate`, `tCombinedSQLOutput` | Postgres |
| SCDELT | `tMysqlSCDELT`, `tOracleSCDELT`, `tPostgresqlSCDELT`, `tJDBCSCDELT`, `tSybaseSCDELT`... | Se cuentan en P03 (escenario S9 de cada motor) |
| SAP | `tELTSAPInput`, `tELTSAPMap` | P11 |

## 2. Orden de trabajo

1. **Postgres**: `tELTInput` / `tELTMap` / `tELTOutput` y `tELTPostgresql*`. Es el motor de referencia.
2. **Mysql**: `tELTMysql*`.
3. **SQLTemplate** y **CombinedSQL** sobre Postgres.
4. **Oracle, MSSql**: `tELTOracle*`, `tELTMSSql*` (contenedor real, uno cada vez).
5. **Greenplum** (contra Postgres), **Vertica**, **Netezza**, **Sybase**, **Teradata**, **Hive**: segun el peldano de
   emulacion de P03. Los que usan dialecto propio se prueban con **driver shim** hacia Postgres/H2 y **la ficha dice que
   la SQL generada no se valido contra el motor real**; pero la SQL generada si se captura y se compara (seccion 4).

## 3. Patron de escenario

Una prueba ELT necesita tres cosas que los demas componentes no: **tabla de origen ya sembrada**, **tabla de destino**
y **comprobacion de la SQL generada**.

```
tPostgresqlConnection
   -SUBJOB_OK-> tPostgresqlRow            (prepara: CREATE TABLE origen + INSERT de 4 filas + CREATE TABLE destino)
   -SUBJOB_OK-> tELTPostgresqlInput  -> tELTPostgresqlMap -> tELTPostgresqlOutput   (INSERT ... SELECT)
   -SUBJOB_OK-> tPostgresqlInput -> tLogRow                                         (lee el destino)
   -SUBJOB_OK-> tPostgresqlClose
```

Hay que aprender tres cosas del componente antes de escribir el JSON:

1. **Los tres ELT se conectan por un enlace especial** (`TABLE`/`ELT`), no por `FLOW`. Mira `connectors` en
   `talend_components_definition`.
2. **`tELT*Map` es un `tMap` de SQL**: su modelo (`nodeData`) tiene tablas de entrada con alias, uniones (`JOIN`),
   condiciones `WHERE` y columnas de salida con expresiones SQL. Montalo en Studio, guardalo y copia el `nodeData` del
   `.item`; despues parametriza.
3. **El nombre de tabla y de alias son literales** (con comillas) y, en motores sensibles a mayusculas, importan.

## 4. Comprobar la SQL, no solo el resultado

Un ELT puede dar el mismo resultado con SQL equivocada (por ejemplo, ignorando el `WHERE`). Comprueba los dos:

- **El resultado**: leer el destino y comparar filas exactas.
- **La SQL generada**: esta en el `.java` del job (`poms/jobs/process/<job>/src/main/java/.../<JOB>.java`) como
  literal `String` justo antes del `stmt.execute`. Un test de TypeScript puede leer ese fichero y comprobar que
  contiene los fragmentos esperados (`INSERT INTO`, `WHERE`, el `JOIN`). Es especialmente util en los motores
  emulados: demuestra que Talend genera la SQL correcta aunque el emulador no la valide.

## 5. Trampas conocidas

| Trampa | Que hacer |
|---|---|
| Sin enlace entre `Input` y `Map`, no se genera nada | Conectar `Input -> Map -> Output` con el enlace `ELT`/`TABLE` correcto |
| `Map` sin modelo | Se genera una sentencia vacia y falla en ejecucion: aplicar `mapper`/`nodeData` **despues de conectar** |
| Alias distinto del nombre de la tabla | El alias del modelo se usa en las expresiones; mantener el mismo en todo el modelo |
| Mayusculas en Oracle/DB2 | Entrecomillar los nombres o declararlos en mayuscula |
| `tSQLTemplateMerge` falla en motores sin `MERGE` | MySQL no tiene `MERGE`: el componente usa `INSERT ... ON DUPLICATE KEY`; probarlo ahi |
| Commit y rollback (`tSQLTemplateCommit/Rollback`) | Mismas reglas que los `Commit`/`Rollback` de P03: conexion sin auto-commit y sin encolar el commit en el bucle |

## 6. Aceptacion de P04

- Los 44 componentes ejecutados (A o A-emu) con datos conocidos y salida exacta.
- Por cada motor ELT, un escenario `INSERT ... SELECT` con union y filtro, y otro con agregacion.
- La SQL generada comprobada con un test de TypeScript en los motores emulados.
- Fichas en `docs/fichas-componentes/elt.md`.
