# Plan de pruebas del MCP de Talend

Va de lo simple a lo complejo. Si una fase falla, no avances: ahi esta el limite del MCP.
Como usar el MCP para ejecutarlo: [GUIA-AGENTE.md](GUIA-AGENTE.md).

## Criterios (se registran para cada prueba)

1. El MCP genera el job sin errores.
2. El job abre en Talend Studio sin avisos.
3. El job compila y ejecuta.
4. La salida coincide con lo esperado, **que se define antes de ejecutar**.

La salida se lee con `talend_job_execute`, no mirando la vista Run.

## Datos de prueba

`bun run scripts/make-testdata.ts` los genera en `testdata/` (los CSV y el Excel grandes estan
en `.gitignore` y se regeneran). Tienen trampas a proposito.

| Archivo | Contenido | Trampas |
|---|---|---|
| `clientes.csv` | id, nombre, fecha_alta, monto, estado, ciudad | Separador `;`, tildes y ñ, nulos, 2 filas duplicadas, fechas en dos formatos |
| `transacciones.csv` | id_tx, id_cliente, monto, fecha | Un `id_cliente` que no existe en clientes (rechazos) |
| `productos.xlsx` | 2 hojas, encabezado en la fila 3 | Celdas combinadas, numeros guardados como texto |
| `ancho_fijo.txt` | Layout posicional de 5 campos | Estilo de exportes SAS |
| `config.json` / `ventas.json` | Parametros anidados | Arreglo dentro de objeto |
| `clientes_grande.csv` | 500 mil filas | Rendimiento |

Para las pruebas de base de datos: `testdata/docker-compose.yml` y `testdata/sql/init.sql`
levantan un Postgres local. El proyecto real ya tiene un Postgres en la nube configurado en sus
jobs, asi que Docker solo hace falta si no se quiere tocar ese.

## Fases y estado

| Fase | Que se prueba | Estado |
|---|---|---|
| 0 | `tFixedFlowInput` -> `tLogRow` (humo) | Validada: `1\|Bogota\|100.5`, `2\|Medellin\|200.25` |
| 1 | `tFileInputDelimited` -> `tLogRow`; -> `tFileOutputDelimited` (separador y encoding) | Validada: respeta tildes, ñ y nulos; falla en fechas `dd/MM/yyyy` (la trampa); salida UTF-8 correcta |
| 2 | `tMap` (renombrar, expresiones, filtros, rechazo, lookups, nulos, fechas, Var) | **Bloqueada por entorno**: el `.item` sale bien pero no compila sin `talend-tmap-dataset-1.2.16.jar` (Talend Exchange) |
| 3 | `tSortRow`, `tUniqRow`, `tAggregateRow`, `tJoin`, `tUnite`, `tReplicate`, `tNormalize`, `tDenormalize`, `tFilterRow`, `tFilterColumns` | **Pendiente**: falta el formato interno de las tablas de condiciones/criterios (el catalogo solo da los nombres de columna) |
| 4 | `tConvertType`, `tJavaRow`, `tJava`, `tJavaFlex` | Validada con `tJavaRow` (acumulado tipo `RETAIN`) |
| 5 | Excel, posicional, JSON, Parquet | **Bloqueada**: `tFileInputPositional` y `tFileInputJSON` generan codigo que no compila en 8.0.1; el `.item` es correcto |
| 6 | `tPrejob`/`tPostjob`, `tRunJob` padre-hijo, contextos, `tFileList`, triggers, `tDie`/`tWarn` | Validada en lo probado: `tPrejob`/`tPostjob`/`tRunJob` (el padre llama al hijo). Sin probar: `tFileList`, triggers de error, `tDie` |
| 7 | Bases de datos (`tDB*`, commit/rollback, insert/update/delete) | **Pendiente** |
| 8 | Migracion de un programa SAS real, comparado fila por fila | **Pendiente** |
| 9 | Robustez | Validada: componente inexistente da error claro; repetir la instruccion no duplica componentes; 16 componentes y 60 columnas |

Orden recomendado para lo que falta: terminar la 3 (descubrir el formato de las tablas con
`talend_studio_component_parameters`), la 6 completa, luego 7 y 8.

## Plantilla de resultados

`testdata/resultados.csv`, una fila por prueba:
`fase, prueba, prompt_usado, genera_ok, abre_ok, ejecuta_ok, salida_correcta, tiempo_min, notas`

## Cobertura del catalogo

`bun run scripts/coverage.ts` crea, configura, lista y borra cada uno de los 1294 componentes del
catalogo en un job de pruebas (`MCP_Coverage`) y escribe `testdata/cobertura.csv`.

**Todavia no hay una medicion valida:** las corridas reportan los 1294 como fallidos con
`No existe el nodo 'tXxx_N'` (el nodo se crea pero la operacion siguiente no lo encuentra). Hasta
corregirlo, la cobertura real es desconocida y no debe afirmarse.
