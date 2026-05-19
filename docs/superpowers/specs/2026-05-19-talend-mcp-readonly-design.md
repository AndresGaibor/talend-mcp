# Diseño: MCP solo lectura para Qlik Talend Studio

## Objetivo

Crear un servidor MCP local en TypeScript con Bun que analice proyectos de Qlik Talend Studio en modo solo lectura. El servidor debe detectar automáticamente el job abierto, leer su definición, extraer flujo/componentes/schemas/contextos y consultar logs de ejecución recientes sin modificar `.item`, `.properties` ni archivos del workspace.

## Alcance Inicial

El alcance inicial se limita a lectura y análisis. No se editarán jobs, contextos, metadata, propiedades, schemas ni archivos generados por Talend. Tampoco se intentará controlar la UI de Talend Studio.

El servidor debe operar sobre el workspace detectado en:

```text
/Applications/TalendStudio-8.0.1/studio/workspace
```

Y sobre el proyecto detectado:

```text
/Applications/TalendStudio-8.0.1/studio/workspace/CAPACITACION_GL3-1327321152/PRJ_GENIUS_LAB
```

La implementación debe permitir configurar una ruta explícita con `TALEND_PROJECT`, pero también soportar detección automática usando archivos de `.metadata` cuando esa variable no exista.

## Evidencia Local Confirmada

El job abierto puede inferirse desde:

```text
/Applications/TalendStudio-8.0.1/studio/workspace/.metadata/.plugins/org.eclipse.e4.workbench/PRJ_GENIUS_LAB_R_B_lab04_gaibor_a.xmi
```

Ese archivo contiene el editor abierto:

```text
Job lab04_olist_orders_to_staging 0.1
```

La configuración de lanzamiento existe en:

```text
/Applications/TalendStudio-8.0.1/studio/workspace/.metadata/.plugins/org.eclipse.debug.core/.launches/lab04_olist_orders_to_staging 0.1.launch
```

Ese archivo contiene `TALEND_JOB_NAME`, `TALEND_JOB_VERSION`, `TALEND_JOB_ID` y `CURRENT_PROJECT_NAME`.

La definición principal del job existe en:

```text
process/bloque2_talend_base/lab04_olist_orders_to_staging_0.1.item
```

Y sus propiedades en:

```text
process/bloque2_talend_base/lab04_olist_orders_to_staging_0.1.properties
```

## Arquitectura

El MCP se dividirá en módulos pequeños:

`talendWorkspace`
: Detecta instalación, workspace, proyecto activo y rutas de `.metadata`.

`talendOpenJob`
: Lee los XMI del workbench de Eclipse/Talend y extrae editores abiertos, job seleccionado, nombre y versión.

`talendRepository`
: Lista jobs bajo `process/`, empareja `.item` con `.properties` y resuelve rutas por nombre/version.

`talendJobParser`
: Parsea `.item` como XML y extrae nodos, conexiones, metadata, columnas, mapper tables y parámetros relevantes.

`talendContexts`
: Lee contextos embebidos en `.item` y contextos centralizados bajo `context/*.item`.

`talendRunLogs`
: Lee `.metadata/.log`, `.launches/*.launch` y logs conocidos del job para resumir última ejecución, command line, errores y estado inferido.

`talendAnalysis`
: Ejecuta análisis read-only como columnas vacías/null, diferencias entre schemas internos y riesgos básicos de truncamiento a partir de metadata Talend y archivos de entrada accesibles.

## Herramientas MCP

### `talend_detect_open_job`

Detecta el job abierto leyendo `org.eclipse.e4.workbench/*.xmi`.

Salida esperada:

```json
{
  "projectName": "PRJ_GENIUS_LAB",
  "jobName": "lab04_olist_orders_to_staging",
  "version": "0.1",
  "label": "Job lab04_olist_orders_to_staging 0.1",
  "itemPath": ".../process/bloque2_talend_base/lab04_olist_orders_to_staging_0.1.item"
}
```

### `talend_list_jobs`

Lista jobs dentro de `process/**/*.properties` y resuelve su `.item` asociado.

### `talend_read_job`

Devuelve resumen de un job: nombre, propósito, descripción, versión, ruta `.item`, ruta `.properties`, componentes, conexiones y contextos.

### `talend_list_components`

Extrae componentes desde nodos XML `<node>`: `componentName`, `UNIQUE_NAME`, label, posición y parámetros principales.

### `talend_show_flow`

Extrae conexiones XML `<connection>` y devuelve flujo ordenado por source/target. Para el job actual debe poder mostrar:

