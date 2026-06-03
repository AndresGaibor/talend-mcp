package com.andres.talend.bridge;

import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicReference;

import org.eclipse.swt.widgets.Display;

final class UiThread {
  private UiThread() {}

  static <T> T sync(Callable<T> action) {
    if (Display.getCurrent() != null) {
      return call(action);
    }

    AtomicReference<T> result = new AtomicReference<>();
    AtomicReference<RuntimeException> error = new AtomicReference<>();
    Display display = Display.getDefault();
    display.syncExec(() -> {
      try {
        result.set(call(action));
      } catch (RuntimeException e) {
        error.set(e);
      }
    });

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
