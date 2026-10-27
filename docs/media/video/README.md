# Video de demostración

Fuente de `docs/media/demo.gif`, el GIF del README. Es un proyecto [Remotion](https://www.remotion.dev/)
independiente: no forma parte del servidor ni de `bun run verify`.

Todo lo que sale en pantalla es real:

- La tabla de presets sale de `bun run mapa`.
- La escena "Automatizando Talend Studio" muestra llamadas reales a las tools contra un Studio 8.0.1 abierto
  (crear el job, añadir componentes, schema, filtro, conexiones y `talend_job_verify`), con los tiempos medidos.
- Las capturas de `public/` son recortes del lienzo y de la consola Run de Studio. Se recortan para que no
  aparezcan la barra de título, el árbol del repositorio ni el nombre del proyecto: no las sustituyas por
  capturas de ventana completa.

Si cambian las cifras (por ejemplo el número de tools), actualiza `src/Composition.tsx` y vuelve a renderizar.

```bash
cd docs/media/video
bun install
bunx remotion studio                    # vista previa
bunx remotion render src/index.ts Demo ../demo.gif --codec=gif --every-nth-frame=2 --scale=0.75
```
