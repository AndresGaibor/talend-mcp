import { useCallback } from "react";
import { Card } from "../../components/Card";
import { ToolActionButton } from "../../design-system/ToolActionButton";

interface HomeQuickActionsProps {
  onNavigate?: (appId: string) => void;
  onAction?: (toolName: string, args: Record<string, unknown>) => void;
}

export function HomeQuickActions({ onNavigate, onAction }: HomeQuickActionsProps) {
  const handleAction = useCallback((toolName: string, args: Record<string, unknown>) => {
    if (onAction) onAction(toolName, args);
  }, [onAction]);

  const quickActions = [
    { label: "Listar Jobs", toolName: "talend_jobs_list", args: { limit: 50 } },
    { label: "Snapshots", toolName: "talend_snapshots_list", args: {} },
    { label: "Ejecutar Run", toolName: "talend_runs_list", args: { limit: 10 } },
    { label: "Validar Diseno", toolName: "talend_validation_validate_design", args: {} },
  ];

  const appLinks = [
    { label: "Environment Doctor", appId: "environment-doctor" },
    { label: "Pipeline Spec Editor", appId: "pipeline-spec-editor" },
    { label: "Run Monitor", appId: "run-monitor" },
    { label: "Dataset Inspector", appId: "dataset-inspector" },
    { label: "Validation Report", appId: "validation-report" },
    { label: "Snapshot Manager", appId: "snapshot-manager" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Acciones Rapidas</h3>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <ToolActionButton
              key={action.label}
              label={action.label}
              variant="primary"
              size="sm"
              onExecute={() => handleAction(action.toolName, action.args)}
            />
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Navegacion Rapida</h3>
        <div className="flex flex-wrap gap-2">
          {appLinks.map((link) => (
            <ToolActionButton
              key={link.appId}
              label={link.label}
              variant="secondary"
              size="sm"
              onExecute={() => { if (onNavigate) onNavigate(link.appId); }}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
