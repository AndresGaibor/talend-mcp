# Seguridad

## Versiones con soporte

Solo la última versión publicada recibe correcciones.

## Cómo informar de una vulnerabilidad

Usa **Security, Report a vulnerability** en el repositorio de GitHub (informe privado). No abras un
issue público ni publiques el detalle antes de que haya corrección. Incluye la versión
(`talend-mcp version`), el sistema operativo y los pasos para reproducirlo.

## Modelo de seguridad

- El servidor es **local**: stdio o HTTP en `127.0.0.1`. Escuchar fuera de loopback exige
  `TALEND_MCP_TOKEN`.
- Cada tool tiene un riesgo (`read`, `write`, `execute`, `destructive`). `TALEND_MCP_ALLOW_WRITE`,
  `TALEND_MCP_ALLOW_EXECUTE` y `TALEND_MCP_ALLOW_DESTRUCTIVE` lo limitan, y lo destructivo exige
  además `confirm: true`.
- Cada llamada queda en `.talend-mcp/audit.jsonl` (herramienta, riesgo, resultado y duración; no los
  argumentos).
- Los instaladores comprueban el SHA-256 contra `checksums.txt` del mismo release y no instalan si
  no coincide. Los binarios **no están firmados**: si tu organización lo exige, compílalos tú
  (`bun run release:build`) o verifica el checksum a mano.
- Las credenciales de Talend o de bases de datos no se almacenan en el servidor; viven en el
  proyecto de Studio. Trata `.talend-mcp/` como datos locales sensibles.
