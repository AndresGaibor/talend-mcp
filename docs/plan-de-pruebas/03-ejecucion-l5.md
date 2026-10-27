# Ejecucion con la salida esperada (L5)

[Volver al indice](../PLAN-DE-PRUEBAS.md)

## Ejecucion con la salida esperada (L5)

`bun run scripts/execution-check.ts` monta cada escenario de `tests/fixtures/talend/escenarios-l5/<suite>/<escenario>.json`, lo ejecuta
y **compara la salida con la que se declaro antes de ejecutar** (lineas exactas, lineas que tienen que aparecer o
el fichero que escribe). El informe queda en `testdata/resultados-l5.csv`.

| Comando | Que hace |
|---|---|
| `bun run scripts/execution-check.ts` | Monta y ejecuta todos los escenarios |
| `bun run scripts/execution-check.ts agregar` | Solo los escenarios cuyo nombre contenga ese texto |
| `bun run scripts/execution-check.ts --suite transformaciones` | Ejecuta una suite: `humo`, `archivos`, `transformaciones`, `bd`, `control`, `contextos`, `orquestacion`, `codigo`, `aws`, `privacidad`, `calidad`, `formatos`, `sistema`, `conciliacion` u `otros` |
| `bun run l5:validar [--suite <nombre>]` | Valida los fixtures sin abrir Studio: nombre, job, nodos, conexiones y suite. Sale con código 1 y la ruta exacta si algo está mal |
| `bun run scripts/execution-check.ts --solo-fallidos` | Reintenta solo los escenarios fallidos segun `testdata/resultados-l5.csv` |
| `bun run scripts/execution-check.ts --desde HEAD` | Ejecuta los escenarios cuyo fixture cambio respecto al commit indicado |
| `bun run scripts/execution-check.ts --todas` | Repite también los escenarios que ya pasaron. Por defecto se omiten los que ya pasaron con la misma huella (el escenario y las definiciones de componentes), guardada en `testdata/cache-l5.json`. Recargar el plugin o tocar el arnés no la invalida. No cubre el estado externo (Postgres, S3, HDFS, SMTP): si cambian, usa `--todas` |
| `bun run scripts/execution-check.ts` (con memoria alta) | Antes de cada escenario mide el heap de Studio (y pide recoleccion si pasa el 80 %). Si no hay margen, para con código 2: reinicia Studio y vuelve a ejecutar el mismo comando; lo ya probado se omite. Cada Run deja memoria en Studio que no se libera |
| `bun run test:cambios` | Solo los tests afectados por los archivos cambiados (`bun test --changed`). La suite completa (`bun test`) tarda unos 10 s, así que úsala antes de commitear |
| `L5_KEEP_JOBS=1 bun run scripts/execution-check.ts` | Deja los jobs montados en Studio (por defecto se borran). En PowerShell: `$env:L5_KEEP_JOBS="1"; bun run scripts/execution-check.ts`. Util para abrir un job y ver su vista Problemas |
| `bun run scripts/execution-check.ts <filtro> --en-studio` | Ejecuta los jobs con el Run de Studio, para verlos en su consola. Por defecto se ejecutan rapido, en su propia JVM, y no aparecen en Studio. Mas lento; con lineas de salida que comprobar el job corre dos veces. Tambien `L5_EN_STUDIO=1` |
| `bun run scripts/execution-check.ts --reiniciar-studio` | Si Studio llega al 80 % de memoria, lo reinicia solo (cierra sin forzar, lo abre, espera al bridge y reinstala el plugin) y la corrida sigue. Studio retiene cada editor de job abierto y no se ha encontrado forma de liberarlo sin reiniciar. Sin la opcion, la corrida se para. Tambien `L5_REINICIAR=1`; el reinicio a mano es `bun run scripts/l5/studio-reiniciar.ts` |
| `L5_VISTAS=conservar` | No oculta la vista de Job Settings durante la corrida (por defecto se oculta y se vuelve a mostrar al terminar, porque ralentiza cada borrado ~1,5 s) |
| `L5_TIEMPOS=1 bun run scripts/execution-check.ts <filtro>` | Imprime en stderr la duracion de cada fase (`montaje`, `crear job`, `abrir job`, `anadir <nodo>`, `conectar nodos`, `run de studio`, `ejecucion`, `borrado de jobs`...). Sin la variable no cambia nada. Ver [seccion 79](../studio-internals/08-interfaz-ui.md) |

En cada archivo de escenario, `@TESTDATA@` es la carpeta `testdata/` (los datos que usan: `l5_clientes.csv`,
`l5_clientes.json`, `l5_ventas.csv`). Los escenarios de base de datos necesitan el Postgres de
`testdata/docker-compose.yml` (puerto 5433):

