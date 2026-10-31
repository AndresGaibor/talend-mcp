package com.andres.talend.bridge.diagnostics;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.Platform;

/**
 * Ultimas lineas del Error Log de Talend Studio ({@code <workspace>/.metadata/.log}).
 *
 * Asi se ven los errores de Studio, y los que registra el propio bridge, sin
 * abrir la vista de Error Log. Solo se lee el final del archivo: el log puede
 * pesar cientos de MB y no hace falta cargarlo entero.
 */
public final class LogTailService {
  public static final int DEFAULT_LINES = 200;
  public static final int MAX_LINES = 2_000;

  /** Bytes maximos que se leen del final del archivo. */
  private static final long MAX_BYTES = 1024L * 1024L;

  private LogTailService() {}

  public static Map<String, Object> tail(int requestedLines) {
    int lines = Math.max(1, Math.min(requestedLines, MAX_LINES));

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "high");
    payload.put("endpoint", "/logs/tail");

    File file = logFile();
    if (file == null || !file.isFile()) {
      payload.put("available", false);
      payload.put("lines", List.of());
      return payload;
    }

    try {
      Tail tail = readTail(file, lines);
      payload.put("available", true);
      payload.put("file", file.getAbsolutePath());
      // El tamano se informa aunque solo se lea la cola: un log de cientos de MB
      // es la senal de que toca rotarlo.
      payload.put("sizeBytes", file.length());
      payload.put("truncated", tail.truncated);
      payload.put("lines", tail.lines);
      return payload;
    } catch (IOException e) {
      payload.put("ok", false);
      payload.put("available", true);
      payload.put("file", file.getAbsolutePath());
      payload.put("error", e.getMessage());
      payload.put("lines", List.of());
      return payload;
    }
  }

  /** Archivo de log de la plataforma, o null si no se conoce. */
  static File logFile() {
    try {
      IPath location = Platform.getLogFileLocation();
      return location == null ? null : location.toFile();
    } catch (RuntimeException e) {
      // Fuera de Eclipse (pruebas, ejecucion sin Studio) la plataforma no tiene log.
      return null;
    }
  }

  /** Ultimas {@code lines} lineas del archivo, leyendo como mucho {@link #MAX_BYTES} del final. */
  static Tail readTail(File file, int lines) throws IOException {
    try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
      long length = raf.length();
      long start = Math.max(0, length - MAX_BYTES);
      raf.seek(start);
      byte[] bytes = new byte[(int) (length - start)];
      raf.readFully(bytes);

      String[] all = new String(bytes, StandardCharsets.UTF_8).split("\\r?\\n");
      // Si no se empezo en el principio del archivo, la primera linea puede estar cortada.
      int first = start > 0 ? 1 : 0;

      List<String> complete = new ArrayList<>();
      for (int i = first; i < all.length; i++) {
        complete.add(all[i]);
      }
      int skip = Math.max(0, complete.size() - lines);
      boolean truncated = start > 0 || skip > 0;
      return new Tail(List.copyOf(complete.subList(skip, complete.size())), truncated);
    }
  }

  /** Resultado de leer el final del log. */
  static final class Tail {
    final List<String> lines;
    final boolean truncated;

    Tail(List<String> lines, boolean truncated) {
      this.lines = lines;
      this.truncated = truncated;
    }
  }
}
