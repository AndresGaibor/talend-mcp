package com.andres.talend.bridge;

import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

public final class Activator extends AbstractUIPlugin {
  public static final String PLUGIN_ID = "com.andres.talend.bridge";

  private static Activator instance;

  private BridgeServer bridgeServer;

  public static Activator getDefault() {
    return instance;
  }

  @Override
  public void start(BundleContext context) throws Exception {
    super.start(context);
    instance = this;
    bridgeServer = new BridgeServer(context);
    bridgeServer.start();
  }

  @Override
  public void stop(BundleContext context) throws Exception {
    if (bridgeServer != null) {
      bridgeServer.stop();
      bridgeServer = null;
    }
    instance = null;
    super.stop(context);
  }
}
