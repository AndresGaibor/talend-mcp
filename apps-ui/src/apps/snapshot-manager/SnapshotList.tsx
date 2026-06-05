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

interface SnapshotListProps {
  snapshots: Snapshot[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function SnapshotList({ snapshots, selectedIds, onSelect, isLoading }: SnapshotListProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-gray-500">
        Loading snapshots...
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No snapshots available
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {snapshots.map((snapshot) => {
        const isSelected = selectedIds.includes(snapshot.id);
        return (
          <button
            key={snapshot.id}
            onClick={() => onSelect(snapshot.id)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 truncate">{snapshot.name}</span>
              <span className="text-xs text-gray-500 ml-2 shrink-0">
                {formatBytes(snapshot.sizeBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400 truncate">{snapshot.sourcePath}</span>
              <span className="text-xs text-gray-400 ml-2 shrink-0">
                {formatDate(snapshot.createdAt)}
              </span>
            </div>
            {snapshot.description && (
              <p className="text-xs text-gray-500 mt-1 truncate">{snapshot.description}</p>
            )}
            {snapshot.tags && snapshot.tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {snapshot.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}