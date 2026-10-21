package com.andres.talend.bridge.automation;

import org.eclipse.core.runtime.Platform;
import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;

/**
 * Cargador de clases de Talend.
 *
 * El plugin no puede usar `Class.forName` para las clases de Talend: cada
 * bundle de OSGi tiene su propio classloader y las clases del framework no
 * estan en el classpath del plugin. La via es buscarlas en los bundles
 * cargados.
 */
public final class TalendClasses {

  private TalendClasses() {}

  /**
   * Carga una clase de Talend.
   *
   * @param className nombre completo de la clase.
   */
  public static Class<?> load(String className) throws ClassNotFoundException {
    Bundle runtime = Platform.getBundle("org.talend.core.runtime");
    if (runtime != null) {
      BundleContext context = runtime.getBundleContext();
      if (context != null) {
        for (Bundle bundle : context.getBundles()) {
          try {
            return bundle.loadClass(className);
          } catch (ClassNotFoundException ignored) {
            // El bundle no tiene la clase: se prueba el siguiente.
          }
        }
      }
    }
    return Class.forName(className);
  }
}
