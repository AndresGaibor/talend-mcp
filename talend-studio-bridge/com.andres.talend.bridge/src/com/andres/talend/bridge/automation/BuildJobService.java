package com.andres.talend.bridge.automation;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import com.google.gson.JsonObject;

/**
 * Build Job: genera el zip autonomo de un job compilado (launcher `_run.bat`/`_run.sh`/`_run.ps1`,
 * jar del job, `lib/` con sus dependencias y el contexto por defecto) y lo extrae en una carpeta.
 *
 * Es el mismo paquete que produce el asistente Export Job de Studio, con la opcion de binarios. Un
 * programador externo lo puede ejecutar sin Studio. El zip se extrae en `<destination>/` porque el
 * launcher busca `../lib` relativo a su propia carpeta.
 *
 * Se llama por reflexion, como el resto del bridge, para no depender de los paquetes de Talend en el
 * manifiesto del plugin. Corre en el hilo HTTP, no en el de la UI.
 */
public final class BuildJobService {

  private static final String BUILD_JOB_MANAGER =
      "org.talend.repository.ui.wizards.exportjob.scriptsmanager.BuildJobManager";
  private static final String EXPORT_CHOICE =
      "org.talend.repository.ui.wizards.exportjob.scriptsmanager.JobScriptsManager$ExportChoice";
  private static final String JOB_EXPORT_TYPE =
      "org.talend.repository.ui.wizards.exportjob.JavaJobScriptsExportWSWizardPage$JobExportType";
  private static final String NULL_MONITOR = "org.eclipse.core.runtime.NullProgressMonitor";

  private static final String DEFAULT_VERSION = "0.1";
  private static final String DEFAULT_CONTEXT = "Default";

  private BuildJobService() {}

  /**
   * Construye el job indicado.
   *
   * @param spec job (obligatorio), destination (carpeta absoluta, obligatoria), version y context (opcionales).
   * @return zipPath, extractedDir, launcherPath, sizeBytes y durationMs.
   */
  public static Map<String, Object> build(JsonObject spec) throws Exception {
    String job = JsonSpec.required(spec, "job");
    String destination = JsonSpec.required(spec, "destination");
    String version = orDefault(JsonSpec.string(spec, "version"), DEFAULT_VERSION);
    String context = orDefault(JsonSpec.string(spec, "context"), DEFAULT_CONTEXT);

    File carpeta = new File(destination);
    if (!carpeta.isAbsolute()) {
      throw new IllegalArgumentException("destination debe ser una ruta absoluta: " + destination);
    }
    if (!carpeta.isDirectory() && !carpeta.mkdirs()) {
      throw new IllegalStateException("No se pudo crear la carpeta de destino: " + destination);
    }

    Object factory = TalendApi.repositoryFactory();
    Object view = JobRepository.findByLabel(factory, job);
    if (view == null) {
      throw new IllegalStateException("No existe el job '" + job + "' en el proyecto");
    }
    Object item = invoke(invoke(view, "getProperty"), "getItem");

    Map<Object, Object> choices = new HashMap<>();
    choices.put(exportChoice("needLauncher"), Boolean.TRUE);
    choices.put(exportChoice("needSystemRoutine"), Boolean.TRUE);
    choices.put(exportChoice("needUserRoutine"), Boolean.TRUE);
    choices.put(exportChoice("needContext"), Boolean.TRUE);
    choices.put(exportChoice("contextName"), context);
    choices.put(exportChoice("binaries"), Boolean.TRUE);

    Object manager = TalendClasses.load(BUILD_JOB_MANAGER).getMethod("getInstance").invoke(null);
    Object jobExportType = TalendClasses.load(JOB_EXPORT_TYPE).getField("POJO").get(null);
    Object monitor = TalendClasses.load(NULL_MONITOR).getConstructor().newInstance();
    Method buildJob = null;
    for (Method method : manager.getClass().getMethods()) {
      if ("buildJob".equals(method.getName()) && method.getParameterCount() == 7) {
        buildJob = method;
        break;
      }
    }
    if (buildJob == null) {
      throw new IllegalStateException("BuildJobManager no expone buildJob(7 argumentos) en esta version de Studio");
    }

    long start = System.currentTimeMillis();
    buildJob.invoke(manager, carpeta.getAbsolutePath(), item, version, context, choices, jobExportType, monitor);
    long durationMs = System.currentTimeMillis() - start;

    File zip = newestZipSince(carpeta, start - 1000L);
    if (zip == null) {
      throw new IllegalStateException("Studio no dejo ningun zip en " + destination);
    }
    List<String> extraidos = extract(zip, carpeta);
    File launcher = findLauncher(carpeta, job);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("job", job);
    result.put("version", version);
    result.put("context", context);
    result.put("zipPath", zip.getAbsolutePath());
    result.put("sizeBytes", zip.length());
    result.put("extractedDir", carpeta.getAbsolutePath());
    result.put("entries", extraidos.size());
    result.put("launcherPath", launcher == null ? null : launcher.getAbsolutePath());
    result.put("durationMs", durationMs);
    return result;
  }

