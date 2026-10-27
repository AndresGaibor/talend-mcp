# Plan para probar y documentar todos los componentes de Talend

Este plan lo ejecuta **otro agente**. Esta escrito para que ese agente pueda trabajar solo: dice que hay que
hacer, en que orden, con que herramientas, como saber que un componente esta terminado y que hacer cuando algo falla.
Si algo no esta claro, la regla es: **probalo en Studio, mira como lo guarda y copia eso** (ver "Como se resuelve un
componente que no sabes configurar").

- Catalogo completo, generado: [../catalogo-componentes/README.md](../catalogo-componentes/README.md)
- Como ejecutar lo que no se puede levantar (emuladores, shim, servidores falsos): [EMULADORES.md](EMULADORES.md)
- Que hacer cuando falla algo: [SOLUCION-DE-PROBLEMAS.md](SOLUCION-DE-PROBLEMAS.md)
- Plantilla de la ficha de cada componente: [PLANTILLA-FICHA.md](PLANTILLA-FICHA.md)
- Los 50 principales ya tienen ficha: [../COMPONENTES-PRINCIPALES.md](../COMPONENTES-PRINCIPALES.md)

## 1. Alcance en numeros

El catalogo instalado en Studio 8.0.1 tiene **1175 definiciones**: 777 de la paleta Standard (`DI`) y 398 de las
paletas Spark, Streaming y MapReduce. Salen de `bun run docs:componentes`; las cifras de abajo se
actualizan al regenerar.

| Paleta | Componentes | Plan |
|---|---|---|
| `DI` (Standard) | 777 | P01 a P09 y P11 |
| `SPARK`, `SPARKSTREAMING`, `STRUCTUREDSTREAMING` | 397 | P10 |
| `OTHER` | 1 | P11 |

Los componentes de la generacion nueva (AWS, JDBC, Snowflake...) **no tienen XML de definicion**: viven en archivos
`.car` y su definicion esta en el codigo Java. Para esos, `talend_components_definition` no sirve; usa
`talend_studio_component_parameters` con Studio abierto.

## 2. Regla central: nada se queda sin probar

**Todo componente se ejecuta.** "Compila" no es "probado". Si el servicio real no se puede levantar en local, el
agente **construye o usa un sustituto** hasta que el componente corra de verdad y su salida se compruebe. Solo hay un
nivel de aceptacion final y es la ejecucion con la salida comprobada.

| Nivel | Nombre | Requisitos | Se acepta como final |
|---|---|---|---|
| **A** | Ejecutado contra el servicio real | Compila (L4), ejecuta con salida comprobada (L5), caso de error claro (C7), ficha | Si |
| **A-emu** | Ejecutado contra un **sustituto** | Igual que A, pero el servicio es un emulador, un motor compatible (Postgres, H2 en modo Oracle/MSSQL/DB2...) o un servidor falso escrito para la prueba. La ficha dice **cual** y **que no valida** | Si |
| **X** | Excepcion pendiente de aprobacion | Ya se agoto la escalera de emulacion (abajo) y hay una razon tecnica escrita | **No** hasta que la persona responsable lo apruebe |

Los antiguos niveles B (solo compila), C (solo diseno) y D (descartado) **desaparecen como destino**. Un componente
puede quedar temporalmente en X, pero X es una deuda visible: se lista en `docs/plan-componentes/EXCEPCIONES.md` (el
agente la crea y la mantiene) con el motivo, lo que se intento y lo que haria falta. La persona decide si acepta la
excepcion, aporta el servicio o pide otro sustituto. **El agente nunca cierra una excepcion por su cuenta.**

### La escalera de emulacion

Recorre los peldanos **en orden** y quedate con el primero que consiga ejecutar el componente. Detalle de cada uno,
con recetas y la tabla "componente -> sustituto", en [EMULADORES.md](EMULADORES.md).

1. **Servicio real en contenedor** (Postgres, MySQL, Oracle, MSSql, DB2, Mongo, Kafka, LDAP, SFTP...).
2. **Servicio compatible por protocolo** (Greenplum, Redshift, Aurora, Vertica-lite y CockroachDB-like contra Postgres;
   MariaDB contra MySQL).
3. **Motor embebido en modo de compatibilidad**: H2 en modo `Oracle`, `MSSQLServer`, `DB2`, `MySQL`, `PostgreSQL`,
   `Derby` o `HSQLDB`. Sin contenedor y con poca memoria.
4. **Driver "shim"**: un `java.sql.Driver` minimo que se registra con el nombre de clase y la URL del fabricante
   (`com.teradata.jdbc.TeraDriver`, `jdbc:teradata://...`) y reenvia a Postgres o H2. Asi el **codigo generado real**
   del componente corre sin tener el producto.
5. **Servidor falso escrito para la prueba** (HTTP/REST, SOAP, SMTP, LDAP, TCP, SFTP...) que responde con respuestas
   grabadas. Hay un ejemplo en `scripts/l5/http-sink.ts`.
6. **Doble de la libreria cliente** (un jar propio que sustituye al SDK propietario, solo en `testdata/`), cuando el
   componente habla con un cliente nativo (SAP JCo, bibliotecas de fabricante).
7. Si todo lo anterior falla: **X**, con el informe de lo intentado.

Un peldano mas alto no es "mejor": es el **mas fiel al real**. Cuanto mas abajo se baja, mas hay que dejar escrito lo
que el sustituto no demuestra (dialecto SQL, autenticacion real, rendimiento, limites del servicio).

## 3. Que se entrega por componente

1. **Estado** en el catalogo (se regenera solo): L4 y L5.
2. **Ficha** en `docs/fichas-componentes/<grupo>.md`, con la [plantilla](PLANTILLA-FICHA.md).
3. **Escenario L5** (A o A-emu) en `tests/fixtures/talend/escenarios-l5/<suite>/<nombre>.json`; el ejemplo copiable de
   la ficha **es** ese JSON.
4. **Un test de TypeScript** solo si hubo que cambiar codigo del MCP o del bridge para que funcionara.
5. **Una linea** en [../plan-de-pruebas/06-seguimiento-componentes.md](../plan-de-pruebas/06-seguimiento-componentes.md)
   con fecha, comando y resultado.

Una ficha sin escenario que la respalde no vale: el ejemplo debe estar ejecutado.

## 4. Orden de trabajo

El orden es el de los niveles del catalogo (1 a 13). **No saltes al siguiente plan hasta cerrar el anterior o dejar
anotado el bloqueo.**

| Fase | Plan | Que se hace | Aprox. |
|---|---|---|---|
| 0 | este documento | Preparar entorno y **medir la compilacion de todo el catalogo** (seccion 5) | 1 dia |
| 1 | [P01](P01-nucleo-y-control.md) | Nucleo, control y auditoria | 1-2 semanas |
| 2 | [P02](P02-archivos.md) | Archivos, XML y JSON | 1-2 semanas |
| 3 | [P03](P03-bases-de-datos-relacionales.md) | Bases de datos (Oracle, MSSql y DB2 primero) | 3-4 semanas |
| 4 | [P05](P05-transferencia-de-ficheros.md) | FTP, SFTP, SCP, SSH | 3 dias |
| 5 | [P04](P04-elt-y-sql.md) | ELT y SQL | 1 semana |
| 6 | [P06](P06-cloud-y-mensajeria.md) | Cloud y mensajeria | 2 semanas |
| 7 | [P07](P07-apis-y-servicios.md) | APIs, servicios, LDAP | 1 semana |
| 8 | [P08](P08-big-data-y-nosql.md) | Big Data y NoSQL | 2 semanas |
| 9 | [P09](P09-calidad-y-privacidad.md) | Calidad y privacidad de datos | 1 semana |
| 10 | [P11](P11-negocio-y-legado.md) | Negocio, legado y resto | 1 semana |
| 11 | [P10](P10-paletas-no-di.md) | Spark, Streaming, MapReduce | 2-3 semanas |

Las duraciones son orientativas para una persona; sirven para ordenar el esfuerzo, no como compromiso.

## 5. Fase 0: preparar el entorno y medir de verdad

### 5.1 Entorno

1. Studio abierto con el bridge en `127.0.0.1:3930`. Comprobar con `bun run bridge:status`.
2. `bun run bridge:install` para tener el plugin al dia. **Con Studio abierto recarga el plugin en caliente; no lo
   hagas mientras corre una corrida larga.**
3. Servicios de prueba: `docker compose -f testdata/docker-compose.yml up -d`. Hoy trae Postgres (5433), MySQL
   (3307), Mongo (27018), FTP (2121), moto para AWS (4566), Hive (10000), Impala emulado (21051) y HDFS (9000/9870).
   **Cada plan dice que servicio nuevo anadir a ese fichero.** No crees otro compose: se amplia el existente.
4. `bun run typecheck` y `bun test` en verde antes de empezar. `bun run l5:validar` valida los fixtures sin Studio.
5. La maquina tiene poco margen de RAM (13 GB) y Studio lleva `-Xmx4096m`. Studio retiene ~13 MB por cada job que
   se abre en un editor; por eso las corridas largas usan `--reiniciar-studio`.

### 5.2 Medir la compilacion de todo el catalogo (L4) con el metodo offline

Los informes de compilacion actuales (`testdata/cobertura-*.csv`) son antiguos y sus fallos incluyen causas de arnes y
de memoria que ya se arreglaron. **Antes de dar un componente por malo, vuelve a medirlo.**

La forma rapida es **offline**: crear un job minimo por componente con `talend_jobs_create_batch` y compilarlos todos
con `talend_job_build_batch` (unos 0,2 s por job, sin abrir el editor). El catalogo de 777 componentes Standard se mide
en unos 5 minutos de compilacion.

Recetas para el script `scripts/l4-offline.ts` (que hay que escribir; usa los mismos bloques que el arnes):

1. Leer las definiciones con `DefinitionIndexRepository` y quedarse con `palette === "DI"`.
2. Para cada componente, armar el job minimo segun sus conectores (`connectors` de la definicion):
   - tiene entrada `FLOW` y salida `FLOW` (transformacion): `tFixedFlowInput -> X -> tLogRow`.
   - solo salida `FLOW` (origen, `startable`): `X -> tLogRow`.
   - solo entrada `FLOW` (destino): `tFixedFlowInput -> X`.
   - sin flujo (control, `tFileCopy`...): `X` solo, o `tFixedFlowInput -OnSubjobOk-> X`.
3. Rellenar los parametros obligatorios con `planRequiredParameters(definition)` (el mismo plan que usa
   `talend_components_definition`): el trae `suggestedValue` y `literal` por parametro.
4. Escribir los jobs con `talend_jobs_create_batch` (nombre `L4_<componente>`), carpeta `l4/`.
5. `talend_job_build_batch` sobre todos, en tramos de 500. Guardar el resultado por job.
6. Clasificar el error de javac con las reglas de [SOLUCION-DE-PROBLEMAS.md](SOLUCION-DE-PROBLEMAS.md) (libreria
   que falta, schema vacio, parametro sin comillas, componente sin plantilla...).
7. Escribir un CSV nuevo `testdata/cobertura-l4-offline.csv` con las mismas columnas que los anteriores (`componente`,
   `compila`, `error_compilacion`), de modo que `scripts/catalogo-componentes.ts` lo recoja solo.
8. Borrar los jobs `L4_*` y sus carpetas en `poms/jobs/process/` al terminar.

Los pares internos `*In`/`*Out` de la familia `Technical` (por ejemplo `tXMLMapIn`) **no se miden solos**: son la mitad de un componente visible y fallan de forma enganosa (ver [P02](P02-archivos.md), seccion 7). Se saltan en la medicion y se dan por cubiertos cuando lo esta su componente visible.

Limites del metodo: no detecta un error de ejecucion, y un componente que Studio configura al conectarlo (`tMap`,
`tAggregateRow`, `tNormalize`, `tJavaRow`) necesita su modelo; esos se miden con el arnes de L5 (montaje por la API de
Studio). Marca en el CSV `compila=sin` y la causa `necesita modelo`, para no confundirlos con un fallo.

### 5.3 Resultado esperado de la Fase 0

- `docs/catalogo-componentes/` regenerado con la medicion nueva.
- Una lista corta, por causa, de lo que de verdad no compila. Esa lista es el trabajo real de P01 a P11.

## 6. Bucle de trabajo por componente

```
1. Leer su fila en docs/catalogo-componentes/<grupo>.md y su plan (P0x)
2. talend_components_definition { name }            -> parametros, conectores, libs
3. (generacion nueva) talend_studio_component_parameters { name }
4. Elegir el peldano de la escalera de emulacion (EMULADORES.md) y anotarlo: servicio real, sustituto o excepcion
5. Montar el job minimo y compilarlo (offline o por la API de Studio)
6. Si no compila -> SOLUCION-DE-PROBLEMAS.md; si hay que cambiar codigo, test primero
7. Escribir el escenario L5 con la salida esperada ANTES de ejecutar
8. bun run l5:validar ; bun run scripts/execution-check.ts --suite <suite> "<filtro>"
9. Anadir el caso malo (C7): parametro vacio, sin schema, servicio caido
10. Escribir la ficha (PLANTILLA-FICHA.md) con el JSON del escenario
11. Anotar una linea en el seguimiento y regenerar el catalogo
```

Los criterios C1 a C9 del plan de los 50 siguen valiendo
([../plan-de-pruebas/05-componentes-uno-a-uno.md](../plan-de-pruebas/05-componentes-uno-a-uno.md)): C1 descubrimiento,
C2 parametros, C3 contrato MCP, C4 ejemplo minimo, C5 compila, C6 ejecuta, C7 error claro, C8 documentacion,
C9 agente frio. Para A y A-emu hacen falta C1 a C8.

### Como se resuelve un componente que no sabes configurar

Es el metodo mas fiable del proyecto. Cuando `talend_components_definition` no basta (tablas, modelos, parametros que
cambian con otros):

1. Crealo en Studio **con la API** (`talend_job_create_in_studio` + `talend_job_add_node`) con los valores por
   defecto, o mejor: pidele a la persona que lo monte a mano en el lienzo.
2. Guarda el job y leelo del disco: `talend_jobs_read { jobName }` o abre
   `process/<carpeta>/<JOB>_0.1.item`. Ahi esta **exactamente** como Studio guarda cada `elementParameter`, cada tabla
   (`elementValue`) y el `nodeData` de los componentes con modelo.
3. Copia esos valores al escenario. Respeta las comillas: los parametros de lista (`*_LIST`) van sin comillas y los
   de texto con comillas (ver [../plan-de-pruebas/04-reglas-de-componentes.md](../plan-de-pruebas/04-reglas-de-componentes.md)).
4. Prueba que el escenario reproduce el job: compila y da la misma salida.

### Que herramientas MCP usar

| Necesidad | Tool |
|---|---|
| Ver la definicion de un componente | `talend_components_definition`, `talend_components_parameters` |
| Parametros reales con Studio abierto | `talend_studio_component_parameters` |
| Crear/editar jobs en bloque, sin Studio | `talend_jobs_create_batch`, `talend_jobs_edit_batch`, `talend_job_edit_offline` |
| Compilar muchos jobs | `talend_job_build_batch` |
| Montar un job con la API de Studio | `talend_job_create_in_studio`, `talend_job_add_node`, `talend_job_set_schema`, `talend_job_connect_nodes` |
| Comprobar de verdad un job | `talend_job_verify` (diseno + compila + ejecuta + avisos) |
| Leer un job del disco | `talend_jobs_read` |
| Ver errores | `talend_job_problems`, `talend_errors_explain` |

Detalle de la estrategia mixta (cuando offline y cuando Studio en vivo): [../MODO-OFFLINE.md](../MODO-OFFLINE.md).

## 7. Como se escribe un escenario L5

El formato esta en [../plan-de-pruebas/03-ejecucion-l5.md](../plan-de-pruebas/03-ejecucion-l5.md). Resumen:

- Un archivo por escenario en `tests/fixtures/talend/escenarios-l5/<carpeta>/<nombre-en-minusculas>.json`.
- **La suite sale del prefijo del campo `nombre`** (lo que hay antes de `:`), no de la carpeta. Prefijos validos:
  `humo`, `archivos`, `transformaciones`, `bases de datos` (suite `bd`), `control de flujo` (suite `control`),
  `contextos`, `orquestacion`, `codigo`, `aws`, `privacidad`, `calidad`, `formatos`, `sistema` y `conciliacion`.
  Una familia nueva se anade al mapa `SCENARIO_SUITES` de `scripts/l5/scenario-selection.ts` (de ahi salen la
  validacion de `--suite` y el filtro) y se documenta. La carpeta solo sirve para ordenar los ficheros.
- `@TESTDATA@` dentro de rutas es la carpeta `testdata/`. Los datos de entrada van en `testdata/`.
- La salida esperada (`espera`) se declara **antes** de ejecutar: `lineas` (exactas, o solo cuantas), `contiene`
  (lineas que deben aparecer, sin orden), `fichero` (`ruta`, `lineas`, `contiene`), `consulta` (SQL de comprobacion
  contra el Postgres de pruebas), `contextos`, `error_esperado` y `avisos_tolerados`.
- El job se llama `MCP_L5_<Nombre>` y se borra al terminar (`L5_KEEP_JOBS=1` lo conserva para abrirlo).
- Un escenario que depende de un servicio inexistente se marca `pendiente` con el motivo (un texto); no se borra.
- `prepara` es una lista de SQL que se ejecuta **antes** del job (solo Postgres); `jobs` son los auxiliares (el hijo de
  un `tRunJob`); `timeoutMs` sube el tiempo maximo (180 s por defecto).
- Los avisos de Studio y `[WARN]` de la salida **se informan**. Si uno es esperado, se declara en
  `espera.avisos_tolerados` con el texto exacto del nodo y el motivo (ejemplo: `control/tassert-valida-un-conteo.json`).

Escenario minimo completo (`humo/entrada-fija-a-log.json`), que sirve de modelo:

```json
{
  "nombre": "humo: entrada fija a log",
  "job": "MCP_L5_Humo",
  "nodos": [
    { "type": "tFixedFlowInput", "nombre": "entrada",
      "columnas": [ { "name": "id", "type": "id_Integer" }, { "name": "ciudad", "type": "id_String" } ],
      "values": [ ["1", "Bogota"], ["2", "Medellin"] ] },
    { "type": "tLogRow", "nombre": "salida" }
  ],
  "conexiones": [ { "origen": "entrada", "destino": "salida" } ],
  "espera": { "lineas": ["1|Bogota", "2|Medellin"] }
}
```

Campos de un nodo (`Nodo` en `scripts/l5/scenario-types.ts`): `type`, `nombre`, `parameters`
(`{ "PARAM": { "value": "...", "literal": true|false } }`), `columnas`, `columnasPorConector`, `esquemas` (varias
tablas de metadata, p. ej. `tAggregateRow`), `values` (filas de un `tFixedFlowInput`), `tablas` (`GROUPBYS`,
`FIELD_OPTIONS`...), `schemaDespuesDeConectar` y `mapper` (modelo del `tMap`). Una conexion es
`{ origen, destino, tipo }` con `tipo` = el conector de Studio (por defecto el principal; usados: `SUBJOB_OK`, `ITERATE`, `SUBJOB_ERROR`, `PARALLELIZE`,
`COMPONENT_OK`, `MAIN`, `REJECT`...).

Comandos:

```bash
bun run l5:validar --suite bd                      # valida fixtures sin Studio
bun run scripts/execution-check.ts --suite bd --todas "tabla"   # ejecuta
bun run scripts/execution-check.ts --reiniciar-studio ...       # si la memoria llega al 80 %
L5_KEEP_JOBS=1 bun run scripts/execution-check.ts ...           # deja el job para inspeccionarlo
```

## 8. Documentacion que se produce

| Que | Donde | Como |
|---|---|---|
| Catalogo completo | `docs/catalogo-componentes/` | **Generado**: `bun run docs:componentes` (no se edita) |
| Ficha de cada componente | `docs/fichas-componentes/<grupo>.md` | A mano, con la [plantilla](PLANTILLA-FICHA.md) |
| Reglas nuevas descubiertas | `docs/plan-de-pruebas/04-reglas-de-componentes.md` | Una seccion por regla, con el sintoma y el arreglo |
| Detalle interno de Studio nuevo | `docs/studio-internals/` (indice en `docs/TALEND-STUDIO-INTERNALS.md`) | Solo si descubres una API o trampa de Studio |
| Seguimiento | `docs/plan-de-pruebas/06-seguimiento-componentes.md` | Una linea por componente y fecha |
| Guia del agente | `src/modules/guide/domain/task-catalog/` | Si descubres una regla que un agente debe seguir, anadela a `rules.ts` |

Regenera el catalogo al terminar cada tanda: `bun run docs:componentes`.

## 9. Reglas de oro para el agente que ejecuta el plan

1. **Evidencia antes que afirmacion.** "Funciona" significa: comando ejecutado, salida leida, resultado pegado en el
   seguimiento. Compilar no es ejecutar; un job que termina con codigo 0 puede tener `[WARN]`/`[ERROR]` en la salida.
2. **No cambies el estado de Studio sin avisar.** `bun run bridge:install` recarga el plugin del Studio en uso. No lo
   hagas durante una corrida larga. No fuerces el cierre de Studio ni de procesos del usuario.
3. **Un cambio de codigo lleva su test.** Si arreglas el MCP o el bridge para que un componente funcione, anade un test
   y deja `bun run typecheck` y `bun test` en verde antes de seguir.
4. **No edites en disco un job abierto en un editor** (Studio lo pisaria). Las tools offline se niegan.
5. **Nada se queda sin probar.** Si un componente depende de algo que no puedes levantar, recorre la escalera de emulacion
   ([EMULADORES.md](EMULADORES.md)) antes de rendirte. Solo si se agota, lo registras como excepcion X con la
   razon y pasa al siguiente. Nunca lo dejes sin estado.
6. **Los datos de prueba son sinteticos.** No uses datos reales de clientes; en `testdata/` solo hay datos inventados.
7. **No commitees secretos.** Las claves de los contenedores de prueba son de laboratorio (`talend/talend`); si un
   servicio pide una clave real, va en variables de entorno.
8. **Commits pequenos, por familia**, con el mensaje `test(l5): <familia>: <que>`. No commitees si el typecheck o los
   tests fallan.

## 10. Definicion de "terminado"

El plan termina cuando se cumple **todo** esto:

1. Los **777 componentes Standard** estan en **A** (servicio real) o **A-emu** (sustituto), con su ficha y su escenario
   L5 ejecutado. Cero componentes "sin medir" y cero "solo compila" en `docs/catalogo-componentes/README.md`.
2. Los **398 componentes de las paletas Spark, Streaming y MapReduce** estan igual de ejecutados (P10).
3. Los pares internos `*In`/`*Out` quedan cubiertos por la ficha de su componente visible (no cuentan aparte).
4. `docs/plan-componentes/EXCEPCIONES.md` esta **vacio**, o cada fila tiene la decision escrita de la persona
   responsable (aportar el servicio, aceptar el sustituto, o retirar el componente del alcance).
5. Informe final en `docs/plan-componentes/INFORME-FINAL.md`: cuantos componentes hay por nivel (A / A-emu), que
   sustituto se uso en cada A-emu y **que no demuestra**, y la lista de excepciones.

Mientras haya una excepcion sin decision, el plan **no esta terminado**; no se maquilla bajando el listón.
