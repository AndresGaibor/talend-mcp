# Video de demostración

Fuente de `docs/media/demo-chat.gif`, el GIF del README. Es un proyecto [Remotion](https://www.remotion.dev/)
independiente: no forma parte del servidor ni de `bun run verify`.

Todo lo que sale en pantalla es real:

- La tabla de presets sale de `bun run mapa`.
- La escena del chat muestra un caso real: filtrar un `.xls` de ventas (Bogota y monto mayor a 1000) y guardar
  el resultado en un CSV. Las llamadas a las tools, sus tiempos, el lienzo de Studio, la consola Run y el
  contenido de los archivos salen de una ejecución real contra un Studio 8.0.1 abierto. Solo el mensaje del
  usuario está escrito a mano.
- Las capturas de `public/` son recortes del lienzo y de la consola Run de Studio. Se recortan para que no
  aparezcan la barra de título, el árbol del repositorio ni el nombre del proyecto: no las sustituyas por
  capturas de ventana completa.

Si cambian las cifras (por ejemplo el número de tools), actualiza `src/Composition.tsx` y vuelve a renderizar.

```bash
cd docs/media/video
bun install
bunx remotion studio                    # vista previa
bunx remotion render src/index.ts Demo ../demo-chat.gif --codec=gif --every-nth-frame=2 --scale=0.75
```
