package com.andres.talend.bridge.launch;

import static com.andres.talend.bridge.TestSupport.check;

import java.io.File;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

import com.andres.talend.bridge.launch.LaunchTrackerService.LaunchRunInfo;

/**
 * El store de lanzamientos es de solo anadir: al cargar se deja una sola linea por
 * lanzamiento y, si pasa del tope, se descartan los mas antiguos.
 */
public final class LaunchStoreTests {
  private LaunchStoreTests() {}

  public static void run() throws Exception {
    File store = new File(new File(System.getProperty("user.home"), ".talend-bridge"), "launch-runs.txt");
    store.getParentFile().mkdirs();

    Method serialize = LaunchTrackerService.class.getDeclaredMethod("serialize", LaunchRunInfo.class);
    serialize.setAccessible(true);

    // Un lanzamiento por cada entrada del tope mas diez, y cada uno escrito dos veces
    // (inicio y fin), como hace el store real al cambiar de estado.
    int total = LaunchTrackerService.MAX_STORED_RUNS + 10;
    List<String> lines = new ArrayList<>();
    for (int i = 0; i < total; i++) {
      LaunchRunInfo info = new LaunchRunInfo();
      info.launchId = "launch_" + i + "_MCP_Test";
      info.launchConfigName = "MCP_Test_" + i;
      info.mode = "run";
      info.startedAt = i;
      info.status = "started";
      lines.add((String) serialize.invoke(null, info));
      info.terminatedAt = (long) i + 1;
      info.durationMs = 1L;
      info.status = "success";
      info.exitCode = 0;
      lines.add((String) serialize.invoke(null, info));
    }
    Files.write(store.toPath(), String.join("\n", lines).concat("\n").getBytes(StandardCharsets.UTF_8));

    LaunchTrackerService.loadPersistedRuns();

    check(LaunchTrackerService.getLaunch("launch_" + (total - 1) + "_MCP_Test") != null,
        "el lanzamiento mas reciente se conserva al compactar");
    check(LaunchTrackerService.getLaunch("launch_0_MCP_Test") == null,
        "el lanzamiento mas antiguo se descarta al pasar del tope");
    long kept = Files.readAllLines(store.toPath(), StandardCharsets.UTF_8).stream()
        .filter(line -> !line.trim().isEmpty()).count();
    check(kept == LaunchTrackerService.MAX_STORED_RUNS,
        "el archivo queda con una linea por lanzamiento conservado (hay " + kept + ")");
    check(!new File(store.getParentFile(), store.getName() + ".tmp").exists(),
        "la reescritura no deja el temporal");

    // Un lanzamiento que seguia "started" al cargar no tiene vigilante: se cierra como interrumpido.
    LaunchRunInfo orphan = new LaunchRunInfo();
    orphan.launchId = "launch_orphan_MCP_Test";
    orphan.launchConfigName = "MCP_Orphan";
    orphan.mode = "run";
    orphan.startedAt = System.currentTimeMillis() - 60_000L;
    orphan.status = "started";
    Files.write(store.toPath(), ((String) serialize.invoke(null, orphan) + "\n").getBytes(StandardCharsets.UTF_8));

    LaunchTrackerService.loadPersistedRuns();
    LaunchRunInfo closed = LaunchTrackerService.getLaunch("launch_orphan_MCP_Test");
    check(closed != null && "interrupted".equals(closed.status) && closed.terminatedAt != null,
        "un lanzamiento huerfano se cierra como interrumpido al cargar, con su hora de fin");
    check(closed != null && closed.exitCode == null,
        "un lanzamiento interrumpido no inventa codigo de salida");
  }
}
