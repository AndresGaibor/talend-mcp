package com.andres.talend.bridge;

import org.eclipse.core.runtime.ILog;
import org.eclipse.core.runtime.IStatus;
import org.eclipse.core.runtime.Platform;
import org.eclipse.core.runtime.Status;
import org.osgi.framework.Bundle;
import org.osgi.framework.FrameworkUtil;

/**
 * Logging del bridge hacia el Error Log de Talend Studio.
 *
 * Antes los fallos del bridge eran invisibles: el servidor HTTP respondia con
 * errores genericos y no habia forma de saber que habia pasado. Ahora todo
 * error queda registrado en el log de la plataforma.
 */
public final class BridgeLog {
  private BridgeLog() {}

  public static void info(String message) {
    log(IStatus.INFO, message, null);
  }

  public static void warn(String message) {
    log(IStatus.WARNING, message, null);
  }

  public static void warn(String message, Throwable error) {
    log(IStatus.WARNING, message, error);
  }

  public static void error(String message, Throwable error) {
    log(IStatus.ERROR, message, error);
  }

  private static void log(int severity, String message, Throwable error) {
    try {
      Bundle bundle = FrameworkUtil.getBundle(BridgeLog.class);
      if (bundle == null) {
        return;
      }
      ILog log = Platform.getLog(bundle);
      if (log == null) {
        return;
      }
      log.log(new Status(severity, Activator.PLUGIN_ID, message, error));
    } catch (RuntimeException ignored) {
      // El logging nunca debe romper el bridge.
    }
  }
}
