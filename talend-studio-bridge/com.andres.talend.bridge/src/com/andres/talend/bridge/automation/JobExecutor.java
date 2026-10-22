package com.andres.talend.bridge.automation;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import com.andres.talend.bridge.BridgeLog;
import com.andres.talend.bridge.UiThread;

import com.google.gson.JsonObject;

import org.eclipse.core.resources.IProject;

/**
 * Ejecuta un job ya generado y devuelve su salida.
 *
 * Talend ejecuta cada job en una JVM aparte y muestra el resultado en la vista
 * Run, que no se puede leer desde el bridge. Pero el codigo generado queda en
 * el workspace, con un `target/classpath.jar` que lleva el classpath completo
 * en su MANIFEST. Con eso se puede relanzar el job capturando su salida, que
 * es lo que hace falta para comprobar que el resultado es el esperado.
 *
 * El proceso se relanza, no se intercepta: el job ya se ha ejecutado una vez
 * (con `run_active_job`) y aqui se ejecuta otra vez para leer su salida.
 */
public final class JobExecutor {

  private JobExecutor() {}

  /** Tiempo maximo de la ejecucion, en milisegundos. */
  private static final long DEFAULT_TIMEOUT_MS = 300_000L;

  /**
   * Ejecuta el job generado y devuelve su salida.
   *
   * @param spec name, version, context y timeoutMs.
   */
  public static Map<String, Object> execute(JsonObject spec) throws Exception {
    String name = JsonSpec.required(spec, "name");
    String version = JsonSpec.string(spec, "version");
    if (version == null || version.trim().isEmpty()) {
      version = "0.1";
    }
    String context = JsonSpec.string(spec, "context");
    if (context == null || context.trim().isEmpty()) {
      context = "Default";
    }
    long timeoutMs = 300_000L;
    String rawTimeout = JsonSpec.string(spec, "timeoutMs");
    if (rawTimeout != null) {
      try {
        timeoutMs = Long.parseLong(rawTimeout);
      } catch (NumberFormatException e) {
        timeoutMs = DEFAULT_TIMEOUT_MS;
      }
    }

    Path folder = generatedFolder(name, version);
    if (folder == null) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("executed", false);
      result.put("jobName", name);
      result.put("error", "El job no tiene codigo generado. Ejecutalo antes con talend_job_run.");
      return result;
    }
    Path classpathJar = folder.resolve("target").resolve("classpath.jar");
    if (!Files.isRegularFile(classpathJar)) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("executed", false);
      result.put("jobName", name);
      result.put("error", "El job no esta compilado: no existe target/classpath.jar");
      return result;
    }

    String mainClass = mainClassOf(folder, name);
    if (mainClass == null) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("executed", false);
      result.put("jobName", name);
      result.put("error", "No se encontro la clase principal del job en target/classes");
      return result;
    }

    List<String> command = new ArrayList<>();
    command.add(javaBinary());
    command.add("-Xms256M");
    command.add("-Xmx1024M");
    command.add("-Dfile.encoding=UTF-8");
    command.add("-Dstdout.encoding=UTF-8");
    command.add("-cp");
    command.add(classpathJar.toString());
    command.add(mainClass);
    command.add("--context=" + context);
    // Los valores del contexto no viajan en el codigo generado: los inyecta
    // el runtime, y aqui se le pasan como argumentos ("--context_type
    // CLAVE=VALOR"). Sin esto, un job relanzado a mano no ve sus variables.
    // Ojo: el "=" va pegado, el runtime lee el argumento entero.
    for (String value : contextValuesOf(name, context)) {
      command.add("--context_type=" + value);
    }

    ProcessBuilder builder = new ProcessBuilder(command);
    builder.redirectErrorStream(false);
    Process process = builder.start();

    StringBuilder stdout = new StringBuilder();
    StringBuilder stderr = new StringBuilder();
    Thread out = drain(process.getInputStream(), stdout);
    Thread err = drain(process.getErrorStream(), stderr);

    Integer exitCode = null;
    boolean finished = false;
    try {
      finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    if (!finished) {
      process.destroyForcibly();
    }
    out.join(2000);
    err.join(2000);
    if (finished) {
      exitCode = process.exitValue();
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("executed", true);
    result.put("jobName", name);
    result.put("version", version);
    result.put("mainClass", mainClass);
    result.put("exitCode", exitCode);
    result.put("timedOut", !finished);
    result.put("stdout", stdout.toString());
    result.put("stderr", stderr.toString());
    result.put("lines", linesOf(stdout.toString()));
    return result;
  }

  /**
   * Carpeta del proyecto generado de un job.
   *
   * Vive en el proyecto de Eclipse, bajo `poms/jobs/process/<job>/<job>_<version>`.
   * El nombre de la carpeta del proyecto va en minusculas y con guiones
   * bajos: `MCP_Fase6_Padre` 0.1 esta en `mcp_fase6_padre_0.1`.
   */
  private static Path generatedFolder(String name, String version) {
    try {
      IProject iProject = TalendApi.resourceProject();
      if (iProject == null) {
        return null;
      }
      org.eclipse.core.resources.IFolder root = iProject.getFolder("poms/jobs/process");
      if (!root.exists()) {
        return null;
      }
      String normalized = name.toLowerCase().replace('-', '_') + "_" + version.replace('-', '_');
      Path base = root.getLocation().toPath();
      // Primero dentro de la carpeta del job, y luego en cualquier subcarpeta.
      Path direct = base.resolve(name).resolve(normalized);
      if (Files.isDirectory(direct)) {
        return direct;
      }
      Path found = search(base, normalized, 3);
      if (found != null) {
        return found;
      }
      return search(base, name + "_" + version, 3);
    } catch (Exception e) {
      BridgeLog.warn("No se pudo localizar la carpeta del job '" + name + "'", e);
      return null;
    }
  }

  /** Busca una carpeta por nombre, con una profundidad maxima. */
  private static Path search(Path root, String folderName, int depth) {
    if (depth < 0 || !Files.isDirectory(root)) {
      return null;
    }
    try (java.util.stream.Stream<Path> entries = Files.list(root)) {
      for (Path entry : entries.toArray(Path[]::new)) {
        if (Files.isDirectory(entry) && entry.getFileName().toString().equals(folderName)) {
          return entry;
        }
      }
      for (Path entry : entries.toArray(Path[]::new)) {
        if (Files.isDirectory(entry)) {
          Path found = search(entry, folderName, depth - 1);
          if (found != null) {
            return found;
          }
        }
      }
    } catch (Exception e) {
      return null;
    }
    return null;
  }

  /**
   * Los valores de las variables del contexto, en formato "CLAVE=VALOR".
   *
   * Se leen del modelo del job (el que tiene abierto Studio). Si el job no
   * esta abierto, se leen del fichero `contexts/<contexto>.properties` que
   * deja el build.
   */
  private static List<String> contextValuesOf(String jobName, String context) {
    List<String> values = new ArrayList<>();
    try {
      Object editor = UiThread.sync(() -> TalendApi.designerEditor(jobSpec(jobName)), 10_000L);
      Object process = UiThread.sync(() -> TalendApi.processOf(editor), 10_000L);
      Object manager = process.getClass().getMethod("getContextManager").invoke(process);
      Object chosen = null;
      for (Object candidate : contextsOf(manager)) {
        String name = String.valueOf(candidate.getClass().getMethod("getName").invoke(candidate));
        if (name.equals(context)) {
          chosen = candidate;
          break;
        }
      }
      if (chosen == null) {
        chosen = manager.getClass().getMethod("getDefaultContext").invoke(manager);
      }
      if (chosen == null) {
        return values;
      }
      Object parameters = chosen.getClass().getMethod("getContextParameterList").invoke(chosen);
      if (parameters instanceof Iterable) {
        for (Object parameter : (Iterable<?>) parameters) {
          String name = String.valueOf(parameter.getClass().getMethod("getName").invoke(parameter));
          String value = String.valueOf(parameter.getClass().getMethod("getValue").invoke(parameter));
          values.add(name + "=" + value);
        }
      }
      return values;
    } catch (Exception e) {
      BridgeLog.warn("No se pudieron leer los valores del contexto '" + context + "'", e);
      return values;
    }
  }

  /** El spec del job, para abrirlo en el editor. */
  private static com.google.gson.JsonObject jobSpec(String jobName) {
    com.google.gson.JsonObject spec = new com.google.gson.JsonObject();
    spec.addProperty("job", jobName);
    return spec;
  }

  /** Los contextos del job. */
  @SuppressWarnings("unchecked")
  private static List<Object> contextsOf(Object manager) throws Exception {
    Object list = manager.getClass().getMethod("getListContext").invoke(manager);
    return list instanceof List ? (List<Object>) list : new ArrayList<>();
  }

  /**
   * Busca la clase principal del job, deducida de las clases compiladas.
   *
   * Se busca el fichero `<JobName>.class` en `target/classes`: su ruta
   * relativa es el paquete mas la clase.
   */
  private static String mainClassOf(Path folder, String jobName) {
    Path classes = folder.resolve("target").resolve("classes");
    if (!Files.isDirectory(classes)) {
      return null;
    }
    try (java.util.stream.Stream<Path> entries = Files.walk(classes)) {
      for (Path entry : entries.toArray(Path[]::new)) {
        String fileName = entry.getFileName().toString();
        if (!fileName.endsWith(".class")) {
          continue;
        }
        String simple = fileName.substring(0, fileName.length() - ".class".length());
        if (!simple.equals(jobName)) {
          continue;
        }
        Path relative = classes.relativize(entry);
        StringBuilder full = new StringBuilder();
        for (int i = 0; i < relative.getNameCount() - 1; i++) {
          if (full.length() > 0) {
            full.append('.');
          }
          full.append(relative.getName(i).toString());
        }
        full.append('.').append(simple);
        return full.toString();
      }
    } catch (Exception e) {
      BridgeLog.warn("No se pudo buscar la clase principal del job", e);
    }
    return null;
  }

  /** Lineas de la salida del job, sin las vacias. */
  private static List<String> linesOf(String stdout) {
    List<String> lines = new ArrayList<>();
    for (String line : stdout.split("\\r?\\n")) {
      if (!line.trim().isEmpty()) {
        lines.add(line);
      }
    }
    return lines;
  }

  /** El java del propio runtime de Studio. */
  private static String javaBinary() {
    String home = System.getProperty("java.home");
    String separator = home.contains("\\") ? "\\" : "/";
    return home + separator + "bin" + separator + "java";
  }

  /** Lee un flujo en un hilo aparte y lo acumula. */
  private static Thread drain(java.io.InputStream stream, StringBuilder target) {
    Thread thread = new Thread(() -> {
      try (BufferedReader reader = new BufferedReader(
          new InputStreamReader(stream, StandardCharsets.UTF_8))) {
        String line;
        while ((line = reader.readLine()) != null) {
          synchronized (target) {
            target.append(line).append(System.lineSeparator());
          }
        }
      } catch (Exception e) {
        // El proceso se ha terminado: no pasa nada.
      }
    });
    thread.setDaemon(true);
    thread.start();
    return thread;
  }
}
