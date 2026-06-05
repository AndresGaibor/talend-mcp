import { useState, useCallback } from "react";
import { callTool } from "./openai-client";
import { normalizeToolResult, type NormalizedResult } from "./normalize-result";

interface UseCallToolState {
  isLoading: boolean;
  error: string | null;
  result: NormalizedResult | null;
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
    ): Promise<NormalizedResult> => {
      setState({ isLoading: true, error: null, result: null });

      try {
        const rawResult = await callTool(toolName, args);
        const result = normalizeToolResult(rawResult);
        
        setState({ 
          isLoading: false, 
          error: result.ok ? null : (result.error || "Error al ejecutar herramienta"), 
          result 
        });
        
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error desconocido";
        const result: NormalizedResult = { ok: false, success: false, error: errorMessage };
        setState({ isLoading: false, error: errorMessage, result });
        return result;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, result: null });
  }, []);

  return { ...state, execute, reset };
}