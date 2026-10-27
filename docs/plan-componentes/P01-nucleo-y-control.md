# P01 · Nucleo, control y auditoria

Niveles 1 y 2 del catalogo (y parte del 12 que es de control). Son los componentes que estan en casi todo job: si
fallan, falla todo lo demas. **Se cierran primero y con el nivel mas exigente (A).**

- Catalogo: [processing](../catalogo-componentes/processing.md), [orchestration](../catalogo-componentes/orchestration.md),
  [logs-errors](../catalogo-componentes/logs-errors.md), [custom-code](../catalogo-componentes/custom-code.md),
  [system](../catalogo-componentes/system.md), [misc](../catalogo-componentes/misc.md),
  [technical](../catalogo-componentes/technical.md), [test-and-check](../catalogo-componentes/test-and-check.md).
- Suites L5 que ya existen: `humo`, `transformaciones`, `control`, `orquestacion`, `contextos`, `codigo`.
- Servicios externos: ninguno, salvo `tSendMail` (MailHog), `tWaitForSocket`/`tServerAlive` (un servidor TCP de prueba con Bun) y `tWaitForSqlData` (Postgres).

## 1. Estado de partida (aprox.)

De los 44 componentes del nivel 1, 35 ya tienen escenario L5 que pasa. Faltan, entre otros: `tReplace`,
`tReplaceList`, `tExtractDelimitedFields`, `tSplitRow`, `tSampleRow`, `tForeach`, `tBufferInput`, `tBufferOutput`.
Del nivel 2 estan hechos `tLogCatcher`, `tStatCatcher`, `tAssert`, `tAssertCatcher`, `tChronometerStart`,
`tChronometerStop`, `tSetEnv`; faltan `tFlowMeter`, `tFlowMeterCatcher`, `tSetProxy`, `tSetKeystore`,
`tSetKerberosConfiguration`, `tLibraryLoad`, `tMemorizeRows`, `tMsgBox`, `tInfiniteLoop`, `tWaitForSqlData`,
`tWaitForSocket`, `tServerAlive`, `tContextDump`. Confirmalo en el catalogo antes de empezar: cambia con cada corrida.

## 2. Orden de trabajo

1. Cerrar los pendientes de nivel 1 (los transformadores de fila y los de iteracion).
2. Nivel 2: auditoria (`tFlowMeter`, `tFlowMeterCatcher`), memoria (`tMemorizeRows`, `tBufferInput/Output`).
3. Nivel 2: configuracion de entorno (`tSetProxy`, `tSetKeystore`, `tSetKerberosConfiguration`, `tLibraryLoad`).
4. Nivel 2: esperas y servicios (`tWaitForSqlData`, `tWaitForSocket`, `tServerAlive`, `tInfiniteLoop`).
5. Revision del `tMap` con casos complejos (seccion 4).

## 3. Receta por grupo

### 3.1 Transformadores de fila (`tReplace`, `tReplaceList`, `tExtractDelimitedFields`, `tSplitRow`, `tSampleRow`)

Patron: `tFixedFlowInput -> X -> tLogRow` con filas conocidas y salida exacta.

| Componente | Que comprobar | Pista |
|---|---|---|
| `tReplace` | Sustitucion simple, con `CASE_SENSITIVE`, y por expresion regular | La tabla `SUBSTITUTIONS` (`INPUT_COLUMN`, `SEARCH_PATTERN`, `REPLACE_STRING`, ...); las celdas con nombres de columna van **sin** comillas, las demas con comillas |
| `tReplaceList` | Sustitucion con una tabla de equivalencias (lookup) | Necesita dos entradas: el flujo y el `lookup` con las parejas buscar/reemplazar |
| `tExtractDelimitedFields` | Parte un campo en columnas con un separador | Origen con una columna, salida con tantas como campos; `FIELDSEPARATOR` como literal Java |
| `tSplitRow` | Una fila de entrada produce N filas de salida | Esquema de salida distinto; `COL_MAPPING` de la tabla |
| `tSampleRow` | Se queda con filas por rango (`"1,3..5"`) | El rango es un literal Java; comprobar que respeta el orden |

### 3.2 Iteracion y control de flujo (`tForeach`, `tLoop`, `tFlowToIterate`, `tIterateToFlow`, `tInfiniteLoop`)

