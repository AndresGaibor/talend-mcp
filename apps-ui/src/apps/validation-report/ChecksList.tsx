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

function StatusIcon({ status }: { status: ValidationCheck["status"] }) {
  if (status === "ok") {
    return (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    );
  }
  if (status === "warning") {
    return (
      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
  );
}

export function ChecksList({ checks }: ChecksListProps) {
  const groupedChecks = {
    ok: checks.filter(c => c.status === "ok"),
    warning: checks.filter(c => c.status === "warning"),
    error: checks.filter(c => c.status === "error"),
    missing: checks.filter(c => c.status === "missing"),
  };

  const statusConfig = {
    ok: { bg: "bg-emerald-50", border: "border-emerald-200" },
    warning: { bg: "bg-amber-50", border: "border-amber-200" },
    error: { bg: "bg-rose-50", border: "border-rose-200" },
    missing: { bg: "bg-gray-50", border: "border-gray-200" },
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
                  <div className="flex-shrink-0 mt-0.5">
                    <StatusIcon status={check.status} />
                  </div>
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
