package com.andres.talend.bridge.workbench;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

  public static Map<String, Object> openResource(String absolutePath) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/workbench/open-resource");
    payload.put("path", absolutePath);

    if (absolutePath == null || absolutePath.trim().isEmpty()) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      payload.put("error", error("INVALID_PATH", "path vacío"));
      return payload;
    }

    IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();
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
      // Ignorar errores de refresco
    }

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
    if (file.getName().endsWith(".item")) {
      IEditorPart talendEditor = openTalendJobEditor(page, file);
      if (talendEditor != null) {
        return talendEditor;
      }
    }

    IEditorDescriptor descriptor = PlatformUI.getWorkbench().getEditorRegistry().getDefaultEditor(file.getName());
    IEditorInput input = newFileEditorInput(file);
    if (descriptor != null) {
      return page.openEditor(input, descriptor.getId(), true);
    }

    return page.openEditor(input, "org.eclipse.ui.DefaultTextEditor", true);
  }

  private static IEditorPart openTalendJobEditor(IWorkbenchPage page, IFile file) throws Exception {
    Object processItem = resolveProcessItem(file);
    if (processItem == null) {
      throw new IllegalStateException("No se pudo resolver el ProcessItem para " + file.getName()
          + ". Verifique que el job esté en el repositorio Talend activo.");
    }

    IEditorInput input = newProcessEditorInput(processItem, file);
    String editorId = talendMultiPageEditorId();
    return page.openEditor(input, editorId, true);
  }

  private static Object resolveProcessItem(IFile file) throws Exception {
    // Cargar la factory con el classloader correcto del bundle que la contiene
    Bundle repoBundle = Platform.getBundle("org.talend.core.repository");
    if (repoBundle == null) {
      throw new ClassNotFoundException("Bundle org.talend.core.repository no encontrado");
    }
    Class<?> factoryClass = repoBundle.loadClass("org.talend.core.repository.model.ProxyRepositoryFactory");
    Object factory = factoryClass.getMethod("getInstance").invoke(null);

    // ERepositoryObjectType debe cargarse con un classloader compatible con la factory.
    // Usar el classloader de la factory (no Platform.getBundle directo) evita el mismatch de OSGi.
    ClassLoader factoryClassLoader = factory.getClass().getClassLoader();
    Class<?> enumClass = factoryClassLoader.loadClass("org.talend.core.model.repository.ERepositoryObjectType");
    Object processType = enumClass.getField("PROCESS").get(null);

    // Estrategia 1: leer el ID del repositorio desde el archivo .properties hermano del .item
    String itemId = readItemIdFromProperties(file);
    if (itemId != null) {
      Object viewObject = resolveByItemId(factory, factoryClass, itemId, enumClass, processType);
      if (viewObject != null) {
        return extractProcessItemFromViewObject(viewObject);
      }
    }

    // Estrategia 2 (fallback): escanear getAll(PROCESS) y filtrar por label/version
    RepositoryCoordinates coordinates = repositoryCoordinates(file.getName());
    Object viewObject = findProcessViewObjectByLabel(factory, factoryClass, enumClass, processType, coordinates);
    if (viewObject != null) {
      return extractProcessItemFromViewObject(viewObject);
    }

    return null;
  }

  /**
   * Lee el atributo id del elemento TalendProperties:Property en el archivo .properties
   * que está junto al .item. Ese ID es el identificador único del item en el repositorio Talend.
   */
  private static String readItemIdFromProperties(IFile file) {
    try {
      String itemPath = file.getLocation().toOSString();
      String propertiesPath = itemPath.endsWith(".item")
          ? itemPath.substring(0, itemPath.length() - ".item".length()) + ".properties"
          : itemPath + ".properties";
      java.nio.file.Path path = java.nio.file.Paths.get(propertiesPath);
      if (!java.nio.file.Files.exists(path)) {
        return null;
      }
      String xml = new String(java.nio.file.Files.readAllBytes(path), java.nio.charset.StandardCharsets.UTF_8);
      // Buscar el atributo id= dentro de TalendProperties:Property (no el xmi:id, sino id=)
      java.util.regex.Matcher m = java.util.regex.Pattern
          .compile("<TalendProperties:Property[^>]*\\s+id=\"([^\"]+)\"")
          .matcher(xml);
      if (m.find()) {
        return m.group(1);
      }
      return null;
    } catch (Exception e) {
      return null;
    }
  }

  /**
   * Usa getLastVersion(String id, ERepositoryObjectType) para resolver por ID directo.
   * Este método es más eficiente que escanear getAll().
   */
  private static Object resolveByItemId(Object factory, Class<?> factoryClass, String itemId,
      Class<?> enumClass, Object processType) throws Exception {
    try {
      java.lang.reflect.Method getLastVersion = factoryClass.getMethod("getLastVersion", String.class, enumClass);
      return getLastVersion.invoke(factory, itemId, processType);
    } catch (NoSuchMethodException e) {
      // La firma exacta no está disponible; intentar la versión sin tipo
      try {
        java.lang.reflect.Method getLastVersion = factoryClass.getMethod("getLastVersion", String.class);
        return getLastVersion.invoke(factory, itemId);
      } catch (Exception e2) {
        return null;
      }
    } catch (java.lang.reflect.InvocationTargetException e) {
      // PersistenceException u otro error de Talend; tratar como no encontrado
      return null;
    }
  }

  /**
   * Escanea getAll(ERepositoryObjectType.PROCESS) y busca por label y version.
   * Fallback cuando no se puede leer el ID del .properties.
   * La clave es invocar getAll con el enumClass cargado por el classloader de la factory,
   * evitando el NoSuchMethodException por mismatch de tipos OSGi.
   */
  private static Object findProcessViewObjectByLabel(Object factory, Class<?> factoryClass,
      Class<?> enumClass, Object processType, RepositoryCoordinates coordinates) throws Exception {
    java.lang.reflect.Method getAllMethod = null;
    // Buscar el método getAll con un único parámetro del tipo enum correcto
    for (java.lang.reflect.Method m : factoryClass.getMethods()) {
      if ("getAll".equals(m.getName()) && m.getParameterTypes().length == 1
          && m.getParameterTypes()[0].getName().equals(enumClass.getName())) {
        getAllMethod = m;
        break;
      }
    }
    if (getAllMethod == null) {
      return null;
    }

    Object allObjects;
    try {
      allObjects = getAllMethod.invoke(factory, processType);
    } catch (java.lang.reflect.InvocationTargetException e) {
      return null;
    }

    if (!(allObjects instanceof Iterable)) {
      return null;
    }

    Object candidate = null;
    for (Object viewObject : (Iterable<?>) allObjects) {
      String label = String.valueOf(invoke(viewObject, "getLabel"));
      String version = String.valueOf(invoke(viewObject, "getVersion"));
      if (!coordinates.label.equals(label)) {
        continue;
      }
      if (coordinates.version != null && !coordinates.version.equals(version)) {
        continue;
      }
      candidate = viewObject;
      if (coordinates.version != null) {
        return candidate; // coincidencia exacta por label + version
      }
    }

    return candidate;
  }

  /**
   * Extrae el ProcessItem de un IRepositoryViewObject via reflexión.
   * viewObject.getProperty().getItem() debe ser un ProcessItem.
   */
  private static Object extractProcessItemFromViewObject(Object viewObject) throws Exception {
    if (viewObject == null) {
      return null;
    }
    Object property = invoke(viewObject, "getProperty");
    if (property == null) {
      return null;
    }
    Object item = invoke(property, "getItem");
    if (item == null) {
      return null;
    }
    // Verificar que sea un ProcessItem usando el nombre de clase (evita mismatch de classloader)
    if (item.getClass().getName().equals("org.talend.core.model.properties.impl.ProcessItemImpl")
        || item.getClass().getName().endsWith(".ProcessItem")) {
      return item;
    }
    // Recorrer la jerarquía de interfaces para verificar ProcessItem
    for (Class<?> iface : item.getClass().getInterfaces()) {
      if ("org.talend.core.model.properties.ProcessItem".equals(iface.getName())) {
        return item;
      }
    }
    return null;
  }

  private static IEditorInput newProcessEditorInput(Object processItem, IFile itemFile) throws Exception {
    // CRÍTICO: Cargar el .item EMF resource ANTES de construir ProcessEditorInput.
    // Si no se hace, el proxy cross-reference del ProcessItem al contenido del .item
    // no está resuelto → Talend crea un proceso vacío en memoria → sobreescribe el .item original.
    forceLoadProcessContent(processItem, itemFile);

    // Cargar ProcessEditorInput con el classloader de org.talend.designer.core
    Bundle designerBundle = Platform.getBundle("org.talend.designer.core");
    if (designerBundle == null) {
      throw new ClassNotFoundException("Bundle org.talend.designer.core no encontrado");
    }
    Class<?> editorInputClass = designerBundle.loadClass("org.talend.designer.core.ui.editor.ProcessEditorInput");

    // ProcessItem debe cargarse con el mismo classloader que el constructor espera
    // (compatible con el classloader del bundle del editor)
    Class<?> processItemClass = editorInputClass.getClassLoader()
        .loadClass("org.talend.core.model.properties.ProcessItem");

    java.lang.reflect.Constructor<?> constructor = editorInputClass.getConstructor(processItemClass, boolean.class);
    return (IEditorInput) constructor.newInstance(processItem, Boolean.TRUE);
  }

  /**
   * Fuerza la carga del EMF resource del .item y resuelve el proxy cross-reference
   * del ProcessItem al contenido del .item (nodos, conexiones).
   *
   * CRÍTICO: si este método falla, lanza excepción en lugar de silenciar el error.
   * Silenciar el error permite que ProcessEditorInput cree un proceso vacío y lo
   * guarde encima del .item original → destrucción de datos.
   *
   * Usa InternalEObject.eProxyURI() para obtener la URI EXACTA del proxy, garantizando
   * que la URI del resource cargado coincida con la que EMF espera para la resolución.
   */
  private static void forceLoadProcessContent(Object processItem, IFile itemFile) throws Exception {
    ClassLoader cl = processItem.getClass().getClassLoader();

    Class<?> eObjectClass         = cl.loadClass("org.eclipse.emf.ecore.EObject");
    Class<?> internalEObjectClass = cl.loadClass("org.eclipse.emf.ecore.InternalEObject");
    Class<?> resourceClass        = cl.loadClass("org.eclipse.emf.ecore.resource.Resource");
    Class<?> resourceSetClass     = cl.loadClass("org.eclipse.emf.ecore.resource.ResourceSet");
    Class<?> uriClass             = cl.loadClass("org.eclipse.emf.common.util.URI");

    // Paso 1: obtener el campo process del ProcessItem
    Object process = invoke(processItem, "getProcess");
    if (process == null) {
      throw new IllegalStateException(
          "processItem.getProcess() retornó null — el ProcessItem no tiene proceso asociado. " +
          "Item: " + itemFile.getName());
    }

    // Paso 2: verificar si es un proxy EMF
    boolean isProxy = (Boolean) eObjectClass.getMethod("eIsProxy").invoke(process);
    if (!isProxy) {
      return; // ya está resuelto, nada que hacer
    }

    // Paso 3: obtener la URI EXACTA del proxy usando InternalEObject
    Object proxyUri = internalEObjectClass.getMethod("eProxyURI").invoke(process);
    if (proxyUri == null) {
      throw new IllegalStateException(
          "EMF proxy sin URI — no se puede resolver el proceso. Item: " + itemFile.getName());
    }
    // La URI del proxy incluye el fragmento (#/), lo removemos para obtener la URI del resource
    Object resourceUri = uriClass.getMethod("trimFragment").invoke(proxyUri);

    // Paso 4: obtener el ResourceSet del ProcessItem
    Object propertiesResource = eObjectClass.getMethod("eResource").invoke(processItem);
    if (propertiesResource == null) {
      throw new IllegalStateException(
          "processItem.eResource() retornó null — el ProcessItem no está en ningún ResourceSet. " +
          "URI proxy del proceso: " + proxyUri + ". Item: " + itemFile.getName());
    }

    Object resourceSet = resourceClass.getMethod("getResourceSet").invoke(propertiesResource);
    if (resourceSet == null) {
      throw new IllegalStateException(
          "Resource del ProcessItem no tiene ResourceSet. " +
          "URI proxy del proceso: " + proxyUri + ". Item: " + itemFile.getName());
    }

    // Paso 5: asegurarnos de que el .item se lea desde disco y no desde caché.
    // Si el ResourceSet ya tiene el resource cargado (posiblemente vacío/stale de una sesión anterior),
    // lo descargamos y removemos para forzar una relectura desde disco.
    Object existingResource;
    try {
      existingResource = resourceSetClass.getMethod("getResource", uriClass, boolean.class)
          .invoke(resourceSet, resourceUri, false); // false = solo buscar, NO cargar
    } catch (java.lang.reflect.InvocationTargetException e) {
      existingResource = null;
    }
    if (existingResource != null) {
      try {
        // Descargar el resource stale de memoria
        existingResource.getClass().getMethod("unload").invoke(existingResource);
        // Removerlo del ResourceSet para que getResource(uri, true) lo lea desde disco
        Object resourcesList = resourceSetClass.getMethod("getResources").invoke(resourceSet);
        resourcesList.getClass().getMethod("remove", Object.class).invoke(resourcesList, existingResource);
      } catch (Exception unloadEx) {
        // Si no se puede descargar, continuar de todas formas
      }
    }

    // Cargar el .item resource desde disco usando la URI EXACTA del proxy (idempotente si ya está cargado).
    Object itemResource;
    try {
      itemResource = resourceSetClass.getMethod("getResource", uriClass, boolean.class)
          .invoke(resourceSet, resourceUri, true);
    } catch (java.lang.reflect.InvocationTargetException e) {
      Throwable cause = e.getCause() != null ? e.getCause() : e;
      throw new IllegalStateException(
          "No se pudo cargar el .item resource con URI=" + resourceUri +
          " (proxy URI original: " + proxyUri + "): " + cause.getMessage(), cause);
    }

    if (itemResource == null) {
      throw new IllegalStateException(
          "ResourceSet.getResource() retornó null para URI=" + resourceUri);
    }

    // Paso 6: forzar resolución del proxy llamando getProcess() de nuevo.
    // Ahora que el resource está en el ResourceSet, EMF resolverá el proxy.
    Object resolvedProcess = invoke(processItem, "getProcess");
    boolean stillProxy = (Boolean) eObjectClass.getMethod("eIsProxy").invoke(resolvedProcess);
    if (stillProxy) {
      throw new IllegalStateException(
          "El proxy NO se resolvió después de cargar el resource. " +
          "URI proxy: " + proxyUri + ", URI resource cargado: " + resourceUri +
          ". Posible mismatch de URI. Item: " + itemFile.getName());
    }
  }

  private static String talendMultiPageEditorId() throws Exception {
    Bundle designerBundle = Platform.getBundle("org.talend.designer.core");
    if (designerBundle == null) {
      throw new ClassNotFoundException("Bundle org.talend.designer.core no encontrado");
    }
    Class<?> editorClass = designerBundle.loadClass("org.talend.designer.core.ui.MultiPageTalendEditor");
    return String.valueOf(editorClass.getField("ID").get(null));
  }

  private static RepositoryCoordinates repositoryCoordinates(String fileName) {
    String baseName = fileName.endsWith(".item") ? fileName.substring(0, fileName.length() - ".item".length()) : fileName;
    int separatorIndex = baseName.lastIndexOf('_');
    if (separatorIndex <= 0 || separatorIndex >= baseName.length() - 1) {
      return new RepositoryCoordinates(baseName, null);
    }

    return new RepositoryCoordinates(baseName.substring(0, separatorIndex), baseName.substring(separatorIndex + 1));
  }

  private static Object invoke(Object target, String methodName, Class<?>[] parameterTypes, Object... arguments) throws Exception {
    java.lang.reflect.Method method = target.getClass().getMethod(methodName, parameterTypes);
    return method.invoke(target, arguments);
  }

  private static Object invoke(Object target, String methodName) throws Exception {
    java.lang.reflect.Method method = target.getClass().getMethod(methodName);
    return method.invoke(target);
  }

  private static Class<?> loadClassFromBundle(String bundleSymbolicName, String className) throws ClassNotFoundException {
    Bundle bundle = Platform.getBundle(bundleSymbolicName);
    if (bundle == null) {
      throw new ClassNotFoundException("No se encontró el bundle " + bundleSymbolicName);
    }
    return bundle.loadClass(className);
  }

  private static final class RepositoryCoordinates {
    private final String label;
    private final String version;

    private RepositoryCoordinates(String label, String version) {
      this.label = label;
      this.version = version;
    }
  }

  private static IEditorInput newFileEditorInput(IFile file) throws Exception {
    Class<?> editorInputClass = Class.forName("org.eclipse.ui.part.FileEditorInput");
    java.lang.reflect.Constructor<?> constructor = editorInputClass.getConstructor(IFile.class);
    return (IEditorInput) constructor.newInstance(file);
  }
}
