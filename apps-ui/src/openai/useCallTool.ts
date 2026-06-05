import { useState, useCallback } from "react";
import { callTool } from "./openai-client";
import type { ToolResult } from "./openai-types";

interface UseCallToolState {
  isLoading: boolean;
  error: string | null;
  result: ToolResult | null;
}

export function useCallTool() {
  const [state, setState] = useState<UseCallToolState>({
    isLoading: false,
    error: null,
    result: null,
  });

  const execute = useCallback(
    async (
      toolName: string,
      args: Record<string, unknown>
    ): Promise<ToolResult> => {
      setState({ isLoading: true, error: null, result: null });

      try {
        const result = await callTool(toolName, args);
        setState({ isLoading: false, error: null, result });
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setState({ isLoading: false, error: errorMessage, result: null });
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, result: null });
  }, []);

  return { ...state, execute, reset };
}