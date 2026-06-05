import { useState, useCallback } from "react";
import { useCallTool } from "../../openai/useCallTool";
import type {
  SchemaExtractionResult,
  SchemaComparisonResult,
  MappingSuggestionsResult,
  ComponentSchema,
} from "./types";

export function useSchemaExtraction(componentId: string) {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [schema, setSchema] = useState<ComponentSchema | null>(null);

  const extractSchema = useCallback(async () => {
    const res = await callTool("talend_components_extract_schema", {
      componentId,
    });
    if (res.ok && res.data) {
      const data = res.data as SchemaExtractionResult;
      if (data.ok && data.schema) {
        setSchema(data.schema);
      }
    }
    return res;
  }, [componentId, callTool]);

  return { schema, extractSchema, isLoading, error };
}

export function useSchemaComparison(schemaFromId: string, schemaToId: string) {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [comparison, setComparison] = useState<SchemaComparisonResult | null>(null);

  const compareSchemas = useCallback(async () => {
    const res = await callTool("talend_components_compare_schemas", {
      schemaFromId,
      schemaToId,
    });
    if (res.ok && res.data) {
      setComparison(res.data as SchemaComparisonResult);
    }
    return res;
  }, [schemaFromId, schemaToId, callTool]);

  return { comparison, compareSchemas, isLoading, error };
}

export function useMappingSuggestions(schemaFromId: string, schemaToId: string) {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [suggestions, setSuggestions] = useState<MappingSuggestionsResult | null>(null);

  const getSuggestions = useCallback(async () => {
    const res = await callTool("talend_components_get_mapping_suggestions", {
      schemaFromId,
      schemaToId,
    });
    if (res.ok && res.data) {
      setSuggestions(res.data as MappingSuggestionsResult);
    }
    return res;
  }, [schemaFromId, schemaToId, callTool]);

  return { suggestions, getSuggestions, isLoading, error };
}

export function useSelectedComponents() {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [inputSchema, setInputSchema] = useState<ComponentSchema | null>(null);
  const [outputSchema, setOutputSchema] = useState<ComponentSchema | null>(null);

  const fetchSelectedComponents = useCallback(async () => {
    const res = await callTool("talend_bridge_get_selected_components_schemas", {});
    if (res.ok && res.data) {
      const data = res.data as { ok: boolean; inputSchema?: ComponentSchema; outputSchema?: ComponentSchema };
      if (data.ok) {
        setInputSchema(data.inputSchema || null);
        setOutputSchema(data.outputSchema || null);
      }
    }
    return res;
  }, [callTool]);

  return { inputSchema, outputSchema, fetchSelectedComponents, isLoading, error };
}
