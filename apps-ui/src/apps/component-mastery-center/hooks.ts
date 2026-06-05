import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import type { MasteryStatus, MasteryComponentDetails } from "./types";

export function useMasteryStatus() {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [status, setStatus] = useState<MasteryStatus>({
    totalComponents: 0,
    masteredCount: 0,
    inProgressCount: 0,
    failedCount: 0,
    lastUpdated: "",
  });

  const fetchMasteryStatus = useCallback(async () => {
    const result = await callTool("talend_components_mastery_status", {});
    if (result.ok && result.data) {
      const data = result.data as Partial<MasteryStatus>;
      setStatus((prev) => ({
        ...prev,
        totalComponents: data.totalComponents ?? prev.totalComponents,
        masteredCount: data.masteredCount ?? prev.masteredCount,
        inProgressCount: data.inProgressCount ?? prev.inProgressCount,
        failedCount: data.failedCount ?? prev.failedCount,
        lastUpdated: data.lastUpdated ?? prev.lastUpdated,
      }));
    }
    return result;
  }, [callTool]);

  return {
    ...status,
    isLoading,
    error,
    fetchMasteryStatus,
  };
}

export function useMasteryDetails(componentName: string) {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [details, setDetails] = useState<MasteryComponentDetails | null>(null);

  const fetchDetails = useCallback(async () => {
    const result = await callTool("talend_components_mastery_details", {
      componentName,
    });
    if (result.ok && result.data) {
      setDetails(result.data as MasteryComponentDetails);
    }
    return result;
  }, [callTool, componentName]);

  return {
    details,
    isLoading,
    error,
    fetchDetails,
  };
}