- `tForeach`: lista de valores fija; cada iteracion deja `globalMap.get("<nodo>_CURRENT_VALUE")`. Comprobar con un
  `tJava` que imprime el valor y que el numero de iteraciones coincide.
- `tLoop`: `FOR` con `FROM`, `TO`, `STEP`; `WHILE` con una condicion Java. Escenario ya existente (`control/`).
- `tInfiniteLoop`: **cuidado**, no termina solo. El escenario debe cortar con un `tDie` por una condicion
  (`globalMap` con un contador) o con `timeoutMs`. Declaralo en el escenario y anotalo en la ficha.

### 3.3 Memoria y buffers (`tMemorizeRows`, `tBufferOutput`, `tBufferInput`)

- `tMemorizeRows`: guarda las N ultimas filas en variables (`row1_col[0]`, `[1]`...). Comprobar con un `tJavaRow` que
  lee la fila anterior.
- `tBufferOutput` / `tBufferInput`: el buffer sirve para pasar datos entre un job hijo y su padre (`tRunJob` con
  "transmit whole context" y devolviendo el buffer). Escenario: hijo con `tBufferOutput`, padre que lee con
  `tRunJob` y `tLogRow`. Es la parte mas delicada: documentar bien el orden.

### 3.4 Auditoria (`tFlowMeter`, `tFlowMeterCatcher`, `tStatCatcher`, `tLogCatcher`)

- `tFlowMeter` cuenta las filas que pasan por un enlace; `tFlowMeterCatcher` las recoge. Patron:
  `tFixedFlowInput -> (enlace con tFlowMeter) -> tLogRow` y, en paralelo, `tFlowMeterCatcher -> tLogRow`.
  La salida debe traer el numero de filas y la etiqueta del enlace.
- Las columnas de los catchers (`moment`, `pid`, `job`, `origin`, `message`...) son de tipo fecha/texto fijos. El bridge
  ya les pone el patron de fecha al guardar; si ves `A value must be set for Date Pattern`, mira
  [SOLUCION-DE-PROBLEMAS.md](SOLUCION-DE-PROBLEMAS.md) seccion 3.
- `tStatCatcher` necesita `tStatCatcherStatistics=true` en el job (parametro del job, no del componente).

### 3.5 Entorno y seguridad (`tSetProxy`, `tSetKeystore`, `tSetKerberosConfiguration`, `tLibraryLoad`, `tSetEnv`)

Son configuracion, no flujo de datos. Nivel de aceptacion realista:

| Componente | Nivel | Como se prueba |
|---|---|---|
| `tSetProxy` | A | Fija propiedades del sistema (`http.proxyHost`...); un `tJava` posterior las lee con `System.getProperty` y las imprime |
| `tSetKeystore` | A | Apunta a un keystore generado con `keytool` en `testdata/`; un `tJava` lee `javax.net.ssl.keyStore` |
| `tSetKerberosConfiguration` | A-emu | Fija propiedades de Kerberos. Se comprueba con un `tJava` que lee `java.security.krb5.conf`/`realm`, y se ejecuta contra un KDC MIT krb5 de laboratorio en contenedor (imagen de comunidad); sin KDC solo demuestra las propiedades |
| `tLibraryLoad` | A | Carga un jar de `testdata/` y un `tJava` instancia una clase de el |
| `tSetEnv` | A (ya hecho) | `PATH` de la JVM |

### 3.6 Esperas (`tWaitForFile` hecho; `tWaitForSqlData`, `tWaitForSocket`, `tServerAlive`)

- `tWaitForSqlData`: espera a que una consulta devuelva filas. Usar el Postgres (5433): una tabla vacia que un
  subjob paralelo llena tras 2 s. Comprobar que el job continua cuando aparece el dato y que respeta `TIMEOUT`.
- `tWaitForSocket`: levantar un `Bun.serve` TCP que se abre tras 2 s (hay un ejemplo de servidor auxiliar en
  `scripts/l5/http-sink.ts`).
- `tServerAlive`: comprobar un host:puerto vivo y otro muerto; el segundo debe dar un error claro (C7).

### 3.7 Contexto y variables (`tContextLoad`, `tContextDump`, `tSetGlobalVar`)

- `tContextLoad` necesita su `nodeData` con la lista de variables a cargar; si no, no saca filas. Montalo en Studio y
  lee su `.item` (metodo de README, seccion 6).
- `tContextDump` es su inverso: imprime las variables del contexto. Escenario con dos variables y salida exacta.

