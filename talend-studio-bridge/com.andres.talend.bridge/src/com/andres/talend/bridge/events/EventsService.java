package com.andres.talend.bridge.events;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.LinkedHashMap;

import org.eclipse.debug.core.DebugEvent;
import org.eclipse.debug.core.IDebugEventSetListener;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.ILaunchConfiguration;
import org.eclipse.debug.core.ILaunchManager;
import org.eclipse.debug.core.DebugPlugin;

import org.eclipse.ui.ISelectionListener;
import org.eclipse.ui.ISelectionService;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.IWorkbenchPart;
import org.eclipse.ui.IWorkbenchPartReference;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.IPartListener2;
import org.eclipse.ui.IEditorReference;
import org.eclipse.ui.IEditorPart;
import org.eclipse.core.resources.IResourceChangeEvent;
import org.eclipse.core.resources.IResourceChangeListener;
import org.eclipse.core.resources.IResourceDelta;
import org.eclipse.core.resources.ResourcesPlugin;

public final class EventsService implements IDebugEventSetListener, IPartListener2, ISelectionListener, IResourceChangeListener {

  private static final int MAX_EVENTS = 100;
  private static final List<Map<String, Object>> recentEvents = new CopyOnWriteArrayList<>();
  private static final Map<String, Long> activeLaunches = new ConcurrentHashMap<>();

  private static EventsService instance;

  public static void start() {
    if (instance != null) return;
    instance = new EventsService();
    DebugPlugin.getDefault().addDebugEventListener(instance);

    try {
      IWorkbenchPage page = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getActivePage();
      if (page != null) {
        page.addPartListener(instance);
        ISelectionService ss = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getSelectionService();
        ss.addSelectionListener(instance);
      }
    } catch (Exception ignored) {
    }

    try {
      ResourcesPlugin.getWorkspace().addResourceChangeListener(instance, IResourceChangeEvent.POST_CHANGE);
    } catch (Exception ignored) {
    }
  }

  public static void stop() {
    if (instance == null) return;
    DebugPlugin.getDefault().removeDebugEventListener(instance);
    try {
      IWorkbenchPage page = PlatformUI.getWorkbench().getActiveWorkbenchWindow().getActivePage();
      if (page != null) {
        page.removePartListener(instance);
      }
    } catch (Exception ignored) {
    }
    instance = null;
  }

