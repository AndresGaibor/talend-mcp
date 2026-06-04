import { describe, expect, test } from "bun:test";

import { buildLauncherInitialStateForApp } from "../../src/presentation/apps";
import { createTalendMcpServer } from "../../src/server";

describe("Talend presentation apps", () => {
  test("registra launchers y recursos visuales", () => {
    const server = createTalendMcpServer();
    const toolNames = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
    const resourceUris = Object.keys((server as unknown as { _registeredResources: Record<string, unknown> })._registeredResources);

    expect(toolNames).toContain("talend_app_dashboard");
    expect(toolNames).toContain("talend_app_dataset_inspector");
    expect(toolNames).toContain("talend_app_job_designer");
    expect(toolNames).toContain("talend_app_validation_report");
    expect(toolNames).toContain("talend_app_run_monitor");
    expect(toolNames).toContain("talend_app_snapshot_diff");
    expect(toolNames).toContain("talend_app_deliverables");
    expect(toolNames).toContain("talend_app_component_catalog");
    expect(toolNames).toContain("talend_app_command_center");
    expect(toolNames).toContain("talend_app_home");
    expect(toolNames).toContain("talend_app_environment_doctor");
    expect(toolNames).toContain("talend_app_workspace_explorer");
    expect(toolNames).toContain("talend_app_job_browser");
    expect(toolNames).toContain("talend_app_pattern_gallery");
    expect(toolNames).toContain("talend_app_visual_job_designer");
    expect(toolNames).toContain("talend_app_pipeline_spec_editor");
    expect(toolNames).toContain("talend_app_mapping_builder");
    expect(toolNames).toContain("talend_app_tmap_designer");
    expect(toolNames).toContain("talend_app_dataset_inspector_pro");
    expect(toolNames).toContain("talend_app_csv_preview");
    expect(toolNames).toContain("talend_app_raw_mapping_matrix");
    expect(toolNames).toContain("talend_app_context_profiles");
    expect(toolNames).toContain("talend_app_database_connection_wizard");
    expect(toolNames).toContain("talend_app_secret_safety");
    expect(toolNames).toContain("talend_app_run_monitor_pro");
    expect(toolNames).toContain("talend_app_launch_history");
    expect(toolNames).toContain("talend_app_runtime_comparison");
    expect(toolNames).toContain("talend_app_problems_view");
    expect(toolNames).toContain("talend_app_error_explorer");
    expect(toolNames).toContain("talend_app_validation_timeline");
    expect(toolNames).toContain("talend_app_snapshot_manager");

    expect(resourceUris).toContain("ui://talend/dashboard.html");
    expect(resourceUris).toContain("ui://talend/dataset-inspector.html");
    expect(resourceUris).toContain("ui://talend/job-designer.html");
    expect(resourceUris).toContain("ui://talend/validation-report.html");
    expect(resourceUris).toContain("ui://talend/run-monitor.html");
    expect(resourceUris).toContain("ui://talend/snapshot-diff.html");
    expect(resourceUris).toContain("ui://talend/deliverables.html");
    expect(resourceUris).toContain("ui://talend/component-catalog.html");
    expect(resourceUris).toContain("ui://talend/command-center.html");
    expect(resourceUris).toContain("ui://talend/home.html");
    expect(resourceUris).toContain("ui://talend/environment-doctor.html");
    expect(resourceUris).toContain("ui://talend/workspace-explorer.html");
    expect(resourceUris).toContain("ui://talend/job-browser.html");
    expect(resourceUris).toContain("ui://talend/pattern-gallery.html");
    expect(resourceUris).toContain("ui://talend/visual-job-designer.html");
    expect(resourceUris).toContain("ui://talend/pipeline-spec-editor.html");
    expect(resourceUris).toContain("ui://talend/mapping-builder.html");
    expect(resourceUris).toContain("ui://talend/tmap-designer.html");
    expect(resourceUris).toContain("ui://talend/dataset-inspector-pro.html");
    expect(resourceUris).toContain("ui://talend/csv-preview.html");
    expect(resourceUris).toContain("ui://talend/raw-mapping-matrix.html");
    expect(resourceUris).toContain("ui://talend/context-profiles.html");
    expect(resourceUris).toContain("ui://talend/database-connection-wizard.html");
    expect(resourceUris).toContain("ui://talend/secret-safety.html");
    expect(resourceUris).toContain("ui://talend/run-monitor-pro.html");
    expect(resourceUris).toContain("ui://talend/launch-history.html");
    expect(resourceUris).toContain("ui://talend/runtime-comparison.html");
    expect(resourceUris).toContain("ui://talend/problems-view.html");
    expect(resourceUris).toContain("ui://talend/error-explorer.html");
    expect(resourceUris).toContain("ui://talend/validation-timeline.html");
    expect(resourceUris).toContain("ui://talend/snapshot-manager.html");
  });

  test("home arranca con estado inicial del entorno", async () => {
    const initialState = await buildLauncherInitialStateForApp("home");

    expect(initialState).toHaveProperty("environment");
    expect(initialState).toHaveProperty("quickStats");
    expect(initialState).toHaveProperty("recentJobs");
    expect(initialState).toHaveProperty("recentRuns");
    expect(initialState).toHaveProperty("recentSnapshots");
    expect(initialState).toHaveProperty("errorStats");
  });
});
