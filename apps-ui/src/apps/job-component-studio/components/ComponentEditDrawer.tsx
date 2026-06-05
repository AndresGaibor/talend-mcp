import { useState, useEffect } from "react";
import type { ComponentParameter } from "../types";
import { useComponentPatch, useRenameLabel, useRenameUniqueName } from "../hooks";

interface ComponentEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobName: string;
  folderPath?: string;
  uniqueName: string;
  parameterToEdit: ComponentParameter | null; // Null if renaming
  mode: "parameter" | "label" | "uniqueName";
  onSuccess: () => void;
}

export function ComponentEditDrawer({
  isOpen,
  onClose,
  jobName,
  folderPath,
  uniqueName,
  parameterToEdit,
  mode,
  onSuccess,
}: ComponentEditDrawerProps) {
  const { previewPatch, applyPatch, isLoading: isPatching } = useComponentPatch();
  const { rename: renameLabel, isLoading: isRenamingLabel } = useRenameLabel();
  const { previewRename, applyRename, isLoading: isRenamingUnique } = useRenameUniqueName();

  const [value, setValue] = useState("");
  const [previewData, setPreviewData] = useState<{
    diff: string;
    warnings: string[];
    riskLevel: "low" | "medium" | "high";
    confirmationToken?: string;
  } | null>(null);
  
  const [tokenInput, setTokenInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === "parameter" && parameterToEdit) {
        setValue(parameterToEdit.value);
      } else if (mode === "label") {
        setValue(uniqueName);
      } else if (mode === "uniqueName") {
        setValue(uniqueName);
      }
      setPreviewData(null);
      setTokenInput("");
      setErrorMsg(null);
    }
  }, [isOpen, mode, parameterToEdit, uniqueName]);

  if (!isOpen) return null;

  const handlePreview = async () => {
    setErrorMsg(null);
    setPreviewData(null);

    if (mode === "parameter" && parameterToEdit) {
      const res = await previewPatch(jobName, folderPath, uniqueName, {
        [parameterToEdit.name]: value,
      });
      if (res.ok && res.data) {
        const d = res.data as any;
        setPreviewData({
          diff: d.diff,
          warnings: d.warnings || [],
          riskLevel: d.riskLevel || "low",
        });
      } else {
        setErrorMsg(res.error || "Error al calcular previsualización");
      }
    } else if (mode === "uniqueName") {
      const res = await previewRename(jobName, folderPath, uniqueName, value);
      if (res.ok && res.data) {
        const d = res.data as any;
        setPreviewData({
          diff: `Cambiar UNIQUE_NAME de "${uniqueName}" a "${value}"\nConexiones afectadas: ${d.affectedConnectionsCount}`,
          warnings: d.warning ? [d.warning] : [],
          riskLevel: "high",
          confirmationToken: d.confirmationToken,
        });
      } else {
        setErrorMsg(res.error || "Error al verificar cambio de UniqueName");
      }
    }
  };

  const handleApply = async () => {
    setErrorMsg(null);

    if (mode === "parameter" && parameterToEdit) {
      const res = await applyPatch(jobName, folderPath, uniqueName, {
        [parameterToEdit.name]: value,
      });
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || "Error al aplicar cambios");
      }
    } else if (mode === "label") {
      const res = await renameLabel(jobName, folderPath, uniqueName, value);
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || "Error al renombrar label");
      }
    } else if (mode === "uniqueName" && previewData?.confirmationToken) {
      if (tokenInput !== previewData.confirmationToken) {
        setErrorMsg("El token de confirmación no coincide.");
        return;
      }
      const res = await applyRename(jobName, folderPath, uniqueName, value, tokenInput);
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || "Error al aplicar cambio de UniqueName");
      }
    }
  };

  const isLoading = isPatching || isRenamingLabel || isRenamingUnique;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl relative animate-slide-in p-6 overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              {mode === "parameter" && `Editar ${parameterToEdit?.name}`}
              {mode === "label" && "Renombrar Label"}
              {mode === "uniqueName" && "Cambiar UNIQUE_NAME (ID)"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Componente: {uniqueName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Fields */}
        <div className="flex-1 py-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500">
              {mode === "parameter" && "Nuevo valor"}
              {mode === "label" && "Nuevo Label visible"}
              {mode === "uniqueName" && "Nuevo UNIQUE_NAME"}
            </label>
            {mode === "parameter" ? (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={4}
                className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
            )}
          </div>

          {/* Label changes do not need preview */}
          {mode !== "label" && !previewData && (
            <button
              onClick={handlePreview}
              disabled={isLoading}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-950 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
            >
              {isLoading ? "Cargando..." : "Previsualizar Cambios"}
            </button>
          )}

          {/* Diffs & Risk Audit */}
          {previewData && (
            <div className="space-y-4 pt-4 border-t border-gray-100 animate-fade-in">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-gray-700">Resumen del Cambio</h4>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    previewData.riskLevel === "high"
                      ? "bg-red-50 text-red-700 border-red-100"
                      : "bg-green-50 text-green-700 border-green-100"
                  }`}
                >
                  Riesgo: {previewData.riskLevel.toUpperCase()}
                </span>
              </div>

              {/* Diff Output */}
              <div className="bg-gray-900 text-gray-200 p-4 rounded-xl font-mono text-[10px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                {previewData.diff}
              </div>

              {/* Warnings */}
              {previewData.warnings.map((w, idx) => (
                <div key={idx} className="p-3 bg-amber-50 border border-amber-100 text-amber-900 text-xs rounded-xl flex items-start space-x-2">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{w}</span>
                </div>
              ))}

              {/* Token Confirmation for Unique Name */}
              {previewData.confirmationToken && (
                <div className="space-y-2 p-3 bg-red-50/55 border border-red-100/50 rounded-xl">
                  <p className="text-[11px] text-red-900 font-semibold">
                    Esta operación es destructiva. Copia y pega el token de confirmación a continuación:
                  </p>
                  <p className="text-xs font-mono bg-red-100 text-red-800 p-2 rounded select-all font-semibold">
                    {previewData.confirmationToken}
                  </p>
                  <input
                    type="text"
                    placeholder="Pegar token aquí..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition-all"
          >
            Cancelar
          </button>
          
          {(mode === "label" || previewData) && (
            <button
              onClick={handleApply}
              disabled={isLoading || (mode === "uniqueName" && tokenInput !== previewData?.confirmationToken)}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
            >
              {isLoading ? "Aplicando..." : "Aplicar Cambios"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
