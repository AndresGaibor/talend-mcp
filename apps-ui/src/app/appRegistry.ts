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
import { ProblemsViewApp } from "../apps/problems-view/ProblemsViewApp";
import { JobComponentStudioApp } from "../apps/job-component-studio/JobComponentStudioApp";
import { ComponentAtlasApp } from "../apps/component-atlas/ComponentAtlasApp";
import { ComponentMasteryCenterApp } from "../apps/component-mastery-center/ComponentMasteryCenterApp";
import { SchemaMappingStudioApp } from "../apps/schema-mapping-studio/SchemaMappingStudioApp";
import { RecipeBuilderApp } from "../apps/recipe-builder/RecipeBuilderApp";
import { ExecutionCenterApp } from "../apps/execution-center/ExecutionCenterApp";
import { JobQualityCenterApp } from "../apps/job-quality-center/JobQualityCenterApp";

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
  { id: "component-atlas", component: ComponentAtlasApp, title: "Component Atlas" },
  { id: "component-mastery-center", component: ComponentMasteryCenterApp, title: "Component Mastery Center" },
  { id: "workshop-progress", component: WorkshopProgressApp, title: "Workshop Progress" },
  { id: "fix-wizard", component: FixWizardApp, title: "Fix Wizard" },
  { id: "antipattern-detector", component: AntiPatternDetectorApp, title: "Antipattern Detector" },
  { id: "report-snippets", component: ReportSnippetsApp, title: "Report Snippets" },
  { id: "evidence-pack", component: EvidencePackApp, title: "Evidence Pack" },
  { id: "requirement-checklist", component: RequirementChecklistApp, title: "Requirement Checklist" },
  { id: "problems-view", component: ProblemsViewApp, title: "Problems View" },
  { id: "job-component-studio", component: JobComponentStudioApp, title: "Job Component Studio" },
  { id: "component-inspector", component: JobComponentStudioApp, title: "Component Inspector Pro" },
  { id: "schema-mapping-studio", component: SchemaMappingStudioApp, title: "Schema Mapping Studio" },
  { id: "recipe-builder", component: RecipeBuilderApp, title: "Recipe Builder" },
  { id: "execution-center", component: ExecutionCenterApp, title: "Execution Center" },
  { id: "job-quality-center", component: JobQualityCenterApp, title: "Job Quality Center" },
];
