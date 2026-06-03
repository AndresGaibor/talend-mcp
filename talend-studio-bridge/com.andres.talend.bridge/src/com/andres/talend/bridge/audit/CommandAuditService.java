package com.andres.talend.bridge.audit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeConfig;

import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.commands.ICommandService;
import org.eclipse.ui.handlers.IHandlerService;

public final class CommandAuditService {
  private CommandAuditService() {}

  public static Map<String, Object> listCommands() {
    IWorkbench workbench = PlatformUI.getWorkbench();
    ICommandService commandService = workbench.getService(ICommandService.class);
    List<Map<String, Object>> commands = new ArrayList<>();
    if (commandService != null) {
      for (org.eclipse.core.commands.Command command : commandService.getDefinedCommands()) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", command.getId());
        item.put("defined", command.isDefined());
        item.put("enabled", command.isEnabled());
        try {
          item.put("name", command.getName());
        } catch (Exception e) {
          item.put("name", null);
        }
        try {
          item.put("category", command.getCategory() != null ? command.getCategory().getName() : null);
        } catch (Exception e) {
          item.put("category", null);
        }
        commands.add(item);
      }
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/commands/list");
    payload.put("commands", commands);
    return payload;
  }

  public static Map<String, Object> executeCommand(String commandId, boolean dryRun, BridgeConfig config) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/commands/execute");
    payload.put("commandId", commandId);
    payload.put("dryRun", dryRun);

    if (commandId == null || commandId.trim().isEmpty()) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      payload.put("error", error("INVALID_COMMAND", "commandId vacío"));
      return payload;
    }

    if (config.readOnly && !dryRun) {
      payload.put("ok", false);
      payload.put("blocked", true);
      payload.put("reason", "READ_ONLY");
      payload.put("executed", false);
      payload.put("error", error("READ_ONLY", "Bridge está en modo readOnly"));
      return payload;
    }

    if (dryRun) {
      payload.put("executed", false);
      payload.put("allowed", config.allowAllCommands || config.allowCommands.contains(commandId));
      return payload;
    }

    if (!config.unsafeActions) {
      payload.put("ok", false);
      payload.put("blocked", true);
      payload.put("reason", "UNSAFE_ACTIONS_DISABLED");
      payload.put("executed", false);
      payload.put("error", error("UNSAFE_ACTIONS_DISABLED", "unsafeActions=false"));
      return payload;
    }

    if (!config.allowAllCommands && !config.allowCommands.contains(commandId)) {
      payload.put("ok", false);
      payload.put("blocked", true);
      payload.put("reason", "COMMAND_NOT_IN_ALLOW_LIST");
      payload.put("executed", false);
      payload.put("error", error("COMMAND_NOT_ALLOWED", "Comando fuera de allowCommands"));
      return payload;
    }

    IWorkbench workbench = PlatformUI.getWorkbench();
    IHandlerService handlerService = workbench.getService(IHandlerService.class);
    try {
      if (handlerService != null) {
        handlerService.executeCommand(commandId, null);
      }
      payload.put("executed", true);
      return payload;
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("confidence", "low");
      payload.put("error", error("COMMAND_FAILED", e.getMessage()));
      return payload;
    }
  }

  private static Map<String, Object> error(String code, String message) {
    Map<String, Object> error = new LinkedHashMap<>();
    error.put("code", code);
    error.put("message", message);
    return error;
  }
}
