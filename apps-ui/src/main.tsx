import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { HomeApp } from './apps/home/HomeApp';
import { EnvironmentDoctorApp } from './apps/environment-doctor/EnvironmentDoctorApp';
import { DatasetInspectorApp } from './apps/dataset-inspector/DatasetInspectorApp';
import { PipelineSpecEditorApp } from './apps/pipeline-spec-editor/PipelineSpecEditorApp';
import { ValidationReportApp } from './apps/validation-report/ValidationReportApp';
import { RunMonitorApp } from './apps/run-monitor/RunMonitorApp';
import { SnapshotManagerApp } from './apps/snapshot-manager/SnapshotManagerApp';
import { SecretSafetyApp } from './apps/secret-safety/SecretSafetyApp';
import { DeliverablesApp } from './apps/deliverables/DeliverablesApp';
import { ComponentCatalogApp } from './apps/component-catalog/ComponentCatalogApp';
import { WorkshopProgressApp } from './apps/workshop-progress/WorkshopProgressApp';
import { FixWizardApp } from './apps/fix-wizard/FixWizardApp';
import { AntiPatternDetectorApp } from './apps/antipattern-detector/AntiPatternDetectorApp';
import { ReportSnippetsApp } from './apps/report-snippets/ReportSnippetsApp';
import { EvidencePackApp } from './apps/evidence-pack/EvidencePackApp';
import { RequirementChecklistApp } from './apps/requirement-checklist/RequirementChecklistApp';

function AppRouter() {
  const [appId, setAppId] = useState<string>('home');

  useEffect(() => {
    const metaAppId = document.querySelector('meta[name="app-id"]')?.getAttribute('content');
    const urlAppId = new URLSearchParams(location.search).get('appId');
    setAppId(metaAppId ?? urlAppId ?? 'home');
  }, []);

  switch (appId) {
    case 'home': return <HomeApp />;
    case 'environment-doctor': return <EnvironmentDoctorApp />;
    case 'dataset-inspector':
    case 'dataset-inspector-pro': return <DatasetInspectorApp />;
    case 'pipeline-spec-editor': return <PipelineSpecEditorApp />;
    case 'validation-report': return <ValidationReportApp />;
    case 'run-monitor':
    case 'run-monitor-pro': return <RunMonitorApp />;
    case 'snapshot-manager': return <SnapshotManagerApp />;
    case 'secret-safety': return <SecretSafetyApp />;
    case 'deliverables': return <DeliverablesApp />;
    case 'component-catalog': return <ComponentCatalogApp />;
    case 'workshop-progress': return <WorkshopProgressApp />;
    case 'fix-wizard': return <FixWizardApp />;
    case 'antipattern-detector': return <AntiPatternDetectorApp />;
    case 'report-snippets': return <ReportSnippetsApp />;
    case 'evidence-pack': return <EvidencePackApp />;
    case 'requirement-checklist': return <RequirementChecklistApp />;
    default: return <HomeApp />;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);