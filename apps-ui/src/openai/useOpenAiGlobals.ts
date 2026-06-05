import { useState, useEffect, useCallback } from "react";
import { setGlobals } from "./openai-client";
import type { OpenAiGlobals } from "./openai-types";

function getDocumentContent(): string {
  return document.body?.innerText || "";
}

function getCursorPosition(): string {
  const selection = window.getSelection();
  return selection?.toString() || "";
}

function getSelection(): string {
  const selection = window.getSelection();
  return selection?.toString() || "";
}

async function getClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

export function useOpenAiGlobals() {
  const [globals, setGlobalsState] = useState<OpenAiGlobals | null>(null);

  const refreshGlobals = useCallback(async () => {
    const newGlobals: OpenAiGlobals = {
      document: getDocumentContent(),
      cursor: getCursorPosition(),
      selection: getSelection(),
      clipboard: await getClipboard(),
    };
    setGlobalsState(newGlobals);
    setGlobals(newGlobals);
    return newGlobals;
  }, []);

  useEffect(() => {
    refreshGlobals();

    const handleSelectionChange = () => {
      refreshGlobals();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [refreshGlobals]);

  return { globals, refreshGlobals };
}