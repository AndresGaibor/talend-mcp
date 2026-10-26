package com.andres.talend.bridge.diagnostics;

import static com.andres.talend.bridge.TestSupport.check;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;

/**
 * El final del Error Log: solo se lee la cola del archivo, y la primera linea
 * no debe quedar cortada cuando el archivo es mas grande que lo que se lee.
 */
public final class LogTailTests {
  private LogTailTests() {}

  public static void run() throws IOException {
    File dir = Files.createTempDirectory("logtail").toFile();
    try {
      File small = new File(dir, "small.log");
      StringBuilder ten = new StringBuilder();
      for (int i = 1; i <= 10; i++) {
        ten.append("linea ").append(i).append('\n');
      }
      Files.write(small.toPath(), ten.toString().getBytes(StandardCharsets.UTF_8));

      LogTailService.Tail last3 = LogTailService.readTail(small, 3);
      check(last3.lines.equals(List.of("linea 8", "linea 9", "linea 10")),
          "de un archivo pequeno se leen las ultimas lineas pedidas");
      check(last3.truncated, "se marca truncado cuando se piden menos lineas que hay");

      LogTailService.Tail all = LogTailService.readTail(small, 50);
      check(all.lines.size() == 10 && !all.truncated, "pedir mas lineas que el archivo devuelve todas, sin truncar");

      File big = new File(dir, "big.log");
      StringBuilder entries = new StringBuilder();
      for (int i = 0; i < 300_000; i++) {
        entries.append("entrada de log numero ").append(i).append('\n');
      }
      Files.write(big.toPath(), entries.toString().getBytes(StandardCharsets.UTF_8));

      LogTailService.Tail tail = LogTailService.readTail(big, 5);
      check(tail.truncated && tail.lines.size() == 5, "un archivo grande solo lee la cola");
      check("entrada de log numero 299999".equals(tail.lines.get(4)), "la ultima linea de un archivo grande es la correcta");
      check(tail.lines.get(0).matches("entrada de log numero \\d+"), "la primera linea de la cola no queda cortada");
    } finally {
      for (File file : dir.listFiles()) {
        file.delete();
      }
      dir.delete();
    }

    check(LogTailService.tail(999_999).get("available").equals(false),
        "fuera de Eclipse no hay log: available=false y sin error");
  }
}
