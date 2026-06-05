import { useState, useCallback, useEffect } from "react";
import { callTool } from "./openai-client";
import { normalizeToolResult } from "./normalize-result";

export interface AppSession {
  id: string;
  datasetMappings?: unknown[];
  pipelineSpec?: unknown;
  validationReport?: unknown;
  lastRunId?: string;
  evidenceFiles?: string[];
  workshopTasks?: unknown[];
  [key: string]: unknown;
}

interface UseAppSessionState {
  session: AppSession | null;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_SESSION_ID = "default";

export function useAppSession(sessionId: string = DEFAULT_SESSION_ID) {
  const [state, setState] = useState<UseAppSessionState>({
    session: null,
    isLoading: false,
    error: null,
  });

  const getSession = useCallback(async (): Promise<AppSession | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const rawResult = await callTool("talend_app_session_get", { sessionId });
      const result = normalizeToolResult<AppSession>(rawResult);
      
      if (result.ok && result.data) {
        setState({ session: result.data, isLoading: false, error: null });
        return result.data;
      }
      
      setState((prev) => ({ ...prev, isLoading: false, error: result.error || "Error getting session" }));
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return null;
    }
  }, [sessionId]);

  const createSession = useCallback(async (): Promise<AppSession | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const rawResult = await callTool("talend_app_session_create", { id: sessionId });
      const result = normalizeToolResult<AppSession>(rawResult);

      if (result.ok && result.data) {
        setState({ session: result.data, isLoading: false, error: null });
        return result.data;
      }
      
      setState((prev) => ({ ...prev, isLoading: false, error: result.error || "Error creating session" }));
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return null;
    }
  }, [sessionId]);

  const updateSession = useCallback(async (updates: Partial<AppSession>): Promise<AppSession | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const rawResult = await callTool("talend_app_session_update", { sessionId, ...updates });
      const result = normalizeToolResult<AppSession>(rawResult);

      if (result.ok && result.data) {
        setState({ session: result.data, isLoading: false, error: null });
        return result.data;
      }
      
      setState((prev) => ({ ...prev, isLoading: false, error: result.error || "Error updating session" }));
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return null;
    }
  }, [sessionId]);

  useEffect(() => {
    getSession();
  }, [getSession]);

  return {
    ...state,
    getSession,
    createSession,
    updateSession,
  };
}