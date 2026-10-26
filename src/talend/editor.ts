/**
 * Fachada del editor XML de Talend.
 *
 * Las operaciones viven en `src/talend/editor/` por recurso (componentes,
 * contextos y propiedades); este archivo conserva la API publica que ya
 * consumian las tools y los servicios.
 */

export {
  buildTalendComponentEditPreview,
  patchTalendComponentXml,
  updateTalendComponentParameterXml,
  updateTalendSchemaColumnXml,
} from "./editor/component-edit";

export {
  addTalendConnectionXml,
  buildTalendComponentDeletePreview,
  buildTalendConnectionDeletePreview,
  deleteTalendComponentXml,
  deleteTalendConnectionXml,
  duplicateTalendComponentXml,
  moveTalendComponentXml,
} from "./editor/component-structure";

export {
  buildTalendContextDeletePreview,
  buildTalendContextEditPreview,
  deleteTalendContextParameterXml,
  updateTalendContextParameterXml,
  upsertTalendContextParameterXml,
} from "./editor/context";

export {
  buildTalendJobPropertiesEditPreview,
  updateTalendJobPropertiesXml,
} from "./editor/properties";
