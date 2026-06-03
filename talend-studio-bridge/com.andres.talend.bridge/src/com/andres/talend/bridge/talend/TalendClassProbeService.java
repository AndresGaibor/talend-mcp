package com.andres.talend.bridge.talend;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;

public final class TalendClassProbeService {
  private static final List<String> PROBES = new ArrayList<String>();

  static {
    PROBES.add("org.talend.designer.core.ui.editor.ProcessTalendEditor");
    PROBES.add("org.talend.designer.core.ui.editor.TalendEditor");
    PROBES.add("org.talend.designer.core.model.process.IProcess2");
    PROBES.add("org.talend.core.model.process.IProcess");
    PROBES.add("org.talend.core.model.process.INode");
    PROBES.add("org.talend.core.model.process.IConnection");
    PROBES.add("org.talend.repository.model.IRepositoryNode");
    PROBES.add("org.talend.core.model.properties.ProcessItem");
    PROBES.add("org.talend.core.model.properties.Property");
  }

  private TalendClassProbeService() {}

  public static Map<String, Object> probe(BundleContext context) {
    List<Map<String, Object>> classes = new ArrayList<>();
    for (String className : PROBES) {
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("name", className);
      item.put("available", false);
      item.put("loadedFromBundle", null);
      for (Bundle bundle : context.getBundles()) {
        try {
          bundle.loadClass(className);
          item.put("available", true);
          item.put("loadedFromBundle", bundle.getSymbolicName());
          break;
        } catch (Throwable ignored) {
        }
      }
      classes.add(item);
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/talend/probe/classes");
    payload.put("classes", classes);
    return payload;
  }
}
