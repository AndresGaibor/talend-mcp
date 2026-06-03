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
import org.eclipse.debug.core.ILaunchManager;

public final class LaunchConfigService {
  private LaunchConfigService() {}

  public static Map<String, Object> listConfigs() {
    List<Map<String, Object>> configs = new ArrayList<>();
    try {
      ILaunchManager manager = DebugPlugin.getDefault().getLaunchManager();
      for (ILaunchConfiguration config : manager.getLaunchConfigurations()) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", config.getName());
        item.put("type", config.getType() != null ? config.getType().getName() : null);
        item.put("path", null);
        configs.add(item);
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

    if (dryRun || !config.unsafeActions) {
      payload.put("executed", false);
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
}
