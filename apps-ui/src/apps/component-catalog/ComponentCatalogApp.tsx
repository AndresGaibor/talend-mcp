import { useState, useEffect, useCallback } from "react";
import { AppHeader, ErrorBanner, LoadingState } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { useCallTool } from "../../openai/useCallTool";
import { ComponentSearch } from "./ComponentSearch";
import { ComponentDetails } from "./ComponentDetails";
import { ComponentTemplatePanel } from "./ComponentTemplatePanel";
import type { ComponentInfo } from "./types";

interface CatalogStatus {
  catalogPath: string | null;
  entryCount: number;
  [key: string]: unknown;
}

export function ComponentCatalogApp() {
  const { execute: callTool } = useCallTool();
  const [selectedComponent, setSelectedComponent] = useState<ComponentInfo | null>(null);
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    setStatusError(null);

    const result = await callTool("talend_components_catalog_status", {});
    if (result.ok && result.data) {
      const data = result.data as Record<string, unknown>;
      setStatus({
        catalogPath: (data.catalogPath as string) ?? null,
        entryCount: (data.entryCount as number) ?? 0,
        ...data,
      });
    } else {
      setStatusError(result.error || "Error al verificar el catálogo");
    }

    setIsCheckingStatus(false);
  }, [callTool]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setStatusError(null);

    const result = await callTool("talend_components_scan_installed", {});
    if (result.ok && result.data) {
      await checkStatus();
    } else {
      setStatusError(result.error || "Error al escanear componentes");
    }

    setIsScanning(false);
  }, [callTool, checkStatus]);

  const catalogExists = status !== null && status.catalogPath !== null && status.entryCount > 0;

  if (isCheckingStatus) {
    return (
      <div className="space-y-6">
        <AppHeader
          title="Component Catalog"
          subtitle="Busca, inspecciona y genera templates de componentes Talend"
        />
        <LoadingState message="Verificando catálogo de componentes..." />
      </div>
    );
  }

  if (!catalogExists) {
    return (
      <div className="space-y-6">
        <AppHeader
          title="Component Catalog"
          subtitle="Busca, inspecciona y genera templates de componentes Talend"
        />

        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              No hay catálogo de componentes generado
            </h3>
            <p className="text-gray-500">
              Escanea los componentes instalados para generar el catálogo y poder buscar,
              inspeccionar y generar templates.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={handleScan}
              disabled={isScanning}
            >
              {isScanning ? "Escaneando..." : "Escanear componentes instalados"}
            </Button>
          </div>
        </Card>

        {statusError && (
          <ErrorBanner message={statusError} onDismiss={() => setStatusError(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Component Catalog"
        subtitle="Busca, inspecciona y genera templates de componentes Talend"
      />

      {statusError && (
        <ErrorBanner message={statusError} onDismiss={() => setStatusError(null)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ComponentSearch
            onSelectComponent={setSelectedComponent}
            selectedComponent={selectedComponent}
          />

          {selectedComponent && (
            <ComponentDetails component={selectedComponent} />
          )}
        </div>

        <div>
          <ComponentTemplatePanel component={selectedComponent} />
        </div>
      </div>
    </div>
  );
}
