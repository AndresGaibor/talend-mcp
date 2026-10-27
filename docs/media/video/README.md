# Video de demostración

Fuente de `docs/media/demo.gif`, el GIF del README. Es un proyecto [Remotion](https://www.remotion.dev/)
independiente: no forma parte del servidor ni de `bun run verify`.

Las cifras y comandos que salen en pantalla vienen de `bun run mapa` y de `talend_guide`. Si cambian
(por ejemplo el número de tools), actualiza `src/Composition.tsx` y vuelve a renderizar.

```bash
cd docs/media/video
bun install
bunx remotion studio                    # vista previa
bunx remotion render src/index.ts Demo ../demo.gif --codec=gif --every-nth-frame=2 --scale=0.75
```
