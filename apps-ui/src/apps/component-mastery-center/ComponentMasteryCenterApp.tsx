import { useEffect } from "react";
import { AppHeader, LoadingState, ErrorBanner } from "../../design-system";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { useMasteryStatus } from "./hooks";

export function ComponentMasteryCenterApp() {
  const {
    totalComponents,
    masteredCount,
    inProgressCount,
    failedCount,
    isLoading,
    error,
    fetchMasteryStatus,
  } = useMasteryStatus();

  useEffect(() => {
    fetchMasteryStatus();
  }, [fetchMasteryStatus]);

  if (isLoading && totalComponents === 0) {
    return (
      <div className="space-y-6">
        <AppHeader
          title="Component Mastery Center"
          subtitle="Rastrea tu progreso en el dominio de componentes"
        />
        <LoadingState message="Cargando estado de dominio..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Component Mastery Center"
        subtitle="Rastrea tu progreso en el dominio de componentes"
      />

      {error && <ErrorBanner message={error} onDismiss={() => {}} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Dominados
          </h3>
          <p className="text-4xl font-bold text-green-600 mt-2">{masteredCount}</p>
          <p className="text-sm text-gray-400 mt-1">
            {totalComponents > 0 ? Math.round((masteredCount / totalComponents) * 100) : 0}% del total
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            En progreso
          </h3>
          <p className="text-4xl font-bold text-blue-600 mt-2">{inProgressCount}</p>
          <p className="text-sm text-gray-400 mt-1">Aprendiendo actualmente</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Sin aprender
          </h3>
          <p className="text-4xl font-bold text-gray-400 mt-2">
            {totalComponents - masteredCount - inProgressCount}
          </p>
          <p className="text-sm text-gray-400 mt-1">Pendientes por explorar</p>
        </Card>
      </div>

      {failedCount > 0 && (
        <Card className="p-4 border-l-4 border-red-400 bg-red-50">
          <p className="text-red-700">
            <span className="font-bold">{failedCount}</span> componente{failedCount > 1 ? "s" : ""} con fallos. Revisa los detalles para resolver.
          </p>
        </Card>
      )}

      <div className="flex gap-4">
        <Button variant="primary" onClick={() => {}}>
          Learn All
        </Button>
        <Button variant="secondary" onClick={() => {}}>
          Learn Selected
        </Button>
      </div>

      <div className="text-sm text-gray-400">
        Ultima actualizacion: {new Date().toLocaleString()}
      </div>
    </div>
  );
}