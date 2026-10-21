package com.andres.talend.bridge;

import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import org.eclipse.swt.widgets.Display;

/**
 * Ejecucion en el hilo de la interfaz de Studio.
 *
 * Los widgets de SWT (los shells, los dialogos) solo se pueden tocar desde el
 * hilo de la UI. Estas operaciones se lanzan ahi.
 *
 * La espera tiene un tiempo maximo: si el hilo de la UI esta ocupado (por
 * ejemplo, compilando un job), la llamada se devuelve con un error en vez de
 * colgarse. Sin eso, el bridge entero se queda bloqueado y el guardian de
 * modales deja de poder cerrar los dialogos que bloquean al IDE.
 */
public final class UiThread {

  /** Tiempo maximo de espera por defecto, en milisegundos. */
  public static final long DEFAULT_TIMEOUT_MS = 10_000L;

  private UiThread() {}

  /**
   * Ejecuta una accion en el hilo de la UI y espera su resultado.
   */
  public static <T> T sync(Callable<T> action) {
    return sync(action, DEFAULT_TIMEOUT_MS);
  }

  /**
   * Ejecuta una accion en el hilo de la UI y espera su resultado.
   *
   * @param timeoutMs tiempo maximo de espera. Si el hilo de la UI no queda
   *        libre, se lanza una excepcion.
   */
  public static <T> T sync(Callable<T> action, long timeoutMs) {
    if (Display.getCurrent() != null) {
      return call(action);
    }

    AtomicReference<T> result = new AtomicReference<>();
    AtomicReference<RuntimeException> error = new AtomicReference<>();
    AtomicBoolean done = new AtomicBoolean(false);

    Display display = Display.getDefault();
    display.asyncExec(() -> {
      try {
        result.set(call(action));
      } catch (RuntimeException e) {
        error.set(e);
      } finally {
        done.set(true);
      }
    });

    long deadline = System.currentTimeMillis() + timeoutMs;
    while (!done.get() && System.currentTimeMillis() < deadline) {
      try {
        Thread.sleep(20);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      }
    }
    if (!done.get()) {
      throw new IllegalStateException(
          "El hilo de la interfaz de Studio esta ocupado (se acabo el tiempo de espera)");
    }
    if (error.get() != null) {
      throw error.get();
    }
    return result.get();
  }

  private static <T> T call(Callable<T> action) {
    try {
      return action.call();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
