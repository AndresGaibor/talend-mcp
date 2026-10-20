package com.andres.talend.bridge;

import java.util.LinkedHashMap;
import java.util.Map;

import com.andres.talend.bridge.launch.LaunchConfigService;
import com.andres.talend.bridge.launch.LaunchTrackerService;
import com.andres.talend.bridge.problems.ProblemMarkerService;
import com.andres.talend.bridge.talend.TalendIntrospectionService;
import com.andres.talend.bridge.workbench.WorkbenchService;
import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.ILaunchConfigurationType;
import org.eclipse.debug.core.ILaunchConfigurationWorkingCopy;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IWorkbenchPage;

public final class AutomationService {

  private AutomationService() {}

  public static Map<String, Object> runActiveJob(boolean saveBefore, boolean waitForTermination, int timeoutMs, boolean dryRun, BridgeConfig config) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/automation/run-active-job");
    payload.put("dryRun", dryRun);

    if (config.readOnly && !dryRun) {
      payload.put("ok", false);
      payload.put("blocked", true);
      payload.put("reason", "READ_ONLY");
      payload.put("error", error("READ_ONLY", "Bridge está en modo readOnly"));
      return payload;
    }

    if (dryRun) {
      payload.put("mode", "dryRun");
      payload.put("step", "would-execute-active-job");
      return payload;
    }

    if (!config.unsafeActions) {
      payload.put("ok", false);
      payload.put("blocked", true);
      payload.put("reason", "UNSAFE_ACTIONS_DISABLED");
      payload.put("error", error("UNSAFE_ACTIONS_DISABLED", "unsafeActions=false"));
      return payload;
    }

    // Step 1-3: todo lo que toca la UI va en un bloque sincronizado corto.
    //
    // Ojo: la ejecucion del job NO puede correr en el hilo de la UI. Lanzar y
    // esperar la terminacion tarda dezenas de segundos y congelaria Talend
    // Studio, que es exactamente lo que pasaba antes de este cambio.
    Map<String, Object> ui = UiThread.sync(() -> {
      Map<String, Object> state = new LinkedHashMap<>();

      IWorkbenchPage page = WorkbenchService.activePageOrNull();
      state.put("page", page);
      if (page == null) {
        return state;
      }

      IEditorPart editor = page.getActiveEditor();
      state.put("editor", editor);
      if (editor == null) {
        return state;
      }

      state.put("title", editor.getTitle());

      if (saveBefore && editor.isDirty()) {
        state.put("save", WorkbenchService.saveActiveEditor());
      }

      return state;
    });

    IWorkbenchPage page = (IWorkbenchPage) ui.get("page");
    if (page == null) {
      payload.put("ok", false);
      payload.put("error", error("NO_ACTIVE_PAGE", "No hay página activa en el workbench"));
      return payload;
    }

    IEditorPart activeEditor = (IEditorPart) ui.get("editor");
    if (activeEditor == null) {
      payload.put("ok", false);
      payload.put("error", error("NO_ACTIVE_EDITOR", "No hay editor activo"));
      return payload;
    }

    String editorTitle = (String) ui.get("title");

    if (ui.get("save") instanceof Map) {
      Map<?, ?> saveResult = (Map<?, ?>) ui.get("save");
      if (!Boolean.TRUE.equals(saveResult.get("saved"))) {
        payload.put("warning", "Editor dirty but save failed");
      }
    }

    // Step 3: Find launch config matching editor title
    String jobName = extractJobName(editorTitle);
    if (jobName == null) {
      payload.put("ok", false);
      payload.put("error", error("CANNOT_EXTRACT_JOB_NAME", "No se pudo extraer nombre de job de: " + editorTitle));
      return payload;
    }

    payload.put("jobName", jobName);
    payload.put("step", "launch-config-search");

    // Step 4: Find matching launch config (or create/update it)
    ILaunchConfiguration launchConfig = findLaunchConfig(jobName);
    final IEditorPart editorForConfig = activeEditor;
    final ILaunchConfiguration existingConfig = launchConfig;
    Map<String, Object> ensured = UiThread.sync(() -> ensureLaunchConfigFor(jobName, editorForConfig, existingConfig));
    if (!Boolean.TRUE.equals(ensured.get("ok"))) {
      payload.put("ok", false);
      payload.put("error", ensured.get("error"));
      return payload;
    }
    launchConfig = (ILaunchConfiguration) ensured.get("launchConfiguration");
    if (Boolean.TRUE.equals(ensured.get("created"))) {
      payload.put("launchConfigCreated", true);
    } else if (Boolean.TRUE.equals(ensured.get("updated"))) {
      payload.put("launchConfigUpdated", true);
    }
    payload.put("launchConfigAttributes", ensured.get("attributes"));

    String launchName = launchConfig.getName();
    payload.put("launchConfig", launchName);
    payload.put("step", "launching");

    // Step 5: Launch via LaunchConfigService (which registers it in LaunchTracker)
    Map<String, Object> launchResult = LaunchConfigService.runLaunchConfig(launchConfig, launchName, "run", false, config);
    if (!Boolean.TRUE.equals(launchResult.get("ok"))) {
      payload.put("ok", false);
      payload.put("launchResult", launchResult);
      return payload;
    }
    
