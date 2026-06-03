package com.andres.talend.bridge.audit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.runtime.Platform;
import org.eclipse.ui.PlatformUI;
import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.BundleException;
import org.osgi.framework.FrameworkUtil;

public final class PluginAuditService {
  private PluginAuditService() {}

  public static Map<String, Object> auditEnvironment(BundleContext context) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/audit/environment");
    Map<String, Object> javaInfo = new LinkedHashMap<>();
    javaInfo.put("version", System.getProperty("java.version", "unknown"));
    javaInfo.put("vendor", System.getProperty("java.vendor", "unknown"));
    javaInfo.put("home", System.getProperty("java.home", "unknown"));
    payload.put("java", javaInfo);

    Map<String, Object> osgi = new LinkedHashMap<>();
    osgi.put("bundleCount", context.getBundles().length);
    payload.put("osgi", osgi);

    Map<String, Object> eclipse = new LinkedHashMap<>();
    eclipse.put("product", Platform.getProduct() != null ? Platform.getProduct().getName() : "unknown");
    eclipse.put("application", Platform.getApplicationArgs() != null ? "available" : "unknown");
    eclipse.put("instanceLocation", Platform.getInstanceLocation() != null ? Platform.getInstanceLocation().getURL().toString() : "unknown");
    eclipse.put("installLocation", Platform.getInstallLocation() != null ? Platform.getInstallLocation().getURL().toString() : "unknown");
    payload.put("eclipse", eclipse);

    List<Map<String, Object>> detectedBundles = detectTalendBundles(context);
    Map<String, Object> talend = new LinkedHashMap<>();
    talend.put("detectedBundles", detectedBundles);
    talend.put("detectedClasses", new java.util.ArrayList<Object>());
    talend.put("confidence", detectedBundles.isEmpty() ? "low" : "medium");
    payload.put("talend", talend);
    return payload;
  }

  private static List<Map<String, Object>> detectTalendBundles(BundleContext context) {
    List<Map<String, Object>> bundles = new ArrayList<>();
    for (Bundle bundle : context.getBundles()) {
      String symbolicName = bundle.getSymbolicName();
      if (symbolicName == null) continue;
      String lower = symbolicName.toLowerCase();
      if (!lower.contains("talend") && !lower.contains("tdq") && !lower.contains("designer") && !lower.contains("repository") && !lower.contains("dataquality")) {
        continue;
      }
      Map<String, Object> item = new LinkedHashMap<>();
      item.put("symbolicName", symbolicName);
      item.put("version", String.valueOf(bundle.getVersion()));
      item.put("state", bundleState(bundle.getState()));
      bundles.add(item);
    }
    return bundles;
  }

  private static String bundleState(int state) {
    switch (state) {
      case Bundle.ACTIVE:
        return "ACTIVE";
      case Bundle.INSTALLED:
        return "INSTALLED";
      case Bundle.RESOLVED:
        return "RESOLVED";
      case Bundle.STARTING:
        return "STARTING";
      case Bundle.STOPPING:
        return "STOPPING";
      default:
        return "UNKNOWN";
    }
  }
}
