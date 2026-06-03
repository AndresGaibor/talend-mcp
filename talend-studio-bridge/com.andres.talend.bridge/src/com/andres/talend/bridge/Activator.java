package com.andres.talend.bridge;

import com.andres.talend.bridge.events.EventsService;
import com.andres.talend.bridge.launch.LaunchTrackerService;

import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

public final class Activator extends AbstractUIPlugin {
  public static final String PLUGIN_ID = "com.andres.talend.bridge";

  private static Activator instance;

  private BridgeServer bridgeServer;

  @Override
  public void start(BundleContext context) throws Exception {
    super.start(context);
    instance = this;
    LaunchTrackerService.loadPersistedRuns();
    EventsService.start();
    bridgeServer = new BridgeServer(context);
    bridgeServer.start();
  }

  @Override
  public void stop(BundleContext context) throws Exception {
    if (bridgeServer != null) {
      bridgeServer.stop();
      bridgeServer = null;
    }
    EventsService.stop();
    instance = null;
    super.stop(context);
  }
}