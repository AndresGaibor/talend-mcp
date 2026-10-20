package com.andres.talend.bridge.launch;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

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

  public static void loadPersistedRuns() {
    File file = getStoreFile();
    if (!file.exists()) return;

    try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.trim().isEmpty()) continue;
        try {
          LaunchRunInfo info = deserialize(line);
          if (info != null && info.launchId != null) {
            launches.put(info.launchId, info);

            String currentLatest = launchNameToLatestId.get(info.launchConfigName);
            if (currentLatest == null) {
              launchNameToLatestId.put(info.launchConfigName, info.launchId);
            } else {
              LaunchRunInfo currentInfo = launches.get(currentLatest);
              if (currentInfo == null || info.startedAt > currentInfo.startedAt) {
                launchNameToLatestId.put(info.launchConfigName, info.launchId);
              }
            }
          }
        } catch (Exception ignored) {}
      }
    } catch (Exception e) {
      System.err.println("Failed to load persisted runs: " + e.getMessage());
    }
  }

  public static String registerLaunch(String launchConfigName, String mode) {
    String safeName = launchConfigName.replaceAll("[^a-zA-Z0-9_.-]+", "_");
    String launchId = "launch_" + System.currentTimeMillis() + "_" + safeName;
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

  /**
   * Marca como terminada la ultima ejecucion de una configuracion de arranque.
   *
   * Es la via que usa el listener de Eclipse: al terminar el proceso del job
   * solo se sabe el nombre de la configuracion, no el identificador que se
   * dio al registrar el arranque.
   */
  public static void markTerminatedByLaunchName(String launchConfigName, Integer exitCode) {
    if (launchConfigName == null) {
      return;
    }
    String launchId = launchNameToLatestId.get(launchConfigName);
    if (launchId == null) {
      return;
    }
    markTerminated(launchId, exitCode, null);
  }

  public static LaunchRunInfo waitForLaunch(String launchId, int timeoutMs) {
    long deadline = System.currentTimeMillis() + timeoutMs;
    while (true) {
      LaunchRunInfo info = getLaunch(launchId);
      if (info != null && info.terminatedAt != null) {
        return info;
      }
      long remaining = deadline - System.currentTimeMillis();
      if (remaining <= 0) {
        return getLaunch(launchId);
      }
      if (info != null) {
        // Talend ejecuta cada job en una JVM aparte. El fin del proceso es
        // la senal de que el job termino: el evento de depuracion de
        // Eclipse no se emite para estos lanzamientos.
        for (ProcessHandle handle : processesOfJob(info.launchConfigName)) {
          try {
            handle.onExit().get(Math.min(remaining, 1000), TimeUnit.MILLISECONDS);
            markTerminated(launchId, exitCodeOf(handle), null);
            return getLaunch(launchId);
          } catch (TimeoutException e) {
            // Todavia no ha terminado: se sigue esperando.
          } catch (Exception e) {
            // El proceso ya no esta: se comprueba en la siguiente vuelta.
          }
        }
      }
      try {
        Thread.sleep(50);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      }
    }
    return getLaunch(launchId);
  }

  /**
   * Codigo de salida de un proceso ya terminado.
   *
   * Se pide por reflexion porque la version de Java con la que compila el
   * plugin no siempre expone `ProcessHandle.Info.exitCode`.
   */
  private static Integer exitCodeOf(ProcessHandle handle) {
    try {
      Object info = handle.getClass().getMethod("info").invoke(handle);
      Object value = info.getClass().getMethod("exitCode").invoke(info);
      if (value instanceof java.util.Optional) {
        value = ((java.util.Optional<?>) value).orElse(null);
      }
      return value instanceof Integer ? (Integer) value : null;
    } catch (Exception e) {
      return null;
    }
  }

  /**
   * Procesos del sistema operativo que corresponden a un job.
   *
   * Se buscan por la linea de comandos, que incluye el nombre de la clase
   * java del job: `prj_bancolombia.mcp_fase0_zero_0_1.MCP_Fase0_Zero`.
   */
  private static List<ProcessHandle> processesOfJob(String launchConfigName) {
    List<ProcessHandle> found = new ArrayList<>();
    if (launchConfigName == null) {
      return found;
    }
    String jobName = launchConfigName.trim();
    int space = jobName.indexOf(' ');
    if (space > 0) {
      jobName = jobName.substring(0, space);
    }
    if (jobName.isEmpty()) {
      return found;
    }
    for (ProcessHandle handle : ProcessHandle.allProcesses().toArray(ProcessHandle[]::new)) {
      try {
        String command = handle.info().commandLine().orElse("");
        if (command.contains(jobName)) {
          found.add(handle);
        }
      } catch (Exception e) {
        // Hay procesos que no dejan leer su linea de comandos.
      }
    }
    return found;
  }

  private static void persist(LaunchRunInfo info) {
    try {
      File file = getStoreFile();
      try (OutputStreamWriter writer = new OutputStreamWriter(new FileOutputStream(file, true), StandardCharsets.UTF_8)) {
        writer.write(serialize(info) + "\n");
      }
    } catch (Exception e) {
      System.err.println("Failed to persist launch run: " + e.getMessage());
    }
  }

  private static File getStoreFile() {
    File dir = new File(System.getProperty("user.home"), ".talend-bridge");
    if (!dir.exists()) dir.mkdirs();
    return new File(dir, "launch-runs.txt");
  }

  private static String serialize(LaunchRunInfo info) {
    StringBuilder sb = new StringBuilder();
    sb.append(nullSafe(info.launchId)).append("|");
    sb.append(nullSafe(info.launchConfigName)).append("|");
    sb.append(nullSafe(info.mode)).append("|");
    sb.append(info.startedAt).append("|");
    sb.append(info.terminatedAt != null ? info.terminatedAt : "").append("|");
    sb.append(info.durationMs != null ? info.durationMs : "").append("|");
    sb.append(nullSafe(info.status)).append("|");
    sb.append(info.exitCode != null ? info.exitCode : "").append("|");
    sb.append(info.extra != null ? info.extra.toString() : "");
    return sb.toString();
  }

  private static String nullSafe(String s) {
    return s != null ? s : "";
  }

  private static LaunchRunInfo deserialize(String line) {
    try {
      String[] parts = line.split("\\|", -1);
      if (parts.length < 8) return null;
      LaunchRunInfo info = new LaunchRunInfo();
      info.launchId = parts[0];
      info.launchConfigName = parts[1];
      info.mode = parts[2];
      info.startedAt = Long.parseLong(parts[3]);
      info.terminatedAt = parts[4].isEmpty() ? null : Long.parseLong(parts[4]);
      info.durationMs = parts[5].isEmpty() ? null : Long.parseLong(parts[5]);
      info.status = parts[6];
      info.exitCode = parts[7].isEmpty() ? null : Integer.parseInt(parts[7]);
      return info;
    } catch (Exception e) {
      return null;
    }
  }

  public static String findLatestLaunchIdByName(String launchConfigName) {
    return launchNameToLatestId.get(launchConfigName);
  }

  public static LaunchRunInfo getLaunch(String launchId) {
    if (launchId == null) return null;
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
    LaunchRunInfo info = getLaunch(launchId);
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
