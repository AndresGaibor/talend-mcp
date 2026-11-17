package com.andres.talend.bridge.automation;

import static com.andres.talend.bridge.TestSupport.check;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.Comparator;

/**
 * La salida de un job se acumula en memoria mientras corre. Sin tope, un job
 * verboso llena el heap del bridge.
 */
public final class JobExecutorTests {
  private JobExecutorTests() {}

  public static void run() throws Exception {
    verifiesRecursiveGeneratedFolderSearch();

    Method drain = JobExecutor.class.getDeclaredMethod(
        "drain", InputStream.class, StringBuilder.class, AtomicBoolean.class);
    drain.setAccessible(true);

    // Salida corta: se conserva entera y no se marca como recortada.
    StringBuilder corta = new StringBuilder();
    AtomicBoolean cortaRecortada = new AtomicBoolean(false);
    Thread hiloCorto = (Thread) drain.invoke(null,
        flujo("linea uno\nlinea dos\n"), corta, cortaRecortada);
    hiloCorto.join(10_000);
    check(!cortaRecortada.get(), "una salida corta no se marca como recortada");
    check(corta.toString().contains("linea uno") && corta.toString().contains("linea dos"),
        "una salida corta se conserva entera");

    // Salida enorme: se queda el final y se avisa del recorte.
    StringBuilder entrada = new StringBuilder();
    for (int i = 0; i < 80_000; i++) {
      entrada.append("linea ").append(i).append(" de relleno para pasar del tope\n");
    }
    StringBuilder larga = new StringBuilder();
    AtomicBoolean largaRecortada = new AtomicBoolean(false);
    Thread hiloLargo = (Thread) drain.invoke(null,
        flujo(entrada.toString()), larga, largaRecortada);
    hiloLargo.join(20_000);
    check(largaRecortada.get(), "una salida enorme se marca como recortada");
    check(larga.length() <= 2_000_100, "la salida enorme respeta el tope (mide " + larga.length() + ")");
    check(larga.indexOf("salida recortada") >= 0, "la salida recortada lo dice al principio");
    check(larga.toString().contains("linea 79999 "), "la salida recortada conserva el final");
    check(!larga.toString().contains("linea 0 "), "la salida recortada suelta el principio");
  }

  private static void verifiesRecursiveGeneratedFolderSearch() throws Exception {
    Path root = Files.createTempDirectory("talend-generated-folder-test-");
    try {
      Path expected = Files.createDirectories(root.resolve("Azure_Talend").resolve("poc_azure_job_0.1"));
      Path found = JobExecutor.search(root, "poc_azure_job_0.1", 3);
      check(expected.equals(found), "la busqueda recursiva encuentra un proyecto generado bajo su carpeta de repositorio");
    } finally {
      try (java.util.stream.Stream<Path> paths = Files.walk(root)) {
        for (Path path : paths.sorted(Comparator.reverseOrder()).toArray(Path[]::new)) {
          Files.deleteIfExists(path);
        }
      }
    }
  }

  private static InputStream flujo(String texto) {
    return new ByteArrayInputStream(texto.getBytes(StandardCharsets.UTF_8));
  }
}
