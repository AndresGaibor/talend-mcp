# Contribuir

Las reglas completas (arquitectura, convenciones, qué no hacer) están en [AGENTS.md](AGENTS.md);
el índice de la documentación, en [docs/README.md](docs/README.md). Esta página es el resumen.

## Preparar el entorno

```bash
bun install
bun run ganchos:instalar   # una vez por copia: activa el gancho pre-commit
bun run mapa               # estructura del repo y herramientas por preset
```

## Antes de abrir un PR

```bash
bun run verify             # typecheck, tests y validación de fixtures; debe quedar en verde
```

- Usa **Bun**, no Node. No añadas `dotenv`.
- Una tool nueva sigue `talend_<área>_<verbo>`, declara su riesgo en
  `src/presentation/server/tool-safety.ts` y se documenta con `bun run docs:tools`.
- Los cambios de comportamiento llevan test. Los de documentación, `bun test tests/docs` en verde.
- Anota el cambio en `CHANGELOG.md`, sección `Unreleased` (créala si no existe).

## Publicar una versión

1. Sube la versión a la vez en `package.json`, `plugins/talend-mcp/.claude-plugin/plugin.json` y
   `.claude-plugin/marketplace.json` (`tests/docs/distribution.test.ts` falla si difieren).
2. Pasa la sección `Unreleased` de `CHANGELOG.md` a `## [X.Y.Z] - AAAA-MM-DD`.
3. Si cambiaste `.claude/skills/talend-mcp/SKILL.md`, cópialo a
   `plugins/talend-mcp/skills/talend-mcp/SKILL.md` (el mismo test lo comprueba).
4. Commit, `git tag vX.Y.Z` y `git push origin main vX.Y.Z`. El workflow `Release` compila los
   binarios, construye el plugin Java y crea el release.
