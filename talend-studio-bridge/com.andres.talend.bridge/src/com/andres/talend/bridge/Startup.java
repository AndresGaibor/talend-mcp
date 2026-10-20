package com.andres.talend.bridge;

import org.eclipse.ui.IStartup;

/**
 * Punto de entrada de arranque.
 *
 * El bundle es lazy, asi que la extension {@code org.eclipse.ui.startup} es lo
 * que fuerza su activacion al abrir Talend Studio. Aqui solo se informa donde
 * quedo escuchando el bridge para que sea facil de encontrar desde la interfaz.
 */
public final class Startup implements IStartup {
  @Override
  public void earlyStartup() {
    BridgeLog.info("Talend Studio Bridge activo. Consulta http://127.0.0.1:3930/ping para verificar el estado.");
  }
}
