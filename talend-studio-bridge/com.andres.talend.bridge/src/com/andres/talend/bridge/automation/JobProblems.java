package com.andres.talend.bridge.automation;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.andres.talend.bridge.BridgeLog;

import com.google.gson.JsonObject;

/**
 * Problemas de diseno de un job: los errores y avisos que Studio marca en el
 * lienzo y lista en la vista Problemas ("No schema has been defined yet",
 * "This component should have input link(s)"...).
 *
 * Se calculan sin ejecutar nada, asi que sirven para comprobar que un job
 * "abre sin avisos" y para detectar un job mal montado antes de compilarlo.
 */
public final class JobProblems {

  private JobProblems() {}

  /** Clase de Talend que guarda los problemas de todos los jobs abiertos. */
  private static final String PROBLEMS_CLASS = "org.talend.designer.core.ui.views.problems.Problems";
  private static final String STATUS_CLASS = "org.talend.core.model.process.Problem$ProblemStatus";

  /**
   * Recalcula y devuelve los problemas del job. Va en la UI: refrescar el estado
   * de los nodos toca los marcadores del lienzo.
   *
   * @param spec `job` opcional (si no, el job activo). Con `release: true` se sueltan los problemas del job
   *        antes de devolver: para quien va a cerrar el editor que abrio, porque cerrarlo no los limpia y el
   *        almacen estatico de Studio acumularia copias (y falsos errores) cada vez que se recrea el job.
   */
  public static Map<String, Object> list(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String jobName = String.valueOf(process.getClass().getMethod("getName").invoke(process));

    Class<?> problems = TalendClasses.load(PROBLEMS_CLASS);
    Class<?> statusClass = TalendClasses.load(STATUS_CLASS);

    // Un job borrado y recreado con el mismo nombre deja sus problemas viejos en el almacen estatico de Studio: se
    // quitan todos los de este nombre y el recalculo de abajo repone solo los del proceso actual.
    int purged = purgeByJobName(problems, statusClass, jobName);

    // Studio solo recalcula los problemas cuando se edita; aqui se fuerza.
    for (Method method : problems.getMethods()) {
      if ("refreshProcessAllNodesStatus".equals(method.getName()) && method.getParameterCount() == 1) {
        method.invoke(null, process);
        break;
      }
    }

    // Los problemas de un job que se borro y se recreo con el mismo nombre siguen en el almacen estatico de Studio
    // y apuntan al proceso viejo: solo cuentan los del proceso actual.
    List<Map<String, Object>> found = new ArrayList<>();
    int discarded = 0;
    int errors = 0;
    int warnings = 0;
    int infos = 0;
    for (Object status : statusClass.getEnumConstants()) {
      Object list = problems.getMethod("getProblemsBySeverity", statusClass).invoke(null, status);
      if (!(list instanceof Iterable)) {
        continue;
      }
      for (Object problem : (Iterable<?>) list) {
        // La lista es global (todos los jobs abiertos): solo los de este.
        if (!jobName.equals(jobNameOf(problem))) {
          continue;
        }
        if (!belongsToProcess(problem, process)) {
          discarded++;
          continue;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        String severity = String.valueOf(status);
        item.put("severity", severity);
        item.put("node", TalendApi.invokeOrNull(problem, "getNodeName"));
        item.put("component", TalendApi.invokeOrNull(problem, "getComponentName"));
        item.put("description", TalendApi.invokeOrNull(problem, "getDescription"));
        item.put("type", String.valueOf(TalendApi.invokeOrNull(problem, "getType")));
        found.add(item);
        if ("ERROR".equals(severity)) {
          errors++;
        } else if ("WARNING".equals(severity)) {
          warnings++;
        } else {
          infos++;
        }
      }
    }

    if (JsonSpec.booleanOf(spec, "release", false)) {
      releaseProblems(problems, process);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("job", jobName);
    result.put("errors", errors);
    result.put("warnings", warnings);
    result.put("infos", infos);
    result.put("clean", errors == 0 && warnings == 0);
    // Entradas viejas (de un job del mismo nombre ya descartado) que no se cuentan.
    result.put("discardedStale", discarded + purged);
    result.put("problems", found);
    return result;
  }

  /**
   * El problema es del proceso actual. Cada problema guarda en su `jobInfo` el proceso al que pertenece: el de un job
   * que se borro y se recreo con el mismo nombre apunta a un proceso viejo (comparado por identidad) y se descarta.
   * Si no se puede saber el proceso, se conserva.
   */
  private static boolean belongsToProcess(Object problem, Object process) {
    try {
      Object info = TalendApi.invokeOrNull(problem, "getJobInfo");
      if (info == null) {
        return true;
      }
      Object owner = TalendApi.invokeOrNull(info, "getProcess");
      return owner == null || owner == process;
    } catch (RuntimeException e) {
      return true;
    }
  }

  /** Quita del almacen de Studio los problemas de un job por su nombre; devuelve cuantos quito. */
  private static int purgeByJobName(Class<?> problems, Class<?> statusClass, String jobName) {
    int removed = 0;
    try {
      for (Object status : statusClass.getEnumConstants()) {
        Object list = problems.getMethod("getProblemsBySeverity", statusClass).invoke(null, status);
        if (!(list instanceof java.util.Collection)) {
          continue;
        }
        java.util.Collection<?> collection = (java.util.Collection<?>) list;
        int before = collection.size();
        try {
          collection.removeIf(problem -> jobName.equals(jobNameOf(problem)));
          removed += before - collection.size();
        } catch (UnsupportedOperationException e) {
          // Una copia de solo lectura: no se puede purgar por aqui.
        }
      }
    } catch (Exception e) {
      BridgeLog.warn("No se pudieron purgar los problemas viejos de " + jobName, e);
    }
    return removed;
  }

  /** Suelta los problemas del job del almacen estatico de Studio (`removeJob`, o `removeProblemsByProcess`). */
  private static void releaseProblems(Class<?> problems, Object process) {
    for (String name : new String[] {"removeJob", "removeProblemsByProcess"}) {
      for (Method method : problems.getMethods()) {
        if (name.equals(method.getName()) && method.getParameterCount() == 1) {
          try {
            method.invoke(null, process);
          } catch (Exception e) {
            BridgeLog.warn("No se pudieron soltar los problemas con " + name, e);
          }
          break;
        }
      }
    }
  }

  /** Nombre del job al que pertenece un problema. */
  private static String jobNameOf(Object problem) {
    Object info = TalendApi.invokeOrNull(problem, "getJobInfo");
    if (info == null) {
      return null;
    }
    Object name = TalendApi.invokeOrNull(info, "getJobName");
    return name == null ? null : String.valueOf(name);
  }
}
