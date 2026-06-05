import { useState, useCallback } from "react";
import { Card } from "../../components/Card";
import { useCallTool } from "../../openai/useCallTool";

interface RestorePanelProps {
  snapshotId: string;
  snapshotName: string;
  onCancel: () => void;
  onComplete: () => void;
}

interface RestoreResponse {
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  message?: string;
  warning?: string;
}

export function RestorePanel({ snapshotId, snapshotName, onCancel, onComplete }: RestorePanelProps) {
  const { execute: callTool, isLoading } = useCallTool();
  const [error, setError] = useState<string | null>(null);
  const [confirmationStep, setConfirmationStep] = useState<"warning" | "input">("warning");
  const [confirmText, setConfirmText] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  const REQUIRED_CONFIRM_TEXT = "RESTORE";

  const handleProceed = useCallback(async () => {
    setError(null);
    const result = await callTool("talend_snapshots_restore", { snapshotId });

    if (result.success && result.result) {
      try {
        const data: RestoreResponse = JSON.parse(result.result);
        if (data.requiresConfirmation && data.confirmationToken) {
          setPendingToken(data.confirmationToken);
          setConfirmationStep("input");
        } else {
          onComplete();
        }
      } catch {
        setError("Invalid response from restore tool");
      }
    } else {
      setError(result.error ?? "Failed to initiate restore");
    }
  }, [callTool, snapshotId, onComplete]);

  const handleConfirmRestore = useCallback(async () => {
    if (confirmText !== REQUIRED_CONFIRM_TEXT) {
      setError(`Please type "${REQUIRED_CONFIRM_TEXT}" to confirm`);
      return;
    }

    if (!pendingToken) {
      setError("No pending restore operation");
      return;
    }

    setError(null);
    const result = await callTool("talend_snapshots_restore", {
      snapshotId,
      confirmationToken: pendingToken,
    });

    if (result.success) {
      onComplete();
    } else {
      setError(result.error ?? "Failed to restore snapshot");
    }
  }, [callTool, snapshotId, confirmText, pendingToken, onComplete]);

  return (
    <Card className="p-6 border-2 border-orange-300">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Restore Snapshot</h3>
            <p className="text-gray-600 mt-1">
              You are about to restore <strong>{snapshotName}</strong>. This operation will overwrite existing files.
            </p>
          </div>
        </div>

        {confirmationStep === "warning" && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> This is a destructive operation. Files will be overwritten with the snapshot contents.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={isLoading}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {isLoading ? "Processing..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {confirmationStep === "input" && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">
                Final Confirmation Required
              </p>
              <p className="text-xs text-orange-700">
                Type <strong>RESTORE</strong> in the field below to confirm you want to proceed with this destructive operation.
              </p>
            </div>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Type RESTORE to confirm"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isLoading || confirmText !== REQUIRED_CONFIRM_TEXT}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:bg-gray-400"
              >
                {isLoading ? "Restoring..." : "Execute Restore"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}