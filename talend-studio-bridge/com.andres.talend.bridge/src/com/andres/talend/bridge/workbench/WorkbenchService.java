package com.andres.talend.bridge.workbench;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.resources.WorkspaceService;
import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.Path;
import org.eclipse.core.runtime.Platform;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IEditorDescriptor;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorReference;
import org.eclipse.ui.IViewReference;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PlatformUI;
import org.osgi.framework.Bundle;

public final class WorkbenchService {
  private WorkbenchService() {}

  public static Map<String, Object> state() {
    List<Map<String, Object>> windows = new ArrayList<>();
    for (IWorkbenchWindow window : PlatformUI.getWorkbench().getWorkbenchWindows()) {
      Map<String, Object> windowPayload = new LinkedHashMap<>();
      Shell shell = window.getShell();
      IWorkbenchPage page = window.getActivePage();
      windowPayload.put("shellTitle", shell != null ? shell.getText() : "");
      windowPayload.put("activePage", page != null);
      if (page != null && page.getPerspective() != null) {
        Map<String, Object> perspective = new LinkedHashMap<>();
        perspective.put("id", page.getPerspective().getId());
        perspective.put("label", page.getPerspective().getLabel());
        windowPayload.put("perspective", perspective);
      } else {
        windowPayload.put("perspective", null);
      }
      windowPayload.put("activeEditor", page != null && page.getActiveEditor() != null ? editor(page.getActiveEditor()) : null);
      windowPayload.put("openEditors", page != null ? editors(page.getEditorReferences()) : Collections.<Map<String, Object>>emptyList());
      windowPayload.put("visibleViews", page != null ? views(page.getViewReferences()) : Collections.<Map<String, Object>>emptyList());
      windowPayload.put("dirtyEditors", page != null ? dirtyEditors(page.getDirtyEditors()) : Collections.<Map<String, Object>>emptyList());
      windows.add(windowPayload);
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/workbench/state");
    payload.put("windows", windows);
    return payload;
  }

  public static Map<String, Object> selection() {
    IWorkbenchWindow window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
    ISelection selection = window != null ? window.getSelectionService().getSelection() : null;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/workbench/selection");
    payload.put("selectionClass", selection != null ? selection.getClass().getName() : null);
    payload.put("selectionText", selection != null ? selection.toString() : null);
    payload.put("structuredSelection", structuredSelection(selection));
    return payload;
  }

  public static Map<String, Object> views() {
    List<Map<String, Object>> visibleViews = new ArrayList<>();
    for (IWorkbenchWindow window : PlatformUI.getWorkbench().getWorkbenchWindows()) {
      IWorkbenchPage page = window.getActivePage();
      if (page == null) continue;
      for (IViewReference view : page.getViewReferences()) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", view.getId());
        item.put("title", view.getTitle());
        item.put("visible", true);
        visibleViews.add(item);
      }
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/workbench/views");
    payload.put("views", visibleViews);
    return payload;
  }

  public static Map<String, Object> saveActiveEditor() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/save-active");

    IWorkbenchPage page = activePage();
    if (page == null || page.getActiveEditor() == null) {
      payload.put("ok", false);
      payload.put("saved", false);
      payload.put("error", error("NO_ACTIVE_EDITOR", "No hay editor activo"));
      return payload;
    }

    IEditorPart editor = page.getActiveEditor();

    // Ojo con `isDirty`: ese indicador mira el estado de la UI (paginas y
    // command stack de GEF), no el estado real del modelo de Talend, que es
    // `process.isProcessModified()`. Un job modificado por la API queda con el
    // editor limpio, asi que comprobar `dirty` hacia que el guardado no
    // ocurriera nunca. Se pregunta al proceso.
    if (!editor.isDirty() && !isProcessModified(editor)) {
      payload.put("saved", false);
      payload.put("message", "Editor no está dirty, no se necesita guardar");
      return payload;
    }

    try {
      editor.doSave(new org.eclipse.core.runtime.NullProgressMonitor());
      payload.put("saved", true);
      payload.put("editorTitle", editor.getTitle());
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("saved", false);
      payload.put("error", error("SAVE_FAILED", e.getMessage()));
    }
    return payload;
  }

  /**
   * Indica si el proceso del editor tiene cambios pendientes.
   *
   * Es el estado real del modelo de Talend, a diferencia de `isDirty` del
   * editor, que solo refleja el estado de la interfaz.
   */
  public static boolean isProcessModified(IEditorPart editor) {
    try {
      Object designer = editor.getClass().getMethod("getDesignerEditor").invoke(editor);
      if (designer == null) {
        return false;
      }
      Object process = designer.getClass().getMethod("getProcess").invoke(designer);
      if (process == null) {
        return false;
      }
      Object modified = process.getClass().getMethod("isProcessModified").invoke(process);
      return Boolean.TRUE.equals(modified);
    } catch (Exception e) {
      return false;
    }
  }

  public static Map<String, Object> saveAllEditors() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/save-all");

