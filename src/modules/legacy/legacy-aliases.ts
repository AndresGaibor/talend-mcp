export const LEGACY_TO_CANONICAL: Array<[string, string]> = [
  ["talend_list_jobs", "talend_jobs_list"],
  ["talend_read_job", "talend_jobs_read"],
  ["talend_dataset_inspect_csv_folder", "talend_datasets_inspect_csv_folder"],
  ["talend_dataset_infer_csv_schema", "talend_datasets_infer_csv_schema"],
  ["talend_dataset_generate_raw_table_mappings", "talend_datasets_generate_raw_mappings"],
  ["talend_snapshot_list", "talend_snapshots_list"],
  ["talend_snapshot_restore", "talend_snapshots_restore"],
  ["talend_deliverable_create_package", "talend_deliverables_create_package"],
  ["talend_deliverable_collect_files", "talend_deliverables_collect"],
  ["talend_secret_scan_project", "talend_secrets_scan_project"],
];