```bash
docker compose -f testdata/docker-compose.yml up -d
```

| Escenario | Estado |
|---|---|
| `tFixedFlowInput` -> `tLogRow` | Correcto: `1\|Bogota`, `2\|Medellin` |
| `tFileInputDelimited` -> `tLogRow` | Correcto: las cuatro filas, con el separador y los decimales tal cual |
| `tFileInputDelimited` -> `tFileOutputDelimited` | Correcto: el fichero escrito tiene las cuatro filas |
| `tFileInputDelimited` -> `tUniqRow` -> `tSortRow` -> `tLogRow` | Correcto: quita el duplicado y ordena por monto descendente |
| `tFileInputDelimited` -> `tFilterRow` -> `tLogRow` | Correcto: deja solo las filas con monto mayor que 150 |
| dos `tFileInputDelimited` -> `tUnite` -> `tLogRow` | Correcto: salen las ocho filas (las dos fuentes) |
| `tFileInputDelimited` -> `tMap` -> `tLogRow` | Correcto: el `tMap` renombra la columna con `toUpperCase()` y filtra por monto (`2\|JOSE`, `3\|LUCIA`). El modelo del `tMap` (entradas, salidas con sus expresiones y filtros) lo monta el arnes con el `mapper` del bridge |
| `tFixedFlowInput` -> `tFileOutputJSON` | Correcto: el JSON escrito tiene las filas |
| `tFixedFlowInput` -> `tDie`, con `SUBJOB_ERROR` desde el arranque hacia un manejador (`tFixedFlowInput` -> `tFileOutputDelimited`) | Correcto: el `tDie` corta el job con codigo 1 y el manejador escribe su fichero. Un fallo que no lanza (un `tFileInputDelimited` sin fichero) **no** dispara el manejador (ver INTERNALS 53) |
| `tPrejob` -> `tRunJob` (hijo) -> `tPostjob` | Correcto: el padre llama al hijo y su salida sale en la del padre |
| `tPostgresqlConnection` -> `tPostgresqlInput` -> `tLogRow` | Correcto: lee las diez filas del Postgres de pruebas (ver INTERNALS 35) |
| contextos: crear un entorno y sus variables | Correcto: el job tiene los dos entornos con sus valores. El `tContextLoad` no saca filas (necesita su `nodeData` con la lista de variables a cargar), asi que el valor se comprueba en el modelo |
| `tFileInputDelimited` -> `tAggregateRow` -> `tLogRow` | Correcto: agrupa por ciudad y suma el monto (`Bogota\|201.0\|2`, `Medellin\|200.25\|1`, `Cali\|300.0\|1`). La tabla de salida del agregado va la primera en su lista de metadata (ver INTERNALS 41) |
| `tPostgresqlConnection` -> `tPostgresqlOutput` (sin componente de commit) | Correcto: escribe las dos filas y la consulta de comprobacion devuelve 2. La conexion va con `AUTO_COMMIT=true` y **no** hay ningun `tPostgresqlCommit` encolado (ver INTERNALS 45) |
| `tFixedFlowInput` -> `tJavaRow` -> `tLogRow` | Correcto: el `tJavaRow` deja la fila de salida con sus columnas (`ANA`, `JOSE`) si su esquema se aplica **despues de conectar** (`schemaDespuesDeConectar: true`) |
| `tFixedFlowInput` -> `tNormalize` -> `tLogRow` | Correcto: parte la columna `etiquetas` en filas (`Ana\|rojo`, `Ana\|verde`, `Jose\|azul`). La entrada y la salida declaran las columnas con el **mismo nombre** (el codigo generado las copia por el nombre) y la columna a normalizar (`NORMALIZE_COLUMN`) es un valor de lista cerrada: va sin comillas |
| `tFileInputJSON` -> `tLogRow` | Correcto: lee el JSON con la ruta del escenario (`$.clientes[*]`) y sale `1\|Ana\|Bogota`, `2\|Jose\|Medellin`. Con `READ_BY=JSONPATH` la raiz del bucle va en `JSON_LOOP_QUERY` y el mapeo en la tabla `MAPPING_JSONPATH` (ver INTERNALS 48) |
| `tFileList` (suelto) + `tJavaRow` que lee el `globalMap` -> `tLogRow` | Correcto: el `tFileList` lista la carpeta y el `tJavaRow` saca el nombre del fichero del `globalMap` (`<uniqueName>_CURRENT_FILE`); el `tFileList` no emite filas (ver INTERNALS 47) |
| `tRowGenerator` -> `tLogRow` | Correcto: genera tres filas con el valor de su tabla `VALUES` (`Ana`, `Ana`, `Ana`) |
| `tFixedFlowInput` -> `tFilterColumns` -> `tLogRow` | Correcto: se queda solo con las columnas del esquema del `tFilterColumns` (`1\|Bogota`, `2\|Medellin`) |
| `tPostgresqlConnection` -> `tPostgresqlOutput` (`ACTION=UPDATE`, `UPDATE_KEY`) + `tPostgresqlCommit` con `OnSubjobOk` desde el arranque del subjob | Correcto: la consulta de comprobacion devuelve el valor nuevo. La conexion va con `AUTO_COMMIT=false` y el commit se cuelga **del arranque** del subjob, no del output: Studio solo genera los triggers que salen del primer componente (INTERNALS 53) |
| `tPostgresqlConnection` -> `tPostgresqlOutput` (`ACTION=DELETE`, `DELETE_KEY`) | Correcto: la fila con esa clave desaparece y el resto sigue |
| `tFixedFlowInput` -> `tDie` | Correcto: el job termina con codigo 1 y el mensaje del `tDie` |
| `tPostgresqlConnection` -> `tPostgresqlOutput` (`ACTION=UPDATE`, `UPDATE_KEY`) + `tPostgresqlRollback` con `OnSubjobOk` desde el arranque del subjob | Correcto: la consulta de comprobacion ve el valor **anterior**. La conexion va con `AUTO_COMMIT=false` y el rollback se cuelga del arranque del subjob, igual que el commit |
| `tPrejob` -> `tFixedFlowInput` -> `tFileOutputDelimited`, subjob principal, `tPostjob` -> `tFixedFlowInput` -> `tFileOutputDelimited` (los tres al mismo fichero, con `APPEND`) | Correcto: el fichero queda en el orden `pre`, `principal`, `post`. `tPrejob`/`tPostjob` solo tienen conector `COMPONENT_OK` (no `FLOW`): se cuelgan con `OnComponentOk` del `tFixedFlowInput` de su subjob |
| `tFixedFlowInput` -> `tLogRow` y, con `OnSubjobOk`, un `tWarn` (`PRIORITY=4`) | Correcto: sale la fila y la linea `[WARN ] ... Message: ... Code: ...`, y el job termina con codigo 0. Con `PRIORITY="WARNING"` (el nombre en vez del `VALUE`) el job no compila (INTERNALS 57) |
| `tFixedFlowInput` -> `tFlowToIterate` -> `tJava` (conector `ITERATE`) | Correcto: cada fila activa una iteracion y los valores `row1.id` y `row1.nombre` del `globalMap` salen como `1\|Ana` y `2\|Jose` |
| `tFixedFlowInput` -> `tSetGlobalVar` -> `tJavaRow` | Correcto: la tabla `VARIABLES` guarda `l5_global=Talend` y el consumidor, ejecutado por fila tras el flujo, imprime `Talend` |

