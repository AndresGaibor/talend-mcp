# Plan: Talend MCP Suite - Bloque 2 (Portabilidad macOS/Windows/WSL)

## Objetivo
Asegurar que el MCP funcione correctamente en macOS, Windows y WSL.

## Contexto
- Proyecto existente: talend-mcp (suite MCP para Talend Studio)
- Ubicación: /Users/andresgaibor/code/javascript/talend-mcp
- Plataforma: macOS/darwin (actual), Windows, WSL
- Framework: Bun, MCP SDK, TypeScript

## Reglas obligatorias
- Usar Bun para todo (bun test, bun run, etc.)
- No hardcodear LAB-09 ni rutas de usuario específicas
- Responder en español
- No usar `process.platform` directamente - usar `PlatformContext`

---

## Tarea 2.1: Verificar PlatformContext existente

### Descripción
Verificar que el código de platform existente (`src/platform/`) esté completo y funcionando.

### Implementación
1. Revisar `src/platform/runtime.ts` - PlatformContext, detectRuntimeOS, etc.
2. Revisar `src/platform/path-bridge.ts` - toMcpPath, toTalendHostPath
3. Revisar `src/platform/job-runner-strategy.ts` - detectJobRunnerStrategy

### Criterios de aceptación
- [ ] PlatformContext exportado y usado
- [ ] Funciones de conversión de paths implementadas
- [ ] TypeScript sin errores

---

## Tarea 2.2: Integrar PlatformContext en bridge-client

### Descripción
El bridge-client debe usar PlatformContext para conversar con Talend Studio en cualquier SO.

### Implementación
1. Importar `createPlatformContext` en bridge-client
2. Usar `toTalendHostPath` antes de enviar rutas a Talend
3. Usar `toMcpPath` después de recibir rutas de Talend

### Criterios de aceptación
- [ ] bridge-client usa PlatformContext
- [ ] Rutas convertidas correctamente

---

## Tarea 2.3: Environment Doctor App muestra PlatformContext

### Descripción
La app Environment Doctor debe mostrar el estado de platform para debugging.

### Implementación
1. Modificar `talend_app_environment_doctor` para incluir:
   - runtimeOs
   - talendHostOs
   - pathMode
   - raw vs mcp vs host paths

### Criterios de aceptación
- [ ] Environment Doctor muestra PlatformContext completo
- [ ] Tests pasando

---

## Tarea 2.4: Tests de portabilidad

### Descripción
Crear tests para verificar la lógica de portabilidad.

### Implementación
1. Crear `tests/platform/portability.test.ts`
2. Tests para:
   - `detectRuntimeOS()` en diferentes platform
   - `toMcpPath()` / `toTalendHostPath()`
   - Conversión de paths WSL/Windows

### Criterios de aceptación
- [ ] Tests pasando
- [ ] Cubren casos principales

---

## Dependencias
Ninguna

## Orden de ejecución
1. Verificar PlatformContext → 2.1
2. Integrar bridge-client → 2.2
3. Environment Doctor → 2.3
4. Tests portabilidad → 2.4

## SHAs de referencia después de completar
[Se llenará después de cada tarea]