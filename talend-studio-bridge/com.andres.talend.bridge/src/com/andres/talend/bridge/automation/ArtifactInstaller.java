package com.andres.talend.bridge.automation;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonObject;

/**
 * Descarga artefactos de Maven al repositorio local de Studio.
 *
 * Hay componentes cuyo runtime no viene con Studio (el tFileInputJSON
 * necesita `com.jayway.jsonpath:json-path`, por ejemplo). Cuando falta, el
 * build de Maven falla con "Offline / Missing artifact" y el job no compila.
 *
 * Studio usa como repositorio local el de su propia instalacion
 * (`<instalacion>/configuration/.m2/repository`), asi que descargar ahi es
 * lo que hace que el build lo encuentre.
 */
public final class ArtifactInstaller {

  private ArtifactInstaller() {}

  /** Repositorio publico de Maven Central. */
  private static final String CENTRAL = "https://repo1.maven.org/maven2";

  /**
   * Descarga un artefacto al repositorio local de Studio.
   *
   * @param spec groupId, artifactId y version. Con `file` se instala un jar que
   *        ya esta en el equipo (util para los componentes de Talend Exchange,
   *        cuyo dominio no se resuelve desde todas las redes).
   */
  public static Map<String, Object> install(JsonObject spec) throws Exception {
    String group = JsonSpec.required(spec, "groupId");
    String artifact = JsonSpec.required(spec, "artifactId");
    String version = JsonSpec.required(spec, "version");
    String file = JsonSpec.string(spec, "file");

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("groupId", group);
    result.put("artifactId", artifact);
    result.put("version", version);

    Path repository = localRepository();
    result.put("repository", repository.toString());
    if (repository == null) {
      result.put("installed", false);
      result.put("error", "No se pudo localizar el repositorio local de Studio");
      return result;
    }

    Path folder = repository.resolve(group.replace('.', '/')).resolve(artifact).resolve(version);
    Path jar = folder.resolve(artifact + "-" + version + ".jar");
    Path pom = folder.resolve(artifact + "-" + version + ".pom");
    try {
      Files.createDirectories(folder);
      boolean already = Files.isRegularFile(jar);
      if (!already) {
        if (file != null && !file.trim().isEmpty()) {
          copyJar(Paths.get(file.trim()), jar);
          result.put("fromFile", file);
        } else {
          download(group, artifact, version, "jar", jar);
        }
      }
      if (!Files.isRegularFile(pom)) {
        if (file != null && !file.trim().isEmpty()) {
          writeMinimalPom(pom, group, artifact, version);
        } else {
          download(group, artifact, version, "pom", pom);
        }
      }
      result.put("installed", true);
      result.put("alreadyInstalled", already);
      result.put("path", jar.toString());
    } catch (Exception e) {
      result.put("installed", false);
      result.put("error", e.getMessage());
      BridgeLog.warn("No se pudo instalar " + group + ":" + artifact + ":" + version, e);
    }
    return result;
  }

  /** Copia un jar local al repositorio de Studio. */
  private static void copyJar(Path origen, Path destino) throws Exception {
    if (!Files.isRegularFile(origen)) {
      throw new IllegalStateException("No existe el fichero '" + origen + "'");
    }
    Path temporal = destino.resolveSibling(destino.getFileName() + ".tmp");
    Files.copy(origen, temporal, StandardCopyOption.REPLACE_EXISTING);
    Files.move(temporal, destino, StandardCopyOption.REPLACE_EXISTING);
  }

  /**
   * Escribe un pom minimo.
   *
   * Maven necesita el pom del artefacto: sin el, el build falla con
   * "Artifact has not been packaged into the correct form".
   */
  private static void writeMinimalPom(Path pom, String group, String artifact, String version)
      throws Exception {
    String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        + "<project xmlns=\"http://maven.apache.org/POM/4.0.0\">\n"
        + "  <modelVersion>4.0.0</modelVersion>\n"
        + "  <groupId>" + group + "</groupId>\n"
        + "  <artifactId>" + artifact + "</artifactId>\n"
        + "  <version>" + version + "</version>\n"
        + "  <packaging>jar</packaging>\n"
        + "</project>\n";
    Files.write(pom, xml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }

  /** Descarga un fichero del repositorio publico de Maven. */
  private static void download(String group, String artifact, String version, String extension,
      Path target) throws Exception {
    String path = group.replace('.', '/') + "/" + artifact + "/" + version + "/"
        + artifact + "-" + version + "." + extension;
    URL url = new URL(CENTRAL + "/" + path);
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setConnectTimeout(20_000);
    connection.setReadTimeout(60_000);
    connection.setRequestProperty("User-Agent", "talend-mcp-bridge");
    int status = connection.getResponseCode();
    if (status != 200) {
      throw new IllegalStateException("Maven Central devolvio " + status + " para " + path);
    }
    Path temporal = target.resolveSibling(target.getFileName() + ".tmp");
    try (InputStream input = connection.getInputStream()) {
      Files.copy(input, temporal, StandardCopyOption.REPLACE_EXISTING);
    }
    Files.move(temporal, target, StandardCopyOption.REPLACE_EXISTING);
  }

  /**
   * Repositorio local de Studio.
   *
   * Studio instala Maven en su propia carpeta: `<instalacion>/configuration/.m2/repository`.
   * La ruta de la instalacion viene como `file:/C:/...`, asi que hay que
   * quitar el prefijo antes de usarla.
   */
  private static Path localRepository() {
    String area = System.getProperty("osgi.install.area");
    if (area == null || area.trim().isEmpty()) {
      area = System.getProperty("user.dir");
    }
    if (area == null) {
      return null;
    }
    if (area.startsWith("file:")) {
      area = area.substring("file:".length());
    }
    area = area.replace('\\', '/');
    // En Windows la ruta puede venir como /C:/...: la barra inicial sobra.
    if (area.length() > 2 && area.charAt(0) == '/' && area.charAt(2) == ':') {
      area = area.substring(1);
    }
    while (area.endsWith("/")) {
      area = area.substring(0, area.length() - 1);
    }
    return Paths.get(area, "configuration", ".m2", "repository");
  }
}
