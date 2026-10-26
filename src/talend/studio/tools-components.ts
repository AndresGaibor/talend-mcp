import { componentCatalogTools } from "./tools-components/catalogo";
import { componentParameterTools } from "./tools-components/parametros";
import { componentLabelTools, componentPositionTools } from "./tools-components/edicion";
import { componentPatchTools } from "./tools-components/parches";
import { componentRenameTools } from "./tools-components/renombrado";

// Orden de registro original: catálogo, parámetros, label, parches, posición y renombrado.
export const componentTools = [
  ...componentCatalogTools,
  ...componentParameterTools,
  ...componentLabelTools,
  ...componentPatchTools,
  ...componentPositionTools,
  ...componentRenameTools,
];
