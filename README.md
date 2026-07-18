# Charla Mineduc — Accesibilidad Cognitiva para los Servicios Públicos

Charla para la Secretaría Regional Ministerial de Educación (Viña del Mar, julio 2026). Presentación reveal.js con la arquitectura de [/cc](https://github.com/hspencer/cc) y [/pictos-chile](https://github.com/hspencer/pictos-chile): Vite, estilos Sass (Lexend + EB Garamond, paleta púrpura/naranja/terracota/salvia) y sketches p5.js montados por diapositiva vía `.p5-host[data-sketch]`.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173/charla-mineduc/
npm run build   # genera docs/ para GitHub Pages
```

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Diapositivas (secciones horizontales, slides verticales) con notas del presentador |
| `css/custom.scss` | Estilos del deck |
| `main.js` | Inicialización de Reveal, ciclo de vida de los sketches y puntitos de la seguidilla |
| `public/p5/sketches.js` | Montaje p5 + sketches `gauss`, `interaccion`, `capas` |

## Hilo de la charla

1. Ley 21.545 y apoyos razonables (campana de Gauss).
2. El servicio como suma de sus trámites.
3. La accesibilidad es un problema de diseño (espacio de interacción).
4. Cuatro decisiones para que un trámite se entienda: una lámina marco y una profundización por decisión.
5. Apoyos visuales (por qué y cómo) y la definición de "pictograma".
6. Parte práctica: pictos.cl, cómo se arma un paso, la seguidilla de la campaña de votación y pictos.net en vivo.

## Sketches p5

Tres sketches con avance automático o por clic dentro del canvas. Sus parámetros están al inicio de cada `*Factory` en `public/p5/sketches.js`.

- `gauss` (#s1-gauss): la población cae y se apila; se dibuja la campana (nadie es el promedio); al cambiar la dimensión medida, las mismas personas se reordenan.
- `interaccion` (#s3-interaccion): barreras → canales (lenguaje llano, pictogramas, señalética, voz, apoyo humano) → flujo, con el rombo de los apoyos.
- `capas` (#s6-capas): la frase en lenguaje llano se colorea por partes; cada parte levanta su capa (acción + elemento + contexto = escena) y rima con la imagen. Recortes en `public/images/capas/`. Las capas y los signos (+, =) se posicionan desde el ancho real de cada imagen para quedar equidistantes, con la suma separada a la derecha.

## Seguidilla de votación (#s6-votacion)

Campaña real hecha con pictogramas.pictos.cl: `public/images/votacion/01–13.png`, láminas uniformes (4501×5626). Se muestran una a una, centradas y contenidas dentro de la diapo (alto en px, no en `vh`), con el fondo del slide igualado al de las imágenes[^bg]. Se avanza con clic (fragments `fade-in` apiladas) y el progreso se indica con puntitos bajo la imagen, actualizados desde `main.js`.

[^bg]: `data-background-color="#e9f1fe"`, el mismo tono del margen de las láminas, para que cada momento se vea a sangre.

## Definición de "pictograma" (#s5-pictos-chile)

Diapositiva replicada tal cual desde /pictos-chile (ya no embebida en iframe): texto en EB Garamond, sin dependencias externas.

## Lanzador de demos (#s6-launcher)

Pantalla de marca con tres tarjetas `target="_blank"`: pictos.cl (muestra la escala: 51 servicios · 213 ubicaciones · 699 tareas), pictogramas.pictos.cl y pictos.net (demo en vivo, en ventana nueva). Las demos no van en iframe: pictos.net no se deja embeber.

## Fondos por sección

Cada sección lleva un tinte de fondo suave por `data-background-color` para marcar el avance; el cierre queda en negro y el lanzador en púrpura oscuro.

## Imágenes de s5

Los cuatro argumentos de `#s5-por-que` se ilustran con `public/images/s5/*.png` fundidas con `mix-blend-mode: multiply` (fondo blanco): `procesamiento-visual`, `permanencia`, `rima`, `abstraccion`.

## Publicación

GitHub Pages vía GitHub Actions: cada push a `main` construye con Vite a `docs/`. En GitHub, Settings → Pages → Source: GitHub Actions.

## Notas

p5.js está vendorizado en `public/p5/p5.min.js` para no depender de la red del auditorio. El favicon usa `svg/favicon-a11y.svg`.
