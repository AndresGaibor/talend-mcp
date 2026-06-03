package com.andres.talend.bridge;

import java.util.LinkedHashMap;
import java.util.Map;

import com.andres.talend.bridge.launch.LaunchConfigService;
import com.andres.talend.bridge.launch.LaunchTrackerService;
import com.andres.talend.bridge.problems.ProblemMarkerService;
import com.andres.talend.bridge.workbench.WorkbenchService;

import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.PlatformUI;

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

    // Step 1: Detect active editor
    IWorkbenchPage page = WorkbenchService.activePageOrNull();
    if (page == null) {
      payload.put("ok", false);
      payload.put("error", error("NO_ACTIVE_PAGE", "No hay página activa en el workbench"));
      return payload;
    }

    IEditorPart activeEditor = page.getActiveEditor();
    if (activeEditor == null) {
      payload.put("ok", false);
      payload.put("error", error("NO_ACTIVE_EDITOR", "No hay editor activo"));
      return payload;
    }

    String editorTitle = activeEditor.getTitle();

    // Step 2: Save if dirty
    if (saveBefore && activeEditor.isDirty()) {
      Map<String, Object> saveResult = WorkbenchService.saveActiveEditor();
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

    // Step 4: Find matching launch config
    ILaunchConfiguration launchConfig = findLaunchConfig(jobName);
    if (launchConfig == null) {
      payload.put("ok", false);
      payload.put("error", error("LAUNCH_CONFIG_NOT_FOUND", "No se encontró launch config para: " + jobName));
      return payload;
    }

    String launchName = launchConfig.getName();
    payload.put("launchConfig", launchName);
    payload.put("step", "launching");

    // Step 5: Launch via LaunchConfigService (which registers it in LaunchTracker)
    Map<String, Object> launchResult = LaunchConfigService.runLaunchConfig(launchName, "run", false, config);
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
}