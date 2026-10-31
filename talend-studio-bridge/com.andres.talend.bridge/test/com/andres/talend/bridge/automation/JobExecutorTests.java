package com.andres.talend.bridge.automation;

import static com.andres.talend.bridge.TestSupport.check;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * La salida de un job se acumula en memoria mientras corre. Sin tope, un job
 * verboso llena el heap del bridge.
 */
public final class JobExecutorTests {
  private JobExecutorTests() {}

  public static void run() throws Exception {
    Method drain = JobExecutor.class.getDeclaredMethod(
        "drain", InputStream.class, StringBuilder.class, AtomicBoolean.class);
    drain.setAccessible(true);

    // Salida corta: se conserva entera y no se marca como recortada.
    StringBuilder corta = new StringBuilder();
    AtomicBoolean cortaRecortada = new AtomicBoolean(false);
    Thread hiloCorto = (Thread) drain.invoke(null,
        flujo("linea uno\nlinea dos\n"), corta, cortaRecortada);
    hiloCorto.join(10_000);
    check(!cortaRecortada.get(), "una salida corta no se marca como recortada");
    check(corta.toString().contains("linea uno") && corta.toString().contains("linea dos"),
        "una salida corta se conserva entera");

    // Salida enorme: se queda el final y se avisa del recorte.
    StringBuilder entrada = new StringBuilder();
    for (int i = 0; i < 80_000; i++) {
      entrada.append("linea ").append(i).append(" de relleno para pasar del tope\n");
    }
    StringBuilder larga = new StringBuilder();
    AtomicBoolean largaRecortada = new AtomicBoolean(false);
    Thread hiloLargo = (Thread) drain.invoke(null,
        flujo(entrada.toString()), larga, largaRecortada);
    hiloLargo.join(20_000);
    check(largaRecortada.get(), "una salida enorme se marca como recortada");
    check(larga.length() <= 2_000_100, "la salida enorme respeta el tope (mide " + larga.length() + ")");
    check(larga.indexOf("salida recortada") >= 0, "la salida recortada lo dice al principio");
    check(larga.toString().contains("linea 79999 "), "la salida recortada conserva el final");
    check(!larga.toString().contains("linea 0 "), "la salida recortada suelta el principio");
  }

  private static InputStream flujo(String texto) {
    return new ByteArrayInputStream(texto.getBytes(StandardCharsets.UTF_8));
  }
}
