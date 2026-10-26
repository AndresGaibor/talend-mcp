/**
 * Fachada de la instalacion del plugin con el p2 director.
 *
 * Se usa cuando Talend Studio esta cerrado. Tambien limpia restos de intentos
 * anteriores (jars sueltos y repositorios p2 con rutas invalidas) que, sin
 * esto, hacen fallar cada instalacion posterior.
 *
 * La salida y el director viven en `p2-install/context.ts`, las rutas y
 * nombres de p2 en `p2-install/paths.ts`, la limpieza en
 * `p2-install/cleanup.ts`, la preparacion del workspace en
 * `p2-install/workspace.ts` y la instalacion en `p2-install/director.ts`.
 */

export {
  cleanLeftoverJars,
  cleanMalformedP2Repositories,
  cleanStaleP2Repositories,
} from "./p2-install/cleanup";
export { prepareWorkspace } from "./p2-install/workspace";
export {
  installNew,
  installedFeatureVersion,
  uninstallPrevious,
} from "./p2-install/director";
