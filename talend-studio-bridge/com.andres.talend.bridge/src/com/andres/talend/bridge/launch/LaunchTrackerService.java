package com.andres.talend.bridge.launch;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.andres.talend.bridge.JsonUtil;

public final class LaunchTrackerService {

  public static class LaunchRunInfo {
    public String launchId;
    public String launchConfigName;
    public String mode;
    public long startedAt;
    public Long terminatedAt;
    public Long durationMs;
    public String status;
    public Integer exitCode;
    public Map<String, Object> extra;
  }

  private static final Map<String, LaunchRunInfo> launches = new ConcurrentHashMap<>();
  private static final Map<String, String> launchNameToLatestId = new ConcurrentHashMap<>();

  private LaunchTrackerService() {}

  public static String registerLaunch(String launchConfigName, String mode) {
    String launchId = "launch_" + System.currentTimeMillis() + "_" + launchConfigName.replaceAll("\\s+", "_");
    LaunchRunInfo info = new LaunchRunInfo();
    info.launchId = launchId;
    info.launchConfigName = launchConfigName;
    info.mode = mode != null ? mode : "run";
    info.startedAt = System.currentTimeMillis();
    info.status = "started";
    launches.put(launchId, info);
    launchNameToLatestId.put(launchConfigName, launchId);
    persist(info);
    return launchId;
  }

  public static void markTerminated(String launchId, Integer exitCode, Map<String, Object> extra) {
    LaunchRunInfo info = launches.get(launchId);
    if (info != null) {
      info.terminatedAt = System.currentTimeMillis();
      info.durationMs = info.terminatedAt - info.startedAt;
      info.exitCode = exitCode;
      info.extra = extra;
      if (exitCode == null) {
        info.status = "terminated_without_exit_code";
      } else if (exitCode == 0) {
        info.status = "success";
      } else {
        info.status = "failed";
      }
      persist(info);
    }
  }

  public static LaunchRunInfo waitForLaunch(String launchId, int timeoutMs) {
    long deadline = System.currentTimeMillis() + timeoutMs;
    while (System.currentTimeMillis() < deadline) {
      LaunchRunInfo info = getLaunch(launchId);
      if (info != null && info.terminatedAt != null) {
        return info;
      }
      try {
        Thread.sleep(500);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      }
    }
    return getLaunch(launchId);
  }

  private static void persist(LaunchRunInfo info) {
    try {
      File file = getStoreFile();
      try (OutputStreamWriter writer = new OutputStreamWriter(new FileOutputStream(file, true), StandardCharsets.UTF_8)) {
        writer.write(JsonUtil.stringify(info) + "\n");
      }
    } catch (Exception e) {
      System.err.println("Failed to persist launch run: " + e.getMessage());
    }
  }

  private static File getStoreFile() {
    File dir = new File(System.getProperty("user.home"), ".talend-bridge");
    if (!dir.exists()) dir.mkdirs();
    return new File(dir, "launch-runs.jsonl");
  }

  public static String findLatestLaunchIdByName(String launchConfigName) {
    return launchNameToLatestId.get(launchConfigName);
  }

  public static void markTerminated(String launchId, Integer exitCode, Map<String, Object> extra) {
    LaunchRunInfo info = launches.get(launchId);
    if (info != null) {
      info.terminatedAt = System.currentTimeMillis();
      info.durationMs = info.terminatedAt - info.startedAt;
      info.exitCode = exitCode;
      info.extra = extra;
      if (exitCode == null) {
        info.status = "terminated_without_exit_code";
      } else if (exitCode == 0) {
        info.status = "success";
      } else {
        info.status = "failed";
      }
    }
  }

  public static LaunchRunInfo getLaunch(String launchId) {
    return launches.get(launchId);
  }

  public static List<LaunchRunInfo> getAllLaunches() {
    return new ArrayList<>(launches.values());
  }

  public static List<LaunchRunInfo> getRecentRuns(int limit) {
    List<LaunchRunInfo> all = new ArrayList<>(launches.values());
    all.sort((a, b) -> Long.compare(b.startedAt, a.startedAt));
    return all.subList(0, Math.min(limit, all.size()));
  }

  public static Map<String, Object> runs() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/launch/runs");
    payload.put("runs", getRecentRuns(50));
    return payload;
  }

  public static Map<String, Object> runStatus(String launchId) {
    LaunchRunInfo info = launches.get(launchId);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/launch/run-status");
    if (info != null) {
      payload.put("launchId", info.launchId);
      payload.put("launchConfigName", info.launchConfigName);
      payload.put("mode", info.mode);
      payload.put("startedAt", info.startedAt);
      payload.put("terminatedAt", info.terminatedAt);
      payload.put("durationMs", info.durationMs);
      payload.put("status", info.status);
      payload.put("exitCode", info.exitCode);
      payload.put("terminated", info.terminatedAt != null);
    } else {
      payload.put("ok", false);
      payload.put("error", error("LAUNCH_NOT_FOUND", "No se encontró launch: " + launchId));
    }
    return payload;
  }

  private static Map<String, Object> error(String code, String message) {
    Map<String, Object> err = new LinkedHashMap<>();
    err.put("code", code);
    err.put("message", message);
    return err;
  }
}