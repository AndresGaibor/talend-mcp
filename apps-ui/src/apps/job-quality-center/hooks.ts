import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import type { QualityReport, QualityIssue } from "./types";

export function useQualityReport(jobId: string) {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [report, setReport] = useState<QualityReport | null>(null);

  const fetchReport = useCallback(async () => {
    const result = await callTool("talend_job_quality_report", { jobId });
    if (result.ok && result.data) {
      setReport(result.data as QualityReport);
    }
    return result;
  }, [callTool, jobId]);

  return {
    report,
    loading: isLoading,
    error,
    fetchReport,
  };
}

export function useQualityIssues(jobId: string) {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [issues, setIssues] = useState<QualityIssue[]>([]);

  const fetchIssues = useCallback(async () => {
    const result = await callTool("talend_job_quality_issues", { jobId });
    if (result.ok && result.data) {
      setIssues(result.data as QualityIssue[]);
    }
    return result;
  }, [callTool, jobId]);

  return {
    issues,
    loading: isLoading,
    error,
    fetchIssues,
  };
}