### 3.8 Codigo propio (`tJava`, `tJavaRow`, `tJavaFlex`, `tGroovy*`)

- Ya estan los tres de Java. Pendiente: documentar **imports**, **rutinas** (`routines.*`) y el uso de `globalMap`.
- Trampa del `tJavaRow` con enteros no nulos: ver SOLUCION seccion 2.
- `tGroovy`/`tGroovyFile` (nivel 12): se ejecutan; Groovy llega como libreria (`installMissing`). Escenario con un script de 3 lineas y salida exacta.

### 3.9 Subjobs y orquestacion (`tRunJob`, `tPrejob`, `tPostjob`, `tParallelize`, `tDie`, `tWarn`, `tSleep`, `tSendMail`, `tSystem`)

Hechos con L5. Lo que falta es **documentar los casos limite**:

- `tRunJob`: pasar parametros de contexto, "die on child error", hijo con `tBufferOutput`, hijo inexistente (error claro).
- `tParallelize`: espera `Wait for all` y `Wait for first` y el orden de salida (no determinista: comprobar con
  `espera.contiene`, no con `lineas` exactas).
- `tSendMail`: levantar **MailHog** (`mailhog/mailhog`, SMTP 1025, API HTTP 8025) y comprobar con su API que llego
  el mensaje. Anadir el servicio a `testdata/docker-compose.yml`.
- `tSystem`: comandos portables (`cmd /c echo` en Windows); comprobar salida estandar y codigo de salida.
- `tMsgBox`: abre un dialogo Swing. Se ejecuta en una sesion con escritorio y un `tJava` en paralelo (`tParallelize`) lo cierra con `java.awt.Robot` (pulsa Enter); el job debe terminar con codigo 0. Sin escritorio (`java.awt.headless=true`) lanza `HeadlessException`: ese comportamiento tambien se documenta y se comprueba con `error_esperado`.

## 4. `tMap`: el que mas valor tiene

El `tMap` es el componente mas usado y el mas complejo. El escenario actual (renombrar y filtrar) no basta. Escenarios
nuevos, cada uno con su ficha:

| Caso | Que cubre |
|---|---|
| Join interno con un `lookup` | Dos entradas, `INNER_JOIN`, salida con columnas de ambas |
| Join externo (`LEFT_OUTER_JOIN`) | Filas sin pareja salen con nulos |
| Salida `reject` y `inner join reject` | Las filas que no cruzan van a una segunda salida |
| Varias salidas con filtros distintos | Una fila puede ir a mas de una salida |
| Variables (`Var`) y expresiones Java | `Var.x = row1.a + row1.b`; funciones de `StringHandling` y `TalendDate` |
| Lookup con `Reload at each row` / `Load once` | Comprobar con datos que cambian |
| Expresion con `null` | Columna nulable, `Relational.ISNULL` |
| Orden de salidas y `Die on error` | Que pasa si una expresion lanza excepcion |

El modelo del mapper se aplica **despues de conectar** (`mapper` en el spec). Montalo en Studio, guarda y lee el
`nodeData` del `.item`: es la fuente de verdad para escribir el JSON.

## 5. Aceptacion de P01

- Todos los de nivel 1 y 2 en A; `tSetKerberosConfiguration` y `tMsgBox` en A-emu (KDC de laboratorio; dialogo cerrado desde el propio job con `Robot`, ver EMULADORES.md seccion 5).
- `tMap` con los 8 casos de la seccion 4.
- Fichas escritas en `docs/fichas-componentes/processing.md`, `orchestration.md`, `logs-errors.md`,
  `custom-code.md`, `system.md`, `misc.md`, `technical.md` y `test-and-check.md`.
- Seguimiento al dia y catalogo regenerado.

## 6. Riesgos y como se resuelven

| Riesgo | Que hacer |
|---|---|
| `tInfiniteLoop` cuelga la corrida | Siempre con corte por `tDie` y `timeoutMs` bajo; si cuelga, `Stop` del job desde el arnes, nunca matar Studio |
| Salida no determinista (`tParallelize`) | `espera.contiene` en vez de `lineas` exactas |
| `tSendMail` sin SMTP | Levantar MailHog (A-emu: valida el mensaje, no un buzon real) |
| `tContextLoad` sin filas | Falta `nodeData`; copiarlo del `.item` de Studio |
| Avisos de catchers | SOLUCION seccion 3 |
