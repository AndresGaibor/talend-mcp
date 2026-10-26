# Plan de verificacion componente a componente

[Volver al indice](../PLAN-DE-PRUEBAS.md)

## Objetivo

Recorrer los 50 componentes de la lista de abajo **uno por uno**. Un componente queda hecho solo cuando un agente
externo puede configurarlo con pocas llamadas, sin adivinar nombres ni valores, y Talend lo compila y lo ejecuta con
la salida que se declaro antes. El avance de cada componente se anota en
[06-seguimiento-componentes.md](06-seguimiento-componentes.md).

## Principios para el agente externo

1. **Pocas llamadas.** Crear un componente y configurarlo en una o dos llamadas: `talend_job_add_node` con
   `parameters`, `schema`, `tables` o `mapper`.
2. **Lo obligatorio con valor por defecto se rellena solo.** El agente pone solo lo que decide: la ruta, la tabla,
   la expresion.
3. **Los nombres son los de Studio.** Las conexiones se llaman `row1`, `row2`... que pone Studio al conectar. El
   nombre de una tabla de tMap es el de su conexion; nunca uno inventado (`out1`, `Var`).
4. **Un error dice que fallo, en que nodo y como se arregla.** Nada de codigos crudos ni `ECONNREFUSED` sin contexto.
5. **Un ejemplo copiable por componente**, en la documentacion, y es exactamente el que pasa la prueba.

## Ficha de verificacion

Cada componente pasa estas comprobaciones en orden. Si una falla, se corrige (MCP, generador o documentacion) y se
repite desde esa comprobacion.

| Codigo | Comprobacion | Como se comprueba |
|---|---|---|
| C1 Descubrimiento | Se encuentra por su nombre exacto y tiene una descripcion de una linea | `talend_components_search`, `talend_list_components` |
| C2 Parametros | Obligatorios, valores por defecto y valores validos son claros | `talend_components_parameters`, `talend_components_definition` |
| C3 Contrato MCP | Las descripciones de la herramienta y de sus campos explican el componente, y ningun campo se descarta en silencio | Lectura del schema de `talend_job_add_node` y `talend_job_configure_node`; test de schema |
| C4 Ejemplo minimo | Un JSON de configuracion copiable que monta el nodo | Escenario L5 (existente o nuevo) |
| C5 Compila | Talend genera el codigo sin errores | `bun run scripts/execution-check.ts <escenario>`: compila antes de ejecutar |
| C6 Ejecuta | La salida, o el fichero escrito, coincide con lo declarado | Mismo comando; compara la seccion `espera` |
| C7 Error claro | Un caso malo (parametro vacio, sin esquema, conexion no valida) da un mensaje que dice que arreglar | Test de TypeScript, o escenario con `error_esperado` |
| C8 Documentacion | Ficha en `COMPONENTS.md` con el ejemplo de C4, y ese ejemplo existe en el repo | Test de documentacion (`tests/docs`) |
| C9 Agente frio | Un agente sin contexto, que solo lee la documentacion, lo configura sin errores | Prueba manual; se anotan llamadas y errores |

C9 mide si es intuitivo. Se evalua al final de cada grupo, no por componente, porque necesita un agente nuevo cada vez.

## Entorno

- Talend Studio abierto con el bridge en modo `readWrite`. Comprobar con `bun run bridge:status`.
- Publicar el build del bridge con `bun run bridge:install`. Con Studio abierto recarga el plugin en caliente, asi
  que **cambia el Studio en uso**: pedir confirmacion antes.
- Base de datos de pruebas para los escenarios de BD: `docker compose -f testdata/docker-compose.yml up -d` (puerto 5433).
- Sin Studio: `bun test`, `bun run typecheck` y `bun run l5:validar`.
- Los jobs de prueba se llaman `MCP_L5_*` y se borran al terminar, salvo con `L5_KEEP_JOBS=1`.

## Orden

Los cinco grupos de la lista, en orden: A (1-12), B (13-22), C (23-33), D (34-43) y E (44-50). Dentro de cada grupo, en el
orden de la lista. Un componente no empieza hasta que el anterior esta hecho o tiene un bloqueo anotado.

**Fase 0, antes del grupo A:**

1. Tests y typecheck en verde.
2. Bridge compilado con los cambios de `MapperConfigurer.java`. Ya compila con el JDK de Studio
   (`buildBridgeFast`, sin publicar).
3. Publicar el bridge en el Studio en uso. Requiere confirmacion.

## Proceso por componente

1. Leer su fila en el seguimiento y sus hallazgos previos (seccion de abajo).
2. Revisar C1 a C3: en el codigo y con las herramientas del MCP contra Studio.
3. Corregir lo que falle. Cada correccion lleva su test.
4. Ejecutar C4 a C6 con el escenario L5 del componente. Si no existe, crearlo en
   `tests/fixtures/talend/escenarios-l5/<suite>/`.
5. Anadir C7 (caso malo) y C8 (documentacion).
6. Anotar el resultado en el seguimiento: fecha, comando y resultado.

Un componente esta **hecho** cuando C1 a C8 pasan. C9 se evalua por grupo.

## Lista de los 50 componentes

Criterio: uso frecuente en jobs ETL reales y su papel en el flujo (entrada, transformacion, salida, control de
errores, orquestacion). El orden dentro de cada grupo es aproximado.

### Grupo A: flujo de datos basico

