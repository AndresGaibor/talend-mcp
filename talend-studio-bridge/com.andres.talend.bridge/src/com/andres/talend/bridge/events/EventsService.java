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

import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IPartListener2;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.IWorkbenchPartReference;
import org.eclipse.ui.PlatformUI;

public final class EventsService implements IDebugEventSetListener, IPartListener2 {

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
      }
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

  @Override
  public void partActivated(IWorkbenchPartReference partRef) {
    if (partRef instanceof org.eclipse.ui.IEditorPart) {
      IEditorPart editor = (IEditorPart) partRef.getPart(true);
      if (editor != null) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", editor.getTitle());
        info.put("id", editor.getSite().getId());
        info.put("class", editor.getClass().getName());
        addEvent("editor.activated", info);
      }
    }
  }

  @Override
  public void partOpened(IWorkbenchPartReference partRef) {
    if (partRef instanceof org.eclipse.ui.IEditorPart) {
      IEditorPart editor = (IEditorPart) partRef.getPart(true);
      if (editor != null) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", editor.getTitle());
        info.put("id", editor.getSite().getId());
        addEvent("editor.opened", info);
      }
    }
  }

  @Override
  public void partClosed(IWorkbenchPartReference partRef) {
    if (partRef instanceof org.eclipse.ui.IEditorPart) {
      IEditorPart editor = (IEditorPart) partRef.getPart(true);
      if (editor != null) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", editor.getTitle());
        info.put("id", editor.getSite().getId());
        addEvent("editor.closed", info);
      }
    }
  }

  @Override
  public void partVisible(IWorkbenchPartReference partRef) {}

  @Override
  public void partHidden(IWorkbenchPartReference partRef) {}

  @Override
  public void partDeactivated(IWorkbenchPartReference partRef) {
    if (partRef instanceof org.eclipse.ui.IEditorPart) {
      IEditorPart editor = (IEditorPart) partRef.getPart(true);
      if (editor != null) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", editor.getTitle());
        addEvent("editor.deactivated", info);
      }
    }
  }

  @Override
  public void partBroughtToTop(IWorkbenchPartReference partRef) {}

  @Override
  public void partInputChanged(IWorkbenchPartReference partRef) {}

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