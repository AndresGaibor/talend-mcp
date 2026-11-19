/**
 * Las pruebas no deben depender del Talend Studio de quien las corre: con el puente apuntando a un puerto donde no
 * escucha nadie, cualquier llamada falla al instante (y las que quieren un puente lo levantan ellas mismas).
 * Sin esto, un Studio abierto y saturado vuelve lentas o inestables pruebas que no tienen nada que ver con el.
 */
process.env.TALEND_BRIDGE_PORT ??= "1";

// Las pruebas no escriben en el .talend-mcp/audit.jsonl real: mezclaban RISK_NOT_ALLOWED y
// VALIDATION_FAILED de prueba con las llamadas de los clientes. Las que auditan activan "normal" en un tmp.
process.env.TALEND_MCP_LOG ??= "quiet";
