package com.andres.talend.bridge.automation;

import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Ejecuta codigo Java dentro de Studio, con acceso a las APIs de Talend.
 *
 * Sirve para lo que no cabe en una tool: explorar una API desconocida,
 * consultar el estado interno del IDE o hacer una operacion que aun no tenga
 * endpoint. El codigo se compila contra los jars de Studio y se ejecuta en el
 * mismo classloader que el plugin, asi que ve exactamente las mismas clases
 * que ve Talend.
 *
 * El codigo debe tener una clase con un metodo estatico `public static
 * Object run()` sin argumentos. El valor que devuelva se serializa a JSON.
 *
 * Por seguridad:
 *
 * - Solo se ejecuta si `unsafeActions` esta activo y el modo no es lectura.
 * - El codigo corre en un hilo aparte, no en el de la UI. Si necesita tocar
 *   la UI, el propio codigo puede pedir el hilo de la UI.
 */
public final class CodeRunnerService {

  /** Nombre del metodo que se invoca en el codigo del usuario. */
  private static final String ENTRY_POINT = "run";

  private CodeRunnerService() {}

  /**
   * Compila y ejecuta el codigo dado.
   *
   * @param spec code (obligatorio), className (opcional) y uiThread (opcional).
   *        Con `uiThread` el codigo corre en el hilo de la UI, que es lo
   *        necesario para tocar widgets, diálogos o el workbench. Sin eso, SWT
   *        lanza `Invalid thread access`.
   */
  public static Map<String, Object> run(JsonObject spec) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("ok", true);
    payload.put("source", "studio-bridge");
    payload.put("confidence", "medium");
    payload.put("endpoint", "/automation/run-code");

    String code = string(spec, "code");
    if (code == null || code.trim().isEmpty()) {
      payload.put("ok", false);
      payload.put("error", "MISSING_PARAMETER: falta el parametro 'code'");
      return payload;
    }

