package com.andres.talend.bridge;

import org.eclipse.ui.IStartup;

public final class Startup implements IStartup {
  @Override
  public void earlyStartup() {
    Activator.getDefault();
  }
}
