package com.andres.talend.bridge;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.concurrent.atomic.AtomicBoolean;

import org.osgi.framework.Bundle;

/**
 * Carga en caliente del bundle.
 *
 * Vigila el jar en `~/.talend-bridge/hot/bridge.jar`. Cuando el archivo cambia
 * (el instalador lo copia despues de compilar), recarga el bundle con
 * {@link Bundle#update(java.io.InputStream)}: OSGi descarta el classloader,
 * detiene el Activator y lo vuelve a iniciar, asi que el servidor HTTP queda
 * sirviendo el codigo nuevo sin reiniciar Talend Studio.
 *
 * El jar que queda cargado en disco es el que instalo p2, de modo que un
 * reinicio posterior de Studio arranca con la misma version.
 */
public final class HotReloadService {
  private static final long POLL_INTERVAL_MS = 2000;
  private static final String HOT_DIR_ENV = "TALEND_BRIDGE_HOT_DIR";
  private static final String HOT_FILE_NAME = "bridge.jar";

  private final AtomicBoolean running = new AtomicBoolean(false);
  private volatile Thread watcher;

  public void start(Bundle bundle) {
    if (!running.compareAndSet(false, true)) return;

    Thread thread = new Thread(() -> watch(bundle), "talend-bridge-hot-reload");
    thread.setDaemon(true);
    watcher = thread;
    thread.start();

    BridgeLog.info("Carga en caliente activa: vigilando " + hotJarPath());
  }

  public void stop() {
    running.set(false);
    Thread thread = watcher;
    if (thread != null) {
      thread.interrupt();
    }
    watcher = null;
  }

  /** Ruta del jar que activa la recarga. */
  public static Path hotJarPath() {
    String dir = System.getenv(HOT_DIR_ENV);
    Path base = dir != null && !dir.isBlank()
        ? Paths.get(dir)
        : Paths.get(System.getProperty("user.home"), ".talend-bridge", "hot");
    return base.resolve(HOT_FILE_NAME);
  }

  private void watch(Bundle bundle) {
    // La firma se guarda en un archivo aparte porque el classloader del bundle se
    // reemplaza al recargar: sin esto, la instancia nueva detectaria el mismo
    // jar como "cambiado" y volveria a recargar en bucle.
    Path signatureFile = signaturePath();
    String lastSignature = readSignature(signatureFile);
    Path hotJar = hotJarPath();

    while (running.get()) {
      try {
        Thread.sleep(POLL_INTERVAL_MS);
      } catch (InterruptedException e) {
        return;
      }

      try {
        if (!Files.isRegularFile(hotJar)) continue;

        String signature = signatureOf(hotJar);
        if (signature.equals(lastSignature)) continue;
        lastSignature = signature;

        byte[] bytes = Files.readAllBytes(hotJar);
        if (bytes.length == 0) continue;

        writeSignature(signatureFile, signature);

        // El framework reinicia el Activator al recargar: la instancia vieja ya no
        // debe seguir vigilando.
        running.set(false);
        BridgeLog.info("Cambio detectado en " + hotJar + ". Recargando el bundle...");
        reload(bundle, bytes);
        return;
      } catch (IOException | RuntimeException e) {
        BridgeLog.warn("No se pudo evaluar la carga en caliente", e);
      }
    }
  }

  /** Firma del jar: tamaño y fecha de modificacion. */
  private static String signatureOf(Path jar) throws IOException {
    return Files.size(jar) + ":" + Files.getLastModifiedTime(jar).toMillis();
  }

  private static Path signaturePath() {
    Path jar = hotJarPath();
    Path parent = jar.getParent();
    return parent == null ? Paths.get(jar.getFileName() + ".sig") : parent.resolve(jar.getFileName() + ".sig");
  }

  private static String readSignature(Path file) {
    try {
      if (!Files.isRegularFile(file)) return "";
      return new String(Files.readAllBytes(file), java.nio.charset.StandardCharsets.UTF_8).trim();
    } catch (IOException e) {
      return "";
    }
  }

  private static void writeSignature(Path file, String signature) {
    try {
      Files.write(file, signature.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    } catch (IOException e) {
      BridgeLog.warn("No se pudo guardar la firma del jar", e);
    }
  }

  private void reload(Bundle bundle, byte[] bytes) {
    try {
      bundle.update(new ByteArrayInputStream(bytes));
      BridgeLog.info("Bundle recargado en caliente");
    } catch (org.osgi.framework.BundleException e) {
      BridgeLog.error("Fallo la recarga en caliente del bundle", e);
    } catch (RuntimeException e) {
      BridgeLog.error("Fallo la recarga en caliente del bundle", e);
    }
  }

  /**
   * Copia el jar recargado sobre el jar que tiene abierto el sistema operativo.
   * Es best effort: en Windows el archivo puede estar bloqueado.
   */
  public static void persistHotJar(byte[] bytes) {
    try {
      Bundle bundle = BundleUtilOwn.bundle();
      if (bundle == null) return;

      String location = bundle.getLocation();
      if (location == null || !location.startsWith("file:")) return;

      String path = location.substring("file:".length());
      if (path.startsWith("/")) path = path.substring(1);
      Path target = Paths.get(path);

      Files.createDirectories(target.getParent());
      Files.copy(new ByteArrayInputStream(bytes), target, StandardCopyOption.REPLACE_EXISTING);
    } catch (IOException | RuntimeException e) {
      BridgeLog.warn("No se pudo persistir el jar recargado", e);
    }
  }

  /** Acceso al bundle propio sin acoplar el servicio a una clase concreta. */
  static final class BundleUtilOwn {
    private BundleUtilOwn() {}

    static Bundle bundle() {
      return org.osgi.framework.FrameworkUtil.getBundle(HotReloadService.class);
    }
  }
}
