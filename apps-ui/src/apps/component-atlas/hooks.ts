import { useState, useCallback, useMemo } from "react";
import { useCallTool } from "../../openai/useCallTool";
import type { ComponentAtlasState, AtlasComponentInfo } from "./types";

export function useCatalogStatus() {
  const { execute: callTool, isLoading, error } = useCallTool();
  const [state, setState] = useState<ComponentAtlasState>({
    catalogStatus: "empty",
    totalComponents: 0,
    families: [],
    components: [],
    searchQuery: "",
    selectedFamily: null,
  });

  const fetchCatalogStatus = useCallback(async () => {
    const result = await callTool("talend_components_atlas_status", {});
    if (result.ok && result.data) {
      const data = result.data as {
        catalogStatus?: "empty" | "scanning" | "ready" | "error";
        totalComponents?: number;
        families?: string[];
        components?: AtlasComponentInfo[];
      };
      setState((prev) => ({
        ...prev,
        catalogStatus: data.catalogStatus || prev.catalogStatus,
        totalComponents: data.totalComponents ?? prev.totalComponents,
        families: data.families || prev.families,
        components: data.components || prev.components,
      }));
    }
    return result;
  }, [callTool]);

  const scanCatalog = useCallback(async () => {
    setState((prev) => ({ ...prev, catalogStatus: "scanning" as const }));
    const result = await callTool("talend_components_atlas_scan", {});
    if (result.ok) {
      await fetchCatalogStatus();
    } else {
      setState((prev) => ({ ...prev, catalogStatus: "error" as const }));
    }
    return result;
  }, [callTool, fetchCatalogStatus]);

  const rebuildCatalog = useCallback(async () => {
    setState((prev) => ({ ...prev, catalogStatus: "scanning" as const }));
    const result = await callTool("talend_components_atlas_rebuild", {});
    if (result.ok) {
      await fetchCatalogStatus();
    } else {
      setState((prev) => ({ ...prev, catalogStatus: "error" as const }));
    }
    return result;
  }, [callTool, fetchCatalogStatus]);

  return {
    ...state,
    isLoading,
    error,
    fetchCatalogStatus,
    scanCatalog,
    rebuildCatalog,
  };
}

export function useComponentSearch(components: AtlasComponentInfo[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  const filteredComponents = useMemo(() => {
    let result = components;

    if (selectedFamily) {
      result = result.filter((c) => c.family === selectedFamily);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.family.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [components, searchQuery, selectedFamily]);

  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const comp of components) {
      counts[comp.family] = (counts[comp.family] || 0) + 1;
    }
    return counts;
  }, [components]);

  return {
    searchQuery,
    setSearchQuery,
    selectedFamily,
    setSelectedFamily,
    filteredComponents,
    familyCounts,
  };
}