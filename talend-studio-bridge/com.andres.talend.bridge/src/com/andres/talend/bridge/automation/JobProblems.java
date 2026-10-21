package com.andres.talend.bridge.automation;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
   * @param spec `job` opcional (si no, el job activo).
   */
  public static Map<String, Object> list(JsonObject spec) throws Exception {
    Object editor = TalendApi.designerEditor(spec);
    Object process = TalendApi.processOf(editor);
    String jobName = String.valueOf(process.getClass().getMethod("getName").invoke(process));

    Class<?> problems = TalendClasses.load(PROBLEMS_CLASS);
    Class<?> statusClass = TalendClasses.load(STATUS_CLASS);

    // Studio solo recalcula los problemas cuando se edita; aqui se fuerza.
    for (Method method : problems.getMethods()) {
      if ("refreshProcessAllNodesStatus".equals(method.getName()) && method.getParameterCount() == 1) {
        method.invoke(null, process);
        break;
      }
    }

    List<Map<String, Object>> found = new ArrayList<>();
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

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("job", jobName);
    result.put("errors", errors);
    result.put("warnings", warnings);
    result.put("infos", infos);
    result.put("clean", errors == 0 && warnings == 0);
    result.put("problems", found);
    return result;
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
