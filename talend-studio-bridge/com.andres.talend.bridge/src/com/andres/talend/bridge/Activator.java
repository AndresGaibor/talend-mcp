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

    bridgeServer = new BridgeServer(context);
    bridgeServer.start();

    // Los listeners se registran despues de que el servidor este arriba: si el
    // servidor falla al arrancar, no quedan listeners de un plugin a medias
    // que nadie desregistra.
    EventsService.start();

    // El guardian cierra solo los dialogos conocidos (por ejemplo el
    // "Jobname Error" al reusar la etiqueta de un job), y solo si la
    // configuracion lo pide con `autoDismissModals`. Por defecto no se cierra
    // ningun modal solo: lo contesta quien lo ve, o la tool
    // `talend_studio_dismiss_dialogs`.
    if (BridgeConfig.load().autoDismissModals) {
      ModalGuard.startWatchdog();
    }

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
