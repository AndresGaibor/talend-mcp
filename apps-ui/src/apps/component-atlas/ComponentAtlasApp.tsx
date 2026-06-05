import { useEffect } from "react";
import { AppHeader, LoadingState, ErrorBanner } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { useCatalogStatus, useComponentSearch } from "./hooks";

export function ComponentAtlasApp() {
  const {
    catalogStatus,
    totalComponents,
    families,
    components,
    isLoading,
    error,
    fetchCatalogStatus,
    scanCatalog,
    rebuildCatalog,
  } = useCatalogStatus();

  const {
    searchQuery,
    setSearchQuery,
    selectedFamily,
    setSelectedFamily,
    filteredComponents,
    familyCounts,
  } = useComponentSearch(components);

  useEffect(() => {
    fetchCatalogStatus();
  }, [fetchCatalogStatus]);

  if (isLoading && catalogStatus === "empty") {
    return (
      <div className="space-y-6">
        <AppHeader
          title="Component Atlas"
          subtitle="Explora todos los componentes aprendidos y sus familias"
        />
        <LoadingState message="Cargando atlas de componentes..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Component Atlas"
        subtitle="Explora todos los componentes aprendidos y sus familias"
      />

      {error && <ErrorBanner message={error} onDismiss={() => {}} />}

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Buscar componente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-gray-200 rounded-lg px-4 py-2.5 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Button
          variant="primary"
          onClick={() => scanCatalog()}
          disabled={catalogStatus === "scanning"}
        >
          {catalogStatus === "scanning" ? "Escaneando..." : "Scan"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => rebuildCatalog()}
          disabled={catalogStatus === "scanning"}
        >
          Rebuild
        </Button>
      </div>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Componentes aprendidos: {totalComponents}
            </h2>
          </div>

          {catalogStatus === "empty" && (
            <Card className="p-8 text-center">
              <p className="text-gray-500 mb-4">
                No hay componentes en el atlas. Ejecuta un scan para comenzar.
              </p>
              <Button variant="primary" onClick={() => scanCatalog()}>
                Escanear componentes
              </Button>
            </Card>
          )}

          {catalogStatus === "ready" && filteredComponents.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-gray-500">No se encontraron componentes</p>
            </Card>
          )}

          {catalogStatus === "ready" && filteredComponents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredComponents.map((comp) => (
                <Card key={comp.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{comp.name}</h3>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {comp.family}
                      </span>
                    </div>
                    {comp.version && (
                      <span className="text-xs text-gray-400">v{comp.version}</span>
                    )}
                  </div>
                  {comp.description && (
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {comp.description}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="w-64 flex-shrink-0">
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">Familias</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedFamily(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFamily === null
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "hover:bg-gray-50 text-gray-600"
                }`}
              >
                Todas ({totalComponents})
              </button>
              {families.map((family) => (
                <button
                  key={family}
                  onClick={() => setSelectedFamily(family)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center ${
                    selectedFamily === family
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "hover:bg-gray-50 text-gray-600"
                  }`}
                >
                  <span className="truncate">{family}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {familyCounts[family] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}