import type { AppRoute } from "./appRoutes";

import { HomeApp } from "../apps/home/HomeApp";
import { EnvironmentDoctorApp } from "../apps/environment-doctor/EnvironmentDoctorApp";
import { DatasetInspectorApp } from "../apps/dataset-inspector/DatasetInspectorApp";
import { PipelineSpecEditorApp } from "../apps/pipeline-spec-editor/PipelineSpecEditorApp";
import { ValidationReportApp } from "../apps/validation-report/ValidationReportApp";
import { RunMonitorApp } from "../apps/run-monitor/RunMonitorApp";
import { SnapshotManagerApp } from "../apps/snapshot-manager/SnapshotManagerApp";
import { SecretSafetyApp } from "../apps/secret-safety/SecretSafetyApp";
import { DeliverablesApp } from "../apps/deliverables/DeliverablesApp";
import { ComponentCatalogApp } from "../apps/component-catalog/ComponentCatalogApp";
import { WorkshopProgressApp } from "../apps/workshop-progress/WorkshopProgressApp";
import { FixWizardApp } from "../apps/fix-wizard/FixWizardApp";
import { AntiPatternDetectorApp } from "../apps/antipattern-detector/AntiPatternDetectorApp";
import { ReportSnippetsApp } from "../apps/report-snippets/ReportSnippetsApp";
import { EvidencePackApp } from "../apps/evidence-pack/EvidencePackApp";
import { RequirementChecklistApp } from "../apps/requirement-checklist/RequirementChecklistApp";

export const APP_ROUTES: AppRoute[] = [
  { id: "home", component: HomeApp, title: "Home" },
  { id: "environment-doctor", component: EnvironmentDoctorApp, title: "Environment Doctor" },
  { id: "dataset-inspector", component: DatasetInspectorApp, title: "Dataset Inspector" },
  { id: "dataset-inspector-pro", component: DatasetInspectorApp, title: "Dataset Inspector Pro" },
  { id: "pipeline-spec-editor", component: PipelineSpecEditorApp, title: "Pipeline Spec Editor" },
  { id: "validation-report", component: ValidationReportApp, title: "Validation Report" },
  { id: "run-monitor", component: RunMonitorApp, title: "Run Monitor" },
  { id: "run-monitor-pro", component: RunMonitorApp, title: "Run Monitor Pro" },
  { id: "snapshot-manager", component: SnapshotManagerApp, title: "Snapshot Manager" },
  { id: "secret-safety", component: SecretSafetyApp, title: "Secret Safety" },
  { id: "deliverables", component: DeliverablesApp, title: "Deliverables" },
  { id: "component-catalog", component: ComponentCatalogApp, title: "Component Catalog" },
  { id: "workshop-progress", component: WorkshopProgressApp, title: "Workshop Progress" },
  { id: "fix-wizard", component: FixWizardApp, title: "Fix Wizard" },
  { id: "antipattern-detector", component: AntiPatternDetectorApp, title: "Antipattern Detector" },
  { id: "report-snippets", component: ReportSnippetsApp, title: "Report Snippets" },
  { id: "evidence-pack", component: EvidencePackApp, title: "Evidence Pack" },
  { id: "requirement-checklist", component: RequirementChecklistApp, title: "Requirement Checklist" },
];
