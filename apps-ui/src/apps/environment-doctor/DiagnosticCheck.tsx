import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";

interface DiagnosticCheckProps {
  label: string;
  success: boolean;
  description?: string;
  details?: string;
}

export function DiagnosticCheck({ label, success, description, details }: DiagnosticCheckProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{label}</span>
            <Badge variant={success ? "success" : "error"}>
              {success ? "Pass" : "Fail"}
            </Badge>
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
          {details && (
            <p className="text-xs font-mono text-gray-400 mt-2 p-2 bg-gray-50 rounded break-all">
              {details}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}