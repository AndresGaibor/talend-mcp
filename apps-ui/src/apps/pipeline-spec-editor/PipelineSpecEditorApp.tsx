import { useState, useCallback, useEffect } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { PatternSelector } from "./PatternSelector";
import { SpecEditor } from "./SpecEditor";
import { PipelinePreview } from "./PipelinePreview";
import { ApplySpecPanel } from "./ApplySpecPanel";

type Step = "select" | "edit" | "preview" | "apply";

export interface Pattern {
  id: string;
  name: string;
  description: string;
}

export interface PipelineSpec {
  name?: string;
  description?: string;
  components?: unknown[];
  connections?: unknown[];
  [key: string]: unknown;
}

export function PipelineSpecEditorApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [step, setStep] = useState<Step>("select");
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);
  const [specDraft, setSpecDraft] = useState<PipelineSpec>({});
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [sessionMappings, setSessionMappings] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const loadPatterns = useCallback(async () => {
    const result = await callTool("talend_jobs_list_patterns", {});
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setPatterns(Array.isArray(data) ? data : []);
      } catch {
        setPatterns([]);
      }
    }
  }, [callTool]);

  const loadSessionMappings = useCallback(async () => {
    const result = await callTool("talend_sessions_get", { key: "pipeline_mappings" });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        if (data && typeof data === "object") {
          setSessionMappings(data as Record<string, unknown>);
        }
      } catch {
        setSessionMappings(null);
      }
    }
  }, [callTool]);

  useEffect(() => {
    loadPatterns();
    loadSessionMappings();
  }, [loadPatterns, loadSessionMappings]);

  const handleSelectPattern = useCallback((pattern: Pattern) => {
    setSelectedPattern(pattern);
    setSpecDraft({
      name: pattern.name,
      description: pattern.description,
      patternId: pattern.id,
    });
    setStep("edit");
  }, []);

  const handleEditSpec = useCallback((spec: PipelineSpec) => {
    setSpecDraft(spec);
  }, []);

  const handleValidate = useCallback(async () => {
    setError(null);
    const result = await callTool("talend_jobs_validate_pipeline_spec", { spec: JSON.stringify(specDraft) });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setValidationResult({
          valid: data.valid ?? false,
          errors: data.errors ?? [],
        });
      } catch {
        setValidationResult({ valid: false, errors: ["Failed to parse validation result"] });
      }
    } else {
      setValidationResult({ valid: false, errors: [result.error ?? "Validation failed"] });
    }
  }, [callTool, specDraft]);

  const handlePreview = useCallback(async () => {
    setError(null);
    const result = await callTool("talend_jobs_preview_pipeline_spec", { spec: JSON.stringify(specDraft) });
    if (result.success && result.result) {
      setPreviewResult(result.result);
      setStep("preview");
    } else {
      setError(result.error ?? "Preview failed");
    }
  }, [callTool, specDraft]);

  const handleApply = useCallback(async () => {
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }
    setShowConfirmation(false);
    setError(null);
    const result = await callTool("talend_jobs_apply_pipeline_spec", { spec: JSON.stringify(specDraft) });
    if (result.success) {
      const snapshotResult = await callTool("talend_snapshots_create", {
        name: `pipeline-${Date.now()}`,
        description: `Snapshot for ${specDraft.name ?? "pipeline"}`,
      });
      if (!snapshotResult.success) {
        setError("Pipeline applied but snapshot creation failed");
      }
    } else {
      setError(result.error ?? "Apply failed");
    }
  }, [callTool, specDraft, showConfirmation]);

  const handleOpenInStudio = useCallback(async () => {
    const result = await callTool("talend_bridge_open_resource", { path: specDraft.name ?? "" });
    if (!result.success) {
      setError(result.error ?? "Failed to open in Studio");
    }
  }, [callTool, specDraft]);

  const handleBack = useCallback((targetStep: Step) => {
    setStep(targetStep);
    setValidationResult(null);
    setPreviewResult(null);
  }, []);

  const handleCancelConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pipeline Spec Editor</h2>
          <p className="text-gray-500 mt-1">
            {step === "select" && "Select a pattern to get started"}
            {step === "edit" && "Edit the pipeline specification"}
            {step === "preview" && "Preview the pipeline"}
            {step === "apply" && "Apply the pipeline"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={step === "select" ? "default" : "success"}>1. Select</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "edit" ? "default" : step === "select" ? "muted" : "success"}>2. Edit</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "preview" ? "default" : step === "apply" ? "success" : "muted"}>3. Preview</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "apply" ? "default" : "muted"}>4. Apply</Badge>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {step === "select" && (
        <Card className="p-6">
          <PatternSelector
            patterns={patterns}
            onSelect={handleSelectPattern}
            isLoading={isLoading}
            sessionMappings={sessionMappings}
          />
        </Card>
      )}

      {step === "edit" && (
        <div className="space-y-4">
          <Card className="p-6">
            {selectedPattern && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-500">Selected pattern:</span>
                <span className="ml-2 font-medium">{selectedPattern.name}</span>
              </div>
            )}
            <SpecEditor
              spec={specDraft}
              onChange={handleEditSpec}
              onValidate={handleValidate}
              validationResult={validationResult}
              isLoading={isLoading}
            />
          </Card>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => handleBack("select")}>
              Back
            </Button>
            <Button variant="secondary" onClick={handleValidate} disabled={isLoading}>
              Validate
            </Button>
            <Button onClick={handlePreview} disabled={isLoading || !validationResult?.valid}>
              Preview
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && previewResult && (
        <div className="space-y-4">
          <Card className="p-6">
            <PipelinePreview preview={previewResult} />
          </Card>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => handleBack("edit")}>
              Back to Edit
            </Button>
            <Button onClick={handleOpenInStudio} disabled={isLoading}>
              Open in Studio
            </Button>
            <Button variant="danger" onClick={() => setStep("apply")}>
              Continue to Apply
            </Button>
          </div>
        </div>
      )}

      {step === "apply" && (
        <div className="space-y-4">
          <Card className="p-6">
            <ApplySpecPanel
              spec={specDraft}
              onConfirm={handleApply}
              onCancel={() => handleBack("preview")}
              isLoading={isLoading}
              showConfirmation={showConfirmation}
              onCancelConfirmation={handleCancelConfirmation}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
