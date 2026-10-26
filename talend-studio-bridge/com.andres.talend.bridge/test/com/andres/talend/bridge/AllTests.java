package com.andres.talend.bridge;

import com.andres.talend.bridge.automation.TalendApiTests;
import com.andres.talend.bridge.diagnostics.LogTailTests;
import com.andres.talend.bridge.launch.LaunchStoreTests;

/**
 * Punto de entrada de los tests Java del bridge. Lo ejecuta
 * tests/talend/bridge-java.test.ts con el JDK de Talend Studio.
 *
 * Se ejecuta con `-Duser.home=<carpeta temporal>` (config y token) y
 * `-Dbridge.src=<carpeta src del bundle>` (para leer la tabla de rutas).
 */
public final class AllTests {
  private AllTests() {}

  public static void main(String[] args) throws Exception {
    CoreTests.run();
    LogTailTests.run();
    TalendApiTests.run();
    LaunchStoreTests.run();
    System.out.println("RESULT passed=" + TestSupport.passed() + " failed=" + TestSupport.failed());
    System.exit(TestSupport.failed() == 0 ? 0 : 1);
  }
}
