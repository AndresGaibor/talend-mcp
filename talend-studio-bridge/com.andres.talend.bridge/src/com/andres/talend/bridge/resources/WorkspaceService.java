package com.andres.talend.bridge.resources;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;

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
      ResourcesPlugin.getWorkspace().save(true, null);
      payload.put("refreshed", true);
      payload.put("message", "Workspace refreshed successfully");
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("refreshed", false);
      payload.put("error", "REFRESH_FAILED: " + e.getMessage());
    }
    return payload;
  }
}
