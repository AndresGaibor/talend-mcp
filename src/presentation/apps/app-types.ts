export const PRESENTATION_APP_IDS = [
  "dashboard",
  "dataset-inspector",
  "job-designer",
  "validation-report",
  "run-monitor",
  "snapshot-diff",
  "deliverables",
  "component-catalog",
  "command-center",
  "home",
  "environment-doctor",
  "workspace-explorer",
  "job-browser",
  "pattern-gallery",
  "visual-job-designer",
  "pipeline-spec-editor",
  "mapping-builder",
  "tmap-designer",
  "dataset-inspector-pro",
  "csv-preview",
  "raw-mapping-matrix",
  "context-profiles",
  "database-connection-wizard",
  "secret-safety",
  "run-monitor-pro",
  "launch-history",
  "runtime-comparison",
  "problems-view",
  "error-explorer",
  "validation-timeline",
  "snapshot-manager",
] as const;

export type PresentationAppId = (typeof PRESENTATION_APP_IDS)[number];

export type PresentationAppInputMode = "none" | "text" | "json";

export interface PresentationAppAction {
  label: string;
  toolName: string;
  description: string;
  inputMode?: PresentationAppInputMode;
  inputLabel?: string;
  inputPlaceholder?: string;
  defaultValue?: string;
  argumentName?: string;
  requiresConfirmation?: boolean;
}

export interface PresentationAppDefinition {
  id: PresentationAppId;
  title: string;
  description: string;
  resourceUri: string;
  launcherToolName: string;
  launchMessage: string;
  actions: PresentationAppAction[];
}

export interface PresentationAppLaunchResult {
  [key: string]: unknown;
  ok: true;
  source: "launcher";
  confidence: number;
  summary: string;
  warnings: string[];
  app: {
    id: PresentationAppId;
    title: string;
    resourceUri: string;
  };
  initialState: Record<string, unknown>;
  seed?: string;
}
