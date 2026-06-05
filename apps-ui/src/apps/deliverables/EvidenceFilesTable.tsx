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
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
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
      header: "Tamanio",
      render: (row: DeliverableFile) => formatBytes(row.sizeBytes),
    },
    {
      key: "modifiedAt",
      header: "Ultima modificacion",
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
