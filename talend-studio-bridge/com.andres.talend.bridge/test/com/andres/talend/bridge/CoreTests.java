package com.andres.talend.bridge;

import static com.andres.talend.bridge.TestSupport.check;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.jar.Attributes;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Configuracion, validacion del jar de recarga y servidor HTTP: que todas las
 * rutas esten registradas, que la autenticacion y los codigos de error sean los
 * esperados. El servidor corre en un puerto libre, fuera de Studio.
 */
final class CoreTests {
  private CoreTests() {}

  static void run() throws Exception {
    hotReloadSignatures();
    configDefaults();
    routesAnswer();
  }

  // ---------------------------------------------------------------------------

  private static void hotReloadSignatures() throws IOException {
    check("com.andres.talend.bridge".equals(
            HotReloadService.bundleSymbolicName(jarWith("com.andres.talend.bridge;singleton:=true"))),
        "el jar del bridge se reconoce por su Bundle-SymbolicName, sin los parametros");
    check("otro.bundle".equals(HotReloadService.bundleSymbolicName(jarWith("otro.bundle"))),
        "un jar ajeno devuelve su propio nombre (y no se toma por el bridge)");
    check(HotReloadService.bundleSymbolicName(jarWith(null)) == null,
        "un jar sin Bundle-SymbolicName devuelve null");
    check(HotReloadService.bundleSymbolicName("no es un zip".getBytes(StandardCharsets.UTF_8)) == null,
        "datos corruptos devuelven null sin lanzar");
    check(HotReloadService.bundleSymbolicName(new byte[0]) == null, "un jar vacio devuelve null");
  }

  private static void configDefaults() throws IOException {
    // Carpeta de usuario vacia (la fija el runner): BridgeConfig.load() escribe el valor por defecto.
    BridgeConfig config = BridgeConfig.load();
    String written = Files.readString(BridgeConfig.tokenPath().resolveSibling("config.json"));
    check(config.port == 3930 && config.readOnly && !config.unsafeActions,
        "la configuracion por defecto es readOnly en el puerto 3930");
    check(written.contains("\"port\": 3930") && written.contains("org.eclipse.ui.file.saveAll"),
        "el archivo por defecto se escribe con el formato de siempre");
  }

  /** Arranca el servidor real en un puerto libre y comprueba cada ruta de la tabla. */
  private static void routesAnswer() throws Exception {
    List<String> routes = routesOfTable();
    int port = freePort();
    writeConfig(port);

    BridgeServer server = new BridgeServer(null);
    server.start();
    try {
      // /ping es la unica ruta publica: responde 200 sin token, y se comprueba aparte.
      List<String> notUnauthorized = new ArrayList<>();
      for (String route : routes) {
        if ("/ping".equals(route)) continue;
        int status = status("GET", port, route, null, null);
        if (status != 401) {
          notUnauthorized.add(route + " -> " + status);
        }
      }
      check(notUnauthorized.isEmpty(),
          "las " + (routes.size() - 1) + " rutas protegidas responden 401 sin token " + notUnauthorized);
      check(routes.size() >= 70, "la tabla de rutas tiene todas las rutas (hay " + routes.size() + ")");
      check(status("GET", port, "/ping", null, null) == 200, "/ping responde sin token");

      String token = Files.readString(BridgeConfig.tokenPath()).trim();
      check(status("PUT", port, "/events/recent", token, null) == 405, "un metodo distinto de GET/POST da 405");
      check(status("GET", port, "/no/existe", token, null) == 404, "una ruta inexistente da 404");
      check(status("POST", port, "/automation/nodes/add", token, "{bad") == 400,
          "un cuerpo JSON invalido da 400 antes de tocar la UI");
      check(status("GET", port, "/workbench/find-editor", token, null) == 400,
          "un parametro obligatorio ausente da 400 antes de tocar la UI");
      check(status("POST", port, "/automation/build-job", token, "{}") == 400,
          "build-job en modo solo lectura da 400");
    } finally {
      server.stop();
    }
  }

  // ---------------------------------------------------------------------------

  /** Rutas registradas en BridgeServer.java: las mismas que lee el test de contrato de TypeScript. */
  static List<String> routesOfTable() throws IOException {
    String sourceRoot = System.getProperty("bridge.src");
    if (sourceRoot == null) {
      throw new IllegalStateException("falta -Dbridge.src");
    }
    Path source = Path.of(sourceRoot, "com", "andres", "talend", "bridge", "BridgeServer.java");
    String text = Files.readString(source);
    Matcher matcher = Pattern.compile(
        "^\\s+(?:route|worker|workerBody|ui|uiBody)\\(\\s*\"(/[^\"]+)\"", Pattern.MULTILINE).matcher(text);
    List<String> routes = new ArrayList<>();
    while (matcher.find()) {
      routes.add(matcher.group(1));
    }
    return routes;
  }

  private static int freePort() throws IOException {
    try (ServerSocket socket = new ServerSocket(0)) {
      return socket.getLocalPort();
    }
  }

  private static void writeConfig(int port) throws IOException {
    Path config = BridgeConfig.tokenPath().resolveSibling("config.json");
    Files.writeString(config, "{\"port\": " + port + ", \"readOnly\": true, \"unsafeActions\": false}");
  }

  private static int status(String method, int port, String route, String token, String body) throws IOException {
    HttpURLConnection connection = (HttpURLConnection) URI.create("http://127.0.0.1:" + port + route).toURL().openConnection();
    connection.setRequestMethod(method);
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(10000);
    if (token != null) {
      connection.setRequestProperty("Authorization", "Bearer " + token);
    }
    if (body != null) {
      connection.setDoOutput(true);
      connection.setRequestProperty("Content-Type", "application/json");
      connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
    }
    int status = connection.getResponseCode();
    connection.disconnect();
    return status;
  }

  /** Un jar minimo con el manifiesto dado (o sin Bundle-SymbolicName si el valor es null). */
  private static byte[] jarWith(String symbolicName) throws IOException {
    Manifest manifest = new Manifest();
    manifest.getMainAttributes().put(Attributes.Name.MANIFEST_VERSION, "1.0");
    if (symbolicName != null) {
      manifest.getMainAttributes().put(new Attributes.Name("Bundle-SymbolicName"), symbolicName);
    }
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (JarOutputStream jar = new JarOutputStream(bytes, manifest)) {
      jar.putNextEntry(new JarEntry("x/Y.txt"));
      jar.write("hola".getBytes(StandardCharsets.UTF_8));
      jar.closeEntry();
    }
    return bytes.toByteArray();
  }
}
