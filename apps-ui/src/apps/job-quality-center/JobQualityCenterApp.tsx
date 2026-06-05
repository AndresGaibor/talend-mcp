import { useEffect, useState } from "react";
import { AppHeader, LoadingState, ErrorBanner } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { useQualityReport } from "./hooks";
import type { SeverityLevel, QualityIssue } from "./types";

const severityOrder: SeverityLevel[] = ["critical", "high", "medium", "low"];

const severityConfig: Record<SeverityLevel, { label: string; variant: "error" | "warning" | "info" | "muted"; color: string }> = {
  critical: { label: "Critical", variant: "error", color: "text-red-600" },
  high: { label: "High", variant: "warning", color: "text-orange-600" },
  medium: { label: "Medium", variant: "info", color: "text-yellow-600" },
  low: { label: "Low", variant: "muted", color: "text-gray-500" },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-yellow-50 border-yellow-200";
  if (score >= 40) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function groupIssuesBySeverity(issues: QualityIssue[]): Record<SeverityLevel, QualityIssue[]> {
  const grouped: Record<SeverityLevel, QualityIssue[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const issue of issues) {
    if (grouped[issue.severity]) {
      grouped[issue.severity].push(issue);
    }
  }
  return grouped;
}

interface IssueCardProps {
  issue: QualityIssue;
}

function IssueCard({ issue }: IssueCardProps) {
  const [copied, setCopied] = useState(false);
  const config = severityConfig[issue.severity];

  const handleCopyFix = async () => {
    if (issue.fixSolution) {
      await navigator.clipboard.writeText(issue.fixSolution);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={config.variant}>{config.label}</Badge>
            {issue.componentName && (
              <span className="text-xs text-gray-500">{issue.componentName}</span>
            )}
            {issue.lineNumber && (
              <span className="text-xs text-gray-400">Line {issue.lineNumber}</span>
            )}
          </div>
          <h4 className="font-semibold text-gray-900">{issue.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
        </div>
      </div>
      {issue.fixSolution && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyFix}
            disabled={!issue.fixSolution}
          >
            {copied ? "Copied!" : "Copy Fix"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface SeveritySectionProps {
  severity: SeverityLevel;
  issues: QualityIssue[];
}

function SeveritySection({ severity, issues }: SeveritySectionProps) {
  if (issues.length === 0) return null;
  const config = severityConfig[severity];

  return (
    <div className="mb-6">
      <h3 className={`text-lg font-semibold mb-3 ${config.color}`}>
        {config.label} ({issues.length})
      </h3>
      <div>
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

interface JobQualityCenterAppProps {
  jobId?: string;
}

export function JobQualityCenterApp({ jobId = "default" }: JobQualityCenterAppProps) {
  const { report, loading, error, fetchReport } = useQualityReport(jobId);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading && !report) {
    return (
      <div className="space-y-6">
        <AppHeader
          title="Job Quality Center"
          subtitle="Analiza la calidad de tus jobs"
        />
        <LoadingState message="Cargando reporte de calidad..." />
      </div>
    );
  }

  const groupedIssues = report ? groupIssuesBySeverity(report.issues) : {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  return (
    <div className="space-y-6">
      <AppHeader
        title="Job Quality Center"
        subtitle="Analiza la calidad de tus jobs"
      />

      {error && <ErrorBanner message={error} onDismiss={() => {}} />}

      {report && (
        <>
          <Card className={`p-8 border-2 ${getScoreBgColor(report.score)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Quality Score
                </p>
                <div className={`text-6xl font-bold mt-2 ${getScoreColor(report.score)}`}>
                  {report.score}
                  <span className="text-3xl text-gray-400">/100</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {report.issues.length} issue{report.issues.length !== 1 ? "s" : ""} found
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Last updated: {new Date(report.lastUpdated).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          <div>
            {severityOrder.map((severity) => (
              <SeveritySection
                key={severity}
                severity={severity}
                issues={groupedIssues[severity]}
              />
            ))}
          </div>

          {report.issues.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-gray-500">No issues found. Great job!</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
