package com.andres.talend.bridge.audit;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeConfig;

public final class CapabilityAuditService {
  private CapabilityAuditService() {}

  public static Map<String, Object> capabilities(BridgeConfig config) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/capabilities");
    Map<String, Object> workbench = new LinkedHashMap<>();
    workbench.put("listEditors", true);
    workbench.put("activeEditor", true);
    workbench.put("dirtyEditors", true);
    workbench.put("visibleViews", true);
    workbench.put("selection", true);

    Map<String, Object> workspace = new LinkedHashMap<>();
    workspace.put("listProjects", true);
    workspace.put("readResources", true);
    workspace.put("watchResources", false);

    Map<String, Object> talend = new LinkedHashMap<>();
    talend.put("detectActiveJob", true);
    talend.put("readActiveJobModel", "partial");
    talend.put("readComponents", "partial");
    talend.put("readConnections", "partial");
    talend.put("editComponents", false);
    talend.put("runJob", "experimental");

    Map<String, Object> commands = new LinkedHashMap<>();
    commands.put("listCommands", true);
    commands.put("executeWhitelistedCommands", config.unsafeActions);

    Map<String, Object> launch = new LinkedHashMap<>();
    launch.put("listLaunchConfigs", true);
    launch.put("runLaunchConfig", config.unsafeActions);

    Map<String, Object> capabilities = new LinkedHashMap<>();
    capabilities.put("workbench", workbench);
    capabilities.put("workspace", workspace);
    capabilities.put("talend", talend);
    capabilities.put("commands", commands);
    capabilities.put("launch", launch);
    payload.put("capabilities", capabilities);

    List<String> limitations = new java.util.ArrayList<>();
    limitations.add("La introspección Talend depende de reflection y puede cambiar entre versiones.");
    limitations.add("Por defecto el bridge no ejecuta acciones inseguras.");
    limitations.add("La lectura completa del modelo puede ser parcial en función de la versión de Talend.");
    payload.put("limitations", limitations);
    return payload;
  }
}
