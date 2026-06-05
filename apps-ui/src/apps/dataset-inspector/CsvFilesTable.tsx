import type { CsvFileInfo } from "./types";

interface CsvFilesTableProps {
  files: CsvFileInfo[];
  onSelectFile: (file: CsvFileInfo) => void;
}

export function CsvFilesTable({ files, onSelectFile }: CsvFilesTableProps) {
  const columns = [
    {
      key: "relativePath",
      header: "File",
      render: (row: CsvFileInfo) => (
        <span className="font-medium text-blue-600">{row.relativePath}</span>
      ),
    },
    {
      key: "rowCount",
      header: "Rows",
    },
    {
      key: "columns",
      header: "Columns",
      render: (row: CsvFileInfo) => row.columns.length,
    },
    {
      key: "delimiter",
      header: "Delimiter",
    },
    {
      key: "encoding",
      header: "Encoding",
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">CSV Files</h3>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {files.map((file, idx) => (
            <tr
              key={idx}
              onClick={() => onSelectFile(file)}
              className="cursor-pointer hover:bg-blue-50"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                  {col.render
                    ? col.render(file)
                    : String((file as unknown as Record<string, unknown>)[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
