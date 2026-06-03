package com.andres.talend.bridge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class BridgeConfig {
  public final int port;
  public final boolean readOnly;
  public final boolean unsafeActions;
  public final boolean allowAllCommands;
  public final List<String> allowCommands;
  public final int timeoutMs;

  private BridgeConfig(int port, boolean readOnly, boolean unsafeActions, boolean allowAllCommands, List<String> allowCommands, int timeoutMs) {
    this.port = port;
    this.readOnly = readOnly;
    this.unsafeActions = unsafeActions;
    this.allowAllCommands = allowAllCommands;
    this.allowCommands = allowCommands;
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
    } catch (IOException e) {
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
      Files.write(tokenPath, (token + System.lineSeparator()).getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
      return token;
    } catch (IOException e) {
      throw new IllegalStateException("No se pudo preparar el token local del bridge", e);
    }
  }

  private static BridgeConfig parse(String json) {
    int port = readInt(json, "port", 3930);
    boolean readOnly = readBoolean(json, "readOnly", true);
    boolean unsafeActions = readBoolean(json, "unsafeActions", false);
    boolean allowAllCommands = readBoolean(json, "allowAllCommands", false);
    int timeoutMs = readInt(json, "timeoutMs", 2500);
    List<String> allowCommands = readStringArray(json, "allowCommands");
    if (allowCommands.isEmpty()) {
      allowCommands.add("org.eclipse.ui.file.save");
      allowCommands.add("org.eclipse.ui.file.saveAll");
    }
    return new BridgeConfig(port, readOnly, unsafeActions, allowAllCommands, allowCommands, timeoutMs);
  }

  private static BridgeConfig defaults() {
    List<String> allowCommands = new ArrayList<>();
    allowCommands.add("org.eclipse.ui.file.save");
    allowCommands.add("org.eclipse.ui.file.saveAll");
    return new BridgeConfig(3930, true, false, false, allowCommands, 2500);
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
          + "  ]\n"
          + "}\n";
      Files.write(configPath, content.getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    } catch (IOException ignored) {
    }
  }

  private static int readInt(String json, String key, int fallback) {
    Matcher matcher = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*(\\d+)").matcher(json);
    return matcher.find() ? Integer.parseInt(matcher.group(1)) : fallback;
  }

  private static boolean readBoolean(String json, String key, boolean fallback) {
    Matcher matcher = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*(true|false)").matcher(json);
    return matcher.find() ? Boolean.parseBoolean(matcher.group(1)) : fallback;
  }

  private static List<String> readStringArray(String json, String key) {
    Matcher matcher = Pattern.compile("\\\"" + Pattern.quote(key) + "\\\"\\s*:\\s*\\[(.*?)\\]", Pattern.DOTALL).matcher(json);
    List<String> result = new ArrayList<>();
    if (!matcher.find()) {
      return result;
    }

    Matcher itemMatcher = Pattern.compile("\\\"(.*?)\\\"").matcher(matcher.group(1));
    while (itemMatcher.find()) {
      result.add(itemMatcher.group(1));
    }
    return result;
  }

  private static Path configPath() {
    return Paths.get(System.getProperty("user.home"), ".talend-bridge", "config.json");
  }

  private static Path tokenPath() {
    return Paths.get(System.getProperty("user.home"), ".talend-bridge", "token");
  }
}
