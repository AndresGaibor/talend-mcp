import { useState, useEffect } from "react";
import { AppHeader, LoadingState, ErrorBanner } from "../../design-system";
import { ComponentList } from "./components/ComponentList";
import { ComponentDetailsPanel } from "./components/ComponentDetailsPanel";
import { ComponentParametersTable } from "./components/ComponentParametersTable";
import { ComponentSchemaTable } from "./components/ComponentSchemaTable";
import { ComponentConnectionsPanel } from "./components/ComponentConnectionsPanel";
import { ComponentEditDrawer } from "./components/ComponentEditDrawer";
import { TMapInspector } from "./components/TMapInspector";
import { useActiveJobDetails, useComponentDetails, useSelectInStudio } from "./hooks";
import type { ComponentParameter } from "./types";

export function JobComponentStudioApp() {
  const { data: jobDetails, fetchJobDetails, isLoading: isJobLoading, error: jobError } = useActiveJobDetails();
  const { data: compDetails, fetchComponentDetails, isLoading: isCompLoading, error: compError, setData: setCompData } = useComponentDetails();
  const { select: selectInStudio, isLoading: isSelecting } = useSelectInStudio();

  const [selectedCompName, setSelectedCompName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"params" | "schema" | "connections" | "mappings" | "raw">("params");
  
  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"parameter" | "label" | "uniqueName">("parameter");
  const [selectedParam, setSelectedParam] = useState<ComponentParameter | null>(null);

  // Load active job details on mount
  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  // Load component details when selected component changes
  useEffect(() => {
    if (selectedCompName) {
      fetchComponentDetails(selectedCompName, true);
    } else {
      setCompData(null);
    }
  }, [selectedCompName, fetchComponentDetails, setCompData]);

  const handleSelectComponent = (uniqueName: string) => {
    setSelectedCompName(uniqueName);
  };

  const handleSelectInStudio = async () => {
    if (selectedCompName) {
      await selectInStudio(selectedCompName);
    }
  };

  const handleEditParam = (name: string, value: string) => {
    setSelectedParam({ name, value });
    setDrawerMode("parameter");
    setIsDrawerOpen(true);
  };

  const handleTriggerRenameLabel = () => {
    setSelectedParam(null);
    setDrawerMode("label");
    setIsDrawerOpen(true);
  };

  const handleTriggerRenameUniqueName = () => {
    setSelectedParam(null);
    setDrawerMode("uniqueName");
    setIsDrawerOpen(true);
  };

  const handleSuccessEdit = async () => {
    // Refresh details after write
    await fetchJobDetails();
    if (selectedCompName) {
      await fetchComponentDetails(selectedCompName, true);
    }
  };

  // Safe checks
  const jobActive = jobDetails?.ok && jobDetails.job?.available;
  const componentsList = jobDetails?.components || [];
  const jobName = jobDetails?.job?.getLabel || jobDetails?.job?.getName || "Desconocido";

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex justify-between items-center flex-shrink-0">
        <AppHeader
          title="Job Component Studio"
          subtitle="Inspecciona, edita y previsualiza componentes del job abierto en Talend Studio"
        />
        <button
          onClick={() => {
            fetchJobDetails();
            if (selectedCompName) fetchComponentDetails(selectedCompName, true);
          }}
          disabled={isJobLoading || isCompLoading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-950 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center space-x-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
          </svg>
          <span>{isJobLoading ? "Refrescando..." : "Refrescar"}</span>
        </button>
      </div>

      {jobError && (
        <ErrorBanner message={`Error al conectar con Studio: ${jobError}`} />
      )}

      {isJobLoading && !jobDetails && (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState message="Conectando con Talend Studio..." />
        </div>
      )}

      {!isJobLoading && !jobActive && (
        <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center flex flex-col items-center justify-center max-w-2xl mx-auto space-y-4">
          <div className="p-4 bg-amber-50 rounded-full text-amber-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">No hay un job abierto en Talend Studio</h3>
          <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
            Asegúrate de que Talend Studio esté iniciado, el plugin Bridge esté activo y tengas un Job de Integración abierto en el editor de diseño.
          </p>
          <button
            onClick={() => fetchJobDetails()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            Reintentar Conexión
          </button>
        </div>
      )}

      {jobActive && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 overflow-hidden">
          {/* Left panel - components list */}
          <div className="lg:col-span-1 h-full min-h-0">
            <ComponentList
              components={componentsList}
              selectedName={selectedCompName}
              onSelect={handleSelectComponent}
            />
          </div>

          {/* Right panel - component details & inspection tabs */}
          <div className="lg:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {!selectedCompName ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Selecciona un componente</h3>
                <p className="text-xs text-gray-400 max-w-xs">
                  Haz clic en cualquier componente de la barra lateral para inspeccionar sus propiedades, esquemas, y conexiones.
                </p>
              </div>
            ) : isCompLoading && !compDetails ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingState message="Cargando propiedades del componente..." />
              </div>
            ) : compError ? (
              <div className="p-6">
                <ErrorBanner message={`Error al cargar componente: ${compError}`} />
              </div>
            ) : compDetails ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Details Header */}
                <div className="p-6 border-b border-gray-100 flex-shrink-0 bg-gray-50/10">
                  <ComponentDetailsPanel
                    details={compDetails}
                    onSelectInStudio={handleSelectInStudio}
                    onRenameLabel={handleTriggerRenameLabel}
                    onRenameUniqueName={handleTriggerRenameUniqueName}
                    isSelecting={isSelecting}
                  />
                </div>

                {/* Tabs selection */}
                <div className="flex px-6 border-b border-gray-100 bg-white flex-shrink-0">
                  {(() => {
                    const tabs = ["params", "schema", "connections"] as string[];
                    if (compDetails.component.componentName === "tMap" && (compDetails.component as any).tMapData) {
                      tabs.push("mappings");
                    }
                    tabs.push("raw");
                    
                    return tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`py-3.5 px-4 text-xs font-semibold border-b-2 transition-all relative -mb-[2px] ${
                          activeTab === tab
                            ? "border-blue-600 text-blue-600 font-bold"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {tab === "params" && "Parámetros"}
                        {tab === "schema" && "Schemas"}
                        {tab === "connections" && "Conexiones"}
                        {tab === "mappings" && "Mapeos (tMap)"}
                        {tab === "raw" && "Modo Avanzado (JSON)"}
                      </button>
                    ));
                  })()}
                </div>

                {/* Tab content panel */}
                <div className="flex-1 p-6 overflow-y-auto min-h-0 bg-gray-50/30">
                  {activeTab === "params" && (
                    <ComponentParametersTable
                      parameters={compDetails.component.parameters}
                      onEditParam={handleEditParam}
                    />
                  )}
                  {activeTab === "schema" && (
                    <ComponentSchemaTable schemas={compDetails.component.schemas} />
                  )}
                  {activeTab === "connections" && (
                    <ComponentConnectionsPanel
                      incoming={compDetails.component.incomingConnections}
                      outgoing={compDetails.component.outgoingConnections}
                      onSelectComponent={handleSelectComponent}
                    />
                  )}
                  {activeTab === "mappings" && (compDetails.component as any).tMapData && (
                    <TMapInspector tMapData={(compDetails.component as any).tMapData} />
                  )}
                  {activeTab === "raw" && (
                    <div className="bg-gray-900 text-gray-100 p-6 rounded-2xl shadow-inner font-mono text-[11px] overflow-auto max-h-[400px]">
                      <pre>{JSON.stringify(compDetails.component, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Slide drawer for edit / rename */}
      <ComponentEditDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        jobName={jobName}
        folderPath={jobDetails?.job?.class ? undefined : undefined} // Not needed for active job
        uniqueName={selectedCompName || ""}
        parameterToEdit={selectedParam}
        mode={drawerMode}
        onSuccess={handleSuccessEdit}
      />
    </div>
  );
}
