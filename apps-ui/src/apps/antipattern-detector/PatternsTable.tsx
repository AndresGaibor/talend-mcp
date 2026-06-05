import { Card } from "../../components/Card";

export interface AntiPatternFinding {
  id: string;
  pattern: string;
  severity: "critical" | "high" | "medium" | "low" | "warning";
  file: string;
  line?: number;
  component?: string;
  description: string;
  recommendation: string;
}

interface PatternsTableProps {
  patterns: AntiPatternFinding[];
  onPatternClick?: (pattern: AntiPatternFinding) => void;
}

function formatPatternType(pattern: string): string {
  return pattern.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSeverityColor(severity: AntiPatternFinding["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "warning":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "low":
      return "bg-green-100 text-green-700 border-green-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function PatternsTable({ patterns, onPatternClick }: PatternsTableProps) {
  if (patterns.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-500">
        No anti-patterns detected. Your Talend jobs look clean!
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Severity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pattern
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Component
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Recommendation
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {patterns.map((pattern) => (
            <tr
              key={pattern.id}
              onClick={() => onPatternClick?.(pattern)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-md border ${getSeverityColor(
                    pattern.severity
                  )}`}
                >
                  {pattern.severity.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {formatPatternType(pattern.pattern)}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {pattern.component ? (
                  <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {pattern.component}
                  </code>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm text-gray-600">
                  {pattern.file}
                  {pattern.line ? `:${pattern.line}` : ""}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-500">{pattern.description}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-500">{pattern.recommendation}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}