package com.andres.talend.bridge;

import com.andres.talend.bridge.events.EventsService;
import com.andres.talend.bridge.launch.LaunchTrackerService;
import com.andres.talend.bridge.workbench.ModalGuard;

import org.eclipse.ui.plugin.AbstractUIPlugin;
import org.osgi.framework.BundleContext;

public final class Activator extends AbstractUIPlugin {
  public static final String PLUGIN_ID = "com.andres.talend.bridge";

  private BridgeServer bridgeServer;
  private HotReloadService hotReloadService;

  @Override
  public void start(BundleContext context) throws Exception {
    super.start(context);
    LaunchTrackerService.loadPersistedRuns();
    EventsService.start();

    bridgeServer = new BridgeServer(context);
    bridgeServer.start();

    // El guardian cierra los modales que bloquean a Studio (por ejemplo el
    // "Jobname Error" al reusar la etiqueta de un job). Sin el, el hilo de
    // la UI se queda dentro del dialogo y el IDE no responde.
    ModalGuard.startWatchdog();

    hotReloadService = new HotReloadService();
    // Antes de recargar el bundle hay que soltar el servidor HTTP y el
    // guardian: si siguen vivos, siguen usando el classloader descartado y
    // Eclipse falla con "Invalid class loader from a refreshed bundle".
    hotReloadService.setBeforeReload(() -> {
      ModalGuard.stopWatchdog();
      if (bridgeServer != null) {
        bridgeServer.stop();
      }
    });
    hotReloadService.start(context.getBundle());
  }

  @Override
  public void stop(BundleContext context) throws Exception {
    ModalGuard.stopWatchdog();
    if (hotReloadService != null) {
      hotReloadService.stop();
      hotReloadService = null;
    }
    if (bridgeServer != null) {
      bridgeServer.stop();
      bridgeServer = null;
    }
    EventsService.stop();
    LaunchTrackerService.stopObservers();
    super.stop(context);
  }
}
