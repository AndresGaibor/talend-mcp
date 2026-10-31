package com.andres.talend.bridge;

import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.eclipse.swt.widgets.Display;

/**
 * Ejecucion en el hilo de la interfaz de Studio.
 *
 * Los widgets de SWT (los shells, los dialogos) solo se pueden tocar desde el
 * hilo de la UI. Estas operaciones se lanzan ahi.
 *
 * Dos reglas importantes:
 *
 * - El hilo de la UI no puede quedarse bloqueado: si se espera ahi mas de
 *   `timeoutMs`, la accion se **descarta** (no se ejecuta tarde, que es peor:
 *   tocaria el modelo cuando ya no toca).
 * - Solo entra en la UI lo que toca widgets o el modelo del job, y en trozos
 *   cortos. Recorrer el catalogo entero o esperar un proceso se hace en el
 *   hilo de trabajo HTTP.
 */
public final class UiThread {

  /** Tiempo maximo de espera por defecto, en milisegundos. */
  public static final long DEFAULT_TIMEOUT_MS = 10_000L;

  /**
   * Acciones que pueden esperar en la cola de la UI a la vez.
   *
   * Si el hilo de la UI se queda bloqueado, cada llamada encola su runnable y
   * los runnables se acumulan en la cola de SWT hasta agotar la memoria. Con un
   * tope, las llamadas nuevas fallan rapido en vez de apilarse.
   */
  private static final int MAX_PENDING = 64;

  private static final AtomicInteger pending = new AtomicInteger();

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
   *        libre, se lanza una excepcion y la accion se descarta.
   */
  public static <T> T sync(Callable<T> action, long timeoutMs) {
    if (Display.getCurrent() != null) {
      return call(action);
    }

    AtomicReference<T> result = new AtomicReference<>();
    AtomicReference<RuntimeException> error = new AtomicReference<>();
    AtomicBoolean cancelled = new AtomicBoolean(false);
    CountDownLatch done = new CountDownLatch(1);

    if (pending.incrementAndGet() > MAX_PENDING) {
      pending.decrementAndGet();
      throw new IllegalStateException(
          "Hay demasiadas acciones esperando al hilo de la interfaz de Studio");
    }

    try {
      Display display = Display.getDefault();
      display.asyncExec(() -> {
        try {
          // Si el tiempo se acabo mientras esta en la cola, la accion se
          // descarta: ejecutarla tarde tocaria el modelo cuando ya no toca.
          if (cancelled.get()) {
            return;
          }
          result.set(call(action));
        } catch (RuntimeException e) {
          error.set(e);
        } finally {
          pending.decrementAndGet();
          done.countDown();
        }
      });
    } catch (RuntimeException | Error e) {
      // Si no se pudo encolar (display nulo o ya liberado) el turno se
      // devuelve aqui: si no, 64 fallos asi dejarian la UI bloqueada para
      // siempre, porque el contador nunca bajaria.
      pending.decrementAndGet();
      throw e;
    }

    boolean finished;
    try {
      finished = done.await(timeoutMs, TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      cancelled.set(true);
      throw new IllegalStateException("Se interrumpio la espera al hilo de la interfaz de Studio");
    }

    if (!finished) {
      cancelled.set(true);
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
    } catch (RuntimeException e) {
      // Sin envolver: asi el servidor ve la excepcion original (por ejemplo una
      // validacion que debe responder 400, no 500).
      throw e;
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
