# Charla Mineduc
## Segunda Jornada de Accesibilidad Universal - martes 21 julio

**Accesibilidad Cognitiva para los Servicios Públicos**
Charla para la Secretaría Regional Ministerial de Educación, Viña del Mar, julio 2026.

Presentación reveal.js con la misma arquitectura de [/cc](https://github.com/hspencer/cc) y [/pictos-chile](https://github.com/hspencer/pictos-chile): Vite + reveal.js 5, estilos Sass (Lexend + EB Garamond, paleta púrpura/naranja/terracota/salvia) y sketches p5.js montados por diapositiva mediante `.p5-host[data-sketch]`.

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173/charla-mineduc/
npm run build     # genera docs/ para GitHub Pages
```

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Diapositivas (secciones horizontales, slides verticales) con notas del presentador |
| `public/p5/sketches.js` | Infraestructura de montaje p5 + sketch `gauss` (campana animada) |
| `css/custom.scss` | Estilos heredados de /pictos-chile más la portada de /cc (`#title-slide`) |
| `main.js` | Inicialización de Reveal y ciclo de vida de los sketches |

## Sketch: la campana de Gauss (`data-sketch="gauss"`)

Tres actos, con avance automático o por clic dentro del canvas:

1. **Caer**: cada persona (forma y color propios) cae y se apila en un histograma.
2. **Curva**: la campana se dibuja sobre la población; el promedio es una abstracción, nadie es el promedio.
3. **Dimensión**: la escala es unidimensional; al cambiar la dimensión medida (comprensión lectora, atención sostenida, interacción social...) las mismas personas se reordenan por completo. Una persona destacada salta de un extremo al otro según qué se mida.

Los parámetros (población, columnas, tiempos, dimensiones) están al inicio de `gaussFactory` en `public/p5/sketches.js`.

## Sketch: el espacio de interacción (`data-sketch="interaccion"`)

Traducción animada del esquema capacidades/demandas al lenguaje gráfico del deck (púrpura = lo personal, naranja = lo diseñable, mismas personas-forma de la campana). Tres actos:

1. **Barreras**: los intentos de las personas se detienen a mitad del espacio de interacción.
2. **Canales**: lo diseñable avanza — cinco canales de comunicación (lenguaje llano, pictogramas, señalética, voz y audio, apoyo humano) llegan a personas distintas de formas distintas; aparece el rombo de los apoyos.
3. **Flujo**: con los apoyos puestos, el valor circula en ambos sentidos.

Los canales se definen en el arreglo `CHANNELS` de `interaccionFactory`.

## Sketch: capas y rima semántica (`data-sketch="capas"`)

Versión animada del esquema semantic-correspondence de /pictos-chile, reutilizando el dibujo original (tarjeta bip en el torniquete) recortado en `public/images/capas/`. Tres actos:

1. **Frase**: el paso en lenguaje llano se colorea por partes — acción (naranja), elemento (azul violeta), contexto (verde bosque).
2. **Capas**: cada parte de la frase levanta su capa visual; las tarjetas se suman.
3. **Rima**: aparece la escena compuesta y la correspondencia se demuestra sola, iluminando por turnos cada palabra junto a su capa.

La frase y los roles se definen en el arreglo `ROLES` de `capasFactory`. Para cambiar el ejemplo hay que reemplazar los recortes de `public/images/capas/`.

## Lanzador de demos

Las demos ya no van en iframes (pictos.net no se deja embeber): la diapositiva `#s6-launcher` es una pantalla de marca sobre púrpura oscuro con las tres aplicaciones como tarjetas `target="_blank"` — pictos.cl, pictogramas.pictos.cl y pictos.net.

## Fondos de color por sección

Cada sección narrativa tiene un tinte de fondo suave (vía `data-background-color` en cada diapositiva) para marcar el avance de una sección a otra, manteniendo contraste con la tinta oscura: Ley verde `#dbe7d6`, Servicios crema `#f1ebdb`, Problema lila `#e6dee9`, Trámite arena `#ece2d0`, Apoyos visuales azul grisáceo `#dbe4ea`, Práctica cálido `#ece4d6`. El cierre queda en negro y el lanzador en púrpura oscuro.

## Imágenes de s5

Los cuatro argumentos de `#s5-por-que` se ilustran con imágenes en `public/images/s5/`, fundidas con `mix-blend-mode: multiply` (por eso deben tener fondo blanco). Hay placeholders; reemplázalos por las ilustraciones reales manteniendo los nombres:

- `procesamiento-visual.png` — figura con formas/casa/imagen entrando a la cabeza, habla tachada
- `permanencia.png` — persona frente al tablero de pictogramas que permanece
- `rima.png` — puente entre palabra-sonido e imagen
- `abstraccion.png` — embudo que destila el caos en formas fundamentales

## Publicación (GitHub Pages)

Repo independiente con deploy por GitHub Actions (`.github/workflows/deploy.yml`): cada push a `main` construye con Vite a `docs/` y publica en Pages. En el repo de GitHub, Settings → Pages → Source: **GitHub Actions**.

## Notas

p5.js está vendorizado en `public/p5/p5.min.js` para no depender de la red del auditorio. El favicon usa `svg/favicon-a11y.svg` (símbolo de accesibilidad universal). La portada cierra con los logos de PUCV, pictos.cl y pictos.net. Las demos de la parte práctica se lanzan en pestaña nueva desde `#s6-launcher` (ya no en iframe: pictos.net no se deja embeber).
