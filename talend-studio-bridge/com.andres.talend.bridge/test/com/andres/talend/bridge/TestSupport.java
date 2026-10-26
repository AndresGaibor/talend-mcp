package com.andres.talend.bridge;

/**
 * Comprobaciones minimas para los tests del bridge, sin dependencias externas
 * (no hay JUnit en el target platform). Cada check imprime PASS o FAIL; el
 * runner sale con error si alguna falla.
 *
 * Estos tests no van dentro del bundle: viven en test/, fuera de src/.
 */
public final class TestSupport {
  private static int passed;
  private static int failed;

  private TestSupport() {}

  public static void check(boolean ok, String name) {
    if (ok) {
      passed++;
      System.out.println("PASS " + name);
    } else {
      failed++;
      System.out.println("FAIL " + name);
    }
  }

  public static int passed() {
    return passed;
  }

  public static int failed() {
    return failed;
  }
}
