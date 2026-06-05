import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { CausePanel } from "./CausePanel";
import { OptionsPanel, type FixOption } from "./OptionsPanel";
import { DiffPreview } from "./DiffPreview";

type Step = "input" | "cause" | "options" | "preview" | "apply";

export function FixWizardApp() {
  const { execute: callTool, isLoading } = useCallTool();

  const [step, setStep] = useState<Step>("input");
  const [errorInput, setErrorInput] = useState("");
  const [jobId, setJobId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [cause, setCause] = useState<string | null>(null);
  const [options, setOptions] = useState<FixOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<FixOption | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleExplainError = useCallback(async () => {
    if (!errorInput.trim()) return;
    setError(null);
    setCause(null);
    setStep("cause");

    const result = await callTool("talend_errors_explain", { error: errorInput });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setCause(data.cause ?? data.message ?? result.result);
      } catch {
        setCause(result.result);
      }
    } else {
      setCause(result.error ?? "Failed to analyze error");
    }
  }, [callTool, errorInput]);

  const handleGetOptions = useCallback(async () => {
    setError(null);
    setOptions([]);
    setStep("options");

    const result = await callTool("talend_errors_suggest_fix", {
      error: errorInput,
      jobId: jobId || undefined,
      componentId: componentId || undefined,
    });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        if (Array.isArray(data)) {
          setOptions(data);
        } else if (data.options && Array.isArray(data.options)) {
          setOptions(data.options);
        } else {
          setOptions([{ id: "default", description: data.description ?? "Recommended fix", confidence: "medium", changes: data.changes ?? {} }]);
        }
      } catch {
        setOptions([{ id: "default", description: result.result, confidence: "medium", changes: {} }]);
      }
    } else {
      setOptions([]);
    }
  }, [callTool, errorInput, jobId, componentId]);

  const handlePreview = useCallback(async () => {
    if (!selectedOption) return;
    setError(null);
    setStep("preview");
    setDiffContent(selectedOption.description + "\n\nChanges:\n" + JSON.stringify(selectedOption.changes, null, 2));
  }, [selectedOption]);

  const handleApply = useCallback(async () => {
    if (!selectedOption) return;

    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setShowConfirmation(false);
    setError(null);
    setStep("apply");

    const snapshotResult = await callTool("talend_snapshots_create", {
      name: `fix-${Date.now()}`,
      description: `Snapshot before applying fix: ${selectedOption.description}`,
    });

    if (!snapshotResult.success || !snapshotResult.result) {
      setError("Cannot apply fix: snapshot creation failed. A snapshot is required before applying any fix.");
      setStep("preview");
      return;
    }

    try {
      const snapshotData = JSON.parse(snapshotResult.result);
      setSnapshotId(snapshotData.id ?? snapshotData.snapshotId ?? snapshotResult.result);
    } catch {
      setSnapshotId(snapshotResult.result ?? "unknown");
    }

    if (jobId && componentId) {
      const patchResult = await callTool("talend_jobs_patch_component", {
        jobId,
        componentId,
        configuration: selectedOption.changes,
      });

      if (!patchResult.success) {
        setError(`Fix applied but revalidation failed: ${patchResult.error}`);
      } else {
        setError(null);
      }
    } else {
      setError("Job ID and Component ID are required to apply the fix");
      setStep("preview");
    }
  }, [callTool, selectedOption, showConfirmation, jobId, componentId]);

  const handleBack = useCallback((targetStep: Step) => {
    setStep(targetStep);
    if (targetStep === "input") {
      setCause(null);
      setOptions([]);
      setSelectedOption(null);
      setDiffContent(null);
      setSnapshotId(null);
    }
    if (targetStep === "cause") {
      setOptions([]);
      setSelectedOption(null);
    }
    if (targetStep === "options") {
      setSelectedOption(null);
      setDiffContent(null);
    }
    setShowConfirmation(false);
  }, []);

  const handleCancelConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  const handleRevalidate = useCallback(async () => {
    setError(null);
    const result = await callTool("talend_errors_explain", { error: errorInput });
    if (result.success && result.result) {
      try {
        const data = JSON.parse(result.result);
        setCause(data.cause ?? data.message ?? result.result);
      } catch {
        setCause(result.result);
      }
    }
    setStep("cause");
  }, [callTool, errorInput]);

  const handleReset = useCallback(() => {
    setStep("input");
    setErrorInput("");
    setJobId("");
    setComponentId("");
    setCause(null);
    setOptions([]);
    setSelectedOption(null);
    setDiffContent(null);
    setSnapshotId(null);
    setError(null);
    setShowConfirmation(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fix Wizard</h2>
          <p className="text-gray-500 mt-1">
            {step === "input" && "Enter the error to analyze"}
            {step === "cause" && "Analyzing probable cause..."}
            {step === "options" && "Select a fix option"}
            {step === "preview" && "Review the changes"}
            {step === "apply" && "Fix applied - revalidate"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={step === "input" ? "default" : "success"}>1. Input</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "cause" ? "default" : step === "input" ? "muted" : "success"}>2. Cause</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "options" ? "default" : ["input", "cause"].includes(step) ? "muted" : "success"}>3. Options</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "preview" ? "default" : ["input", "cause", "options"].includes(step) ? "muted" : "success"}>4. Preview</Badge>
          <span className="text-gray-400">→</span>
          <Badge variant={step === "apply" ? "default" : "muted"}>5. Apply</Badge>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {step === "input" && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Error Message</label>
              <textarea
                value={errorInput}
                onChange={(e) => setErrorInput(e.target.value)}
                placeholder="Paste the error message here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job ID (optional)</label>
                <input
                  type="text"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  placeholder="Job identifier"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Component ID (optional)</label>
                <input
                  type="text"
                  value={componentId}
                  onChange={(e) => setComponentId(e.target.value)}
                  placeholder="Component identifier"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleExplainError} disabled={!errorInput.trim() || isLoading}>
                Analyze Error
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "cause" && (
        <div className="space-y-4">
          <Card className="p-6">
            <CausePanel cause={cause} isLoading={isLoading} />
          </Card>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => handleBack("input")}>
              Back
            </Button>
            <Button onClick={handleGetOptions} disabled={!cause || isLoading}>
              Get Fix Options
            </Button>
          </div>
        </div>
      )}

      {step === "options" && (
        <div className="space-y-4">
          <Card className="p-6">
            <OptionsPanel
              options={options}
              selectedOption={selectedOption}
              onSelect={setSelectedOption}
              isLoading={isLoading}
            />
          </Card>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => handleBack("cause")}>
              Back
            </Button>
            <Button onClick={handlePreview} disabled={!selectedOption || isLoading}>
              Preview Fix
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && selectedOption && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Fix Preview</h3>
            <DiffPreview
              diffContent={diffContent}
              changes={selectedOption.changes}
              isLoading={isLoading}
            />
          </Card>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => handleBack("options")}>
              Back
            </Button>
            <Button variant="danger" onClick={handleApply} disabled={!selectedOption || isLoading}>
              Apply Fix (Requires Snapshot)
            </Button>
          </div>
        </div>
      )}

      {step === "apply" && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center py-6">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-3">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Fix Applied Successfully</h3>
              {snapshotId && (
                <p className="text-sm text-gray-500 mb-4">
                  Snapshot created: {typeof snapshotId === "string" ? snapshotId : JSON.stringify(snapshotId)}
                </p>
              )}
              <p className="text-sm text-gray-500 mb-4">
                The fix has been applied to component {componentId} in job {jobId}.
              </p>
              <p className="text-sm text-amber-600 mb-4">
                Please revalidate the job in Talend Studio to confirm the fix works.
              </p>
            </div>
          </Card>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={handleReset}>
              Start Over
            </Button>
            <Button onClick={handleRevalidate} disabled={isLoading}>
              Revalidate
            </Button>
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Fix Application</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to apply the following fix:
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-800">{selectedOption?.description}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-800">
                <strong>Warning:</strong> A snapshot will be created before applying this fix.
                You can revert to this snapshot if needed.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={handleCancelConfirmation}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleApply}>
                Confirm & Apply
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}