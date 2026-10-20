package com.andres.talend.bridge.resources;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.Path;

public final class WorkspaceService {
  private WorkspaceService() {}

  public static Map<String, Object> state() {
    IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();
    List<Map<String, Object>> projects = new ArrayList<>();
    for (IProject project : root.getProjects()) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("name", project.getName());
      item.put("open", project.isOpen());
      item.put("location", project.getLocation() != null ? project.getLocation().toString() : null);
      projects.add(item);
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/workspace/state");
    payload.put("workspaceRoot", root.getLocation() != null ? root.getLocation().toString() : null);
    payload.put("projects", projects);
    return payload;
  }

  public static Map<String, Object> refresh() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workspace/refresh");

    try {
      IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();

      // `save` guarda el workspace pero no descubre archivos nuevos en disco:
      // hay que refrescar el arbol de recursos para que aparezcan.
      root.refreshLocal(IResource.DEPTH_INFINITE, null);

      // Talend mantiene su propia cache de procesos: sin limpiarla, un job
      // creado por el MCP sigue sin existir para el motor.
      boolean cacheCleared = clearTalendProcessCache();

      // Limpiar la cache no basta. El modelo EMF del repositorio de Talend
      // sigue teniendo la version anterior del `.item` que escribio el MCP, y
      // el delegate de Talend ejecuta el proceso cargado en el editor. Ver
      // docs/TALEND-STUDIO-INTERNALS.md, seccion 7.
      //
      // La recarga precisa se hace por item, en `reloadItemFromDisk`, que se
      // llama al abrir el recurso.
      payload.put("refreshed", true);
      payload.put("talendCacheCleared", cacheCleared);
      payload.put("message", "Workspace refreshed successfully");
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("refreshed", false);
      payload.put("error", "REFRESH_FAILED: " + e.getMessage());
    }
    return payload;
  }

  /**
   * Forces Talend to reread a job from disk.
   *
   * The MCP writes `.item` files outside Studio. Studio keeps the previous
   * version in its EMF model, so the job would run with the old schema. The
   * delegate of Talend runs the process loaded in the editor, so the reload has
   * to happen before the editor is opened.
   *
   * @param absolutePath path of the `.item` file.
   * @return payload with the `reloaded` flag.
   */
  public static Map<String, Object> reloadItemFromDisk(String absolutePath) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workspace/reload-item");
    payload.put("path", absolutePath);

    try {
      IFile file = ResourcesPlugin.getWorkspace().getRoot().getFileForLocation(Path.fromOSString(absolutePath));
      if (file == null || !file.exists()) {
        payload.put("reloaded", false);
        payload.put("reason", "RESOURCE_NOT_FOUND");
        return payload;
      }

      Object resourceManager = getXmiResourceManager();
      if (resourceManager == null) {
        payload.put("reloaded", false);
        payload.put("reason", "RESOURCE_MANAGER_UNAVAILABLE");
        return payload;
      }

      // `loadProperty` descarga el recurso EMF del item y lo vuelve a leer del
      // disco. Es la via que usa el propio Studio al abrir un job.
      Object property = resourceManager.getClass()
          .getMethod("loadProperty", IResource.class)
          .invoke(resourceManager, file);

      // La cache de procesos es otra cache: hay que limpiarla tambien.
      clearTalendProcessCache();

      payload.put("reloaded", property != null);
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("reloaded", false);
      payload.put("error", "RELOAD_FAILED: " + e.getMessage());
    }
    return payload;
  }

  /**
   * `XmiResourceManager` de Talend, por donde se acceden los recursos EMF.
   *
   * `loadProperty(IResource)` descarga el recurso EMF del item y lo relee del
   * disco. Es lo que hace falta cuando el MCP escribe el `.item` por fuera de
   * Studio.
   */
  private static Object getXmiResourceManager() {
    try {
      org.osgi.framework.Bundle bundle = org.eclipse.core.runtime.Platform.getBundle("org.talend.core.repository");
      if (bundle == null) {
        BridgeLog.warn("No se encontro el bundle org.talend.core.repository");
        return null;
      }
      Class<?> proxyFactory = bundle.loadClass("org.talend.core.repository.model.ProxyRepositoryFactory");
      Object factory = proxyFactory.getMethod("getInstance").invoke(null);
      return proxyFactory.getMethod("getXmiResourceManager").invoke(factory);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo obtener el gestor de recursos de Talend", e);
      return null;
    }
  }

  /**
   * Limpia la cache de procesos de Talend.
   *
   * Se usa reflexion para no atar el bundle a org.talend.core.runtime.
   */
  private static boolean clearTalendProcessCache() {
    try {
      // Se carga desde el bundle de Talend: el classloader del bridge no ve sus
      // clases si no estan importadas.
      org.osgi.framework.Bundle bundle = org.eclipse.core.runtime.Platform.getBundle("org.talend.core.runtime");
      if (bundle == null) {
        BridgeLog.warn("No se encontro el bundle org.talend.core.runtime");
        return false;
      }
      Class<?> cacheManager = bundle.loadClass("org.talend.designer.runprocess.ItemCacheManager");
      java.lang.reflect.Method clearCache = cacheManager.getMethod("clearCache");
      clearCache.invoke(null);
      return true;
    } catch (Exception e) {
      BridgeLog.warn("No se pudo limpiar la cache de procesos de Talend", e);
      return false;
    }
  }
}
