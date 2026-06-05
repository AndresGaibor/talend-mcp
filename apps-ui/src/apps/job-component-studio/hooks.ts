import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import type { ActiveJobDetails, ActiveComponentDetails } from "./types";

export function useActiveJobDetails() {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [data, setData] = useState<ActiveJobDetails | null>(null);

  const fetchJobDetails = useCallback(async () => {
    const res = await callTool("talend_bridge_active_job_details", {});
    if (res.ok && res.data) {
      setData(res.data as ActiveJobDetails);
    }
    return res;
  }, [callTool]);

  return { data, fetchJobDetails, isLoading, error };
}

export function useComponentDetails() {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [data, setData] = useState<ActiveComponentDetails | null>(null);

  const fetchComponentDetails = useCallback(async (uniqueName: string, includeRaw = false) => {
    const res = await callTool("talend_bridge_active_component_details", { uniqueName, includeRaw });
    if (res.ok && res.data) {
      setData(res.data as ActiveComponentDetails);
    }
    return res;
  }, [callTool]);

  return { data, fetchComponentDetails, isLoading, error, setData };
}

export function useSelectInStudio() {
  const { execute: callTool, isLoading, error } = useCallTool();

  const select = useCallback(async (uniqueName: string) => {
    const res = await callTool("talend_bridge_select_component", { uniqueName });
    // Also focus the properties sheet
    if (res.ok) {
      await callTool("talend_bridge_show_view", { viewId: "org.eclipse.ui.views.PropertySheet" });
    }
    return res;
  }, [callTool]);

  return { select, isLoading, error };
}

export function useRenameLabel() {
  const { execute: callTool, isLoading, error } = useCallTool();

  const rename = useCallback(async (jobName: string, folderPath: string | undefined, uniqueName: string, newLabel: string) => {
    return await callTool("talend_components_rename_label", { jobName, folderPath, uniqueName, newLabel });
  }, [callTool]);

  return { rename, isLoading, error };
}

export function useComponentPatch() {
  const { execute: callTool, isLoading, error } = useCallTool();

  const previewPatch = useCallback(async (jobName: string, folderPath: string | undefined, uniqueName: string, patch: Record<string, string>) => {
    return await callTool("talend_components_preview_patch", { jobName, folderPath, uniqueName, patch });
  }, [callTool]);

  const applyPatch = useCallback(async (jobName: string, folderPath: string | undefined, uniqueName: string, patch: Record<string, string>) => {
    return await callTool("talend_components_apply_patch", { jobName, folderPath, uniqueName, patch });
  }, [callTool]);

  return { previewPatch, applyPatch, isLoading, error };
}

export function useRenameUniqueName() {
  const { execute: callTool, isLoading, error } = useCallTool();

  const previewRename = useCallback(async (jobName: string, folderPath: string | undefined, oldUniqueName: string, newUniqueName: string) => {
    return await callTool("talend_components_rename_unique_name_preview", { jobName, folderPath, oldUniqueName, newUniqueName });
  }, [callTool]);

  const applyRename = useCallback(async (jobName: string, folderPath: string | undefined, oldUniqueName: string, newUniqueName: string, confirmationToken: string) => {
    return await callTool("talend_components_rename_unique_name_apply", { jobName, folderPath, oldUniqueName, newUniqueName, confirmationToken });
  }, [callTool]);

  return { previewRename, applyRename, isLoading, error };
}

export function useUpdatePosition() {
  const { execute: callTool, isLoading, error } = useCallTool();

  const updatePosition = useCallback(async (jobName: string, folderPath: string | undefined, uniqueName: string, posX: number, posY: number) => {
    return await callTool("talend_components_update_position", { jobName, folderPath, uniqueName, posX, posY });
  }, [callTool]);

  return { updatePosition, isLoading, error };
}
