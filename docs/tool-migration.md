# Convencion de nombres de tools

La migracion de nombres legacy ya termino: **no quedan aliases**. Cada capacidad tiene una
sola tool y su nombre es canonico.

## Regla

```
talend_<area>_<verbo>
```

| Area | Ejemplos |
|---|---|
| `jobs` | `talend_jobs_list`, `talend_jobs_read`, `talend_jobs_create`, `talend_jobs_patch_component` |
| `components` | `talend_components_search`, `talend_components_inspect`, `talend_components_catalog_status` |
| `contexts` | `talend_list_project_contexts`, `talend_read_repository_context` |
| `runs` | `talend_runs_list`, `talend_runs_read`, `talend_job_run_by_name`, `talend_run_exported_job` |
| `errors` | `talend_errors_explain`, `talend_errors_suggest_fix`, `talend_errors_stats` |
| `validation` | `talend_validation_validate_design`, `talend_validation_validate_context_usage` |
| `secrets` | `talend_secrets_scan_project`, `talend_secrets_scan_job` |
| `snapshots` | `talend_snapshots_list`, `talend_snapshots_read`, `talend_snapshots_restore` |
| `datasets` | `talend_datasets_inspect_csv_folder`, `talend_datasets_infer_csv_schema` |
| `deliverables` | `talend_deliverables_export_job`, `talend_deliverables_validate` |
| `evidence` | `talend_evidence_pack_build`, `talend_evidence_pack_export` |
| `requirements` | `talend_requirements_analyze`, `talend_requirements_build_checklist` |
| `bridge` | `talend_bridge_ping`, `talend_bridge_selection`, `talend_bridge_active_job_model` |
| `recipe` | `talend_recipe_generate`, `talend_recipe_get` |
| `mastery` | `talend_mastery_report`, `talend_mastery_component` |

## Que se elimino

Los nombres legacy se renombraron en lugar de duplicarse. Por ejemplo:

| Antes | Ahora |
|---|---|
| `analyze_logs` | `talend_analyze_logs` |
| `view_logs` | `talend_view_logs` |
| `repo_setup` | `talend_repo_setup` |
| `talend_list_jobs` | `talend_jobs_list` |
| `talend_snapshot_list` | `talend_snapshots_list` |
| `talend_create_job` | `talend_jobs_create` |

Tambien se elimino el mecanismo que generaba aliases en runtime
(`TOOL_NAME_ALIASES`, `LEGACY_TO_CANONICAL` y `createLegacyAliasTool`).

## Como se verifica

`tests/tools/canonical-tools.test.ts` falla si alguna tool registrada no empieza con
`talend_` o si hay nombres duplicados. `tests/apps/no-legacy-tools.test.ts` (movido a
`tests/tools/`) comprueba lo mismo desde el registro completo.
