package com.andres.talend.bridge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * Lectura de la configuracion del bridge desde {@code ~/.talend-bridge/config.json}.
 *
 * El archivo es opcional: si no existe o esta corrupto se usan los valores por
 * defecto, que mantienen el bridge en modo solo lectura.
 */
public final class BridgeConfig {
  static final int DEFAULT_PORT = 3930;
  static final int DEFAULT_TIMEOUT_MS = 2500;

  private static final Gson PRETTY_JSON = new GsonBuilder().setPrettyPrinting().create();

  public final int port;
  public final boolean readOnly;
  public final boolean unsafeActions;
  public final boolean allowAllCommands;
  public final List<String> allowCommands;
  public final int timeoutMs;
  /** Si el guardian de modales cierra solo los dialogos conocidos. Apagado por defecto. */
  public final boolean autoDismissModals;

  private BridgeConfig(int port, boolean readOnly, boolean unsafeActions, boolean allowAllCommands,
      List<String> allowCommands, int timeoutMs, boolean autoDismissModals) {
    this.port = port;
    this.readOnly = readOnly;
    this.unsafeActions = unsafeActions;
    this.allowAllCommands = allowAllCommands;
    this.allowCommands = Collections.unmodifiableList(allowCommands);
    this.timeoutMs = timeoutMs;
    this.autoDismissModals = autoDismissModals;
  }

  public static BridgeConfig load() {
    Path configPath = configPath();
    if (!Files.exists(configPath)) {
      writeDefaultConfig(configPath);
      return defaults();
    }

    try {
      String json = new String(Files.readAllBytes(configPath), StandardCharsets.UTF_8);
      return parse(json);
    } catch (IOException | RuntimeException e) {
      BridgeLog.warn("No se pudo leer la configuracion del bridge, se usan los valores por defecto", e);
      return defaults();
    }
  }

  /**
   * Huella del archivo de configuracion (fecha de modificacion y tamanio). Cambia cuando alguien
   * edita el archivo, asi que el servidor puede saber si hay que releerlo sin parsearlo. Vacia si
   * el archivo no existe.
   */
  static String signature() {
    Path configPath = configPath();
    try {
      if (!Files.isRegularFile(configPath)) return "";
      return Files.getLastModifiedTime(configPath).toMillis() + ":" + Files.size(configPath);
    } catch (IOException e) {
      return "";
    }
  }

  /** Representacion JSON de esta configuracion: la misma que se escribe como archivo por defecto. */
  JsonObject toJson() {
    JsonObject json = new JsonObject();
    json.addProperty("port", port);
    json.addProperty("readOnly", readOnly);
    json.addProperty("unsafeActions", unsafeActions);
    json.addProperty("allowAllCommands", allowAllCommands);
    JsonArray commands = new JsonArray();
    for (String command : allowCommands) {
      commands.add(command);
    }
    json.add("allowCommands", commands);
    json.addProperty("timeoutMs", timeoutMs);
    json.addProperty("autoDismissModals", autoDismissModals);
    return json;
  }

  public static String ensureToken() {
    Path tokenPath = tokenPath();
    try {
      Files.createDirectories(tokenPath.getParent());
      if (Files.exists(tokenPath)) {
        String token = new String(Files.readAllBytes(tokenPath), StandardCharsets.UTF_8).trim();
        if (!token.isEmpty()) {
          return token;
        }
      }

      String token = UUID.randomUUID().toString().replace("-", "");
      Files.write(tokenPath, (token + System.lineSeparator()).getBytes(StandardCharsets.UTF_8),
          StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
      restrictPermissions(tokenPath);
      return token;
    } catch (IOException e) {
      throw new IllegalStateException("No se pudo preparar el token local del bridge", e);
    }
  }

  public static Path tokenPath() {
    return Paths.get(System.getProperty("user.home"), ".talend-bridge", "token");
  }

  private static void restrictPermissions(Path path) {
    try {
      java.io.File file = path.toFile();
      if (!file.setReadable(false, false) || !file.setReadable(true, true) || !file.setWritable(false, false)) {
        BridgeLog.warn("No se pudieron ajustar los permisos del token del bridge: " + path);
      }
    } catch (SecurityException e) {
      BridgeLog.warn("No se pudieron ajustar los permisos del token del bridge: " + path, e);
    }
  }

  private static BridgeConfig parse(String json) {
    JsonObject root;
    try {
      JsonElement parsed = JsonParser.parseString(json);
      if (!parsed.isJsonObject()) {
        return defaults();
      }
      root = parsed.getAsJsonObject();
    } catch (RuntimeException e) {
      BridgeLog.warn("La configuracion del bridge no es JSON valido, se usan los valores por defecto", e);
      return defaults();
    }

    int port = readInt(root, "port", DEFAULT_PORT);
    boolean readOnly = readBoolean(root, "readOnly", true);
    boolean unsafeActions = readBoolean(root, "unsafeActions", false);
    boolean allowAllCommands = readBoolean(root, "allowAllCommands", false);
    int timeoutMs = readInt(root, "timeoutMs", DEFAULT_TIMEOUT_MS);
    boolean autoDismissModals = readBoolean(root, "autoDismissModals", false);
    List<String> allowCommands = readStringArray(root, "allowCommands");
    if (allowCommands.isEmpty()) {
      allowCommands = defaultAllowedCommands();
    }
    return new BridgeConfig(port, readOnly, unsafeActions, allowAllCommands, allowCommands, timeoutMs,
        autoDismissModals);
  }

  private static BridgeConfig defaults() {
    return new BridgeConfig(DEFAULT_PORT, true, false, false, defaultAllowedCommands(), DEFAULT_TIMEOUT_MS, false);
  }

  private static List<String> defaultAllowedCommands() {
    List<String> commands = new ArrayList<>();
    commands.add("org.eclipse.ui.file.save");
    commands.add("org.eclipse.ui.file.saveAll");
    return commands;
  }

  private static void writeDefaultConfig(Path configPath) {
    try {
      Files.createDirectories(configPath.getParent());
      String content = PRETTY_JSON.toJson(defaults().toJson()) + "\n";
      Files.write(configPath, content.getBytes(StandardCharsets.UTF_8),
          StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    } catch (IOException e) {
      BridgeLog.warn("No se pudo escribir la configuracion por defecto del bridge", e);
    }
  }

  private static int readInt(JsonObject root, String key, int fallback) {
    JsonElement element = root.get(key);
    if (element == null || !element.isJsonPrimitive()) {
      return fallback;
    }
    try {
      return element.getAsInt();
    } catch (RuntimeException e) {
      return fallback;
    }
  }

  private static boolean readBoolean(JsonObject root, String key, boolean fallback) {
    JsonElement element = root.get(key);
    if (element == null || !element.isJsonPrimitive()) {
      return fallback;
    }
    try {
      return element.getAsBoolean();
    } catch (RuntimeException e) {
      return fallback;
    }
  }

  private static List<String> readStringArray(JsonObject root, String key) {
    List<String> result = new ArrayList<>();
    JsonElement element = root.get(key);
    if (element == null || !element.isJsonArray()) {
      return result;
    }

    JsonArray array = element.getAsJsonArray();
    for (JsonElement item : array) {
      if (item != null && item.isJsonPrimitive()) {
        String value = item.getAsString();
        if (value != null && !value.trim().isEmpty()) {
          result.add(value.trim());
        }
      }
    }
    return result;
  }

  private static Path configPath() {
    return Paths.get(System.getProperty("user.home"), ".talend-bridge", "config.json");
  }
}
