/**
 * Punto de entrada de la presentación reveal.js "De la palabra a la imagen"
 * Inicializa Reveal con plugins y gestiona el ciclo de vida de los sketches p5.js.
 * Se importa desde index.html como módulo ES y se procesa con Vite.
 */

import Reveal from 'reveal.js/dist/reveal.esm.js';
import Markdown from 'reveal.js/plugin/markdown/markdown.esm.js';
import Zoom from 'reveal.js/plugin/zoom/zoom.esm.js';
import Notes from 'reveal.js/plugin/notes/notes.esm.js';
import Highlight from 'reveal.js/plugin/highlight/highlight.esm.js';

import './node_modules/reveal.js/css/reveal.scss';
import './css/custom.scss';

const deck = new Reveal({
  hash: true,
  slideNumber: false,
  transition: 'fade',
  plugins: [ Markdown, Zoom, Notes, Highlight ]
});

deck.initialize().then(() => {
  // Monta el sketch p5 de la diapositiva visible al inicio
  const current = deck.getCurrentSlide();
  if (current) mountP5In(current);

  // Monta/desmonta sketches al cambiar de diapositiva
  deck.on('slidetransitionend', (event) => {
    if (event.previousSlide) unmountP5In(event.previousSlide);
    if (event.currentSlide) mountP5In(event.currentSlide);
  });

  // Re-montar al salir del overview
  deck.on('overviewhidden', () => {
    const currentSlide = deck.getCurrentSlide();
    if (currentSlide) mountP5In(currentSlide);
  });

  // Indicador de avance de la seguidilla de votación (#s6-votacion):
  // enciende el puntito correspondiente al momento visible. La lámina 1
  // es la base (sin fragment), así que el índice activo es f + 1.
  const updateSeqDots = () => {
    const dots = document.querySelectorAll('#s6-votacion .seq-dots span');
    if (!dots.length) return;
    const onSlide = deck.getCurrentSlide() && deck.getCurrentSlide().id === 's6-votacion';
    const f = deck.getIndices().f;
    const active = onSlide ? ((f === undefined || f === null ? -1 : f) + 1) : -1;
    dots.forEach((d, i) => d.classList.toggle('on', i === active));
  };
  deck.on('slidechanged', updateSeqDots);
  deck.on('fragmentshown', updateSeqDots);
  deck.on('fragmenthidden', updateSeqDots);
  updateSeqDots();
});
