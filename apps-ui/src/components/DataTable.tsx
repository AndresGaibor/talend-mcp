import { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
}

export function DataTable<T>({ data, columns, className = "" }: DataTableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
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
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                  {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}