  public static Map<String, Object> recent() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/events/recent");
    payload.put("activeLaunches", activeLaunches.size());
    payload.put("events", new ArrayList<>(recentEvents));
    return payload;
  }

  public static Map<String, Object> clear() {
    recentEvents.clear();
    activeLaunches.clear();
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/events/clear");
    payload.put("cleared", true);
    return payload;
  }

  private static void addEvent(String type, Map<String, Object> data) {
    Map<String, Object> event = new LinkedHashMap<>();
    event.put("type", type);
    event.put("timestamp", System.currentTimeMillis());
    event.put("data", data);
    recentEvents.add(0, event);
    if (recentEvents.size() > MAX_EVENTS) {
      recentEvents.remove(recentEvents.size() - 1);
    }
  }

  @Override
  public void handleDebugEvents(DebugEvent[] events) {
    for (DebugEvent event : events) {
      Object source = event.getSource();
      if (source instanceof ILaunch) {
        ILaunch launch = (ILaunch) source;
        int kind = event.getKind();
        if (kind == DebugEvent.CREATE) {
          activeLaunches.put(launch.getLaunchConfiguration().getName(), System.currentTimeMillis());
          addEvent("launch.started", launchInfo(launch));
        } else if (kind == DebugEvent.TERMINATE) {
          String name = launch.getLaunchConfiguration().getName();
          Long started = activeLaunches.remove(name);
          long duration = started != null ? System.currentTimeMillis() - started : 0;
          Map<String, Object> info = launchInfo(launch);
          info.put("durationMs", duration);
          addEvent("launch.terminated", info);
          String launchId = com.andres.talend.bridge.launch.LaunchTrackerService.findLatestLaunchIdByName(name);
          if (launchId != null) {
            com.andres.talend.bridge.launch.LaunchTrackerService.markTerminated(launchId, null, info);
          }
        } else if (kind == DebugEvent.CHANGE) {
          addEvent("process.changed", launchInfo(launch));
        }
      } else if (source instanceof ILaunchConfiguration) {
        if (event.getKind() == DebugEvent.CREATE) {
          addEvent("launch.configured", configInfo((ILaunchConfiguration) source));
        }
      }
    }
  }

  private static boolean isEditorReference(IWorkbenchPartReference partRef) {
    return partRef instanceof IEditorReference;
  }

  private static Map<String, Object> editorPartInfo(IEditorPart editor) {
    Map<String, Object> info = new LinkedHashMap<>();
    info.put("title", editor.getTitle());
    info.put("dirty", editor.isDirty());
    if (editor.getSite() != null) {
      info.put("siteId", editor.getSite().getId());
    }
    info.put("class", editor.getClass().getName());
    return info;
  }

  private static Map<String, Object> partInfo(IWorkbenchPartReference partRef) {
    Map<String, Object> info = new LinkedHashMap<>();
    info.put("id", partRef.getId());
    info.put("title", partRef.getTitle());
    info.put("class", partRef.getClass().getName());
    try {
      Object part = partRef.getPart(false);
      if (part != null) {
        info.put("partClass", part.getClass().getName());
        if (part instanceof IEditorPart) {
          info.put("isEditor", true);
          info.put("editorInfo", editorPartInfo((IEditorPart) part));
        } else {
          info.put("isEditor", false);
        }
      } else {
        info.put("partClass", null);
        info.put("isEditor", false);
      }
    } catch (Throwable e) {
      info.put("error", e.toString());
    }
    return info;
  }

  @Override
  public void partActivated(IWorkbenchPartReference partRef) {
    if (isEditorReference(partRef)) {
      Map<String, Object> info = partInfo(partRef);
      addEvent("editor.activated", info);
    }
  }

  @Override
  public void partOpened(IWorkbenchPartReference partRef) {
    if (isEditorReference(partRef)) {
      Map<String, Object> info = partInfo(partRef);
      addEvent("editor.opened", info);
    }
  }

  @Override
  public void partClosed(IWorkbenchPartReference partRef) {
    if (isEditorReference(partRef)) {
      Map<String, Object> info = partInfo(partRef);
      addEvent("editor.closed", info);
    }
  }

  @Override
  public void partVisible(IWorkbenchPartReference partRef) {}

  @Override
  public void partHidden(IWorkbenchPartReference partRef) {}

  @Override
  public void partDeactivated(IWorkbenchPartReference partRef) {
    if (isEditorReference(partRef)) {
      Map<String, Object> info = partInfo(partRef);
      addEvent("editor.deactivated", info);
    }
  }

  @Override
  public void partBroughtToTop(IWorkbenchPartReference partRef) {}

  @Override
  public void partInputChanged(IWorkbenchPartReference partRef) {}

  @Override
  public void selectionChanged(IWorkbenchPart part, org.eclipse.jface.viewers.ISelection selection) {
    Map<String, Object> info = new LinkedHashMap<>();
    info.put("partId", part.getSite().getId());
    info.put("partTitle", part.getTitle());
    info.put("selectionClass", selection.getClass().getName());
    info.put("selectionText", selection.toString());
    addEvent("selection.changed", info);
  }

  @Override
  public void resourceChanged(IResourceChangeEvent event) {
    IResourceDelta delta = event.getDelta();
    if (delta == null) return;
    Map<String, Object> info = new LinkedHashMap<>();
    info.put("kind", kindName(event.getKind()));
    info.put("resource", delta.getFullPath().toString());
    info.put("flags", delta.getFlags());
    boolean isProblem = (delta.getFlags() & IResourceDelta.MARKERS) != 0;
    if (isProblem) {
      addEvent("problem.changed", info);
    } else {
      addEvent("resource.changed", info);
    }
  }

  private static String kindName(int kind) {
    switch (kind) {
      case IResourceChangeEvent.PRE_DELETE: return "pre_delete";
      case IResourceChangeEvent.PRE_BUILD: return "pre_build";
      case IResourceChangeEvent.POST_BUILD: return "post_build";
      case IResourceChangeEvent.POST_CHANGE: return "post_change";
      case IResourceChangeEvent.PRE_REFRESH: return "pre_refresh";
      case IResourceChangeEvent.POST_REFRESH: return "post_refresh";
      default: return "unknown";
    }
  }

  private static Map<String, Object> launchInfo(ILaunch launch) {
    Map<String, Object> info = new LinkedHashMap<>();
    info.put("label", launch.toString());
    if (launch.getLaunchConfiguration() != null) {
      info.put("name", launch.getLaunchConfiguration().getName());
      info.put("mode", launch.getLaunchMode());
    }
    info.put("terminated", launch.isTerminated());
    return info;
  }

  private static Map<String, Object> configInfo(ILaunchConfiguration config) {
    Map<String, Object> info = new LinkedHashMap<>();
    info.put("name", config.getName());
    try {
      info.put("type", config.getType() != null ? config.getType().getName() : null);
    } catch (org.eclipse.core.runtime.CoreException e) {
      info.put("type", null);
    }
    return info;
  }
}