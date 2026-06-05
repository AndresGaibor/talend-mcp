import type { PresentationAppDefinition } from "./app-types";
import { createHomeHtml } from "./legacy-shells/home.shell";
import { createDatasetInspectorProHtml } from "./legacy-shells/dataset-inspector-pro.shell";
import { createPipelineSpecEditorHtml } from "./legacy-shells/pipeline-spec-editor.shell";
import { createValidationReportHtml } from "./legacy-shells/validation-report.shell";
import { createRunMonitorProHtml } from "./legacy-shells/run-monitor-pro.shell";
import { createEnvironmentDoctorHtml } from "./legacy-shells/environment-doctor.shell";
import { createSecretSafetyHtml } from "./legacy-shells/secret-safety.shell";
import { createSnapshotManagerHtml } from "./legacy-shells/snapshot-manager.shell";
import { createDeliverablesHtml } from "./legacy-shells/deliverables.shell";
import { createComponentCatalogHtml } from "./legacy-shells/component-catalog.shell";
import { createStudioBridgeAppHtml } from "./legacy-shells/studio-bridge.shell";
import { createGenericShellHtml } from "./legacy-shells/generic.shell";

export function createPresentationAppShellHtml(app: PresentationAppDefinition): string {
  switch (app.id) {
    case "home":
      return createHomeHtml();
    case "dataset-inspector-pro":
      return createDatasetInspectorProHtml();
    case "pipeline-spec-editor":
      return createPipelineSpecEditorHtml();
    case "validation-report":
      return createValidationReportHtml();
    case "run-monitor-pro":
      return createRunMonitorProHtml();
    case "environment-doctor":
      return createEnvironmentDoctorHtml();
    case "secret-safety":
      return createSecretSafetyHtml();
    case "snapshot-manager":
      return createSnapshotManagerHtml();
    case "deliverables":
      return createDeliverablesHtml();
    case "component-catalog":
      return createComponentCatalogHtml();
    case "studio-bridge":
      return createStudioBridgeAppHtml(app);
    default:
      return createGenericShellHtml(app);
  }
}
