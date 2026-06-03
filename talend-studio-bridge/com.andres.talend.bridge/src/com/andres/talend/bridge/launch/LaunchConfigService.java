package com.andres.talend.bridge.launch;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeConfig;

import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.NullProgressMonitor;
import org.eclipse.debug.core.DebugPlugin;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.ILaunchConfigurationType;
import org.eclipse.debug.core.ILaunchManager;

public final class LaunchConfigService {
  private LaunchConfigService() {}

  public static Map<String, Object> listConfigs() {
    List<Map<String, Object>> configs = new ArrayList<>();
    try {
      ILaunchManager manager = DebugPlugin.getDefault().getLaunchManager();
      for (ILaunchConfiguration config : manager.getLaunchConfigurations()) {
        configs.add(configInfo(config));
      }
    } catch (Exception ignored) {
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/launch/configs");
    payload.put("configs", configs);
    return payload;
  }

  private static Map<String, Object> configInfo(ILaunchConfiguration config) {
    Map<String, Object> item = new LinkedHashMap<>();
    item.put("name", config.getName());

    try {
      ILaunchConfigurationType type = config.getType();
      if (type != null) {
        item.put("typeId", type.getIdentifier());
        item.put("typeName", type.getName());

        // Available modes for this type
        java.util.Set<String> modeSet = type.getSupportedModes();
        List<String> modeList = new ArrayList<>();
        for (String mode : modeSet) {
          if (mode.equals(ILaunchManager.RUN_MODE) || mode.equals(ILaunchManager.DEBUG_MODE) || mode.equals(ILaunchManager.PROFILE_MODE)) {
            modeList.add(mode);
          }
        }
        item.put("modes", modeList);
      }
    } catch (Exception ignored) {
      item.put("typeId", null);
      item.put("typeName", null);
      item.put("modes", new ArrayList<>());
    }

    // Attributes
    Map<String, Object> attributes = new LinkedHashMap<>();
    try {
      Map<String, Object> attrs = config.getAttributes();
      for (Map.Entry<String, Object> entry : attrs.entrySet()) {
        if (entry.getValue() != null) {
          attributes.put(entry.getKey(), String.valueOf(entry.getValue()));
        }
      }
    } catch (CoreException ignored) {
    }
    item.put("attributes", attributes);

    // Resource path if available
    try {
      if (config.getMappedResources() != null && config.getMappedResources().length > 0) {
        item.put("resource", config.getMappedResources()[0].getFullPath().toString());
      }
    } catch (Exception ignored) {
    }

    return item;
  }

  public static Map<String, Object> runLaunchConfig(String name, String mode, boolean dryRun, BridgeConfig config) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/launch/run");
    payload.put("name", name);
    payload.put("mode", mode);
    payload.put("dryRun", dryRun);

    ILaunchConfiguration launchConfiguration = findLaunchConfiguration(name);
    payload.put("supported", launchConfiguration != null);

    if (launchConfiguration == null) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      Map<String, Object> error = new LinkedHashMap<>();
      error.put("code", "LAUNCH_NOT_FOUND");
      error.put("message", "No se encontró la launch config solicitada");
      payload.put("error", error);
      return payload;
    }

    if (config.readOnly && !dryRun) {
      payload.put("executed", false);
      payload.put("blocked", true);
      payload.put("reason", "READ_ONLY");
      payload.put("error", error("READ_ONLY", "Bridge está en modo readOnly"));
      return payload;
    }

    if (dryRun) {
      payload.put("executed", false);
      payload.put("blocked", false);
      return payload;
    }

    if (!config.unsafeActions) {
      payload.put("executed", false);
      payload.put("blocked", true);
      payload.put("reason", "UNSAFE_ACTIONS_DISABLED");
      payload.put("error", error("UNSAFE_ACTIONS_DISABLED", "unsafeActions=false"));
      return payload;
    }

    try {
      String launchMode = mode != null && !mode.trim().isEmpty() ? mode : ILaunchManager.RUN_MODE;
      launchConfiguration.launch(launchMode, new NullProgressMonitor(), true);
      payload.put("executed", true);
      payload.put("launchMode", launchMode);
      return payload;
    } catch (CoreException e) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      Map<String, Object> error = new LinkedHashMap<>();
      error.put("code", "LAUNCH_FAILED");
      error.put("message", e.getMessage() != null ? e.getMessage() : "La ejecución de la launch config falló");
      payload.put("error", error);
      return payload;
    }
  }

  private static ILaunchConfiguration findLaunchConfiguration(String name) {
    if (name == null || name.trim().isEmpty()) {
      return null;
    }

    try {
      ILaunchManager manager = DebugPlugin.getDefault().getLaunchManager();
      for (ILaunchConfiguration config : manager.getLaunchConfigurations()) {
        if (name.equals(config.getName())) {
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