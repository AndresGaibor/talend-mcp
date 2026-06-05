import { useState } from "react";
import { AppHeader } from "../../design-system";
import { ComponentSearch } from "./ComponentSearch";
import { ComponentDetails } from "./ComponentDetails";
import { ComponentTemplatePanel } from "./ComponentTemplatePanel";
import type { ComponentInfo } from "./types";

export function ComponentCatalogApp() {
  const [selectedComponent, setSelectedComponent] = useState<ComponentInfo | null>(null);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Component Catalog"
        subtitle="Busca, inspecciona y genera templates de componentes Talend"
      />

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
