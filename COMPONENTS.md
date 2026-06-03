# Catálogo de Componentes Talend (Experto v2)

Este servidor MCP está capacitado para generar jobs con componentes configurados de alto nivel.

## 1. Misc / Orchestration
### `tPrejob` / `tPostjob`
Gestión de ciclos de vida.

### `tRunJob`
Ejecución jerárquica de procesos.
- **Parámetros**: `PROCESS` (Nombre del Job), `CONTEXT_NAME`.

## 2. File / Processing
### `tFileList`
Iteración sobre archivos.
- **Parámetros**: `DIRECTORY`, `FILELIST_TYPE`.

### `tAggregateRow`
Agregaciones matemáticas.

### `tFilterRow`
Lógica de filtrado en flujo.

## 3. Databases / Cloud
### `tMysqlOutput` / `tDBInput`
Conectores de persistencia.

## 4. Internet
### `tRESTClient`
Consumo de APIs.
- **Parámetros**: `URL`, `METHOD`, `CONTENT_TYPE`.

### `tFTPGet`
Transferencia de archivos.

### `tSendMail`
Notificaciones automáticas.

## 5. Logs & Errors
### `tLogCatcher`
Gestión centralizada de errores.
