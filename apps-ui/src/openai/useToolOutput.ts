import { useState, useEffect, useCallback, useRef } from "react";
import { toolOutput } from "./openai-client";

export function useToolOutput() {
  const [pendingOutputs, setPendingOutputs] = useState<
    Map<string, (output: string) => void>
  >(new Map());
  const pendingOutputsRef = useRef(pendingOutputs);

  useEffect(() => {
    pendingOutputsRef.current = pendingOutputs;
  }, [pendingOutputs]);

  const registerToolOutput = useCallback(
    (toolUseId: string): Promise<string> | undefined => {
      const existing = pendingOutputs.get(toolUseId);
      if (existing) return undefined;

      return new Promise<string>((resolve) => {
        setPendingOutputs((prev) => {
          const next = new Map(prev);
          next.set(toolUseId, resolve);
          return next;
        });
      });
    },
    [pendingOutputs]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).openai?.toolOutput) return;

    const originalToolOutput = (window as any).openai.toolOutput;

    (window as any).openai.toolOutput = (toolUseId: string, output: string) => {
      const resolver = pendingOutputsRef.current.get(toolUseId);
      if (resolver) {
        resolver(output);
        setPendingOutputs((prev) => {
          const next = new Map(prev);
          next.delete(toolUseId);
          return next;
        });
      }
      if (originalToolOutput) {
        originalToolOutput(toolUseId, output);
      }
    };

    return () => {
      if ((window as any).openai) {
        (window as any).openai.toolOutput = originalToolOutput;
      }
    };
  }, []);

  const submitToolOutput = (toolUseId: string, output: string) => {
    toolOutput(toolUseId, output);
  };

  return { registerToolOutput, submitToolOutput };
}