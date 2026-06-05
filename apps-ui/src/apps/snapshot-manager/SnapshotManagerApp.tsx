import { useState, useEffect, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SnapshotList } from "./SnapshotList";
import { SnapshotDiff } from "./SnapshotDiff";
import { RestorePanel } from "./RestorePanel";

interface Snapshot {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  description?: string;
  tags?: string[];
  sourcePath: string;
}

interface SnapshotDiffData {
  snapshotA: Snapshot;
  snapshotB: Snapshot;
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];
  diffContent: string;
}

export function SnapshotManagerApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);
  const [diffData, setDiffData] = useState<SnapshotDiffData | null>(null);
  const [showRestorePanel, setShowRestorePanel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setError(null);
    const result = await callTool("talend_snapshots_list", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setSnapshots(data);
      } catch {
        setError("Error parsing snapshots response");
      }
    } else {
      setError(result.error ?? "Error loading snapshots");
    }
  }, [callTool]);

  const loadDiff = useCallback(async () => {
    if (selectedSnapshotIds.length !== 2) {
      setDiffData(null);
      return;
    }
    const result = await callTool("talend_snapshots_diff", {
      snapshotIdA: selectedSnapshotIds[0],
      snapshotIdB: selectedSnapshotIds[1],
    });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setDiffData(data);
      } catch {
        setDiffData(null);
      }
    } else {
      setDiffData(null);
    }
  }, [callTool, selectedSnapshotIds]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const handleSnapshotSelect = (snapshotId: string) => {
    setSelectedSnapshotIds((prev) => {
      if (prev.includes(snapshotId)) {
        return prev.filter((id) => id !== snapshotId);
      }
      if (prev.length >= 2) {
        return [prev[1], snapshotId];
      }
      return [...prev, snapshotId];
    });
    setDiffData(null);
  };

  const handleRestoreConfirm = () => {
    setShowRestorePanel(true);
  };

  const handleRestoreCancel = () => {
    setShowRestorePanel(false);
  };

  const handleRestoreComplete = () => {
    setShowRestorePanel(false);
    setSelectedSnapshotIds([]);
    setDiffData(null);
    loadSnapshots();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Snapshot Manager</h2>
          <p className="text-gray-500 mt-1">Manage and restore project snapshots</p>
        </div>
        <button
          onClick={loadSnapshots}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Snapshots</h3>
            <Badge variant={selectedSnapshotIds.length === 2 ? "success" : "default"}>
              {selectedSnapshotIds.length}/2 selected
            </Badge>
          </div>
          <SnapshotList
            snapshots={snapshots}
            selectedIds={selectedSnapshotIds}
            onSelect={handleSnapshotSelect}
            isLoading={isLoading}
          />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Diff View</h3>
            {selectedSnapshotIds.length === 2 && (
              <button
                onClick={handleRestoreConfirm}
                className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700"
              >
                Restore
              </button>
            )}
          </div>
          <SnapshotDiff diffData={diffData} selectedIds={selectedSnapshotIds} />
        </Card>
      </div>

      {showRestorePanel && selectedSnapshotIds.length === 1 && (
        <RestorePanel
          snapshotId={selectedSnapshotIds[0]}
          snapshotName={snapshots.find((s) => s.id === selectedSnapshotIds[0])?.name ?? ""}
          onCancel={handleRestoreCancel}
          onComplete={handleRestoreComplete}
        />
      )}
    </div>
  );
}