package com.andres.talend.bridge;

import org.eclipse.ui.IStartup;

public final class Startup implements IStartup {
  @Override
  public void earlyStartup() {
    // El bridge se inicia via Activator.start() automáticamente
    // No se necesita llamar a getDefault() aquí
  }
}
