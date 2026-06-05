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

interface SnapshotDiffProps {
  diffData: SnapshotDiffData | null;
  selectedIds: string[];
}

export function SnapshotDiff({ diffData, selectedIds }: SnapshotDiffProps) {
  if (selectedIds.length !== 2) {
    return (
      <div className="py-8 text-center text-gray-500">
        Select 2 snapshots to compare
      </div>
    );
  }

  if (!diffData) {
    return (
      <div className="py-8 text-center text-gray-500">
        Loading diff...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded-full"></span>
          <span className="text-gray-600">{diffData.addedFiles.length} added</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded-full"></span>
          <span className="text-gray-600">{diffData.removedFiles.length} removed</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
          <span className="text-gray-600">{diffData.modifiedFiles.length} modified</span>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <span className="text-sm font-medium text-gray-700">
            {diffData.snapshotA.name} → {diffData.snapshotB.name}
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {diffData.addedFiles.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <div className="text-xs font-medium text-green-700 mb-2">Added Files</div>
              <ul className="space-y-1">
                {diffData.addedFiles.map((file) => (
                  <li key={file} className="text-xs text-gray-600 font-mono flex items-center gap-2">
                    <span className="text-green-600">+</span>
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diffData.removedFiles.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <div className="text-xs font-medium text-red-700 mb-2">Removed Files</div>
              <ul className="space-y-1">
                {diffData.removedFiles.map((file) => (
                  <li key={file} className="text-xs text-gray-600 font-mono flex items-center gap-2">
                    <span className="text-red-600">-</span>
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diffData.modifiedFiles.length > 0 && (
            <div className="p-3">
              <div className="text-xs font-medium text-yellow-700 mb-2">Modified Files</div>
              <ul className="space-y-1">
                {diffData.modifiedFiles.map((file) => (
                  <li key={file} className="text-xs text-gray-600 font-mono flex items-center gap-2">
                    <span className="text-yellow-600">~</span>
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {diffData.diffContent && (
          <div className="border-t bg-gray-900 p-3 max-h-40 overflow-auto">
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
              {diffData.diffContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}