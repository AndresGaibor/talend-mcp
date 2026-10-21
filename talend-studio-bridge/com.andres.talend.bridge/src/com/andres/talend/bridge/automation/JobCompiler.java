package com.andres.talend.bridge.automation;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.google.gson.JsonObject;

/**
 * Genera el codigo Java de un job y comprueba que compila, sin ejecutarlo.
 *
 * Es lo que hace Studio justo antes de un Run (ProcessorUtilities.generateCode
 * y la comprobacion de errores de compilacion), pero sin lanzar el job. Sirve
 * para saber si un componente configurado de cierta forma genera codigo valido
 * (nivel L4) sin tocar datos ni depender de que el job pueda ejecutarse.
 *
 * Tiene que correr en el hilo de la UI: la generacion llama a
 * `TalendJavaEditor.validateSyntax`, que toca widgets. Studio lo hace igual
 * (dentro de su dialogo de progreso), y tarda unos segundos.
 */
public final class JobCompiler {

  private JobCompiler() {}

  private static final Pattern LINE = Pattern.compile("Error Line:\\s*(\\d+)");
  private static final Pattern DETAIL = Pattern.compile("Detail Message:\\s*(.+)");

  /**
   * @param spec `job` opcional (si no, el job activo).
   */
  public static Map<String, Object> check(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String jobName = String.valueOf(process.getClass().getMethod("getName").invoke(process));

    Object contextManager = process.getClass().getMethod("getContextManager").invoke(process);
    Object context = contextManager.getClass().getMethod("getDefaultContext").invoke(contextManager);

    Class<?> utilities = TalendClasses.load("org.talend.designer.runprocess.ProcessorUtilities");
    Class<?> processClass = TalendClasses.load("org.talend.core.model.process.IProcess");
    Class<?> contextClass = TalendClasses.load("org.talend.core.model.process.IContext");
    Method generate = utilities.getMethod("generateCode", processClass, contextClass,
        boolean.class, boolean.class, boolean.class);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("job", jobName);

    long started = System.currentTimeMillis();
    try {
      generate.invoke(null, process, context, false, false, true);
      checkCompilation();
      result.put("compiles", true);
    } catch (InvocationTargetException e) {
      result.put("compiles", false);
      result.put("error", describe(rootMessage(e)));
    } catch (RuntimeException e) {
      result.put("compiles", false);
      result.put("error", describe(rootMessage(e)));
    }
    result.put("generationMs", System.currentTimeMillis() - started);
    return result;
  }

  /** Errores de compilacion de la ultima generacion (lanza si los hay). */
  private static void checkCompilation() throws Exception {
    Class<?> checker = org.eclipse.core.runtime.Platform.getBundle("org.talend.designer.runprocess")
        .loadClass("org.talend.designer.runprocess.JobErrorsChecker");
    checker.getMethod("checkLastGenerationHasCompilationError", boolean.class).invoke(null, true);
  }

  private static String rootMessage(Throwable error) {
    Throwable cause = error;
    while (cause.getCause() != null && cause.getCause() != cause) {
      cause = cause.getCause();
    }
    String message = cause.getMessage();
    return message == null ? cause.getClass().getSimpleName() : message;
  }

  /** Separa linea y mensaje del texto de Studio, y conserva el texto completo. */
  private static Map<String, Object> describe(String raw) {
    Map<String, Object> error = new LinkedHashMap<>();
    Matcher line = LINE.matcher(raw);
    if (line.find()) {
      error.put("line", Integer.parseInt(line.group(1)));
    }
    Matcher detail = DETAIL.matcher(raw);
    error.put("message", detail.find() ? detail.group(1).trim() : raw.trim());
    error.put("raw", raw);
    return error;
  }
}
