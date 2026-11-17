# Roadmap de mejoras del MCP

Priorización por reducción de riesgo operativo, frecuencia de impacto y valor
para clientes MCP. Antes de implementar cada fase, comprobar si ya existe una
capacidad equivalente y ampliarla en lugar de duplicarla.

## Próximas cinco prioridades

| Prioridad | Mejora | Estado actual | Criterio de aceptación |
|---|---|---|---|
| P0 | **Auditoría completa y segura de tools.** Registrar duración y resultado real (incluidos errores devueltos por la tool), sin guardar entradas ni mensajes que puedan contener secretos. | Implementado y probado: eventos de dispatch llevan `correlationId`, y operaciones asíncronas enlazan `operationId` entre inicio, cancelación y llamadas posteriores. Saturación de llamadas/operaciones y solicitud/resultado de cancelación usan códigos fijos. No se persisten argumentos, resultados ni mensajes de excepción. | Mantener códigos de evento allowlisted y no añadir argumentos ni mensajes dinámicos al JSONL. |
| P0 | **Exclusión mutua por recurso.** Serializar cambios sobre el mismo Job/contexto y permitir operaciones independientes en paralelo. | Implementado y probado: además de Jobs/contextos, cubre operaciones globales del workspace de Studio, generación de fixtures por componente y rutas de salida compartidas entre artefactos/builds/entregables/evidencia. Salidas distintas y Jobs independientes mantienen concurrencia. | Al añadir una tool mutante, declarar sus claves de recurso y añadir pruebas de conflicto/independencia. |
| P1 | **Idempotencia para escrituras.** Aceptar claves de operación y devolver el resultado previo si un cliente reenvía la misma petición. | Parcial: HTTP, CLI y `_meta.idempotencyKey` se prueban por transports reales. SQLite coordina claims entre procesos locales, espera operaciones activas, reproduce respuestas terminales y marca como inciertas las que dejó un proceso muerto. Importa el JSON legado. | Probar recuperación en proceso hijo muerto en CI Windows/Linux y documentar la limitación de servidores distribuidos/filesystems de red. |
| P1 | **Operaciones largas con estado y cancelación.** Consultar progreso y cancelar builds o ejecuciones en curso. | Parcial: `talend_job_build_batch_start` usa el mismo operationId en MCP y bridge; `talend_operations_status/cancel` recupera estado y cancela consultando el bridge tras reiniciar MCP. Prueba E2E: reinicio real de MCP, recuperación de progreso y cancelación de lote de 47 Jobs tras completar 5 compilaciones. Estado remoto en memoria del bridge (hasta 24 h); un reinicio del bridge sí pierde el historial. | Automatizar la prueba del reinicio MCP y añadir estrés sostenido; definir recuperación para ejecuciones locales, que no sobreviven al proceso. |
| P1 | **Compatibilidad automatizada por versión de Studio.** Probar contrato y capacidades del bridge en cada versión soportada. | Parcial: `bun run compat:studio` prueba ping, capabilities y suite Java, y escribe un informe versionado sin rutas locales en `.talend-mcp/compatibility/`. Solo hay evidencia de Studio 8.0.1 en este entorno; no existe CI configurada ni versiones adicionales para una matriz real. | Ejecutar el comando en runners por versión y publicar sus informes como matriz de CI. |

## Ya disponible: no duplicar

- `dryRun` y diff para varias operaciones declarativas y lotes.
- Validadores de diseño, pipeline, contextos y configuraciones de componentes.
- Límites de concurrencia global y por Job con timeout por tool; protecciones de tamaño de
  petición/respuesta.
- Autorización por riesgo, confirmación destructiva y auditoría básica.
- Recuperación de diálogos de Studio y validación L5 de los escenarios.

## Medición real del build por lotes

En Talend Studio 8.0.1 (bridge `0.1.0.202610280437`), el 11-11-2026 se
crearon 20 Jobs mínimos aislados (`MCP_MEDICION_01`–`20`) y se compiló el lote
con paralelismo 4. Resultado: **20/20 correctos en 23.706 s** (`totalMs` del
bridge). La primera generación tomó 9.041 ms y las siguientes entre 385 y 638
ms; las compilaciones iniciales, 7.482–9.193 ms, y las restantes,
1.125–1.625 ms. La actualización explícita del workspace agotó el timeout del
hilo UI, pero `talend_job_build_batch` encontró los Jobs y compiló el lote.
Los Jobs, sus carpetas POM/temporales y snapshots de medición se eliminaron y
se comprobó que no quedaran artefactos `MCP_MEDICION_01`–`20`.

Esta evidencia es un smoke test del build por lote, no certifica todos los
endpoints del bridge ni otras versiones de Studio.

Las próximas mejoras deben ampliar esos mecanismos con cobertura de extremo a
extremo, no crear una segunda API para la misma capacidad.

## Orden de ejecución

1. **Completado parcialmente:** duración y resultado semántico se registran sin guardar payloads; queda la correlación y cobertura de rechazos previos al despacho.
2. **Implementado:** los bloqueos cubren Jobs, contextos, estado global de Studio y destinos de artefactos compartidos; exigir clave explícita y prueba al sumar nuevas tools mutantes.
3. **Parcial:** HTTP, CLI y `_meta.idempotencyKey` pasan pruebas reales; SQLite arbitra claims entre procesos locales y el JSON previo se migra. Falta comprobar en CI multiplataforma y documentar la restricción de filesystem local.
4. **Parcial:** builds batch recuperan estado/progreso y cancelación tras reinicio MCP; se probó en HTTP MCP con un lote de 47 Jobs (5 compilados antes de cancelar). Falta automatizar el reinicio, cubrir recuperación de ejecuciones locales y hacer estrés sostenido.
5. **Parcial:** auditoría local automatizada e informe versionado; falta ejecutarla en una matriz de Studio disponible en CI y publicar resultados.

Cada fase debe incluir tests de regresión, documentación y `bun run verify`.