  private static Object exportChoice(String name) throws Exception {
    return TalendClasses.load(EXPORT_CHOICE).getField(name).get(null);
  }

  private static String orDefault(String value, String fallback) {
    return value == null || value.trim().isEmpty() ? fallback : value.trim();
  }

  /** El zip mas reciente de la carpeta, escrito desde el instante dado. */
  private static File newestZipSince(File carpeta, long desde) {
    File[] zips = carpeta.listFiles((dir, name) -> name.toLowerCase().endsWith(".zip"));
    if (zips == null) {
      return null;
    }
    File elegido = null;
    for (File zip : zips) {
      if (zip.lastModified() < desde) {
        continue;
      }
      if (elegido == null || zip.lastModified() > elegido.lastModified()) {
        elegido = zip;
      }
    }
    return elegido;
  }

  /**
   * Extrae el zip en la carpeta dada. Rechaza las entradas que salgan de ella (zip slip).
   *
   * @return nombres de las entradas extraidas
   */
  static List<String> extract(File zipFile, File destino) throws IOException {
    Path raiz = destino.toPath().toAbsolutePath().normalize();
    List<String> nombres = new ArrayList<>();
    try (ZipFile zip = new ZipFile(zipFile)) {
      java.util.Enumeration<? extends ZipEntry> entradas = zip.entries();
      while (entradas.hasMoreElements()) {
        ZipEntry entrada = entradas.nextElement();
        Path objetivo = raiz.resolve(entrada.getName()).normalize();
        if (!objetivo.startsWith(raiz)) {
          throw new IOException("Entrada fuera de la carpeta de destino: " + entrada.getName());
        }
        File archivo = objetivo.toFile();
        if (entrada.isDirectory()) {
          archivo.mkdirs();
          continue;
        }
        archivo.getParentFile().mkdirs();
        try (InputStream in = zip.getInputStream(entrada); OutputStream out = new FileOutputStream(archivo)) {
          in.transferTo(out);
        }
        nombres.add(entrada.getName());
      }
    }
    return nombres;
  }

  /** El launcher del job: `<JOB>/<JOB>_run.bat` o `.sh`, el que haya en la carpeta extraida. */
  private static File findLauncher(File carpeta, String job) {
    String[] candidatos = {job + "_run.bat", job + "_run.sh", job + "_run.ps1"};
    File carpetaJob = new File(carpeta, job);
    for (String nombre : candidatos) {
      File archivo = new File(carpetaJob, nombre);
      if (archivo.isFile()) {
        return archivo;
      }
    }
    return null;
  }

  private static Object invoke(Object target, String method) throws Exception {
    if (target == null) {
      throw new IllegalStateException("Objeto nulo al invocar " + method);
    }
    return target.getClass().getMethod(method).invoke(target);
  }
}