    try {
      String className = string(spec, "className");
      if (className == null || className.trim().isEmpty()) {
        className = detectClassName(code);
      }
      if (className == null) {
        payload.put("ok", false);
        payload.put("error", "CLASS_NAME_NOT_FOUND: no se pudo deducir la clase del codigo");
        return payload;
      }

      // 1. Compilar contra las clases de Studio.
      Path sourceDir = Files.createTempDirectory("talend-bridge-code");
      Path outputDir = Files.createTempDirectory("talend-bridge-classes");
      ClassLoader loader = null;
      try {
        Path sourceFile = sourceDir.resolve(className.replace('.', '/') + ".java");
        Files.createDirectories(sourceFile.getParent());
        Files.write(sourceFile, code.getBytes(java.nio.charset.StandardCharsets.UTF_8));

        List<String> compilerMessages = new ArrayList<>();
        boolean compiled = compile(sourceFile, outputDir, compilerMessages);
        if (!compiled) {
          payload.put("ok", false);
          payload.put("error", "COMPILE_ERROR");
          payload.put("compilerMessages", compilerMessages);
          return payload;
        }

        // 2. Cargar la clase con un classloader que ve los jars de Studio.
        loader = studioClassLoader(outputDir);
        Class<?> compiledClass = loader.loadClass(className);

        // 3. Ejecutar. En el hilo de la UI si se pide.
        Method entryPoint = compiledClass.getMethod(ENTRY_POINT);
        boolean onUiThread = Boolean.TRUE.equals(
            spec.has("uiThread") && !spec.get("uiThread").isJsonNull()
                ? spec.get("uiThread").getAsBoolean() : Boolean.FALSE);

        Object result;
        if (onUiThread) {
          final Object[] holder = new Object[1];
          final Throwable[] failure = new Throwable[1];
          org.eclipse.swt.widgets.Display.getDefault().syncExec(() -> {
            try {
              holder[0] = entryPoint.invoke(null);
            } catch (Throwable t) {
              failure[0] = t;
            }
          });
          if (failure[0] != null) {
            throw failure[0] instanceof Exception ? (Exception) failure[0]
                : new java.lang.RuntimeException(failure[0]);
          }
          result = holder[0];
        } else {
          result = entryPoint.invoke(null);
        }

        payload.put("ok", true);
        payload.put("className", className);
        payload.put("uiThread", onUiThread);
        payload.put("result", toJson(result));
      } finally {
        // El classloader se cierra: si no, cada ejecucion deja las clases
        // cargadas y el heap de Studio se llena sin que se note.
        closeQuietly(loader);
        deleteRecursively(sourceDir);
        deleteRecursively(outputDir);
      }
    } catch (Exception e) {
      payload.put("ok", false);
      payload.put("error", "EXECUTION_ERROR: " + describe(e));
      payload.put("stackTrace", stackTraceOf(e));
      BridgeLog.warn("Fallo la ejecucion de codigo en el bridge", e);
    }
    return payload;
  }

  /** Cierra un classloader, sin que falle la ejecucion si ya esta cerrado. */
  private static void closeQuietly(ClassLoader loader) {
    try {
      if (loader instanceof java.io.Closeable) {
        ((java.io.Closeable) loader).close();
      }
    } catch (Exception e) {
      // Da igual: lo que importa es no dejar el classloader abierto.
    }
  }

  /**
   * Compila el fuente contra el classpath de Studio.
   *
   * Se usa el compilador del JDK que ejecuta Studio, que esta en
   * `jdk.compiler`. El classpath se arma con los jars de los bundles
   * cargados, para que el codigo vea las APIs de Talend.
   */
  private static boolean compile(Path sourceFile, Path outputDir, List<String> messages) {
    javax.tools.JavaCompiler compiler = javax.tools.ToolProvider.getSystemJavaCompiler();
    if (compiler == null) {
      messages.add("El runtime de Studio no incluye el compilador (jdk.compiler). "
          + "Se necesita un JDK completo para compilar codigo.");
      return false;
    }

    StringBuilder classpath = new StringBuilder();
    for (String entry : studioClasspath()) {
      if (classpath.length() > 0) {
        classpath.append(File.pathSeparatorChar);
      }
      classpath.append(entry);
    }

    java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
    java.io.ByteArrayOutputStream err = new java.io.ByteArrayOutputStream();
    int status = compiler.run(null, out, err,
        "-nowarn",
        "-classpath", classpath.toString(),
        "-d", outputDir.toString(),
        sourceFile.toString());

    if (status != 0) {
      String errors = err.toString(java.nio.charset.StandardCharsets.UTF_8);
      if (errors.isEmpty()) {
        errors = out.toString(java.nio.charset.StandardCharsets.UTF_8);
      }
      for (String line : errors.split("\n")) {
        if (!line.trim().isEmpty()) {
          messages.add(line.trim());
        }
      }
      if (messages.isEmpty()) {
        // El compilador no siempre escribe el detalle: se recoge con un
        // escritor propio para no perder el diagnostico.
        messages.add("El compilador devolvio el codigo " + status + " sin detalle. "
            + "Revisa que las clases importadas existan en el classpath de Studio.");
      }
      return false;
    }
    return true;
  }

  /** Classpath con los jars de los bundles activos de Studio. */
  private static List<String> studioClasspath() {
    List<String> entries = new ArrayList<>();
    for (org.osgi.framework.Bundle bundle : org.eclipse.core.runtime.Platform.getBundle(
        "org.talend.core.runtime").getBundleContext().getBundles()) {
      try {
        File file = org.eclipse.core.runtime.FileLocator.getBundleFile(bundle);
        if (file != null && file.exists()) {
          entries.add(file.getAbsolutePath());
        }
      } catch (Exception e) {
        // Un bundle que no se puede localizar no aporta al classpath.
      }
    }
    return entries;
  }

  /**
   * Classloader que ve las clases de Studio y las recien compiladas.
   *
   * Las clases de Talend se cargan desde los bundles del framework, no desde
   * los jars: si se cargaran desde el jar, el codigo veria una copia
   * distinta de las clases que usa el IDE, con singletons y caches
   * diferentes, y la llamada a la API fallaria.
   */
  private static ClassLoader studioClassLoader(Path outputDir) throws IOException {
    return new OsgiAwareClassLoader(outputDir, CodeRunnerService.class.getClassLoader());
  }

  /**
   * Classloader que resuelve primero en los bundles del framework y despues
   * en el classloader padre.
   */
  private static final class OsgiAwareClassLoader extends URLClassLoader {

    OsgiAwareClassLoader(Path outputDir, ClassLoader parent) throws IOException {
      super(new java.net.URL[] {outputDir.toUri().toURL()}, parent);
    }

    @Override
    protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
      synchronized (getClassLoadingLock(name)) {
        Class<?> loaded = findLoadedClass(name);
        if (loaded == null) {
          loaded = loadFromBundles(name);
        }
        if (loaded == null) {
          loaded = super.loadClass(name, false);
        }
        if (resolve) {
          resolveClass(loaded);
        }
        return loaded;
      }
    }

    /** Busca la clase en los bundles activos del framework. */
    private Class<?> loadFromBundles(String name) {
      for (org.osgi.framework.Bundle bundle : org.eclipse.core.runtime.Platform.getBundle(
          "org.talend.core.runtime").getBundleContext().getBundles()) {
        try {
          return bundle.loadClass(name);
        } catch (Throwable ignored) {
          // El bundle no tiene la clase: se prueba el siguiente.
        }
      }
      return null;
    }
  }

  /** Deduce el nombre de la clase a partir del codigo fuente. */
  private static String detectClassName(String code) {
    java.util.regex.Matcher matcher = java.util.regex.Pattern
        .compile("(?m)^\\s*(?:public\\s+)?(?:final\\s+)?class\\s+([A-Za-z_$][A-Za-z0-9_$]*)")
        .matcher(code);
    if (matcher.find()) {
      String simpleName = matcher.group(1);
      // Si el codigo declara paquete, el nombre completo lo incluye.
      java.util.regex.Matcher packageMatcher = java.util.regex.Pattern
          .compile("(?m)^\\s*package\\s+([A-Za-z0-9_.]+)\\s*;")
          .matcher(code);
      if (packageMatcher.find()) {
        return packageMatcher.group(1) + "." + simpleName;
      }
      return simpleName;
    }
    return null;
  }

  /** Convierte el valor devuelto por el codigo a algo serializable. */
  private static Object toJson(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean) {
      return value;
    }
    if (value instanceof Map) {
      Map<String, Object> result = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
        result.put(String.valueOf(entry.getKey()), toJson(entry.getValue()));
      }
      return result;
    }
    if (value instanceof Iterable) {
      List<Object> result = new ArrayList<>();
      for (Object item : (Iterable<?>) value) {
        result.add(toJson(item));
      }
      return result;
    }
    if (value.getClass().isArray()) {
      int length = java.lang.reflect.Array.getLength(value);
      List<Object> result = new ArrayList<>(length);
      for (int i = 0; i < length; i++) {
        result.add(toJson(java.lang.reflect.Array.get(value, i)));
      }
      return result;
    }
    // Cualquier otra cosa se devuelve como texto.
    return String.valueOf(value);
  }

  private static String describe(Exception e) {
    Throwable cause = e;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    return cause.getMessage() != null ? cause.getMessage() : cause.toString();
  }

  private static String stackTraceOf(Exception e) {
    StringWriter writer = new StringWriter();
    e.printStackTrace(new PrintWriter(writer));
    return writer.toString();
  }

  private static void deleteRecursively(Path path) {
    try {
      if (!Files.exists(path)) {
        return;
      }
      Files.walk(path)
          .sorted(java.util.Comparator.reverseOrder())
          .forEach(entry -> {
            try {
              Files.deleteIfExists(entry);
            } catch (Exception ignored) {
              // Un temporal que no se puede borrar no es un problema.
            }
          });
    } catch (Exception e) {
      // Ignorado a proposito: son temporales.
    }
  }

  private static String string(JsonObject object, String key) {
    if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
      return null;
    }
    JsonElement element = object.get(key);
    return element.isJsonPrimitive() ? element.getAsString() : null;
  }
}
