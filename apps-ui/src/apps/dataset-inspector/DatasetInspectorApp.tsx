import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { useAppSession } from "../../openai/useAppSession";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { CsvFilesTable } from "./CsvFilesTable";
import { ColumnsTable } from "./ColumnsTable";
import { RawMappingsTable } from "./RawMappingsTable";
import type { DatasetInspectionResult, BatchRawMappingsResult } from "./types";

type AppStep = "input" | "files" | "columns" | "mappings";

interface CsvFileInfo {
  path: string;
  relativePath: string;
  rowCount: number;
  columns: Array<{
    name: string;
    inferredType: string;
    nullable: boolean;
    sampleValues: string[];
  }>;
  delimiter: string;
  quoteChar: string;
  lineEnding: string;
  encoding: string;
}

export function DatasetInspectorApp() {
  const { execute: callTool, isLoading } = useCallTool();
  const { updateSession } = useAppSession();

  const [step, setStep] = useState<AppStep>("input");
  const [folderPath, setFolderPath] = useState("");
  const [inspection, setInspection] = useState<DatasetInspectionResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<CsvFileInfo | null>(null);
  const [mappings, setMappings] = useState<BatchRawMappingsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inspectFolder = useCallback(async () => {
    if (!folderPath.trim()) return;
    setError(null);
    setInspection(null);
    setSelectedFile(null);
    setMappings(null);

    const result = await callTool("talend_datasets_inspect_csv_folder", { folderPath });
    if (result.ok) {
      const data = result.data as any;
      if (data?.ok) {
        setInspection(data.data);
        setStep("files");
      } else {
        setError(data?.error?.message || "Inspección falló");
      }
    } else {
      setError(result.error || "Error al llamar a la herramienta");
    }
  }, [folderPath, callTool]);

  const selectFile = useCallback((file: CsvFileInfo) => {
    setSelectedFile(file);
    setStep("columns");
  }, []);

  const generateMappings = useCallback(async () => {
    if (!inspection) return;
    setError(null);

    const result = await callTool("talend_datasets_generate_raw_mappings", {
      folderPath: inspection.folderPath,
      namingStrategy: "snake_case",
      forceStringTypes: true,
      addTechnicalColumns: true,
    });

    if (result.ok) {
      const data = result.data as any;
      if (data?.ok) {
        setMappings(data.data);
        setStep("mappings");
        await updateSession({ datasetMappings: data.data });
      } else {
        setError(data?.error?.message || "Generación de mappings falló");
      }
    } else {
      setError(result.error || "Error al llamar a la herramienta de mappings");
    }
  }, [inspection, callTool]);

  const goBack = useCallback(() => {
    if (step === "mappings") {
      setStep("columns");
      setMappings(null);
    } else if (step === "columns") {
      setStep("files");
      setSelectedFile(null);
    } else if (step === "files") {
      setStep("input");
      setInspection(null);
    }
  }, [step]);

  const sendToPipelineEditor = useCallback(() => {
    if (!mappings || !window.openai) return;
    window.openai.toolOutput = mappings;
  }, [mappings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dataset Inspector</h2>
          <p className="text-gray-500 mt-1">Inspect CSV folders and generate raw mappings</p>
        </div>
        {step !== "input" && (
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Back
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {step === "input" && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inspect CSV Folder</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="/path/to/csv/folder"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => e.key === "Enter" && inspectFolder()}
            />
            <Button variant="primary" onClick={inspectFolder} disabled={isLoading || !folderPath.trim()}>
              {isLoading ? "Inspecting..." : "Inspect"}
            </Button>
          </div>
        </Card>
      )}

      {step === "files" && inspection && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Folder: {inspection.folderPath}</p>
                <p className="text-sm text-gray-500">
                  {inspection.csvFileCount} files, {inspection.totalRows} rows, {inspection.totalColumns} columns
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={generateMappings} disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate Raw Mappings"}
              </Button>
            </div>
          </Card>
          <CsvFilesTable files={inspection.files} onSelectFile={selectFile} />
        </>
      )}

      {step === "columns" && selectedFile && (
        <ColumnsTable file={selectedFile} />
      )}

      {step === "mappings" && mappings && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Mappings generated successfully</p>
              <Button variant="primary" size="sm" onClick={sendToPipelineEditor}>
                Send to Pipeline Spec Editor
              </Button>
            </div>
          </Card>
          <RawMappingsTable mappings={mappings} />
        </>
      )}
    </div>
  );
}
