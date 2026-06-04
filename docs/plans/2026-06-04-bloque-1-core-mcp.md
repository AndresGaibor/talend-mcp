# Plan: Talend MCP Suite - Bloque 1 (Core MCP)

## Objetivo
Cerrar el core MCP antes de agregar más UI. Asegurar que todas las tools tengan contrato claro.

## Contexto
- Proyecto existente: talend-mcp (suite MCP para Talend Studio)
- Ubicación: /Users/andresgaibor/code/javascript/talend-mcp
- Plataforma: macOS/darwin
- Framework: Bun, MCP SDK, TypeScript

## Reglas obligatorias
- Usar Bun para todo (bun test, bun run, etc.)
- No hardcodear LAB-09 ni rutas de usuario específicas
- Responder en español

---

## Tarea 1.1: TalendToolResult envelope

### Descripción
Crear un envelope común `TalendToolResult<T>` para normalizar todas las respuestas de tools.

### Estructura esperada
```ts
export type TalendToolResult<T = unknown> = {
  ok: boolean;
  source: string;
  confidence: "high" | "medium" | "low" | "none";
  data?: T;
  warnings?: string[];
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  nextActions?: Array<{
    label: string;
    toolName: string;
    input?: Record<string, unknown>;
  }>;
};
```

### Implementación
1. Crear `src/presentation/tools/common/result.ts`
2. Exportar `TalendToolResult<T>` y helper functions
3. Actualizar respuesta de 3-5 tools principales para usar el envelope

### Criterios de aceptación
- [ ] `TalendToolResult` exportado y usado en al menos 5 tools
- [ ] TypeScript sin errores
- [ ] Tests pasando

---

## Tarea 1.2: Completar outputSchema en todas las tools

### Descripción
Verificar que todas las tools tengan outputSchema definido (no depender solo de GENERIC_TOOL_OUTPUT_SCHEMA).

### Implementación
1. Revisar `getRegisteredServerTools()` en new-server.ts
2. Para cada tool que NO tiene outputSchema específico, aplicar GENERIC_TOOL_OUTPUT_SCHEMA
3. El código actual ya hace esto, solo verificar que funciona

### Criterios de aceptación
- [ ]Todas las tools registradas tienen outputSchema (explícito o GENERIC)
- [ ] typecheck pasando

---

## Tarea 1.3: Completar safety annotations para todas las tools

### Descripción
Verificar que TOOL_SAFETY tenga entrada para todas las tools registradas (~96 tools).

### Implementación
1. Ejecutar script de verificación
2. Si faltan entries, agregarlas
3. Verificar que annotations.idempotentHint, readOnlyHint, destructiveHint, openWorldHint sean correctos

### Criterios de aceptación
- [ ] TOOL_SAFETY tiene todas las tools (96+ entries)
- [ ] typecheck pasando
- [ ] Tests pasando

---

## Tarea 1.4: Fix test app-registry.test.ts

### Descripción
El test "launcher tools están registrados en el servidor" falla porque `getRegisteredServerTools()` no incluye los launchers de apps. Esto es un problema de diseño pre-existente.

### Implementación
Opción: Modificar el test para verificar que los launchers se registran correctamente cuando se llama `registerPresentationApps()`. O usar una función `getAllRegisteredToolNames()` que incluya tanto tools como launchers.

### Criterios de aceptación
- [ ] Test pasa sin modificar la arquitectura existente
- [ ] No causar regresiones

---

## Tarea 1.5: Tests MCP Core

### Descripción
Agregar tests para verificar:
- action.toolName existe en tool registry
- action payload valida contra inputSchema
- dangerous action requiere confirmación

### Implementación
1. Crear `tests/presentation/tools/core.test.ts`
2. Tests para verificar seguridad de annotations

### Criterios de aceptación
- [ ] Tests pasando
- [ ] Cubren las verificaciones de safety

---

## Dependencias
Ninguna (bloque 1 es el base)

## Orden de ejecución
1. TalendToolResult envelope → 1.1
2. outputSchema → 1.2 (ya está, solo verificar)
3. Safety annotations → 1.3 (ya está, solo verificar)
4. Fix test → 1.4
5. Tests core → 1.5

## SHAs de referencia después de completar
[Se llenará después de cada tarea]