```text
tFileInputDelimited_1 (orders) -> row1 -> tMap_1 -> out1 -> tDBOutput_1
```

### `talend_read_contexts`

Lee variables de contexto desde el `.item` del job y desde `context/**/*.item`.

### `talend_analyze_tdboutput`

Analiza componentes `tMysqlOutput`/`tDBOutput` y devuelve host, puerto, base, usuario, tabla, acción de tabla, acción de datos, batch size y schema.

### `talend_read_latest_run_log`

Lee `.metadata/.log` y devuelve la última entrada asociada al job. Debe detectar command lines, errores posteriores y estado inferido.

Estados posibles:

```text
success
error
unknown
```

`success` solo se usará si existe evidencia clara de fin exitoso. Si solo existe command line sin cierre ni error posterior, el estado será `unknown`.

### `talend_read_job_errors`

Busca errores históricos relacionados con un job en `.metadata/.log` y devuelve timestamp, mensaje, línea y bloque de contexto. Debe reconocer patrones como:

```text
The Job "..." has wrong configuration
Unknown column
Data too long
cannot be resolved
Exception
ERROR
```

### `talend_summarize_open_job`

Combina detección de job abierto, flujo, contextos, tDBOutput y logs recientes en una respuesta compacta.

## Comportamiento Esperado Para El Job Actual

Para `lab04_olist_orders_to_staging`, el MCP debe reportar:

```text
Job abierto: lab04_olist_orders_to_staging 0.1
Flujo: orders / tFileInputDelimited_1 -> tMap_1 -> tDBOutput_1
Destino: tMysqlOutput hacia stg_olist_orders_ag
Acción tabla: TRUNCATE
Acción datos: INSERT
Contexto archivo: FILE_OLIST_ORDERS=/Users/andresgaibor/geniuslab/Fuentes/orders.csv
Contextos DB: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
Última ejecución detectada: command line en .metadata/.log
Estado última ejecución: unknown si no hay cierre explícito ni error posterior
Errores históricos: FILE_OLIST_ORDERS no resuelto, stg_olist_orders_ag no resuelto
```

## Manejo De Logs

Talend guarda errores de Studio/Eclipse en `.metadata/.log`. Esa fuente es suficiente para detectar errores de generación, compilación y configuración. La salida completa del Run Console no siempre se persiste porque el `log4j2.xml` generado actualmente solo tiene appender de consola.

El MCP debe usar un enfoque best-effort:

1. Leer `.metadata/.log`.
2. Leer `.metadata/.plugins/org.eclipse.debug.core/.launches/*.launch`.
3. Buscar logs con nombres relacionados al job si existen.
4. Reportar claramente cuando no haya evidencia suficiente para determinar éxito o fallo.

## Seguridad

Todas las herramientas serán read-only. La implementación debe protegerse contra escritura accidental:

- No usar `writeFile`, `appendFile`, `rename`, `unlink` ni equivalentes.
- No modificar `.item`, `.properties`, `.metadata`, `.launch` ni archivos generados.
- No ejecutar Talend jobs desde el MCP en la fase inicial.
- No conectarse a base de datos en la fase inicial.
- Validar que las rutas leídas estén bajo el workspace/proyecto permitido.

## Errores Y Ambigüedades

Si hay múltiples jobs abiertos, `talend_detect_open_job` debe devolver todos y marcar el selected element si el XMI lo permite.

Si no se encuentra job abierto, el MCP debe caer a `talend_list_jobs` y pedir un nombre explícito.

Si no se puede inferir el proyecto desde `.metadata`, debe requerir `TALEND_PROJECT`.

Si la última ejecución no tiene marcador claro de éxito o error, debe devolver `unknown`, no inventar éxito.

## Testing

Las pruebas iniciales deben usar fixtures pequeños basados en copias minimizadas de XML Talend, no los archivos reales completos.

Casos mínimos:

- Parsear job abierto desde XMI de workbench.
- Parsear `.launch` y extraer nombre/version/id.
- Listar job desde `.properties` y resolver `.item`.
- Extraer componentes y conexiones desde `.item`.
- Extraer contextos desde `.item` y `context/*.item`.
- Detectar errores históricos en `.metadata/.log`.
- Clasificar última ejecución como `unknown` cuando solo hay command line.
- Detectar columnas vacías o `null` en schemas.

## Fuera De Alcance Por Ahora

- Edición de `.item`, `.properties` o contexts.
- Ejecución de jobs desde MCP.
- Control de Talend Studio por UI.
- Conexión a MySQL/MariaDB.
- Comparación con schema real de base de datos.
- Persistencia de logs nueva o modificación de `log4j2.xml`.
