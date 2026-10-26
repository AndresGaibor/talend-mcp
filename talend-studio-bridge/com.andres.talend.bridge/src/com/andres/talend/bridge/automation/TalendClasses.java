package com.andres.talend.bridge.automation;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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
 *
 * Buscar una clase recorre todos los bundles y cada miss lanza una excepcion:
 * una sola busqueda puede tardar segundos, y las operaciones piden decenas de
 * clases. Por eso el resultado se guarda. Las ausencias tambien, durante un
 * rato, para no repetir la busqueda de una clase que no esta.
 */
public final class TalendClasses {

  /** Tiempo que se recuerda que una clase no esta. Pasado este plazo se vuelve a buscar. */
  private static final long MISS_TTL_MS = 60_000L;

  private static final Map<String, Class<?>> found = new ConcurrentHashMap<>();
  private static final Map<String, Long> missedAt = new ConcurrentHashMap<>();

  private TalendClasses() {}

  /**
   * Carga una clase de Talend.
   *
   * @param className nombre completo de la clase (con `$` para las anidadas).
   */
  public static Class<?> load(String className) throws ClassNotFoundException {
    Class<?> cached = found.get(className);
    if (cached != null) {
      return cached;
    }
    Long missed = missedAt.get(className);
    if (missed != null && System.currentTimeMillis() - missed < MISS_TTL_MS) {
      throw new ClassNotFoundException(className + " (no encontrada en la busqueda reciente)");
    }
    try {
      Class<?> loaded = search(className);
      found.put(className, loaded);
      missedAt.remove(className);
      return loaded;
    } catch (ClassNotFoundException e) {
      missedAt.put(className, System.currentTimeMillis());
      throw e;
    }
  }

  private static Class<?> search(String className) throws ClassNotFoundException {
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
