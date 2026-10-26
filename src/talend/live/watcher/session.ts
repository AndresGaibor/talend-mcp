/**
 * Estado del watcher activo.
 *
 * Vive en un modulo aparte porque el estado tiene que ser un unico objeto
 * compartido por arranque, parada y consulta de estado.
 */

export interface WatcherInstance {
  abortController: AbortController;
  projectPath: string;
}

let activeWatcher: WatcherInstance | null = null;

export function getActiveWatcher(): WatcherInstance | null {
  return activeWatcher;
}

export function setActiveWatcher(instance: WatcherInstance): void {
  activeWatcher = instance;
}

export function clearActiveWatcher(): void {
  activeWatcher = null;
}
