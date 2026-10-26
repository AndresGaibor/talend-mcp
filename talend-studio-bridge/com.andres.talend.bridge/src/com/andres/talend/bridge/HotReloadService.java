package com.andres.talend.bridge;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.jar.Manifest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.osgi.framework.Bundle;
import org.osgi.framework.BundleException;

/**
 * Carga en caliente del bundle.
 *
 * Vigila el jar en `~/.talend-bridge/hot/bridge.jar`. Cuando el archivo cambia
 * (el instalador lo publica despues de compilar), comprueba que sea este bundle
 * y lo recarga con {@link Bundle#update(java.io.InputStream)}: OSGi descarta el
 * classloader, detiene el Activator y lo vuelve a iniciar, asi que el servidor
 * HTTP queda sirviendo el codigo nuevo sin reiniciar Talend Studio.
 *
 * La comprobacion va antes de parar el servidor: un jar roto o de otro bundle
 * se ignora y el bridge sigue como estaba, en lugar de quedarse caido.
 */
public final class HotReloadService {
  private static final long POLL_INTERVAL_MS = 500;
  private static final String HOT_DIR_ENV = "TALEND_BRIDGE_HOT_DIR";
  private static final String HOT_FILE_NAME = "bridge.jar";
  private static final String MANIFEST_ENTRY = "META-INF/MANIFEST.MF";

  private final AtomicBoolean running = new AtomicBoolean(false);
  private volatile Thread watcher;
  private volatile Runnable beforeReload;

  public void start(Bundle bundle) {
    if (!running.compareAndSet(false, true)) return;

    Thread thread = new Thread(() -> watch(bundle), "talend-bridge-hot-reload");
    thread.setDaemon(true);
    watcher = thread;
    thread.start();

    BridgeLog.info("Carga en caliente activa: vigilando " + hotJarPath());
  }

  /**
   * Accion que se ejecuta justo antes de recargar el bundle.
   *
   * Es el sitio donde hay que soltar lo que usa el classloader viejo: el
   * servidor HTTP y el guardian. Si no, el servidor sigue atendiendo peticiones
   * con las clases del bundle ya descartado y Eclipse falla con "Invalid class
   * loader from a refreshed bundle is being used".
   */
  public void setBeforeReload(Runnable action) {
    this.beforeReload = action;
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
    Path hotJar = hotJarPath();
    // La firma se guarda en un archivo aparte porque el classloader del bundle se
    // reemplaza al recargar: sin esto, la instancia nueva detectaria el mismo
    // jar como "cambiado" y volveria a recargar en bucle.
    Path signatureFile = signaturePath(hotJar);
    String lastSignature = readSignature(signatureFile);

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

        String symbolicName = bundleSymbolicName(bytes);
        if (!Activator.PLUGIN_ID.equals(symbolicName)) {
          BridgeLog.warn("El jar de carga en caliente no es el bundle del bridge (" + symbolicName
              + "), se ignora: " + hotJar);
          continue;
        }

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

  /**
   * Nombre simbolico del bundle que trae el jar, o null si no es un jar con MANIFEST.
   * Solo lee el manifiesto: no carga clases ni toca el bundle en ejecucion.
   */
  static String bundleSymbolicName(byte[] jar) throws IOException {
    try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(jar))) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        if (MANIFEST_ENTRY.equals(entry.getName())) {
          String header = new Manifest(zip).getMainAttributes().getValue("Bundle-SymbolicName");
          return header == null ? null : header.split(";", 2)[0].trim();
        }
      }
    }
    return null;
  }

  /** Firma del jar: tamano y fecha de modificacion. */
  private static String signatureOf(Path jar) throws IOException {
    return Files.size(jar) + ":" + Files.getLastModifiedTime(jar).toMillis();
  }

  private static Path signaturePath(Path jar) {
    Path parent = jar.getParent();
    String name = jar.getFileName() + ".sig";
    return parent == null ? Paths.get(name) : parent.resolve(name);
  }

  private static String readSignature(Path file) {
    try {
      if (!Files.isRegularFile(file)) return "";
      return new String(Files.readAllBytes(file), StandardCharsets.UTF_8).trim();
    } catch (IOException e) {
      return "";
    }
  }

  private static void writeSignature(Path file, String signature) {
    try {
      Files.write(file, signature.getBytes(StandardCharsets.UTF_8));
    } catch (IOException e) {
      BridgeLog.warn("No se pudo guardar la firma del jar", e);
    }
  }

  private void reload(Bundle bundle, byte[] bytes) {
    try {
      releaseBeforeReload();
      bundle.update(new ByteArrayInputStream(bytes));
      BridgeLog.info("Bundle recargado en caliente");
    } catch (BundleException | RuntimeException e) {
      BridgeLog.error("Fallo la recarga en caliente del bundle", e);
    }
  }

  private void releaseBeforeReload() {
    Runnable action = beforeReload;
    if (action == null) return;
    try {
      action.run();
    } catch (RuntimeException e) {
      BridgeLog.warn("No se pudieron soltar los recursos del bundle viejo", e);
    }
  }
}
