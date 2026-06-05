# Migración de Herramientas Legacy

Tabla de mapeo entre nombres de herramientas legacy y nombres canónicos.

| Legacy tool | Nueva tool | Módulo | Estado | Se usa en UI | Tests | Fecha de eliminación |
|-------------|------------|--------|--------|--------------|-------|---------------------|
| talend_list_jobs | talend_jobs_list | jobs | ✅ Implementado | ❌ | ✅ | - |
| talend_read_job | talend_jobs_read | jobs | ✅ Implementado | ❌ | ✅ | - |
| analyze_logs | talend_logs_analyze | logs | ✅ Implementado | ❌ | ✅ | - |
| full_analysis | talend_diagnostics_full_analysis | diagnostics | ✅ Implementado | ❌ | ✅ | - |
| add_talend_connection | talend_components_add_connection | components | ✅ Implementado | ❌ | ✅ | - |
| patch_talend_component | talend_components_patch | components | ✅ Implementado | ❌ | ✅ | - |
| repo_status | talend_repo_status | repo | ✅ Implementado | ❌ | ✅ | - |
| repo_pull | talend_repo_pull | repo | ✅ Implementado | ❌ | ✅ | - |
| talend_dataset_inspect_csv_folder | talend_datasets_inspect_csv_folder | datasets | ✅ Implementado | ❌ | ✅ | - |
| talend_dataset_infer_csv_schema | talend_datasets_infer_csv_schema | datasets | ✅ Implementado | ❌ | ✅ | - |
| talend_dataset_generate_raw_table_mappings | talend_datasets_generate_raw_mappings | datasets | ✅ Implementado | ❌ | ✅ | - |
| talend_secret_scan_project | talend_secrets_scan_project | secrets | ✅ Implementado | ❌ | ✅ | - |
| talend_secret_scan_job | talend_secrets_scan_job | secrets | ✅ Implementado | ❌ | ✅ | - |
| talend_secret_suggest_context_migration | talend_secrets_suggest_context_migration | secrets | ✅ Implementado | ❌ | ✅ | - |
| talend_snapshot_list | talend_snapshots_list | snapshots | ✅ Implementado | ❌ | ✅ | - |
| talend_snapshot_read | talend_snapshots_read | snapshots | ✅ Implementado | ❌ | ✅ | - |
| talend_snapshot_diff | talend_snapshots_diff | snapshots | ✅ Implementado | ❌ | ✅ | - |
| talend_snapshot_restore | talend_snapshots_restore | snapshots | ✅ Implementado | ❌ | ✅ | - |

## Notas

- **Legacy tool**: Nombre original de la herramienta.
- **Nueva tool**: Nombre canónico actualizado con prefijo `talend_` y namespace de módulo.
- **Módulo**: Dominio funcional al que pertenece la herramienta.
- **Estado**: Estado actual de implementación.
- **Se usa en UI**: Indica si la herramienta se utiliza en interfaces de usuario.
- **Tests**: Indica si la herramienta tiene cobertura de tests.
- **Fecha de eliminación**: Fecha planeada para remover el alias legacy (vacío = no planificado).