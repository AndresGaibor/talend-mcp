# Catálogo de Componentes Talend (Maestría 100% — 22 Componentes)

Este servidor MCP está capacitado para generar, parsear y validar Jobs de Talend utilizando **22 componentes únicos** del catálogo oficial.

## 1. Orchestration & Lifecycle Hooks
### `tPrejob` / `tPostjob`
Gestión de inicio y cierre de ciclos de vida en subjobs.
- **Sin parámetros configurables**.

### `tRunJob`
Ejecución jerárquica de procesos (orquestación).
- **Parámetros**: `PROCESS` (Nombre del Job hijo), `USE_DYNAMIC_JOB`, `TRANSMIT_WHOLE_CONTEXT`, `DIE_ON_CHILD_ERROR`.

### `tLoop`
Generación de bucles iterativos (FOR/WHILE).
- **Parámetros**: `FORLOOP`, `WHILELOOP`, `FROM`, `TO`, `STEP`, `INCREASE`.

### `tFlowToIterate`
Conversión de flujos de datos en iteraciones por fila.
- **Parámetros**: `DEFAULT_MAP` (Mapeo automático).

---

## 2. File & Processing
### `tFileInputDelimited`
Lectura de archivos delimitados (CSV, TSV, TXT).
- **Parámetros**: `FILENAME`, `ROWSEPARATOR`, `FIELDSEPARATOR`, `HEADER`, `LIMIT`, `CSV_OPTION`, `ENCODING`.

### `tMap`
Transformaciones y cruces de datos multidimensionales con soporte de joins (lookups).
- **Parámetros**: `LINK_STYLE`.
- **Estructura Interna**: Generación y lectura de metadatos de mapeo (`MapperData`).

### `tFilterRow`
Lógica de filtrado en flujo.
- **Parámetros**: `LOGICAL_OP` (AND/OR), `USE_ADVANCED` (Código Java libre para filtrado).

---

## 3. Persistencia de Datos
### `tMysqlConnection` / `tMysqlClose`
Gestión de conexiones compartidas a base de datos.
- **Parámetros Connection**: `HOST`, `PORT`, `DBNAME`, `USER`, `PASS`, `PROPERTIES`.
- **Parámetros Close**: `CONNECTION` (Referencia al componente de conexión).

### `tMysqlOutput`
Escritura de datos en tablas MySQL / MariaDB / SingleStore.
- **Parámetros**: `HOST`, `PORT`, `DBNAME`, `USER`, `PASS`, `TABLE`, `TABLE_ACTION`, `DATA_ACTION`, `BATCH_SIZE`.

### `tMysqlInput`
Lectura de tablas de base de datos MySQL.
- **Parámetros**: `QUERY` (Sentencia SQL), `DB_VERSION`, `USE_EXISTING_CONNECTION`.

### `tMysqlRow`
Ejecución de scripts SQL/Stored Procedures independientes.
- **Parámetros**: `QUERY`, `USE_EXISTING_CONNECTION`, `DIE_ON_ERROR`.

---

## 4. Internet & APIs (ESB)
### `tRESTClient`
Consumo avanzado de APIs RESTful HTTP.
- **Parámetros**: `URL`, `METHOD` (GET, POST, etc.), `CONTENT_TYPE`, `ACCEPT_TYPE`.
- **Salidas**: Conectores para `Response` (statusCode, body, string) y `Fault` (errorCode, errorMessage).

### `tSendMail`
Notificaciones SMTP (soporte para SSL, TLS y texto/html).
- **Parámetros**: `TO`, `FROM`, `SUBJECT`, `MESSAGE`, `SMTP_HOST`, `SMTP_PORT`, `AUTH_MODE`.

---

## 5. Logs, Errors & Auditoría
### `tLogCatcher`
Gestión centralizada de excepciones Java y warnings.
- **Parámetros**: `CATCH_JAVA_EXCEPTION`, `CATCH_TDIE`, `CATCH_TWARN`.

### `tStatCatcher`
Captura de métricas de rendimiento y velocidad de procesamiento de registros.
- **Sin parámetros configurables** (esquema fijo expuesto como flujo).

---

## 6. Custom Code & Memory
### `tJava`
Bloque de código Java libre (configuración de variables, logs inline, etc.).
- **Parámetros**: `CODE` (Script Java), `IMPORT` (Imports avanzados).

### `tJavaRow`
Bloque de código Java aplicado fila a fila en flujos de datos.
- **Parámetros**: `CODE` (Transformación iterativa), `IMPORT`.

### `tSetGlobalVar`
Almacenamiento de variables en el mapa global del job (`globalMap`).
- **Parámetros**: `VARIABLES` (Pares clave/valor).

### `tFixedFlowInput`
Generador inline de filas de datos estáticas en memoria.
- **Parámetros**: `NB_ROWS`, `USE_SINGLEMODE`.
