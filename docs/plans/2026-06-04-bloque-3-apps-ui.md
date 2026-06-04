# Plan: Talend MCP Suite - Bloque 3 (Apps UI Principales)

## Objetivo
Implementar UI reales para las 10 apps principales de la suite.

## Contexto
- Proyecto existente: talend-mcp (suite MCP para Talend Studio)
- Ubicación: /Users/andresgaibor/code/javascript/talend-mcp
- Plataforma: macOS/darwin
- Framework: Bun, MCP SDK, TypeScript

## Reglas obligatorias
- Usar Bun para todo
- No hardcodear LAB-09 ni rutas de usuario específicas
- Responder en español
- Cada app debe usar window.openai para comunicación con el host
- Cada app debe mostrar estados visuales (no solo JSON)

---

## Apps a implementar

### 1. talend_app_home
**Descripción**: Pantalla principal del MCP
**Debe mostrar**:
- Estado del bridge (conectado/no conectado)
- SO runtime, SO Talend host, pathMode
- Proyecto actual y workspace
- Talend Studio abierto/cerrado
- Jobs encontrados y últimos runs
- Snapshots recientes y problems activos
- Coverage general

### 2. talend_app_environment_doctor
**Descripción**: Diagnóstico completo del entorno
**Debe mostrar**:
- PlatformContext (runtimeOs, talendHostOs, pathMode)
- raw vs mcp vs talendHost paths para cada variable
- Estado de conexión del bridge
- Checks de filesystem

### 3. talend_app_dataset_inspector_pro
**Descripción**: Inspeccionar carpetas CSV y generar mappings
**Debe mostrar**:
- Lista de archivos CSV en carpeta
- Schema inferido por archivo
- Columnas detectadas (date, numeric, etc.)
- Mappings generados

### 4. talend_app_pipeline_spec_editor
**Descripción**: Editar, validar y aplicar TalendPipelineSpec
**Debe mostrar**:
- Pattern selector
- JSON editor
- Visual preview del pipeline
- Component list y connection list
- Warnings y validation results

### 5. talend_app_validation_report
**Descripción**: Validar job existente o spec
**Debe mostrar**:
- Score general
- Checks OK / Warnings / Errors
- Missing contexts
- Audit columns
- DB outputs
- Suggested fixes

### 6. talend_app_run_monitor_pro
**Descripción**: Ejecutar, esperar y analizar runs
**Debe mostrar**:
- Job selector
- Status (pending/running/success/failed)
- Duration
- Logs tail
- Problems y error explanation

### 7. talend_app_snapshot_manager
**Descripción**: Controlar cambios antes/después
**Debe mostrar**:
- Snapshots list
- Job, date, reason, files affected
- Diff viewer
- Restore button (con confirmación)

### 8. talend_app_secret_safety
**Descripción**: Evitar exponer claves y passwords
**Debe mostrar**:
- Secrets encontrados
- Archivo, componente, parámetro
- valuePresent (no mostrar valor real)
- Fix sugerido y migrar a context

### 9. talend_app_deliverables
**Descripción**: Construir entrega del taller
**Debe mostrar**:
- Checklist de entregables
- Job export
- SQL files, logs, validation report
- Runtime evidence, snapshots
- Create ZIP

### 10. talend_app_component_catalog
**Descripción**: Explorar componentes instalados
**Debe mostrar**:
- Search y family filter
- Component list
- Parameters y connectors
- Schema support
- Template generator

---

## Arquitectura de UI

Las UIs se registran como recursos con `resourceUri: "ui://talend/NOMBRE.html"` y se construyen con HTML/CSS/JS vanilla para Bun.serve.

```
src/presentation/apps/ui/
  home.html
  environment-doctor.html
  dataset-inspector.html
  pipeline-spec-editor.html
  validation-report.html
  run-monitor.html
  snapshot-manager.html
  secret-safety.html
  deliverables.html
  component-catalog.html
```

## Criterios de aceptación para cada app
- [ ] UI renderiza correctamente
- [ ] Muestra datos reales de las tools
- [ ] Estados visuales (loading, error, success)
- [ ] Usa window.openai para comunicación
- [ ] No muestra solo JSON bruto
- [ ] Acciones peligrosas requieren confirmación

## Dependencias
- Bloque 1 (Core MCP) - completado
- Bloque 2 (Portabilidad) - completado

## Orden de ejecución
1. Home → 2. Environment Doctor → 3. Dataset Inspector → 4. Pipeline Spec Editor → 5. Validation Report → 6. Run Monitor → 7. Snapshot Manager → 8. Secret Safety → 9. Deliverables → 10. Component Catalog

## SHAs de referencia después de completar
[Se llenará después de cada app]