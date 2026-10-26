export type IssueSeverity = "critical" | "warning" | "info";

export type JobIssue =
  | { severity: "critical"; category: "schema"; component: string; message: string; detail?: string }
  | { severity: "warning"; category: "connection"; component: string; message: string; detail?: string }
  | { severity: "warning"; category: "context"; component: string; message: string; detail?: string }
  | { severity: "info"; category: "config"; component: string; message: string; detail?: string };

export interface FullJobAnalysis {
  jobName: string;
  itemPath: string;
  components: {
    name: string;
    type: string;
    label: string | undefined;
    posX: number;
    posY: number;
  }[];
  connections: {
    source: string;
    target: string;
    label: string | undefined;
  }[];
  tdbOutputs: {
    uniqueName: string;
    componentName: string;
    host: string | undefined;
    dbName: string | undefined;
    table: string | undefined;
    tableAction: string | undefined;
    dataAction: string | undefined;
    schemaColumns: number;
  }[];
  contexts: {
    name: string;
    type: string | undefined;
    value: string | undefined;
  }[];
  schemaIssues: {
    component: string;
    schema: string | undefined;
    column: string;
    issue: string;
    severity: "critical";
  }[];
  columnAnalysis: {
    totalColumns: number;
    analyzedColumns: number;
    critical: number;
    warnings: number;
    infos: number;
    byComponent: Record<string, number>;
    byType: Record<string, number>;
  };
  stats: {
    componentCount: number;
    connectionCount: number;
    contextCount: number;
    tdbOutputCount: number;
    schemaIssueCount: number;
  };
  issues: JobIssue[];
  summary: string;
}
