import { useState, useCallback } from "react";
import type { PipelineSpec } from "./PipelineSpecEditorApp";
import { Button } from "../../components/Button";

interface ApplySpecPanelProps {
  spec: PipelineSpec;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  showConfirmation: boolean;
  onCancelConfirmation: () => void;
}

export function ApplySpecPanel({
  spec,
  onConfirm,
  onCancel,
  isLoading,
  showConfirmation,
  onCancelConfirmation,
}: ApplySpecPanelProps) {
  const [snapshotName, setSnapshotName] = useState("");

  const handleSnapshotNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSnapshotName(e.target.value);
    },
    []
  );

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Apply Pipeline Specification</h3>

      <div className="p-4 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-500">Pipeline:</span>
        <p className="font-medium text-gray-900 mt-1">{spec.name ?? "Unnamed pipeline"}</p>
        {spec.description && (
          <p className="text-sm text-gray-500 mt-1">{spec.description}</p>
        )}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Snapshot name (optional)</span>
          <input
            type="text"
            value={snapshotName}
            onChange={handleSnapshotNameChange}
            className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="my-snapshot-name"
          />
        </label>
      </div>

      {!showConfirmation ? (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isLoading}>
            Apply Pipeline
          </Button>
        </div>
      ) : (
        <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-medium text-red-800">Confirm Apply</h4>
              <p className="mt-1 text-sm text-red-700">
                You are about to apply a pipeline specification. This action will create a snapshot
                and cannot be undone easily. Are you sure you want to proceed?
              </p>
              <div className="mt-4 flex items-center gap-3">
                <code className="px-2 py-1 bg-red-100 rounded text-sm font-mono text-red-800">
                  {spec.name ?? "Unnamed pipeline"}
                </code>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={onCancelConfirmation} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "Applying..." : "Yes, Apply Pipeline"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
