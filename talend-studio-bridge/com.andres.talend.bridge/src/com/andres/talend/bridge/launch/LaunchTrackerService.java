package com.andres.talend.bridge.launch;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IProcess;
import org.eclipse.debug.core.model.IStreamMonitor;
import org.eclipse.debug.core.model.IStreamsProxy;

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
   * Lanzamientos que se conservan en el store. Los mas antiguos se descartan al cargar.
   * Es un tope de crecimiento, no de historial: el store del equipo tenia ~1.700 y no
   * debe perder ninguno al compactarse.
   */
  static final int MAX_STORED_RUNS = 5000;

  /**
   * Cada cuanto se busca el proceso del job de un lanzamiento vigilado. En
   * Windows cada busqueda lanza PowerShell (~1 s), asi que no conviene mas rapido.
   */
  private static final long OBSERVE_POLL_MS = 3000L;

  private static final boolean WINDOWS = System.getProperty("os.name", "").toLowerCase().startsWith("windows");

  /** Margen entre el instante de arranque del proceso y el del lanzamiento. */
  private static final long START_TOLERANCE_MS = 2000L;

  /** Tiempo maximo para que aparezca el proceso del job (compilacion incluida). */
  private static final long PROCESS_APPEAR_TIMEOUT_MS = 15L * 60L * 1000L;

  /** Cuanto se espera a que Eclipse marque como terminado el proceso del launch. */
  private static final long EXIT_CODE_WAIT_MS = 2_000L;

  private static final long EXIT_CODE_POLL_MS = 200L;

  /** Vigilantes activos, por launchId. */
  private static final Map<String, Thread> observers = new ConcurrentHashMap<>();

  /** Launch de Eclipse de cada ejecucion, para leer el codigo de salida de su proceso. */
  private static final Map<String, ILaunch> launchOf = new ConcurrentHashMap<>();

  /** Lanzamientos cuya salida pide alguien (ver `capturarSalidaDe`). */
  private static final Set<String> capturando = ConcurrentHashMap.newKeySet();

  /** Salida recogida al terminar, {stdout, stderr}, hasta que alguien la entrega. */
  private static final Map<String, String[]> salidas = new ConcurrentHashMap<>();

  /** Tope de espera a que la salida de un proceso termine de llegar. */
  private static final long SALIDA_ESPERA_MS = 5_000L;

  /** La salida se da por completa cuando no crece durante este tiempo. */
  private static final long SALIDA_ESTABLE_MS = 200L;

  /** Procesos ya asignados a un lanzamiento, para no contarlos dos veces. */
  private static final Set<Long> claimedPids = ConcurrentHashMap.newKeySet();

  private LaunchTrackerService() {}

  /**
   * Pide capturar la salida (stdout y stderr) del lanzamiento al terminar.
   *
   * Se pide tras lanzarlo. Si el proceso acaba antes, no hay captura y quien la
   * pide tiene que relanzar el job por su cuenta.
   */
  public static void capturarSalidaDe(String launchId) {
    capturando.add(launchId);
  }

  /** Salida capturada del lanzamiento, {stdout, stderr}, o null si no se capturo. Se entrega una vez. */
  public static String[] recogerSalida(String launchId) {
    capturando.remove(launchId);
    return salidas.remove(launchId);
  }

  /** Texto de una salida cuando deja de crecer, o al agotar la espera. */
  private static String salidaCompleta(IStreamMonitor monitor) {
    if (monitor == null) {
      return "";
    }
    long limite = System.currentTimeMillis() + SALIDA_ESPERA_MS;
    String texto = monitor.getContents();
    while (System.currentTimeMillis() < limite) {
      try {
        Thread.sleep(SALIDA_ESTABLE_MS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      }
      String nuevo = monitor.getContents();
      if (nuevo.equals(texto)) {
        break;
      }
      texto = nuevo;
    }
    return texto;
  }

  /**
   * Un lanzamiento que seguia "started" al cargar el plugin ya no tiene vigilante: los
   * vigilantes viven en memoria y se pierden al recargar o reiniciar. Sin esto quedaba
   * "started" para siempre, como si el job siguiera corriendo. Se marca como interrumpido,
   * sin codigo de salida, que es lo que se sabe.
   */
  private static void markOrphanedRuns() {
    long now = System.currentTimeMillis();
    for (LaunchRunInfo info : launches.values()) {
      if (info.terminatedAt == null && "started".equals(info.status)) {
        info.status = "interrupted";
        info.terminatedAt = now;
        info.durationMs = now - info.startedAt;
        persist(info);
      }
    }
  }

  public static void loadPersistedRuns() {
    File file = getStoreFile();
    if (!file.exists()) return;

    int linesRead = 0;
    try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.trim().isEmpty()) continue;
        linesRead++;
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
      markOrphanedRuns();
    } catch (Exception e) {
      System.err.println("Failed to load persisted runs: " + e.getMessage());
      return;
    }
    // Fuera del try del lector: en Windows el archivo sigue bloqueado mientras esta abierto.
    try {
      compactStore(linesRead);
    } catch (IOException e) {
      System.err.println("Failed to compact persisted runs: " + e.getMessage());
    }
  }

  /**
   * El store es solo de anadir: cada cambio de estado es una linea nueva. Al cargar se
   * conserva el ultimo estado de cada lanzamiento (los MAX_STORED_RUNS mas recientes) y,
   * si el archivo tenia lineas de mas, se reescribe. Sin esto crecia sin limite y cada
   * arranque lo leia entero.
   */
  private static void compactStore(int linesRead) throws IOException {
    if (linesRead <= launches.size() && launches.size() <= MAX_STORED_RUNS) {
      return;
    }
    List<LaunchRunInfo> kept = new ArrayList<>(launches.values());
    kept.sort(Comparator.comparingLong((LaunchRunInfo info) -> info.startedAt));
    if (kept.size() > MAX_STORED_RUNS) {
      kept = new ArrayList<>(kept.subList(kept.size() - MAX_STORED_RUNS, kept.size()));
    }

    Set<String> keptIds = new HashSet<>();
    for (LaunchRunInfo info : kept) {
      keptIds.add(info.launchId);
    }
    launches.keySet().retainAll(keptIds);
    launchNameToLatestId.clear();
    for (LaunchRunInfo info : kept) {
      // Orden ascendente: el ultimo que se pone es el mas reciente de cada nombre.
      launchNameToLatestId.put(info.launchConfigName, info.launchId);
    }

    File store = getStoreFile();
    File temp = new File(store.getParentFile(), store.getName() + ".tmp");
    try (OutputStreamWriter writer = new OutputStreamWriter(new FileOutputStream(temp), StandardCharsets.UTF_8)) {
      for (LaunchRunInfo info : kept) {
        writer.write(serialize(info) + "\n");
      }
    }
    try {
      Files.move(temp.toPath(), store.toPath(), StandardCopyOption.REPLACE_EXISTING);
    } finally {
      temp.delete(); // Si el movimiento funciono, ya no existe: no hace nada.
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
   * Asocia el launch de Eclipse que devolvio `launch(...)` con su ejecucion.
   * Sin esto no hay forma de leer el codigo de salida del job.
   */
  public static void attachLaunch(String launchId, ILaunch launch) {
    if (launchId != null && launch != null) {
      launchOf.put(launchId, launch);
    }
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
   * Codigo de salida del job de un lanzamiento, leido de su proceso en Eclipse Debug.
   *
   * ProcessHandle no expone el codigo de salida en la API publica de Java (solo
   * el padre de un proceso lo tiene), asi que se mira por el lado de Eclipse: el
   * IProcess del lanzamiento tiene getExitValue(). Eclipse puede marcarlo como
   * terminado un instante despues de que el proceso del sistema acabe, por eso se
   * espera un poco. Si no aparece, el codigo queda desconocido (null): no se inventa.
   */
  private static Integer exitCodeOf(String launchId) {
    ILaunch launch = launchOf.remove(launchId);
    if (launch == null) {
      return null;
    }
    // Eclipse no registra un IProcess para el job en estos lanzamientos (medido): sin
    // procesos no hay nada que esperar, y esperar los 10 s de antes pagaba cada Run.
    if (launch.getProcesses().length == 0) {
      return null;
    }
    long deadline = System.currentTimeMillis() + EXIT_CODE_WAIT_MS;
    while (true) {
      for (IProcess process : launch.getProcesses()) {
        try {
          if (process.isTerminated()) {
            if (capturando.remove(launchId)) {
              IStreamsProxy proxy = process.getStreamsProxy();
              IStreamMonitor salida = proxy == null ? null : proxy.getOutputStreamMonitor();
              IStreamMonitor errores = proxy == null ? null : proxy.getErrorStreamMonitor();
              salidas.put(launchId, new String[] {salidaCompleta(salida), salidaCompleta(errores)});
            }
            return process.getExitValue();
          }
        } catch (DebugException e) {
          return null;
        }
      }
      if (System.currentTimeMillis() >= deadline) {
        return null;
      }
      try {
        Thread.sleep(EXIT_CODE_POLL_MS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return null;
      }
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
    // En Windows ProcessHandle no devuelve la linea de comandos de ningun proceso
    // (medido), asi que ahi solo sirve WMI: recorrer todos los procesos seria trabajo perdido.
    if (!WINDOWS) {
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
    }
    if (found.isEmpty() && WINDOWS) {
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
  /**
   * Cierra un lanzamiento cuyo proceso nunca se encontro. Sin esto quedaba "started" para
   * siempre, igual que los huerfanos al reiniciar.
   */
  private static void markUnobserved(String launchId) {
    LaunchRunInfo info = launches.get(launchId);
    if (info != null && info.terminatedAt == null) {
      info.status = "not_observed";
      info.terminatedAt = System.currentTimeMillis();
      info.durationMs = info.terminatedAt - info.startedAt;
      persist(info);
    }
  }

  private static void observe(String launchId, String launchConfigName, long startedAt) {
    Thread observer = new Thread(() -> {
      ProcessHandle job = null;
      try {
        job = waitForJobProcess(launchConfigName, startedAt);
        if (job != null) {
          job.onExit().get();
          markTerminated(launchId, exitCodeOf(launchId), null);
        } else {
          // El proceso no aparecio en el plazo: no se sabe cuando ni como termino.
          markUnobserved(launchId);
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      } catch (ExecutionException e) {
        System.err.println("Fallo la vigilancia del launch " + launchId + ": " + e.getMessage());
      } finally {
        if (job != null) {
          claimedPids.remove(job.pid());
        }
        launchOf.remove(launchId);
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
    long begin = System.currentTimeMillis();
    long deadline = begin + PROCESS_APPEAR_TIMEOUT_MS;
    long ultimoWmi = 0L;
    // Hijos de Studio ya descartados como ajenos al job: no se vuelven a consultar.
    Set<Long> descartados = new HashSet<>();
    while (System.currentTimeMillis() < deadline) {
      // Studio lanza la JVM del job como proceso hijo suyo: se busca entre los hijos,
      // sin PowerShell, cada 200 ms. Asi un job de 1 s tambien se ve.
      List<ProcessHandle> candidatos = javaHijosDesde(startedAt, descartados);
      if (!candidatos.isEmpty()) {
        ProcessHandle job = elegirJob(candidatos, launchConfigName, descartados);
        if (job != null) {
          return job;
        }
      }
      // La busqueda por linea de comandos sigue como respaldo, pero cada sondeo en
      // Windows lanza PowerShell (~0,8 s): se hace solo cada pocos segundos.
      long ahora = System.currentTimeMillis();
      if (ahora - ultimoWmi >= OBSERVE_POLL_MS) {
        ultimoWmi = ahora;
        for (ProcessHandle handle : processesOfJob(launchConfigName)) {
          if (startedAfter(handle, startedAt) && claimedPids.add(handle.pid())) {
            return handle;
          }
        }
      }
      Thread.sleep(200);
    }
    return null;
  }

  /**
   * Los `java.exe` hijos de Studio que arrancaron despues del lanzamiento, sin asignar
   * a otro lanzamiento y sin descartar.
   */
  private static List<ProcessHandle> javaHijosDesde(long startedAt, Set<Long> descartados) {
    List<ProcessHandle> found = new ArrayList<>();
    for (ProcessHandle hijo : ProcessHandle.current().children().toArray(ProcessHandle[]::new)) {
      String comando = hijo.info().command().orElse("");
      if (comando.toLowerCase().endsWith("java.exe") && startedAfter(hijo, startedAt)
          && !descartados.contains(hijo.pid()) && !claimedPids.contains(hijo.pid())) {
        found.add(hijo);
      }
    }
    return found;
  }

  /**
   * El hijo que es el proceso del job. Studio puede lanzar mas de un `java` tras el
   * Run, y el primero que aparece no siempre es el job: un `java` ajeno que vive mas
   * tiempo dejaba el lanzamiento en `started` hasta agotar la espera (120 s y 157 s
   * medidos). La linea de comandos de Windows solo se lee por WMI, asi que se
   * consulta una vez por tanda de candidatos: los que no llevan el nombre del job se
   * descartan. Si WMI no devuelve ningun proceso del job, se toma el primero.
   */
  private static ProcessHandle elegirJob(List<ProcessHandle> candidatos, String launchConfigName, Set<Long> descartados) {
    Set<Long> delJob = new HashSet<>();
    for (ProcessHandle handle : processesOfJob(launchConfigName)) {
      delJob.add(handle.pid());
    }
    for (ProcessHandle candidato : candidatos) {
      if (delJob.isEmpty() || delJob.contains(candidato.pid())) {
        if (claimedPids.add(candidato.pid())) {
          return candidato;
        }
      } else {
        descartados.add(candidato.pid());
      }
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
