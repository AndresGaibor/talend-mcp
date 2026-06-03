package com.andres.talend.bridge.problems;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IWorkspaceRoot;
import org.eclipse.core.resources.ResourcesPlugin;

public final class ProblemMarkerService {
  private ProblemMarkerService() {}

  public static Map<String, Object> markers() {
    List<Map<String, Object>> markers = new ArrayList<>();
    try {
      IWorkspaceRoot root = ResourcesPlugin.getWorkspace().getRoot();
      for (IMarker marker : root.findMarkers(IMarker.PROBLEM, true, IResource.DEPTH_INFINITE)) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("severity", severity(marker.getAttribute(IMarker.SEVERITY, IMarker.SEVERITY_INFO)));
        item.put("message", marker.getAttribute(IMarker.MESSAGE, ""));
        item.put("resource", marker.getResource() != null ? marker.getResource().getFullPath().toString() : null);
        item.put("lineNumber", marker.getAttribute(IMarker.LINE_NUMBER, -1));
        item.put("type", marker.getType());
        markers.add(item);
      }
    } catch (Exception ignored) {
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/problems/markers");
    payload.put("markers", markers);
    return payload;
  }

  private static String severity(int severity) {
    if (severity == IMarker.SEVERITY_ERROR) return "ERROR";
    if (severity == IMarker.SEVERITY_WARNING) return "WARNING";
    return "INFO";
  }
}