| # | Componente | Para que |
|---|---|---|
| 1 | tMap | Transformar, filtrar y cruzar entradas y salidas |
| 2 | tFileInputDelimited | Leer CSV/TXT |
| 3 | tFileOutputDelimited | Escribir CSV/TXT |
| 4 | tJDBCInput | Leer de una base por JDBC |
| 5 | tJDBCOutput | Escribir en una base por JDBC |
| 6 | tJDBCConnection | Conexion compartida a la base |
| 7 | tFilterRow | Filtrar filas |
| 8 | tAggregateRow | Agrupar y agregar |
| 9 | tSortRow | Ordenar |
| 10 | tUniqRow | Quitar duplicados |
| 11 | tJava | Codigo Java en lote |
| 12 | tLogRow | Mostrar filas en consola |

### Grupo B: control y orquestacion

| # | Componente | Para que |
|---|---|---|
| 13 | tRunJob | Llamar a un job hijo |
| 14 | tPrejob | Inicio de subjob |
| 15 | tPostjob | Cierre de subjob |
| 16 | tDie | Parar el job con error |
| 17 | tWarn | Aviso sin parar |
| 18 | tLogCatcher | Capturar excepciones |
| 19 | tStatCatcher | Estadisticas de ejecucion |
| 20 | tSetGlobalVar | Variables globales |
| 21 | tContextLoad | Cargar contextos |
| 22 | tLoop | Bucles FOR/WHILE |

### Grupo C: archivos y formatos

| # | Componente | Para que |
|---|---|---|
| 23 | tFileList | Listar ficheros de una carpeta |
| 24 | tFileInputExcel | Leer Excel |
| 25 | tFileOutputExcel | Escribir Excel |
| 26 | tFileInputXML | Leer XML |
| 27 | tFileInputJSON | Leer JSON |
| 28 | tFileInputPositional | Leer ancho fijo |
| 29 | tFileCopy | Copiar ficheros |
| 30 | tFileDelete | Borrar ficheros |
| 31 | tFileExist | Comprobar que existe un fichero |
| 32 | tHttpRequest | Llamadas HTTP/REST |
| 33 | tSendMail | Enviar correo |

### Grupo D: transformacion avanzada

| # | Componente | Para que |
|---|---|---|
| 34 | tJavaRow | Codigo Java fila a fila |
| 35 | tJavaFlex | Java al inicio, por fila y al final |
| 36 | tJoin | Cruzar flujos |
| 37 | tUnite | Unir flujos |
| 38 | tReplicate | Duplicar un flujo |
| 39 | tNormalize | Separar una columna en filas |
| 40 | tDenormalize | Agrupar filas en una columna |
| 41 | tConvertType | Cambiar tipos |
| 42 | tFlowToIterate | Convertir flujo en iteraciones |
| 43 | tIterateToFlow | Convertir iteraciones en flujo |

### Grupo E: bases de datos y utilidades

| # | Componente | Para que |
|---|---|---|
| 44 | tJDBCRow | SQL libre |
| 45 | tJDBCClose | Cerrar conexion |
| 46 | tJDBCCommit | Confirmar transaccion |
| 47 | tJDBCRollback | Deshacer transaccion |
| 48 | tFixedFlowInput | Datos fijos de prueba |
| 49 | tRowGenerator | Generar filas |
| 50 | tPostgresqlInput | Leer PostgreSQL |

## Hallazgos previos que entran en la revision

Vienen de los informes `testdata/cobertura-l4-*.csv` y de la revision de tMap. Cada uno se confirma o se descarta
al revisar su componente.

- **Correccion de la lista (verificada con Studio):** tDBInput, tDBOutput, tDBConnection, tDBRow, tDBClose,
  tDBCommit y tDBRollback no existen en la paleta Standard de Talend 8.0.1; el genérico es la familia `tJDBC*`. Y
  tRESTClient tampoco existe: el REST de la paleta es `tREST`, marcado como *deprecated*, así que se sustituye por
  `tHttpRequest`. La posición en la lista no cambia.
- **Sin medicion de compilacion:** tSendMail tiene creacion y guardado, pero no compilacion. Los componentes JDBC
  de generacion nueva no tienen XML: su definicion sale solo de Studio (`talend_studio_component_parameters`).
- **Fallos de compilacion en los informes:** tSortRow (`defaultRow cannot be resolved`), tUniqRow
  (`IllegalArgumentException`), tRunJob (`Syntax error on token "new"`), tContextLoad (`Duplicate local variable`),
  tFileInputExcel (`Syntax error on token ""`), tFileInputXML (`NameSpaceTool_... cannot be resolved`), tNormalize
  (`split(String`), tDenormalize (`ciudad cannot be resolved`), tFileCopy (`IllegalArgumentException`).
- **Medicion contaminada:** `cobertura-l4-familias2.csv` tiene `Project ... is duplicated in the reactor`. Afecta
  a tFileList, tFileDelete, tFileExist y tFileInputXML. Hay que volver a medirlas.
- **tMap:** la salida `out1` que el agente usaba no es un nombre de Studio. El bridge con las correcciones compila,
  pero todavia no esta publicado en el Studio en uso.
- **Herramientas solapadas:** 233 nombres `talend_*` (`talend_bridge_*`, `talend_studio_*`, `talend_components_*`,
  `talend_job_*`). Para un agente externo la ruta recomendada tiene que quedar clara en `talend_guide`.
- **Ruta XML:** `create-from-spec` genera un tMap con una salida `out1` vacia por defecto, y esa herramienta no
  expone `mapper`.
