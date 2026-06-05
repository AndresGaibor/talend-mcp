import { useState } from "react";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";

interface DeliverableFile {
  path: string;
  name: string;
  sizeBytes: number;
  type: string;
  modifiedAt: Date;
}

interface PackageBuilderProps {
  files: DeliverableFile[];
  onCreatePackage: (name: string, version: string) => void;
  onCancel: () => void;
  isCreating: boolean;
  showConfirmation: boolean;
  onConfirm: () => void;
  onCancelConfirmation: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function PackageBuilder({
  files,
  onCreatePackage,
  onCancel,
  isCreating,
  showConfirmation,
  onConfirm,
  onCancelConfirmation,
}: PackageBuilderProps) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");

  const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreatePackage(name.trim(), version);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Crear Paquete de Deliverable</h3>

      <div className="space-y-4">
        <div>
          <label htmlFor="package-name" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del paquete *
          </label>
          <input
            id="package-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mi-deliverable"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="package-version" className="block text-sm font-medium text-gray-700 mb-1">
            Version
          </label>
          <input
            id="package-version"
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Resumen del paquete</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Archivos</p>
              <p className="font-semibold text-gray-900">{files.length}</p>
            </div>
            <div>
              <p className="text-gray-500">Tamano total</p>
              <p className="font-semibold text-gray-900">{formatBytes(totalSize)}</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
          {files.map((file) => (
            <div key={file.path} className="p-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="text-gray-700 truncate max-w-xs">{file.name}</span>
              </div>
              <span className="text-gray-500 text-xs">{formatBytes(file.sizeBytes)}</span>
            </div>
          ))}
        </div>

        {showConfirmation && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium mb-2">
              Esta seguro de que desea crear el paquete?
            </p>
            <p className="text-yellow-700 text-xs">
              Esta accion creara un paquete con {files.length} archivos ({formatBytes(totalSize)}). El
              proceso puede tardar varios minutos.
            </p>
            <div className="flex gap-2 mt-3">
              <Button variant="danger" size="sm" onClick={onConfirm} disabled={isCreating}>
                Confirmar creacion
              </Button>
              <Button variant="secondary" size="sm" onClick={onCancelConfirmation} disabled={isCreating}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onCancel} disabled={isCreating}>
          Cancelar
        </Button>
        {!showConfirmation && (
          <Button onClick={handleSubmit} disabled={isCreating || !name.trim()}>
            {isCreating ? "Creando..." : "Crear paquete"}
          </Button>
        )}
      </div>
    </Card>
  );
}
