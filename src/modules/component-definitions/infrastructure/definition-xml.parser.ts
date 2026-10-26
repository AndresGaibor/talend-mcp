/**
 * Fachada del lector de la definición XML de un componente
 * (`<nombre>_java.xml`).
 *
 * El XML de Talend es la fuente autoritativa de lo que un componente exige:
 * qué parámetros son obligatorios (`REQUIRED`), con qué valor por defecto
 * (`<DEFAULT>`), cuándo se ven (`SHOW_IF`, `NOT_SHOW_IF`), qué conexiones
 * admite (`<CONNECTORS>`) y qué artefactos necesita (`<IMPORTS>`).
 *
 * El parseo vive en `definition-xml/`: parámetros y tablas, conectores,
 * imports y returns, y el orquestador `parseDefinitionXml`.
 */

export { parseDefinitionXml } from "./definition-xml/parse-definition";
export type { ParseContext } from "./definition-xml/parse-definition";
