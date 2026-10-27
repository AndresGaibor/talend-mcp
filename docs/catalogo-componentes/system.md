# Catalogo: System

> Generado por `bun run scripts/catalogo-componentes.ts`. No lo edites: cambia el script o los datos de origen.

4 componentes · 2 compilan (L4) · 3 con escenario L5 que pasa o esta definido.

Subfamilias: System

| Componente | Nivel | Paleta | Params (oblig.) | Conectores | Libs oblig. | Servicio externo | L4 (compila) | L5 | Plan |
|---|---|---|---|---|---|---|---|---|---|
| `tRunJob` | 1 | DI | 21/9 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | falla | con escenario | P01 |
| `tSetEnv` | 2 | DI | 1/0 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | compila | con escenario | P01 |
| `tSSH` | 7 | DI | 17/1 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | 2 | FTP/SFTP/SSH: contenedor | compila | sin escenario | P05 |
| `tSystem` | 1 | DI | 10/4 | FLOW ITERATE SUBJOB_OK SUBJOB_ERROR COMPONENT_OK COMPONENT_ERROR RUN_IF | - | ninguno | sin medir | con escenario | P01 |
