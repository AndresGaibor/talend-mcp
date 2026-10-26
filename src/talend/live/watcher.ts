/**
 * Fachada del watcher de cambios del proyecto Talend.
 *
 * El estado compartido vive en `watcher/session.ts`, las rutas observables en
 * `watcher/watch-paths.ts`, el bucle de observacion en `watcher/watch-path.ts`
 * y el refresco de metadatos de Studio en `watcher/metadata-refresh.ts`.
 */

export { startTalendWatcher } from "./watcher/start";
export { stopTalendWatcher } from "./watcher/stop";
export { getLiveWatcherStatus } from "./watcher/status";