**Veintiocho escenarios en verde (los 28 pasan).** Se validaron `tFlowToIterate` (convierte cada fila en una iteracion) y `tSetGlobalVar` (variable global disponible para el consumidor en el flujo). Antes, el `tWarn` (avisa y el job sigue), el rollback explicito (la consulta de
comprobacion ve el valor anterior) y el `tPrejob`/`tPostjob` (el fichero sale en el orden `pre`, `principal`,
`post`); antes se anadieron el commit explicito con `OnSubjobOk` (`tPostgresqlCommit`), el borrado con clave
(`DELETE_KEY`) y el `tDie`; antes el generador de filas (`tRowGenerator`) y el filtro de columnas
(`tFilterColumns`); antes se desbloquearon el de la
lectura de JSON (el `tFileInputJSON`) y el del listado de ficheros (el `tFileList`);
los dos anteriores fueron el del `tJavaRow` y el del `tNormalize`. Antes de ellos ya estaban el del
`tAggregateRow` (que se ejecuta con su formato real de tabla, INTERNALS 41) y el de escritura en Postgres
(que necesitaba el nombre de columna en la base de datos y el `AUTO_COMMIT` en la conexion, INTERNALS 43
y 45). Ese ultimo se llamaba antes "...y confirmar" y usaba un `tDBCommit`: asi no funcionaba. El informe
de la ultima vuelta completa esta en `testdata/resultados-l5.csv` (una fila por escenario, con `ejecuta_ok`
y `salida_correcta`).

El `tMap` compila y se ejecuta **sin** el `talend-tmap-dataset` del Exchange: ese jar solo hace falta para el
editor visual del mapper, no para generar codigo ni para ejecutar.

Los pasos para ejecutar y leer la salida estan en INTERNALS 33: primero el Run de Studio (que genera y compila),
despues el relanzamiento que devuelve las lineas. El formato de las tablas de las transformaciones, en INTERNALS 32.
