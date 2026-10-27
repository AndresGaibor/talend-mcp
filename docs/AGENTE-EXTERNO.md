# Empieza aquí: configurar un componente de Talend

[Volver al índice](PLAN-DE-PRUEBAS.md) · Guía completa: [GUIA-AGENTE.md](GUIA-AGENTE.md) · Fichas de los 50 componentes: [COMPONENTES-PRINCIPALES.md](COMPONENTES-PRINCIPALES.md)

Esta página es la entrada corta. Si algo no encaja, la guía completa tiene el detalle.

## 1. Qué necesitas

- Talend Studio abierto, con el bridge cargado. Comprueba con `talend_bridge_ping` (sin argumentos).
- El nombre del componente que quieres usar. Si no lo sabes, mira la tabla de abajo.

## 2. Elige el componente

| Quiero... | Componente |
|---|---|
| Leer un CSV o TXT | `tFileInputDelimited` |
| Escribir un CSV o TXT | `tFileOutputDelimited` |
| Leer o escribir Excel | `tFileInputExcel` / `tFileOutputExcel` |
| Leer XML o JSON | `tFileInputXML` / `tFileInputJSON` |
| Transformar, renombrar, filtrar o cruzar columnas | `tMap` |
| Filtrar filas por una condición | `tFilterRow` |
| Agrupar y sumar | `tAggregateRow` |
| Quitar duplicados u ordenar | `tUniqRow` / `tSortRow` |
| Leer o escribir en una base de datos (PostgreSQL) | `tPostgresqlInput` / `tPostgresqlOutput` |
| Ejecutar un SQL | `tPostgresqlRow` |
| Escribir código Java propio | `tJava` (una vez), `tJavaRow` (por fila) |
| Llamar a otro job | `tRunJob` |
| Avisar, parar o registrar un error | `tWarn` / `tDie` / `tLogCatcher` |
| Ver los datos en la consola | `tLogRow` |

Para cualquier otro componente: `talend_studio_list_components` con un `filter` (por ejemplo `"Excel"`).

## 3. Las llamadas, en orden

| Paso | Herramienta y argumentos | Qué te devuelve |
|---|---|---|
| 1 | `talend_bridge_ping` `{}` | Que Studio responde |
| 2 | `talend_components_definition` `{"name": "tFileInputDelimited"}` | Un texto con **lo que tú pones** (por ejemplo `SCHEMA, FILENAME`) y **lo que ya tiene valor** |
| 3 | `talend_job_create_in_studio` `{"name": "MCP_Mi_Job", "replace": true}` | Un job vacío abierto en el editor |
| 4 | `talend_job_add_node` `{"type": "tFileInputDelimited", "label": "lector", "parameters": {...}}` | El **`uniqueName`** del nodo, por ejemplo `tFileInputDelimited_1`. Guárdalo |
| 5 | `talend_job_set_schema` `{"uniqueName": "...", "columns": [{"name": "id", "type": "id_Integer"}]}` | Las columnas del nodo |
| 6 | `talend_job_connect_nodes` `{"source": "...", "target": "..."}` | La conexión entre dos nodos |
| 7 | `talend_job_compile` `{"job": "MCP_Mi_Job"}` | `compiles: true` si el código genera bien |
| 8 | `talend_job_execute` `{"name": "MCP_Mi_Job"}` | `exitCode` y la salida (`lines`) |

Regla práctica: lo que pones en el paso 2 es lo que necesitas en el paso 4. Lo demás ya tiene valor por defecto.

## 4. Ejemplo copiable

Lee un CSV y lo vuelca en la consola. Es el escenario `archivos: leer un CSV y volcarlo al log`, que pasa en Talend 8.0.1 (informe `testdata/resultados-l5.csv`).

```json
// talend_job_add_node (paso 4): el lector
{
  "type": "tFileInputDelimited",
  "label": "lector",
  "parameters": {
    "FILENAME": { "value": "C:/datos/clientes.csv" },
    "FIELDSEPARATOR": { "value": ";" },
    "HEADER": { "value": "1" },
    "ENCODING": { "value": "UTF-8" }
  }
}

// talend_job_add_node (paso 4): la salida
{ "type": "tLogRow", "label": "salida" }

// talend_job_set_schema (paso 5): usa el uniqueName que devolvió el lector
{
  "uniqueName": "tFileInputDelimited_1",
  "columns": [
    { "name": "id", "type": "id_Integer" },
    { "name": "nombre", "type": "id_String" },
    { "name": "ciudad", "type": "id_String" },
    { "name": "monto", "type": "id_Double" }
  ]
}

// talend_job_connect_nodes (paso 6)
{ "source": "tFileInputDelimited_1", "target": "tLogRow_1" }
```

Ojo: `tLogRow_1` es el nombre que dio Studio a la salida. Cópialo de la respuesta de `talend_job_add_node`, no lo supongas.

Las llamadas de arriba son las mismas que usa el arnés del repo para ese escenario. Lo que todavía no está probado es la secuencia de llamadas MCP tal cual; eso se valida en la prueba con un agente nuevo (C9 del plan).

## 5. Si algo falla

| El mensaje dice | Qué hacer |
|---|---|
| `No hay bridge de Talend Studio en ...` | Abre Talend Studio con el proyecto. Luego `bun run bridge:status` |
| `Falta componentName` o `Falta el parametro 'x'` | Pon el argumento que dice el mensaje |
| `No hay ningún componente llamado 'X'` | Busca el nombre exacto con `talend_components_search {"query": "..."}` |
| `no tiene columnas: sin esquema` | Pon las columnas con `talend_job_set_schema` |
| `no tiene FILENAME` | Pon la ruta del fichero en `parameters.FILENAME` |
| `declara la salida 'X' y no hay ninguna conexion de salida con ese nombre` | Usa el nombre de la conexión que devolvió Studio (`row1`, `row2`...) |
| `El job no esta compilado` | Llama antes a `talend_job_compile` y mira `error.message` |
| `salida con codigo N. Causa: ...` | La última parte del mensaje es la causa real: arréglala y vuelve a compilar |
| `El job no termino a tiempo` | Mira si hay un diálogo abierto en Studio con `talend_studio_ui_dialogs` |

## 6. Cinco reglas

1. **Nombres de Studio.** Las conexiones se llaman `row1`, `row2`... Las tablas de un `tMap` se llaman como su conexión.
2. **Esquema antes de conectar** cuando el componente lo pide, y el `tMap` se configura **después** de conectar.
3. **Compila antes de ejecutar.** `talend_job_compile` te dice el error exacto.
4. **Nunca escribas el `.item` a mano.** Todo se crea con las herramientas de Studio.
5. **Si no sabes un parámetro, pregunta con `talend_studio_component_parameters`.** No lo adivines.