    IWorkbenchPage page = activePage();
    if (page == null) {
      payload.put("ok", false);
      payload.put("saved", 0);
      payload.put("error", error("NO_ACTIVE_PAGE", "No hay página activa"));
      return payload;
    }

    int savedCount = 0;
    for (IEditorPart editor : page.getDirtyEditors()) {
      try {
        editor.doSave(new org.eclipse.core.runtime.NullProgressMonitor());
        savedCount++;
      } catch (Exception ignored) {
      }
    }

    payload.put("saved", savedCount);
    return payload;
  }

  public static Map<String, Object> closeActiveEditor() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/close-editor");

    IWorkbenchPage page = activePage();
    if (page == null || page.getActiveEditor() == null) {
      payload.put("ok", false);
      payload.put("closed", false);
      payload.put("error", error("NO_ACTIVE_EDITOR", "No hay editor activo"));
      return payload;
    }

    IEditorPart editor = page.getActiveEditor();
    try {
      page.closeEditor(editor, true);
      payload.put("closed", true);
      payload.put("editorTitle", editor.getTitle());
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("closed", false);
      payload.put("error", error("CLOSE_FAILED", e.getMessage()));
    }
    return payload;
  }

  public static Map<String, Object> activateEditor(String title) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/activate-editor");

    IWorkbenchPage page = activePage();
    if (page == null) {
      payload.put("ok", false);
      payload.put("error", error("NO_ACTIVE_PAGE", "No hay página activa"));
      return payload;
    }

    for (IEditorReference ref : page.getEditorReferences()) {
      if (title.equals(ref.getTitle())) {
        try {
          page.activate(ref.getPart(true));
          payload.put("activated", true);
          payload.put("editorTitle", title);
          return payload;
        } catch (Exception e) {
          payload.put("ok", false);
          payload.put("error", error("ACTIVATE_FAILED", e.getMessage()));
          return payload;
        }
      }
    }

    payload.put("ok", false);
    payload.put("error", error("EDITOR_NOT_FOUND", "No se encontró editor con título: " + title));
    return payload;
  }

  public static Map<String, Object> closeEditor(String title, boolean save) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/close-editor");

    IWorkbenchPage page = activePage();
    if (page == null) {
      payload.put("ok", false);
      payload.put("error", error("NO_ACTIVE_PAGE", "No hay página activa"));
      return payload;
    }

    for (IEditorReference ref : page.getEditorReferences()) {
      if (title.equals(ref.getTitle()) || (title.contains("*") && ref.getTitle().contains(title.replace("*", "")))) {
        try {
          IEditorPart editor = ref.getEditor(true);
          if (editor != null) {
            page.closeEditor(editor, save);
            payload.put("closed", true);
            payload.put("editorTitle", ref.getTitle());
            return payload;
          }
        } catch (Exception e) {
          payload.put("ok", false);
          payload.put("error", error("CLOSE_FAILED", e.getMessage()));
          return payload;
        }
      }
    }

    payload.put("ok", false);
    payload.put("error", error("EDITOR_NOT_FOUND", "No se encontró editor con título: " + title));
    return payload;
  }

  public static Map<String, Object> findEditor(String titleContains) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/find-editor");

    IWorkbenchPage page = activePage();
    if (page == null) {
      payload.put("ok", false);
      payload.put("error", error("NO_ACTIVE_PAGE", "No hay página activa"));
      return payload;
    }

    List<Map<String, Object>> found = new ArrayList<>();
    for (IEditorReference ref : page.getEditorReferences()) {
      if (ref.getTitle().contains(titleContains)) {
        found.add(editorReference(ref));
      }
    }

    payload.put("editors", found);
    payload.put("count", found.size());
    return payload;
  }

  public static Map<String, Object> showView(String viewId) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/show-view");

    try {
      IWorkbenchPage page = activePage();
      if (page != null) {
        page.showView(viewId);
        payload.put("shown", true);
        payload.put("viewId", viewId);
        return payload;
      }
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("error", error("SHOW_VIEW_FAILED", e.getMessage()));
      return payload;
    }

    payload.put("ok", false);
    payload.put("error", error("NO_ACTIVE_PAGE", "No hay página activa"));
    return payload;
  }

  /**
   * Refresca en disco el ancestro mas cercano que el workspace ya conoce.
   *
   * Sirve para que Eclipse descubra carpetas y archivos creados por fuera
   * (por ejemplo un job generado por el MCP) sin tener que reiniciar.
   */
  private static void refreshClosestAncestor(IWorkspaceRoot root, String absolutePath) {
    org.eclipse.core.runtime.IPath current = Path.fromOSString(absolutePath).removeLastSegments(1);
    while (current != null && current.segmentCount() > 0) {
      try {
        IContainer container = root.getContainerForLocation(current);
        if (container != null && container.exists()) {
          container.refreshLocal(org.eclipse.core.resources.IResource.DEPTH_INFINITE, null);
          return;
        }
      } catch (Exception e) {
        // Se sigue hacia arriba.
      }
      current = current.removeLastSegments(1);
    }
  }

  public static Map<String, Object> openResource(String absolutePath) {    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("source", "studio-bridge");
    payload.put("endpoint", "/workbench/open-resource");
    payload.put("path", absolutePath);

    if (absolutePath == null || absolutePath.trim().isEmpty()) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      payload.put("error", error("INVALID_PATH", "path vacío"));
      return payload;
    }

    IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();

    // Un archivo creado fuera de Studio no esta en el arbol de recursos: hay que
    // refrescar el ancestro mas cercano que Eclipse ya conoce para que lo descubra.
    refreshClosestAncestor(root, absolutePath);

    IFile file = root.getFileForLocation(Path.fromOSString(absolutePath));
    if (file == null || !file.exists()) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      payload.put("error", error("RESOURCE_NOT_FOUND", "No se encontró el recurso en el workspace"));
      return payload;
    }

    try {
      file.getParent().refreshLocal(org.eclipse.core.resources.IResource.DEPTH_ONE, null);
    } catch (Exception e) {
    }

    // Studio puede tener una version anterior del `.item` en su modelo EMF:
    // el MCP escribe los jobs por fuera del IDE. Sin recargar el item, el
    // editor abre el schema viejo y el job se ejecuta con el schema viejo.
    // Ver docs/TALEND-STUDIO-INTERNALS.md, seccion 7.
    Map<String, Object> reload = WorkspaceService.reloadItemFromDisk(absolutePath);
    payload.put("itemReloaded", reload.get("reloaded"));

    try {
      IWorkbenchPage page = activePage();
      if (page == null) {
        payload.put("ok", false);
        payload.put("confidence", "low");
        payload.put("error", error("NO_ACTIVE_PAGE", "No hay una página activa en el workbench"));
        return payload;
      }

      IEditorPart editor = openEditor(page, file);
      payload.put("opened", editor != null);
      payload.put("editorTitle", editor != null ? editor.getTitle() : null);
      return payload;
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      payload.put("error", error("OPEN_FAILED", e.getMessage()));
      return payload;
    }
  }

  private static List<Map<String, Object>> editors(IEditorReference[] references) {
    List<Map<String, Object>> editors = new ArrayList<>();
    for (IEditorReference reference : references) {
      editors.add(editorReference(reference));
    }
    return editors;
  }

  private static Map<String, Object> editorReference(IEditorReference reference) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("title", reference.getTitle());
    item.put("id", reference.getId());
    item.put("dirty", reference.isDirty());
    item.put("tooltip", reference.getTitleToolTip());
    return item;
  }

  private static List<Map<String, Object>> views(IViewReference[] references) {
    List<Map<String, Object>> views = new ArrayList<>();
    for (IViewReference reference : references) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("id", reference.getId());
      item.put("title", reference.getTitle());
      item.put("visible", true);
      views.add(item);
    }
    return views;
  }

  private static List<Map<String, Object>> dirtyEditors(IEditorPart[] editors) {
    List<Map<String, Object>> dirty = new ArrayList<>();
    for (IEditorPart editor : editors) {
      dirty.add(editor(editor));
    }
    return dirty;
  }

  private static Map<String, Object> editor(IEditorPart editor) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("title", editor.getTitle());
    item.put("name", editor.getTitle());
    item.put("id", editor.getSite() != null ? editor.getSite().getId() : editor.getClass().getName());
    item.put("dirty", editor.isDirty());
    item.put("tooltip", editor.getTitleToolTip());
    item.put("class", editor.getClass().getName());
    return item;
  }

  private static List<String> structuredSelection(ISelection selection) {
    if (!(selection instanceof IStructuredSelection)) {
      return Collections.emptyList();
    }

    List<String> items = new ArrayList<>();
    for (Object item : ((IStructuredSelection) selection).toList()) {
      items.add(String.valueOf(item));
    }
    return items;
  }

  private static Map<String, Object> error(String code, String message) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("code", code);
    payload.put("message", message);
    return payload;
  }

  public static IWorkbenchPage activePageOrNull() {
    return activePage();
  }

  /** Editor activo, o null si no hay ninguno. */
  public static IEditorPart activeEditorPart() {
    IWorkbenchPage page = activePage();
    return page != null ? page.getActiveEditor() : null;
  }

  private static IWorkbenchPage activePage() {
    IWorkbenchWindow window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
    if (window != null && window.getActivePage() != null) {
      return window.getActivePage();
    }

    for (IWorkbenchWindow candidate : PlatformUI.getWorkbench().getWorkbenchWindows()) {
      if (candidate != null && candidate.getActivePage() != null) {
        return candidate.getActivePage();
      }
    }

    return null;
  }

  private static IEditorPart openEditor(IWorkbenchPage page, IFile file) throws Exception {
    return TalendJobEditorOpener.openEditor(page, file);
  }
}
