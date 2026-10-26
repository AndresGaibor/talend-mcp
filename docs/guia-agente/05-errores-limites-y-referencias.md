# Errores frecuentes, limites y referencias

[Volver al indice](../GUIA-AGENTE.md)

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

Estado fase por fase en [PLAN-DE-PRUEBAS.md](../PLAN-DE-PRUEBAS.md).

## 12. Documentacion relacionada

- [PLAN-DE-PRUEBAS.md](../PLAN-DE-PRUEBAS.md): fases, criterios y estado.
- [ROADMAP-DOMINIO-TALEND.md](../ROADMAP-DOMINIO-TALEND.md): que falta para automatizar Talend al 100 %.
- [TALEND-STUDIO-INTERNALS.md](../TALEND-STUDIO-INTERNALS.md): APIs internas de Studio, recetas y trampas.
- [ARQUITECTURA.md](../ARQUITECTURA.md): capas del repo y del plugin.
- [PLAN-DE-TRABAJO.md](../PLAN-DE-TRABAJO.md): recetas para cambiar el repo.
