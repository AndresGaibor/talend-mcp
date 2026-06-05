import { useState } from "react";
import { ComponentSearch } from "./ComponentSearch";
import { ComponentDetails } from "./ComponentDetails";
import { ComponentTemplatePanel } from "./ComponentTemplatePanel";
import type { ComponentInfo } from "./types";

export function ComponentCatalogApp() {
  const [selectedComponent, setSelectedComponent] = useState<ComponentInfo | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Component Catalog</h2>
        <p className="text-gray-500 mt-1">
          Busca, inspecciona y genera templates de componentes Talend
        </p>
      </div>

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
