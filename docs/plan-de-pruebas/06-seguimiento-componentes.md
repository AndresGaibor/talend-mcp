# Seguimiento de los 50 componentes

[Volver al indice](../PLAN-DE-PRUEBAS.md) · Plan y criterios: [05-componentes-uno-a-uno.md](05-componentes-uno-a-uno.md)

Leyenda: ⬜ pendiente · 🟡 en curso · ✅ pasa · ❌ falla (ver nota) · ➖ no aplica.

Cada columna es una comprobacion de la ficha (C1 a C8). C9 (agente frio) se anota por grupo, al final de la tabla.
Las notas dicen solo lo que ya esta medido en los informes `testdata/cobertura-l4-*.csv` y en los escenarios L5. No
son resultados de la revision: cada componente se revisa desde cero.

## Registro

| Fecha | Componente | Comprobacion | Comando o herramienta | Resultado |
|---|---|---|---|---|
| 2026-10-26 | Bridge | Fase 0 | `bun run bridge:install` (carga en caliente) | Publicado. El build en vivo coincide con el local (`bridge:status`). |
| 2026-10-26 | Lista de 50 | Verificacion de nombres | `talend_studio_list_components`, `talend_components_definition` | Corregidos 8 nombres que no existen en Studio 8.0.1 (tDB* y tRESTClient). |
| 2026-10-26 | Todos (L4) | Medicion de compilacion | `bun run scripts/coverage.ts --components ... --compile` | Cancelada: heap de Studio al 89-93%. Pendiente tras liberar memoria. |
| 2026-10-26 | Todos (C1, C2) | Descubrimiento y configuracion | `talend_components_definition` (42 XML) | Texto para el agente reescrito: separa lo que pone quien llama de lo que ya tiene valor. 10 tests. |
| 2026-10-26 | Todos (C3) | Contrato generico | `talend_components_parameters` | Acepta `name` ademas de `componentName`; error que dice que falta. |
| 2026-10-26 | tJDBC*, tHttpRequest | C2 | `talend_studio_component_parameters` | Bloqueado: el hilo de Studio no responde y hay un dialogo "Network Issue" abierto. |

## Estado

| # | Componente | Grupo | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | Estado | Notas previas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tMap | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en informes L4 (antes de los cambios de mapper). Bridge con los cambios compila; falta publicarlo. Fixture usa `row2`. |
| 2 | tFileInputDelimited | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4. Varios escenarios L5. El validador exige FILENAME y esquema. |
| 3 | tFileOutputDelimited | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (3 informes). |
| 4 | tJDBCInput | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tDBInput, que no existe en esta Studio. Presente en el catalogo DI. Sin medicion de compilacion. |
| 5 | tJDBCOutput | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tDBOutput. Sin medicion de compilacion. |
| 6 | tJDBCConnection | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tDBConnection. Sin medicion de compilacion. |
| 7 | tFilterRow | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (4 informes). Escenario L5 existente. |
| 8 | tAggregateRow | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (3 informes). Reglas en 04-reglas-de-componentes.md. |
| 9 | tSortRow | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 2 informes (`defaultRow cannot be resolved`) y pasa en 1. |
| 10 | tUniqRow | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 1 informe (`IllegalArgumentException`) y pasa en 2. |
| 11 | tJava | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 12 | tLogRow | A | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 13 | tRunJob | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 3 informes (`Syntax error on token "new"`). Escenario L5 con hijo existe. |
| 14 | tPrejob | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Escenario tPrejob -> tRunJob -> tPostjob. |
| 15 | tPostjob | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 16 | tDie | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Escenario con SUBJOB_ERROR existe. |
| 17 | tWarn | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 18 | tLogCatcher | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (3 informes). |
| 19 | tStatCatcher | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 20 | tSetGlobalVar | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 21 | tContextLoad | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 4 informes (`Duplicate local variable key_tContextLoad_2`). |
| 22 | tLoop | B | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Escenario de bucle existe. |
| 23 | tFileList | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4. Un fallo del arnes (`duplicated in the reactor`): volver a medir. |
| 24 | tFileInputExcel | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 3 informes (`Syntax error on token ""`). |
| 25 | tFileOutputExcel | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (3 informes). |
| 26 | tFileInputXML | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 5 informes (`NameSpaceTool_... cannot be resolved`). Un fallo del arnes: volver a medir. |
| 27 | tFileInputJSON | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (1 informe). Escenario L5 de JSON existe. |
| 28 | tFileInputPositional | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (1 informe). Escenario de ancho fijo existe. |
| 29 | tFileCopy | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 1 informe (`IllegalArgumentException`). |
| 30 | tFileDelete | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Un fallo del arnes: volver a medir. |
| 31 | tFileExist | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Un fallo del arnes: volver a medir. |
| 32 | tHttpRequest | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tRESTClient, que no existe en esta Studio (el REST de la paleta, tREST, esta deprecated). Sin medicion. |
| 33 | tSendMail | C | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Creado y guardado; sin compilacion medida en L4. |
| 34 | tJavaRow | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 35 | tJavaFlex | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (3 informes). Escenario de tJavaFlex existe. |
| 36 | tJoin | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 37 | tUnite | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Escenario L5 existe. |
| 38 | tReplicate | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Escenario L5 existe. |
| 39 | tNormalize | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 2 informes (`split(String`). |
| 40 | tDenormalize | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Falla en 4 informes (`ciudad cannot be resolved`). |
| 41 | tConvertType | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 42 | tFlowToIterate | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 43 | tIterateToFlow | D | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). |
| 44 | tJDBCRow | E | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tDBRow. Sin medicion de compilacion. |
| 45 | tJDBCClose | E | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tDBClose. Sin medicion de compilacion. |
| 46 | tJDBCCommit | E | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tDBCommit. Sin medicion de compilacion. |
| 47 | tJDBCRollback | E | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Sustituye a tDBRollback. Sin medicion de compilacion. |
| 48 | tFixedFlowInput | E | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (1 informe). Escenario L5 existe. |
| 49 | tRowGenerator | E | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (2 informes). Escenario L5 existe. |
| 50 | tPostgresqlInput | E | ✅ | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Compila en L4 (1 informe). |

## C9 por grupo (agente frio)

| Grupo | Componentes | Agente probado | Llamadas hasta configurar | Errores que encontro | Resultado |
|---|---|---|---|---|---|
| A | 1 a 12 | — | — | — | ⬜ |
| B | 13 a 22 | — | — | — | ⬜ |
| C | 23 a 33 | — | — | — | ⬜ |
| D | 34 a 43 | — | — | — | ⬜ |
| E | 44 a 50 | — | — | — | ⬜ |
