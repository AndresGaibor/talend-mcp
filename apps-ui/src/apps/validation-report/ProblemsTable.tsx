import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";

export interface Problem {
  marker: string;
  severity: "error" | "warning" | "info";
  description: string;
  suggestedFix?: string;
  context?: string;
  location?: string;
}

interface ProblemsTableProps {
  problems: Problem[];
  showSuggestedFixes?: boolean;
}

export function ProblemsTable({ problems, showSuggestedFixes = true }: ProblemsTableProps) {
  const severityConfig = {
    error: { variant: "error" as const, label: "Error", bg: "bg-rose-50" },
    warning: { variant: "warning" as const, label: "Warning", bg: "bg-amber-50" },
    info: { variant: "default" as const, label: "Info", bg: "bg-blue-50" },
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Problems Found</h3>
            <p className="text-xs text-gray-500 mt-0.5">{problems.length} issues detected</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="error">{problems.filter(p => p.severity === "error").length} Errors</Badge>
            <Badge variant="warning">{problems.filter(p => p.severity === "warning").length} Warnings</Badge>
            <Badge variant="default">{problems.filter(p => p.severity === "info").length} Info</Badge>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Marker</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Context</th>
              {showSuggestedFixes && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Suggested Fix</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {problems.length === 0 ? (
              <tr>
                <td colSpan={showSuggestedFixes ? 5 : 4} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No problems detected
                </td>
              </tr>
            ) : (
              problems.map((problem, idx) => {
                const config = severityConfig[problem.severity];
                return (
                  <tr key={idx} className={config.bg}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold">
                        {problem.marker}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{problem.description}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 font-mono">{problem.context || "—"}</span>
                    </td>
                    {showSuggestedFixes && (
                      <td className="px-4 py-3">
                        {problem.suggestedFix ? (
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">
                            {problem.suggestedFix}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}