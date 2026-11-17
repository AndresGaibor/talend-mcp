package com.andres.talend.bridge.automation;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.google.gson.JsonObject;

/** Ciclo de vida consultable para builds masivos, separado de la peticion HTTP inicial. */
public final class JobBuildBatchOperations {
  private static final int MAX_HISTORY = 200;
  private static final Pattern OPERATION_ID_PATTERN = Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
  private static final long HISTORY_TTL_MS = 24L * 60L * 60L * 1000L;
  private static final Object LOCK = new Object();
  private static final Map<String, Operation> OPERATIONS = new LinkedHashMap<>();
  private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(r -> {
    Thread thread = new Thread(r, "talend-build-batch");
    thread.setDaemon(true);
    return thread;
  });

  private JobBuildBatchOperations() {}

  public static Map<String, Object> start(JsonObject spec) {
    if (spec == null || !spec.has("jobs") || !spec.get("jobs").isJsonArray() || spec.getAsJsonArray("jobs").size() == 0) {
      throw new IllegalArgumentException("jobs debe contener al menos un nombre de Job");
    }
    prune();
    String requestedId = spec.has("operationId") ? spec.get("operationId").getAsString() : null;
    if (requestedId != null && !OPERATION_ID_PATTERN.matcher(requestedId).matches()) {
      throw new IllegalArgumentException("operationId debe ser un UUID valido");
    }
    String operationId = requestedId == null ? UUID.randomUUID().toString() : requestedId;
    Operation operation = new Operation(operationId, spec.deepCopy(), spec.getAsJsonArray("jobs").size());
    synchronized (LOCK) {
      if (OPERATIONS.containsKey(operation.id)) {
        throw new IllegalStateException("Ya existe una operacion con ese operationId");
      }
      if (OPERATIONS.size() >= MAX_HISTORY) {
        throw new IllegalStateException("Limite de operaciones de build en cola alcanzado");
      }
      OPERATIONS.put(operation.id, operation);
    }
    WORKER.execute(() -> execute(operation));
    return operation.snapshot(false);
  }

  public static Map<String, Object> status(JsonObject spec) {
    Operation operation = find(spec);
    if (operation == null) return notFound();
    return operation.snapshot(true);
  }

  public static Map<String, Object> cancel(JsonObject spec) {
    Operation operation = find(spec);
    if (operation == null) return notFound();
    synchronized (operation) {
      if ("queued".equals(operation.state) || "running".equals(operation.state)) {
        operation.cancelRequested = true;
        operation.state = "cancelling";
        operation.updatedAt = System.currentTimeMillis();
      }
    }
    return operation.snapshot(false);
  }

  private static void execute(Operation operation) {
    synchronized (operation) {
      if (operation.cancelRequested) {
        operation.state = "cancelled";
        operation.finishedAt = System.currentTimeMillis();
        operation.updatedAt = operation.finishedAt;
        return;
      }
      operation.state = "running";
      operation.updatedAt = System.currentTimeMillis();
    }
    try {
      Map<String, Object> result = JobBuilder.buildBatch(operation.spec, operation);
      synchronized (operation) {
        operation.result = result;
        boolean cancelled = Boolean.TRUE.equals(result.get("cancelled"));
        int successful = number(result.get("correctos"), 0);
        int completedJobs = number(result.get("completed"), 0);
        boolean failed = !cancelled && successful < completedJobs;
        operation.state = cancelled ? "cancelled" : failed ? "failed" : "succeeded";
        if (failed) operation.errorCode = "BUILD_BATCH_FAILED";
        operation.completed = number(result.get("completed"), operation.completed);
        operation.finishedAt = System.currentTimeMillis();
        operation.updatedAt = operation.finishedAt;
      }
    } catch (Exception error) {
      synchronized (operation) {
        operation.state = operation.cancelRequested ? "cancelled" : "failed";
        operation.errorCode = operation.cancelRequested ? "CANCELLED" : "BUILD_BATCH_FAILED";
        operation.finishedAt = System.currentTimeMillis();
        operation.updatedAt = operation.finishedAt;
      }
    }
  }

  private static Operation find(JsonObject spec) {
    String id = spec != null && spec.has("operationId") ? spec.get("operationId").getAsString() : "";
    synchronized (LOCK) {
      return OPERATIONS.get(id);
    }
  }

  private static Map<String, Object> notFound() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("found", false);
    result.put("errorCode", "OPERATION_NOT_FOUND");
    return result;
  }

  private static void prune() {
    long cutoff = System.currentTimeMillis() - HISTORY_TTL_MS;
    synchronized (LOCK) {
      Iterator<Map.Entry<String, Operation>> iterator = OPERATIONS.entrySet().iterator();
      while (iterator.hasNext()) {
        Operation operation = iterator.next().getValue();
        if (operation.finishedAt > 0 && operation.finishedAt < cutoff) iterator.remove();
      }
      while (OPERATIONS.size() >= MAX_HISTORY) {
        String removable = null;
        for (Map.Entry<String, Operation> entry : OPERATIONS.entrySet()) {
          if (entry.getValue().finishedAt > 0) { removable = entry.getKey(); break; }
        }
        if (removable == null) break;
        OPERATIONS.remove(removable);
      }
    }
  }

  private static int number(Object value, int fallback) {
    return value instanceof Number ? ((Number) value).intValue() : fallback;
  }

  private static final class Operation implements JobBuilder.BatchControl {
    final String id;
    final JsonObject spec;
    final int total;
    final long createdAt = System.currentTimeMillis();
    volatile String state = "queued";
    volatile int completed;
    volatile String currentJob = "";
    volatile boolean cancelRequested;
    volatile long updatedAt = createdAt;
    volatile long finishedAt;
    volatile String errorCode;
    volatile Map<String, Object> result;

    Operation(String id, JsonObject spec, int total) {
      this.id = id;
      this.spec = spec;
      this.total = total;
    }

    @Override
    public boolean cancelRequested() { return cancelRequested; }

    @Override
    public void progress(String job, int done, int all) {
      currentJob = job == null ? "" : job;
      completed = done;
      updatedAt = System.currentTimeMillis();
    }

    synchronized Map<String, Object> snapshot(boolean includeResult) {
      Map<String, Object> snapshot = new LinkedHashMap<>();
      snapshot.put("found", true);
      snapshot.put("operationId", id);
      snapshot.put("state", state);
      snapshot.put("total", total);
      snapshot.put("completed", completed);
      snapshot.put("currentJob", currentJob);
      snapshot.put("createdAt", createdAt);
      snapshot.put("updatedAt", updatedAt);
      if (finishedAt > 0) snapshot.put("finishedAt", finishedAt);
      if (errorCode != null) snapshot.put("errorCode", errorCode);
      if (includeResult && result != null) snapshot.put("result", result);
      return snapshot;
    }
  }
}
