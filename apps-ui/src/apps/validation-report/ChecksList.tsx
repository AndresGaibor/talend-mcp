import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";

export interface ValidationCheck {
  id: string;
  label: string;
  status: "ok" | "warning" | "error" | "missing";
  message: string;
  severity?: "high" | "medium" | "low";
}

interface ChecksListProps {
  checks: ValidationCheck[];
}

export function ChecksList({ checks }: ChecksListProps) {
  const groupedChecks = {
    ok: checks.filter(c => c.status === "ok"),
    warning: checks.filter(c => c.status === "warning"),
    error: checks.filter(c => c.status === "error"),
    missing: checks.filter(c => c.status === "missing"),
  };

  const statusConfig = {
    ok: { icon: "✓", bg: "bg-emerald-50", border: "border-emerald-200", iconColor: "text-emerald-600" },
    warning: { icon: "⚠", bg: "bg-amber-50", border: "border-amber-200", iconColor: "text-amber-600" },
    error: { icon: "✕", bg: "bg-rose-50", border: "border-rose-200", iconColor: "text-rose-600" },
    missing: { icon: "?", bg: "bg-gray-50", border: "border-gray-200", iconColor: "text-gray-500" },
  };

  return (
    <Card className="p-0">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Validation Checks</h3>
        <p className="text-xs text-gray-500 mt-0.5">{checks.length} total checks</p>
      </div>
      
      <div className="divide-y divide-gray-100">
        {checks.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">
            No validation checks available
          </div>
        ) : (
          checks.map((check, idx) => {
            const config = statusConfig[check.status];
            return (
              <div key={check.id || idx} className={`px-5 py-4 ${config.bg} border-l-4 ${config.border.replace('border-', 'border-l-')}`}>
                <div className="flex items-start gap-3">
                  <span className={`text-lg font-bold ${config.iconColor}`}>{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{check.label}</span>
                      {check.severity && (
                        <Badge variant={check.severity === "high" ? "error" : check.severity === "medium" ? "warning" : "default"} className="text-[10px]">
                          {check.severity}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{check.message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {checks.length > 0 && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
            <span className="text-xs text-gray-600">{groupedChecks.ok.length} OK</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
            <span className="text-xs text-gray-600">{groupedChecks.warning.length} Warnings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500"></span>
            <span className="text-xs text-gray-600">{groupedChecks.error.length} Errors</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-400"></span>
            <span className="text-xs text-gray-600">{groupedChecks.missing.length} Missing</span>
          </div>
        </div>
      )}
    </Card>
  );
}