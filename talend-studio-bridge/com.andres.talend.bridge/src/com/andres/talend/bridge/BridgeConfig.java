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
  public final int port;
  public final boolean readOnly;
  public final boolean unsafeActions;
  public final boolean allowAllCommands;
  public final List<String> allowCommands;
  public final int timeoutMs;

  private BridgeConfig(int port, boolean readOnly, boolean unsafeActions, boolean allowAllCommands,
      List<String> allowCommands, int timeoutMs) {
    this.port = port;
    this.readOnly = readOnly;
    this.unsafeActions = unsafeActions;
    this.allowAllCommands = allowAllCommands;
    this.allowCommands = Collections.unmodifiableList(allowCommands);
    this.timeoutMs = timeoutMs;
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

    int port = readInt(root, "port", 3930);
    boolean readOnly = readBoolean(root, "readOnly", true);
    boolean unsafeActions = readBoolean(root, "unsafeActions", false);
    boolean allowAllCommands = readBoolean(root, "allowAllCommands", false);
    int timeoutMs = readInt(root, "timeoutMs", 2500);
    List<String> allowCommands = readStringArray(root, "allowCommands");
    if (allowCommands.isEmpty()) {
      allowCommands = defaultAllowedCommands();
    }
    return new BridgeConfig(port, readOnly, unsafeActions, allowAllCommands, allowCommands, timeoutMs);
  }

  private static BridgeConfig defaults() {
    return new BridgeConfig(3930, true, false, false, defaultAllowedCommands(), 2500);
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
      String content = "{\n"
          + "  \"port\": 3930,\n"
          + "  \"readOnly\": true,\n"
          + "  \"unsafeActions\": false,\n"
          + "  \"allowAllCommands\": false,\n"
          + "  \"allowCommands\": [\n"
          + "    \"org.eclipse.ui.file.save\",\n"
          + "    \"org.eclipse.ui.file.saveAll\"\n"
          + "  ],\n"
          + "  \"timeoutMs\": 2500\n"
          + "}\n";
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