    String launchId = (String) launchResult.get("launchId");
    payload.put("launchId", launchId);
    payload.put("launched", true);
    payload.put("step", waitForTermination ? "waiting-termination" : "completed");

    // Step 6: Wait for termination if requested using LaunchTrackerService
    if (waitForTermination && launchId != null) {
      LaunchTrackerService.LaunchRunInfo info = LaunchTrackerService.waitForLaunch(launchId, timeoutMs);
      if (info != null) {
        payload.put("terminated", info.terminatedAt != null);
        payload.put("status", info.status);
        payload.put("exitCode", info.exitCode);
        if (info.terminatedAt == null) {
          payload.put("timeout", true);
        }
      }
    }

    // Step 7: Read problems
    payload.put("step", "reading-problems");
    Map<String, Object> problems = ProblemMarkerService.markers();
    payload.put("problems", problems.get("markers"));
    payload.put("problemCount", ((java.util.List<?>) problems.get("markers")).size());

    payload.put("step", "completed");
    return payload;
  }

  private static String extractJobName(String editorTitle) {
    if (editorTitle == null) return null;
    // Format: "Job jobName version" or "jobName_version"
    if (editorTitle.startsWith("Job ")) {
      String rest = editorTitle.substring(4);
      int spaceIdx = rest.lastIndexOf(' ');
      if (spaceIdx > 0) {
        return rest.substring(0, spaceIdx);
      }
      return rest;
    }
    int lastUnderscore = editorTitle.lastIndexOf('_');
    if (lastUnderscore > 0) {
      return editorTitle.substring(0, lastUnderscore);
    }
    return editorTitle;
  }

  private static ILaunchConfiguration findLaunchConfig(String jobName) {
    try {
      ILaunchConfiguration[] configs = DebugPlugin.getDefault().getLaunchManager().getLaunchConfigurations();
      
      // 1. Exact match with version 0.1 (common Talend default)
      for (ILaunchConfiguration config : configs) {
        if (config.getName().equals(jobName + " 0.1")) {
          return config;
        }
      }
      
      // 2. Starts with name + space
      for (ILaunchConfiguration config : configs) {
        if (config.getName().startsWith(jobName + " ")) {
          return config;
        }
      }
      
      // 3. Fallback to startsWith
      for (ILaunchConfiguration config : configs) {
        if (config.getName().startsWith(jobName)) {
          return config;
        }
      }
    } catch (Exception ignored) {
    }
    return null;
  }

  private static Map<String, Object> error(String code, String message) {
    Map<String, Object> err = new LinkedHashMap<>();
    err.put("code", code);
    err.put("message", message);
    return err;
  }

  /** Tipo de launch config que usa Talend para ejecutar un job. */
  private static final String TALEND_JOB_LAUNCH_TYPE = "org.talend.designer.runprocess.jobLaunchConfiguration";

  private static final String ATTR_JOB_NAME = "TALEND_JOB_NAME";
  private static final String ATTR_JOB_ID = "TALEND_JOB_ID";
  private static final String ATTR_JOB_VERSION = "TALEND_JOB_VERSION";
  private static final String ATTR_PROJECT_LABEL = "JOB_PROJECT_TECH_LABEL";

  /**
   * Crea o actualiza la launch config de un job de Talend.
   *
   * Studio solo genera las launch configs cuando el usuario ejecuta el job a
   * mano. Un job creado por el MCP no la tiene, asi que se construye con los
   * mismos atributos que espera el delegate de Talend. Si ya existe pero sus
   * atributos no cuadran con el job actual, se actualiza: si no, el delegate
   * buscaria un proceso que ya no existe.
   */
  private static Map<String, Object> ensureLaunchConfigFor(String jobName, IEditorPart editor,
      ILaunchConfiguration existing) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("ok", false);

    Object process = resolveProcess(editor);
    if (process == null) {
      result.put("error", error("JOB_PROCESS_NOT_FOUND", "El editor activo no expone el proceso del job"));
      return result;
    }

    String technicalName = asString(TalendIntrospectionService.invokeFirst(process, "getName"));
    String jobId = asString(TalendIntrospectionService.invokeFirst(process, "getId"));
    String version = asString(TalendIntrospectionService.invokeFirst(process, "getVersion"));
    String projectLabel = resolveTechnicalLabel(process);

    if (jobId == null || jobId.isEmpty()) {
      jobId = technicalName;
    }

    if (technicalName == null || technicalName.isEmpty()) {
      result.put("error", error("JOB_NAME_NOT_FOUND", "No se pudo obtener el nombre tecnico del job"));
      return result;
    }
    if (version == null || version.isEmpty()) {
      version = "0.1";
    }
    if (projectLabel == null || projectLabel.isEmpty()) {
      result.put("error", error("PROJECT_LABEL_NOT_FOUND", "No se pudo obtener el label tecnico del proyecto"));
      return result;
    }

    try {
      IContainer container = ResourcesPlugin.getWorkspace().getRoot();

      ILaunchConfigurationType type = DebugPlugin.getDefault().getLaunchManager()
          .getLaunchConfigurationType(TALEND_JOB_LAUNCH_TYPE);
      if (type == null) {
        result.put("error", error("LAUNCH_TYPE_NOT_FOUND", "No se encontro el tipo de launch config: " + TALEND_JOB_LAUNCH_TYPE));
        return result;
      }

      String configName = jobName + " " + version;
      ILaunchConfiguration configuration;
      boolean created = false;
      boolean updated = false;

      if (existing != null) {
        configuration = existing.getWorkingCopy();
        updated = !attributesMatch(existing, jobName, jobId, version, projectLabel);
        ((ILaunchConfigurationWorkingCopy) configuration).setAttribute(ATTR_JOB_NAME, jobName);
        ((ILaunchConfigurationWorkingCopy) configuration).setAttribute(ATTR_JOB_ID, jobId);
        ((ILaunchConfigurationWorkingCopy) configuration).setAttribute(ATTR_JOB_VERSION, version);
        ((ILaunchConfigurationWorkingCopy) configuration).setAttribute(ATTR_PROJECT_LABEL, projectLabel);
        configuration = ((ILaunchConfigurationWorkingCopy) configuration).doSave();
      } else {
        ILaunchConfiguration fresh = type.newInstance(container, configName);
        ILaunchConfigurationWorkingCopy workingCopy = fresh.getWorkingCopy();
        workingCopy.setAttribute(ATTR_JOB_NAME, jobName);
        workingCopy.setAttribute(ATTR_JOB_ID, jobId);
        workingCopy.setAttribute(ATTR_JOB_VERSION, version);
        workingCopy.setAttribute(ATTR_PROJECT_LABEL, projectLabel);
        configuration = workingCopy.doSave();
        created = true;
      }

      Map<String, Object> attributes = new LinkedHashMap<>();
      attributes.put(ATTR_JOB_NAME, jobName);
      attributes.put(ATTR_JOB_ID, jobId);
      attributes.put(ATTR_JOB_VERSION, version);
      attributes.put(ATTR_PROJECT_LABEL, projectLabel);

      result.put("ok", true);
      result.put("launchConfiguration", configuration);
      result.put("attributes", attributes);
      result.put("created", created);
      result.put("updated", updated);
      return result;
    } catch (Exception e) {
      result.put("error", error("LAUNCH_CONFIG_CREATE_FAILED", e.getMessage()));
      return result;
    }
  }

  /** Indica si la launch config ya apunta al job actual. */
  private static boolean attributesMatch(ILaunchConfiguration configuration, String jobName, String jobId,
      String version, String projectLabel) {
    try {
      return jobName.equals(configuration.getAttribute(ATTR_JOB_NAME, ""))
          && jobId.equals(configuration.getAttribute(ATTR_JOB_ID, ""))
          && version.equals(configuration.getAttribute(ATTR_JOB_VERSION, ""))
          && projectLabel.equals(configuration.getAttribute(ATTR_PROJECT_LABEL, ""));
    } catch (Exception e) {
      return false;
    }
  }

  private static String asString(Object value) {
    return value instanceof String ? (String) value : null;
  }

  /**
   * Proceso del job abierto en el editor.
   *
   * Se toma del `JobEditorInput.getLoadedProcess()`, que es exactamente lo que
   * usa el delegate de Talend al lanzar: si se usa otra fuente, el id del
   * proceso no coincide y el delegate no encuentra el job.
   */
  private static Object resolveProcess(IEditorPart editor) {
    Object editorInput = editor.getEditorInput();
    Object process = TalendIntrospectionService.invokeFirst(editorInput, "getLoadedProcess");
    if (process != null) {
      return process;
    }
    return TalendIntrospectionService.invokeFirst(editor, "getProcess", "getProcessItem");
  }

  /**
   * Label tecnico del proyecto al que pertenece el job.
   *
   * Talend lo calcula con su ProjectManager a partir de la propiedad del
   * proceso. Se usa reflexion para no atar el bundle a org.talend.core.runtime.
   */
  private static String resolveTechnicalLabel(Object process) {
    try {
      org.osgi.framework.Bundle bundle = org.eclipse.core.runtime.Platform.getBundle("org.talend.core.runtime");
      if (bundle == null) {
        return null;
      }

      Class<?> managerClass = bundle.loadClass("org.talend.repository.ProjectManager");
      Object manager = managerClass.getMethod("getInstance").invoke(null);

      Object property = TalendIntrospectionService.invokeFirst(process, "getProperty");
      if (property == null) {
        return null;
      }

      java.lang.reflect.Method getProject = null;
      for (java.lang.reflect.Method method : managerClass.getMethods()) {
        if ("getProject".equals(method.getName()) && method.getParameterCount() == 1) {
          getProject = method;
          break;
        }
      }
      if (getProject == null) {
        return null;
      }

      Object project = getProject.invoke(manager, property);
      if (project == null) {
        return null;
      }

      return asString(project.getClass().getMethod("getTechnicalLabel").invoke(project));
    } catch (Exception e) {
      BridgeLog.warn("No se pudo resolver el label tecnico del proyecto", e);
      return null;
    }
  }
}