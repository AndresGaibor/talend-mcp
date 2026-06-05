import { DataTable } from "../../components/DataTable";

interface DeliverableFile {
  path: string;
  name: string;
  sizeBytes: number;
  type: string;
  modifiedAt: Date;
}

interface EvidenceFilesTableProps {
  files: DeliverableFile[];
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function EvidenceFilesTable({ files, selectedFiles, onToggleFile }: EvidenceFilesTableProps) {
  const columns = [
    {
      key: "select",
      header: "",
      render: (row: DeliverableFile) => (
        <input
          type="checkbox"
          checked={selectedFiles.has(row.path)}
          onChange={() => onToggleFile(row.path)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    },
    {
      key: "name",
      header: "Nombre",
      render: (row: DeliverableFile) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-lg">📄</span>
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
            <p className="text-xs text-gray-500">{row.path}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      render: (row: DeliverableFile) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
          {row.type}
        </span>
      ),
    },
    {
      key: "sizeBytes",
      header: "Tamaño",
      render: (row: DeliverableFile) => formatBytes(row.sizeBytes),
    },
    {
      key: "modifiedAt",
      header: "Última modificación",
      render: (row: DeliverableFile) =>
        new Date(row.modifiedAt).toLocaleDateString("es-ES", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
  ];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <DataTable data={files} columns={columns} className="mb-0" />
    </div>
  );
}
