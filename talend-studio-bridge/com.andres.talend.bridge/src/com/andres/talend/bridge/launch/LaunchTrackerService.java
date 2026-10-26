package com.andres.talend.bridge.launch;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

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

  /**
   * Cada cuanto se busca el proceso del job de un lanzamiento vigilado. En
   * Windows cada busqueda lanza PowerShell (~1 s), asi que no conviene mas rapido.
   */
  private static final long OBSERVE_POLL_MS = 3000L;

  /** Margen entre el instante de arranque del proceso y el del lanzamiento. */
  private static final long START_TOLERANCE_MS = 2000L;

  /** Tiempo maximo para que aparezca el proceso del job (compilacion incluida). */
  private static final long PROCESS_APPEAR_TIMEOUT_MS = 15L * 60L * 1000L;

  /** Vigilantes activos, por launchId. */
  private static final Map<String, Thread> observers = new ConcurrentHashMap<>();

  /** Procesos ya asignados a un lanzamiento, para no contarlos dos veces. */
  private static final Set<Long> claimedPids = ConcurrentHashMap.newKeySet();

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
    observe(launchId, launchConfigName, info.startedAt);
    return launchId;
  }

  /**
   * Marca el lanzamiento como terminado. Es idempotente: el vigilante y
   * `waitForLaunch` pueden llegar a la vez y solo el primero escribe.
   */
  public static synchronized void markTerminated(String launchId, Integer exitCode, Map<String, Object> extra) {
    LaunchRunInfo info = launches.get(launchId);
    if (info != null && info.terminatedAt == null) {
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

  /**
   * Espera a que el launch termine, como mucho `timeoutMs`.
   *
   * No sondea procesos: el fin lo marca el vigilante (`observe`). Si nadie
   * vigila el launch, no va a cambiar de estado y se devuelve enseguida en vez
   * de consumir todo el timeout.
   */
  public static LaunchRunInfo waitForLaunch(String launchId, int timeoutMs) {
    long deadline = System.currentTimeMillis() + timeoutMs;
    while (true) {
      LaunchRunInfo info = getLaunch(launchId);
      if (info == null || info.terminatedAt != null || !observers.containsKey(launchId)) {
        return info;
      }
      if (System.currentTimeMillis() >= deadline) {
        return info;
      }
      try {
        Thread.sleep(50);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return getLaunch(launchId);
      }
    }
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
    if (!jobName.matches("[A-Za-z0-9_.\\-]+")) {
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
    if (found.isEmpty() && System.getProperty("os.name", "").toLowerCase().startsWith("windows")) {
      found.addAll(processesByCommandLineOnWindows(jobName));
    }
    return found;
  }

  /**
   * Procesos de Windows cuya linea de comandos contiene el nombre del job.
   *
   * Desde la JVM de Studio, `ProcessHandle` no da la linea de comandos de los
   * procesos ajenos (viene vacia), pero WMI si. Se usa PowerShell, que hay en
   * cualquier Windows. El nombre ya viene validado, asi que no puede colar nada
   * en el comando.
   */
  private static List<ProcessHandle> processesByCommandLineOnWindows(String jobName) {
    List<ProcessHandle> found = new ArrayList<>();
    String script = "Get-CimInstance Win32_Process -Filter \"CommandLine LIKE '%" + jobName
        + "%'\" | ForEach-Object { $_.ProcessId }";
    String encoded = Base64.getEncoder().encodeToString(script.getBytes(StandardCharsets.UTF_16LE));
    try {
      Process powershell = new ProcessBuilder("powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded)
          .redirectError(ProcessBuilder.Redirect.DISCARD)
          .start();
      try (BufferedReader reader = new BufferedReader(new InputStreamReader(powershell.getInputStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
          String pid = line.trim();
          if (pid.matches("\\d+")) {
            ProcessHandle.of(Long.parseLong(pid)).ifPresent(found::add);
          }
        }
      }
      powershell.waitFor(10, TimeUnit.SECONDS);
    } catch (Exception e) {
      System.err.println("No se pudo consultar WMI por los procesos de " + jobName + ": " + e.getMessage());
    }
    return found;
  }

  /**
   * Vigila el proceso del job de un lanzamiento hasta que termina.
   *
   * Talend no emite evento de depuracion para estos lanzamientos, asi que el
   * fin se detecta por el proceso del sistema. La vigilancia arranca con el
   * lanzamiento y no solo cuando alguien llama a `waitForLaunch`: un job que
   * acaba antes de esa llamada no dejaria rastro para encontrarlo despues.
   */
  private static void observe(String launchId, String launchConfigName, long startedAt) {
    Thread observer = new Thread(() -> {
      ProcessHandle job = null;
      try {
        job = waitForJobProcess(launchConfigName, startedAt);
        if (job != null) {
          job.onExit().get();
          markTerminated(launchId, exitCodeOf(job), null);
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      } catch (ExecutionException e) {
        System.err.println("Fallo la vigilancia del launch " + launchId + ": " + e.getMessage());
      } finally {
        if (job != null) {
          claimedPids.remove(job.pid());
        }
        observers.remove(launchId);
      }
    }, "talend-bridge-launch-" + launchId);
    observer.setDaemon(true);
    observers.put(launchId, observer);
    observer.start();
  }

  /**
   * Espera a que aparezca el proceso del job que arranco despues del lanzamiento.
   *
   * Ignora los procesos ya asignados a otro lanzamiento y los que arrancaron
   * antes, para no confundir una ejecucion anterior del mismo job. Devuelve
   * null si el proceso no aparece dentro de PROCESS_APPEAR_TIMEOUT_MS.
   */
  private static ProcessHandle waitForJobProcess(String launchConfigName, long startedAt) throws InterruptedException {
    long deadline = System.currentTimeMillis() + PROCESS_APPEAR_TIMEOUT_MS;
    while (System.currentTimeMillis() < deadline) {
      for (ProcessHandle handle : processesOfJob(launchConfigName)) {
        if (startedAfter(handle, startedAt) && claimedPids.add(handle.pid())) {
          return handle;
        }
      }
      Thread.sleep(OBSERVE_POLL_MS);
    }
    return null;
  }

  private static boolean startedAfter(ProcessHandle handle, long startedAt) {
    return handle.info().startInstant()
        .map(instant -> instant.toEpochMilli() >= startedAt - START_TOLERANCE_MS)
        .orElse(false);
  }

  /**
   * Para los vigilantes. Se llama al detener el plugin, que tambien ocurre al
   * recargarlo en caliente: asi no quedan hilos del classloader anterior.
   */
  public static void stopObservers() {
    for (Thread observer : observers.values()) {
      observer.interrupt();
    }
    observers.clear();
    claimedPids.clear();
  }

  /**
   * Estado que ve quien consulta. Un launch sin fin y sin vigilante no se puede
   * confirmar: se devuelve `unobserved` en vez de un `started` que nadie actualiza.
   */
  private static String displayStatus(LaunchRunInfo info) {
    if (info.terminatedAt == null && !observers.containsKey(info.launchId)) {
      return "unobserved";
    }
    return info.status;
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
      payload.put("status", displayStatus(info));
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
