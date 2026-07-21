// ======================================================
// p5.js — Sketches de la charla "Accesibilidad Cognitiva
// para los Servicios Públicos" (MINEDUC, julio 2026).
// Infraestructura de montaje/desmontaje heredada de
// /pictos-chile y /cc: cada diapositiva declara un
// <div class="p5-host" data-sketch="nombre"> y main.js
// invoca mountP5In / unmountP5In en las transiciones.
// ======================================================

const P5_REGISTRY = new Map();

/**
 * Monta un sketch p5 dentro de cada .p5-host[data-sketch]
 * de la diapositiva activa. Se invoca desde main.js tras
 * cada transición de Reveal (slidetransitionend) y al inicio.
 */
function mountP5In(sectionEl) {
  if (!sectionEl) return;
  sectionEl.querySelectorAll('.p5-host').forEach(host => {
    if (P5_REGISTRY.has(host)) return;
    const type = (host.dataset.sketch || '').toLowerCase();
    let factory = null;
    if (type === 'gauss') factory = gaussFactory(host);
    else if (type === 'interaccion') factory = interaccionFactory(host);
    else if (type === 'capas') factory = capasFactory(host);
    if (!factory) return;
    const inst = new p5(factory, host);
    P5_REGISTRY.set(host, inst);

    // Doble requestAnimationFrame: reveal escala el slide en el
    // mismo frame en que se monta el sketch; esperamos a que el
    // layout se asiente antes de pedir el resize del canvas.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof inst.windowResized === 'function') inst.windowResized();
      });
    });

    // Observa cambios de tamaño posteriores (overview, resize, rotación).
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (typeof inst.windowResized === 'function') inst.windowResized();
      });
      ro.observe(host);
      host.__p5ResizeObserver = ro;
    }
  });
}

/**
 * Desmonta el sketch p5 cuando la diapositiva deja de ser
 * visible, liberando canvas y observers. Se invoca desde
 * main.js y desde los hooks de Reveal más abajo.
 */
function unmountP5In(sectionEl) {
  if (!sectionEl) return;
  sectionEl.querySelectorAll('.p5-host').forEach(host => {
    if (host.__p5ResizeObserver) {
      try { host.__p5ResizeObserver.disconnect(); } catch (_) {}
      delete host.__p5ResizeObserver;
    }
    const inst = P5_REGISTRY.get(host);
    if (inst?.remove) inst.remove();
    P5_REGISTRY.delete(host);
    host.innerHTML = '';
  });
}

// Hooks de Reveal como respaldo cuando window.Reveal existe
// (main.js ya gestiona el ciclo de vida vía la instancia ESM).
if (typeof window !== 'undefined') {
  const R = window.Reveal;
  const cur = () => (R?.getCurrentSlide ? R.getCurrentSlide() : null);
  if (R?.on) {
    R.on('ready', e => {
      document.querySelectorAll('.reveal .slides section').forEach(unmountP5In);
      mountP5In(e.currentSlide || cur());
    });
    R.on('slidechanged', e => { unmountP5In(e.previousSlide); mountP5In(e.currentSlide); });
    R.on('overviewhidden', () => {
      document.querySelectorAll('.reveal .slides section').forEach(unmountP5In);
      mountP5In(cur());
    });
  }
}

// Exponer para main.js (que las busca en window).
if (typeof window !== 'undefined') {
  window.mountP5In = mountP5In;
  window.unmountP5In = unmountP5In;
}


// ======================================================
// FÁBRICA DE SKETCH: GAUSS
// La campana de Gauss animada para la diapositiva
// #s1-gauss (sección Ley 21.545 · apoyos razonables).
//
// Hilo mental en tres actos:
//   1. CAER      — cada persona (un punto con forma y color
//                  propios) cae y se apila en un histograma.
//   2. CURVA     — sobre las personas se dibuja la campana:
//                  una abstracción que describe al conjunto.
//                  Nadie es el promedio.
//   3. DIMENSIÓN — la escala es unidimensional: al cambiar
//                  la dimensión medida, las mismas personas
//                  se reordenan por completo. Una persona
//                  destacada muestra cuánto puede saltar.
//
// Interacción: clic avanza de acto (y en el acto 3 cambia
// la dimensión de medición).
// ======================================================
function gaussFactory(parentEl) {
  return function (p) {

    // --- Paleta (custom.scss): púrpura, naranja, terracota + acompañantes
    const PALETTE = [
      [69, 6, 79],      // púrpura profundo
      [239, 106, 18],   // naranja
      [179, 45, 19],    // terracota-bermellón
      [13, 79, 82],     // petróleo (nota nueva)
      [194, 133, 26],   // ocre-mostaza (nota nueva)
      [58, 90, 64],     // verde bosque
      [161, 76, 87],    // rosado seco
      [90, 30, 12]      // café oscuro
    ];
    const TERRA = [179, 45, 19];
    const INK = [28, 20, 31];

    // --- Dimensiones de medición que reordenan a la población (acto 3)
    const DIMENSIONS = [
      'COMPRENSIÓN LECTORA',
      'RAZONAMIENTO MATEMÁTICO',
      'ATENCIÓN SOSTENIDA',
      'INTERACCIÓN SOCIAL',
      'PROCESAMIENTO VISUAL',
      'MEMORIA DE TRABAJO',
      'EXPRESIÓN ORAL',
      'REGULACIÓN EMOCIONAL'
    ];

    // --- Parámetros de la población y del histograma
    const N = 360;            // personas
    const BINS = 33;          // columnas del histograma
    const SPAN = 3;           // rango en desviaciones estándar (±3σ)
    const DIM_HOLD = 4200;    // ms que se sostiene cada dimensión en acto 3
    const MOVE_MS = 1100;     // ms del reordenamiento entre dimensiones

    // --- Estado
    let persons = [];         // {shape, col, scores[], from{x,y}, to{x,y}, delay}
    let phase = 'falling';    // 'falling' | 'curve' | 'dims'
    let phaseStart = 0;       // p.millis() al entrar a la fase
    let dimIdx = 0;           // dimensión activa en acto 3
    let lastSwitch = 0;       // millis del último cambio de dimensión
    let dot = 8;              // tamaño de cada persona (px), se calcula en layout
    let baseline, x0, x1;     // geometría del eje
    let maxStack = 1;         // apilamiento máximo esperado (para escalar)
    let fallDur = 0;          // duración total del acto 1

    // Densidad normal estándar: la forma teórica de la campana.
    const pdf = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);

    // Suavizado cúbico entra/sale, mismo easing de /pictos-chile.
    const ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;

    p.setup = function () {
      const c = p.createCanvas(parentEl.clientWidth, parentEl.clientHeight);
      c.parent(parentEl);
      p.textFont('Lexend');
      buildPopulation();
      layout();
      phaseStart = p.millis();
    };

    p.windowResized = function () {
      // Guardia: el ResizeObserver puede disparar antes de que
      // p5 2.x haya creado el canvas (setup diferido).
      if (!p.canvas) return;
      p.resizeCanvas(parentEl.clientWidth, parentEl.clientHeight);
      layout();
    };

    /**
     * Crea la población: cada persona conserva identidad estable
     * (forma, color) y un puntaje gaussiano independiente por cada
     * dimensión. La persona 0 es la "persona destacada": sus
     * puntajes se fijan a mano para que salte de un extremo a otro
     * según qué dimensión se mida.
     */
    function buildPopulation() {
      persons = [];
      for (let i = 0; i < N; i++) {
        const scores = DIMENSIONS.map(() => p.randomGaussian(0, 1));
        persons.push({
          shape: i % 4,                                  // círculo, cuadrado, triángulo, rombo
          col: PALETTE[i % PALETTE.length],
          scores,
          from: { x: 0, y: 0 },
          to: { x: 0, y: 0 },
          delay: 0
        });
      }
      // La persona destacada: extrema en unas dimensiones, media en otras.
      persons[0].scores = [2.5, -1.9, 0.1, -2.6, 2.2, -0.4, -2.2, 1.4];
      persons[0].col = INK;
    }

    /**
     * Calcula la geometría dependiente del tamaño del canvas:
     * eje, tamaño de punto y apilamiento máximo. Se invoca en
     * setup y en cada resize; luego re-proyecta las posiciones
     * de la dimensión activa.
     */
    function layout() {
      const mL = p.width * 0.06, mR = p.width * 0.06;
      x0 = mL; x1 = p.width - mR;
      baseline = p.height - 64;
      // Apilamiento esperado en la columna central: N * pdf(0) * ancho de bin (en σ)
      const dz = (2 * SPAN) / BINS;
      maxStack = Math.ceil(N * pdf(0) * dz * 1.25);
      const binW = (x1 - x0) / BINS;
      dot = Math.min(binW * 0.82, (baseline - p.height * 0.16) / maxStack);
      assignTargets(dimIdx, false);
    }

    /**
     * Proyecta a cada persona sobre el histograma de la dimensión
     * dada: puntaje → columna → altura de apilamiento. Cuando
     * animate es true, la posición actual pasa a ser el punto de
     * partida de la interpolación (acto 3).
     */
    function assignTargets(d, animate) {
      const binW = (x1 - x0) / BINS;
      const stacks = new Array(BINS).fill(0);
      for (const per of persons) {
        const z = p.constrain(per.scores[d], -SPAN + 0.001, SPAN - 0.001);
        const b = Math.floor(p.map(z, -SPAN, SPAN, 0, BINS));
        const level = stacks[b]++;
        const tx = x0 + binW * (b + 0.5);
        const ty = baseline - dot * (level + 0.5);
        if (animate) {
          per.from = { x: per.to.x, y: per.to.y };
        } else {
          per.from = { x: tx, y: -p.height * 0.3 * (0.4 + Math.random()) };
        }
        per.to = { x: tx, y: ty };
        per.delay = animate ? Math.random() * 220 : Math.random() * 1800;
      }
      fallDur = 2600;
    }

    // Clic: avanzar de acto; en el acto 3, cambiar de dimensión.
    p.mousePressed = function () {
      const inside = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
      if (!inside) return;
      if (phase === 'falling') { enterCurve(); }
      else if (phase === 'curve') { enterDims(); }
      else { nextDimension(); }
    };

    function enterCurve() {
      // Aterriza a todos de inmediato.
      for (const per of persons) { per.from = { ...per.to }; per.delay = 0; }
      phase = 'curve';
      phaseStart = p.millis();
    }

    function enterDims() {
      phase = 'dims';
      phaseStart = p.millis();
      lastSwitch = p.millis();
    }

    function nextDimension() {
      dimIdx = (dimIdx + 1) % DIMENSIONS.length;
      assignTargets(dimIdx, true);
      lastSwitch = p.millis();
    }

    p.draw = function () {
      p.clear();
      if (p.width < 4 || p.height < 4) return;
      const t = p.millis() - phaseStart;

      // Transiciones automáticas entre actos.
      if (phase === 'falling' && t > fallDur + 2000) enterCurve();
      if (phase === 'curve' && t > 4200) enterDims();
      if (phase === 'dims' && p.millis() - lastSwitch > DIM_HOLD) nextDimension();

      drawAxis();
      drawPersons();
      if (phase !== 'falling') drawCurve(phase === 'curve' ? Math.min(1, t / 1600) : 1);
      drawCaptions(t);
    };

    /**
     * Eje horizontal con flechas: la única escala de medición.
     * En el acto 3 el nombre de la dimensión activa aparece bajo
     * el eje, subrayando que se mide una dimensión a la vez.
     */
    function drawAxis() {
      p.stroke(INK[0], INK[1], INK[2], 140);
      p.strokeWeight(1.2);
      p.line(x0 - 8, baseline + dot * 0.6, x1 + 8, baseline + dot * 0.6);
      const y = baseline + dot * 0.6;
      p.line(x1 + 8, y, x1 - 0, y - 4);
      p.line(x1 + 8, y, x1 - 0, y + 4);
      p.line(x0 - 8, y, x0 + 0, y - 4);
      p.line(x0 - 8, y, x0 + 0, y + 4);

      p.noStroke();
      p.fill(INK[0], INK[1], INK[2], 130);
      p.textSize(Math.max(11, p.width * 0.011));
      p.textAlign(p.LEFT, p.TOP);
      p.text('−', x0 - 8, y + 8);
      p.textAlign(p.RIGHT, p.TOP);
      p.text('+', x1 + 8, y + 8);

      // Etiqueta de la dimensión medida (una sola a la vez).
      p.textAlign(p.CENTER, p.TOP);
      const label = (phase === 'dims')
        ? 'Dimensión medida: ' + DIMENSIONS[dimIdx]
        : 'Una sola dimensión de medición';
      p.fill(TERRA[0], TERRA[1], TERRA[2]);
      p.textSize(Math.max(13, p.width * 0.014));
      p.text(label, (x0 + x1) / 2, y + 10);
    }

    /**
     * Dibuja a las personas en su posición interpolada. Cada una
     * tiene forma y color estables entre dimensiones: la población
     * no cambia, solo su ordenamiento. La persona destacada lleva
     * un anillo y la etiqueta "una persona".
     */
    function drawPersons() {
      const now = p.millis();
      const dur = phase === 'falling' ? 900 : MOVE_MS;
      let hx = 0, hy = 0;
      for (let i = persons.length - 1; i >= 0; i--) {
        const per = persons[i];
        const tt = p.constrain((now - phaseStart - per.delay) / dur, 0, 1);
        const k = ease(tt);
        const x = p.lerp(per.from.x, per.to.x, k);
        const y = p.lerp(per.from.y, per.to.y, k);
        if (i === 0) { hx = x; hy = y; }
        p.noStroke();
        p.fill(per.col[0], per.col[1], per.col[2], i === 0 ? 255 : 205);
        drawShape(per.shape, x, y, dot * 0.86);
      }
      // Anillo y etiqueta de la persona destacada.
      p.noFill();
      p.stroke(INK[0], INK[1], INK[2]);
      p.strokeWeight(2);
      p.circle(hx, hy, dot * 1.9);
      // Etiqueta con halo blanco para que se lea sobre la multitud,
      // acotada a los bordes del canvas.
      const lx = p.constrain(hx, 50, p.width - 50);
      p.textSize(Math.max(11, p.width * 0.011));
      p.textAlign(p.CENTER, p.BOTTOM);
      p.stroke(255, 255, 255, 220);
      p.strokeWeight(4);
      p.fill(INK[0], INK[1], INK[2]);
      p.text('una persona', lx, hy - dot * 1.4);
      p.noStroke();
    }

    /**
     * Formas elementales para sugerir diversidad sin caricatura:
     * círculo, cuadrado, triángulo y rombo.
     */
    function drawShape(kind, x, y, s) {
      const h = s / 2;
      if (kind === 0) p.circle(x, y, s);
      else if (kind === 1) p.rect(x - h, y - h, s, s, Math.max(0, s * 0.2));
      else if (kind === 2) p.triangle(x, y - h, x - h, y + h, x + h, y + h);
      else { p.quad(x, y - h, x + h, y, x, y + h, x - h, y); }
    }

    /**
     * La campana teórica dibujada sobre el histograma, escalada a
     * las mismas unidades (personas esperadas por columna × tamaño
     * de punto). Incluye la línea segmentada del promedio.
     * El parámetro k ∈ [0,1] anima el trazo de izquierda a derecha.
     */
    function drawCurve(k) {
      const dz = (2 * SPAN) / BINS;
      p.noFill();
      p.stroke(TERRA[0], TERRA[1], TERRA[2]);
      p.strokeWeight(2.5);
      p.beginShape();
      // Muestreo denso con vertex(): p5 2.x retiró curveVertex
      // (ahora splineVertex) y con 160 puntos no hace falta spline.
      const steps = 160;
      const upto = Math.floor(steps * k);
      for (let i = 0; i <= upto; i++) {
        const z = p.map(i, 0, steps, -SPAN, SPAN);
        const x = p.map(z, -SPAN, SPAN, x0, x1);
        const y = baseline - (N * pdf(z) * dz) * dot;
        p.vertex(x, y);
      }
      p.endShape();

      if (k >= 1) {
        // Línea del promedio: una abstracción vertical, no una persona.
        const cx = (x0 + x1) / 2;
        p.stroke(INK[0], INK[1], INK[2], 120);
        p.strokeWeight(1);
        p.drawingContext.setLineDash([5, 6]);
        p.line(cx, baseline, cx, baseline - (N * pdf(0) * dz) * dot - 26);
        p.drawingContext.setLineDash([]);
        // Etiqueta con halo blanco para que se lea sobre la columna
        // central de puntos sin quedar tapada.
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(Math.max(12, p.width * 0.012));
        const py = baseline - (N * pdf(0) * dz) * dot - 32;
        p.stroke(255, 255, 255, 230);
        p.strokeWeight(4);
        p.fill(INK[0], INK[1], INK[2]);
        p.text('el promedio', cx, py);
        p.noStroke();
      }
    }

    /**
     * Titular del acto en curso, arriba a la izquierda, en el rol
     * del contador de años de la cronología de /pictos-chile:
     * una sola frase que fija la lectura de la escena.
     */
    function drawCaptions() {
      const msgs = {
        falling: 'Cada punto es una persona',
        curve: 'La campana describe al conjunto — nadie es el promedio',
        dims: 'Otra dimensión: las mismas personas, otro orden'
      };
      p.noStroke();
      p.fill(INK[0], INK[1], INK[2], 210);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(Math.max(15, p.width * 0.017));
      p.text(msgs[phase], 10, 8);

      p.fill(INK[0], INK[1], INK[2], 90);
      p.textSize(Math.max(10, p.width * 0.009));
    }
  };
}


// ======================================================
// FÁBRICA DE SKETCH: INTERACCIÓN
// El espacio de interacción para la diapositiva
// #s3-interaccion (la accesibilidad es un problema de
// diseño). Traducción del esquema clásico al lenguaje
// gráfico de este deck: fondo salvia, tinta para el
// texto, púrpura para lo personal, naranja para lo
// diseñable, y las mismas personas-forma de la campana
// de Gauss (continuidad visual entre diagramas).
//
// Hilo mental en tres actos:
//   1. BARRERAS — las personas intentan alcanzar el valor
//                 del entorno; sus intentos se detienen a
//                 mitad del espacio de interacción.
//   2. CANALES  — lo naranja es lo diseñable: desde el
//                 entorno avanzan varios canales de
//                 comunicación que llegan a personas
//                 distintas de formas distintas. Aparece
//                 el rombo de los apoyos.
//   3. FLUJO    — con los apoyos puestos, el valor fluye
//                 en ambos sentidos: la interacción quedó
//                 diseñada.
//
// Interacción: clic avanza de acto; en el acto 3 reinicia.
// ======================================================
function interaccionFactory(parentEl) {
  return function (p) {

    // --- Paleta del deck (custom.scss), compartida con la campana
    const PURPLE = [69, 6, 79];       // lo personal
    const NARANJA = [239, 106, 18];    // lo diseñable
    const TERRA = [179, 45, 19];      // acento (rótulos clave)
    const INK = [28, 20, 31];         // texto
    const PALETTE = [
      [69, 6, 79], [239, 106, 18], [179, 45, 19], [13, 79, 82],
      [194, 133, 26], [58, 90, 64], [161, 76, 87], [90, 30, 12]
    ];

    // --- Canales de comunicación: lo diseñable actúa de formas distintas
    const CHANNELS = [
      'lenguaje llano',
      'pictogramas',
      'señalética',
      'voz y audio',
      'apoyo humano'
    ];

    const N = 15;             // personas
    const ACT1_MS = 4800;     // duración del acto barreras
    const ACT2_MS = 5200;     // duración del acto canales

    let persons = [];         // {shape, col, y, size, reach}
    let channels = [];        // {oy, targets[]}
    let phase = 'barreras';   // 'barreras' | 'canales' | 'flujo'
    let phaseStart = 0;
    let L = {};               // geometría (campos, espacio, rombo)

    const ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;

    p.setup = function () {
      const c = p.createCanvas(parentEl.clientWidth, parentEl.clientHeight);
      c.parent(parentEl);
      p.textFont('Lexend');
      build();
      phaseStart = p.millis();
    };

    p.windowResized = function () {
      // Guardia: el ResizeObserver puede disparar antes de que
      // p5 2.x haya creado el canvas (setup diferido).
      if (!p.canvas) return;
      p.resizeCanvas(parentEl.clientWidth, parentEl.clientHeight);
      build();
    };

    /**
     * Geometría y población. Dos campos suaves y redondeados en
     * los extremos —púrpura: capacidades y limitaciones
     * personales; naranja: demandas del entorno— y entre ambos
     * el espacio de interacción con el rombo de los apoyos.
     */
    function build() {
      const W = p.width, H = p.height;
      const blockW = W * 0.24;
      const topY = H * 0.2, botY = H * 0.94;
      L = {
        purple: { x: 4, y: topY, w: blockW, h: botY - topY },
        orange: { x: W - blockW - 4, y: topY, w: blockW, h: botY - topY },
        gapL: blockW + 4, gapR: W - blockW - 4,
        midX: W / 2, midY: (topY + botY) / 2,
        diamond: Math.min(W * 0.1, (botY - topY) * 0.3)
      };

      persons = [];
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N;
        persons.push({
          shape: i % 4,
          col: PALETTE[i % PALETTE.length],
          y: topY + (botY - topY) * t,
          size: Math.max(10, H * 0.03) * (0.85 + (i * 37 % 10) / 30),
          reach: 0.16 + ((i * 53) % 100) / 100 * 0.45   // hasta dónde llega su intento (acto 1)
        });
      }

      // Cada canal nace a una altura del campo naranja y
      // atiende a las personas cuyo índice le corresponde.
      channels = [];
      for (let c = 0; c < CHANNELS.length; c++) {
        const oy = topY + (botY - topY) * ((c + 0.5) / CHANNELS.length);
        const targets = [];
        for (let i = 0; i < N; i++) if (i % CHANNELS.length === c) targets.push(i);
        channels.push({ oy, targets });
      }
    }

    p.mousePressed = function () {
      const inside = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
      if (!inside) return;
      if (phase === 'barreras') { phase = 'canales'; phaseStart = p.millis(); }
      else if (phase === 'canales') { phase = 'flujo'; phaseStart = p.millis(); }
      else { phase = 'barreras'; phaseStart = p.millis(); }
    };

    p.draw = function () {
      p.clear();
      if (p.width < 4 || p.height < 4) return;
      const t = p.millis() - phaseStart;
      if (phase === 'barreras' && t > ACT1_MS) { phase = 'canales'; phaseStart = p.millis(); }
      else if (phase === 'canales' && t > ACT2_MS) { phase = 'flujo'; phaseStart = p.millis(); }

      drawFields();
      drawPersons();
      if (phase === 'barreras') drawBarriers(Math.min(1, (p.millis() - phaseStart) / 1400));
      if (phase !== 'barreras') {
        const k = phase === 'canales' ? Math.min(1, (p.millis() - phaseStart) / 1800) : 1;
        drawChannels(k);
        if (phase === 'flujo') drawFlow();
        drawDiamond(k);
      }
      drawCaptions();
    };

    /**
     * Campos púrpura y naranja con sus títulos, y el rótulo del
     * espacio de interacción arriba al centro, en terracota como
     * los rótulos clave de la campana.
     */
    function drawFields() {
      const ts = Math.max(17, p.width * 0.021);   // título de bloque, blanco y en negrita

      // Bloques con color fuerte y sólido, como el esquema original.
      p.noStroke();
      p.fill(PURPLE[0], PURPLE[1], PURPLE[2]);
      p.rect(L.purple.x, L.purple.y, L.purple.w, L.purple.h, 14);
      p.fill(NARANJA[0], NARANJA[1], NARANJA[2]);
      p.rect(L.orange.x, L.orange.y, L.orange.w, L.orange.h, 14);

      // Títulos en blanco, negrita, más grandes.
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(ts);
      p.textStyle(p.BOLD);
      p.fill(255);
      p.text('Capacidades y\nlimitaciones\npersonales', L.purple.x + ts * 0.9, L.purple.y + ts * 0.9);
      p.text('Demandas\ndel entorno', L.orange.x + ts * 0.9, L.orange.y + ts * 0.9);
      p.textStyle(p.NORMAL);
      p.textSize(ts * 0.55);
      p.fill(255, 210);
      p.text('lo que podemos\ndiseñar nosotros', L.orange.x + ts * 0.9, L.orange.y + ts * 4.1);

      // Rótulo del espacio de interacción, bajado para no chocar con
      // el título de la diapositiva ni con el titular del acto.
      p.textAlign(p.CENTER, p.TOP);
      p.textSize(Math.max(13, p.width * 0.014));
      p.fill(TERRA[0], TERRA[1], TERRA[2]);
      p.text('espacio de interacción', L.midX, p.height * 0.115);
      const ry = p.height * 0.17;
      p.stroke(INK[0], INK[1], INK[2], 90);
      p.strokeWeight(1);
      p.line(L.gapL + 10, ry, L.gapR - 10, ry);
      p.line(L.gapL + 10, ry - 5, L.gapL + 10, ry + 5);
      p.line(L.gapR - 10, ry - 5, L.gapR - 10, ry + 5);
    }

    /**
     * Las personas diversas asomadas al borde derecho del campo
     * púrpura: mismas cuatro formas, colores y variación de
     * tamaño que en la campana de Gauss.
     */
    function drawPersons() {
      for (const per of persons) {
        // Justo a la derecha del bloque púrpura sólido, sobre el fondo
        // claro, para que los colores diversos se lean con contraste.
        const x = L.gapL + per.size * 0.75;
        p.noStroke();
        p.fill(per.col[0], per.col[1], per.col[2], 235);
        drawShape(per.shape, x, per.y, per.size);
      }
    }

    function drawShape(kind, x, y, s) {
      const h = s / 2;
      if (kind === 0) p.circle(x, y, s);
      else if (kind === 1) p.rect(x - h, y - h, s, s, Math.max(0, s * 0.2));
      else if (kind === 2) p.triangle(x, y - h, x - h, y + h, x + h, y + h);
      else p.quad(x, y - h, x + h, y, x, y + h, x - h, y);
    }

    /**
     * Acto 1: los intentos de las personas se detienen a mitad
     * del espacio de interacción. Línea segmentada del color de
     * cada persona que crece y termina en un tope perpendicular
     * de tinta: la barrera.
     */
    function drawBarriers(k) {
      const gapW = L.gapR - L.gapL;
      p.drawingContext.setLineDash([4, 6]);
      for (const per of persons) {
        const x0 = L.gapL + per.size * 1.5;
        const x1 = x0 + gapW * per.reach * ease(k);
        p.stroke(per.col[0], per.col[1], per.col[2], 170);
        p.strokeWeight(2);
        p.line(x0, per.y, x1, per.y);
        if (k >= 1) {
          p.drawingContext.setLineDash([]);
          p.stroke(INK[0], INK[1], INK[2], 180);
          p.strokeWeight(2.5);
          p.line(x1, per.y - 7, x1, per.y + 7);
          p.drawingContext.setLineDash([4, 6]);
        }
      }
      p.drawingContext.setLineDash([]);
    }

    /**
     * Acto 2: lo diseñable avanza. Cada canal de comunicación
     * sale del campo naranja y se curva hasta cada persona que
     * atiende: el mismo entorno, actuando de formas distintas.
     * El parámetro k ∈ [0,1] anima el avance derecha→izquierda.
     */
    function drawChannels(k) {
      const gapW = L.gapR - L.gapL;
      const ts = Math.max(10, p.width * 0.011);
      for (let c = 0; c < channels.length; c++) {
        const ch = channels[c];
        const ox = L.gapR - 2;
        for (const i of ch.targets) {
          const per = persons[i];
          const tx = L.gapL + per.size * 1.5;
          p.noFill();
          p.stroke(NARANJA[0], NARANJA[1], NARANJA[2], 210);
          p.strokeWeight(2.2);
          p.beginShape();
          const steps = 40;
          for (let s = 0; s <= Math.floor(steps * k); s++) {
            const u = s / steps;
            const pt = bez(ox, ch.oy, tx, per.y, gapW, u);
            p.vertex(pt.x, pt.y);
          }
          p.endShape();
          // Punta de flecha al llegar a la persona.
          if (k >= 1) {
            p.noStroke();
            p.fill(NARANJA[0], NARANJA[1], NARANJA[2]);
            p.triangle(tx, per.y, tx + 10, per.y - 5, tx + 10, per.y + 5);
          }
        }
        // Etiqueta del canal junto a su nacimiento en el campo naranja.
        if (k > 0.35) {
          p.noStroke();
          p.fill(INK[0], INK[1], INK[2], 180);
          p.textSize(ts);
          p.textAlign(p.RIGHT, p.BOTTOM);
          p.text(CHANNELS[c], L.gapR - 14, ch.oy - 16);
        }
      }
    }

    /**
     * Curva de un canal: bezier cúbica derecha→izquierda a
     * través del espacio de interacción. u=0 en el entorno,
     * u=1 en la persona.
     */
    function bez(ox, oy, tx, ty, gapW, u) {
      const c1x = ox - gapW * 0.38, c1y = oy;
      const c2x = tx + gapW * 0.38, c2y = ty;
      const x = p.bezierPoint(ox, c1x, c2x, tx, u);
      const y = p.bezierPoint(oy, c1y, c2y, ty, u);
      return { x, y };
    }

    /**
     * El rombo de los apoyos al centro del espacio de
     * interacción: papel blanco sobre los canales, contorno de
     * tinta, rótulo en tinta. Se dibuja después del flujo para
     * que las partículas pasen por detrás.
     */
    function drawDiamond(k) {
      const d = L.diamond * ease(Math.min(1, k * 1.4));
      if (d <= 1) return;
      p.push();
      p.translate(L.midX, L.midY);
      p.fill(255, 240);
      p.stroke(INK[0], INK[1], INK[2]);
      p.strokeWeight(2.5);
      p.quad(0, -d, d, 0, 0, d, -d, 0);
      p.noStroke();
      p.fill(INK[0], INK[1], INK[2]);
      p.textAlign(p.CENTER, p.CENTER);
      p.textStyle(p.BOLD);
      const dts = Math.max(12, p.width * 0.014) * Math.min(1, k * 1.4);
      p.textSize(dts);
      p.text('apoyos', 0, -dts * 0.6);
      p.text('razonables', 0, dts * 0.6);
      p.textStyle(p.NORMAL);
      p.pop();
    }

    /**
     * Acto 3: partículas recorren los canales en ambos sentidos.
     * Naranjas del entorno hacia las personas, púrpuras de las
     * personas hacia el entorno: el valor fluye porque la
     * interacción quedó diseñada.
     */
    function drawFlow() {
      const gapW = L.gapR - L.gapL;
      const now = p.millis();
      p.noStroke();
      for (let c = 0; c < channels.length; c++) {
        const ch = channels[c];
        const ox = L.gapR - 2;
        for (const i of ch.targets) {
          const per = persons[i];
          const tx = L.gapL + per.size * 1.5;
          for (let s = 0; s < 2; s++) {
            const u = ((now / 2600) + i * 0.13 + s / 2) % 1;
            const a = bez(ox, ch.oy, tx, per.y, gapW, u);
            p.fill(NARANJA[0], NARANJA[1], NARANJA[2]);
            p.circle(a.x, a.y, 6);
            const b = bez(ox, ch.oy, tx, per.y, gapW, 1 - u);
            p.fill(PURPLE[0], PURPLE[1], PURPLE[2], 190);
            p.circle(b.x, b.y - 4, 4);
          }
        }
      }
    }

    /**
     * Titular del acto en curso, arriba a la izquierda, con el
     * mismo tratamiento tipográfico que la campana de Gauss.
     */
    function drawCaptions() {
      const msgs = {
        barreras: 'Sin diseño, los intentos de las personas chocan con barreras',
        canales: 'Lo diseñable avanza: varios canales, distintas formas de llegar',
        flujo: 'Con apoyos, el valor fluye en ambos sentidos'
      };
      p.noStroke();
      p.fill(INK[0], INK[1], INK[2], 210);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(Math.max(15, p.width * 0.017));
      p.text(msgs[phase], 10, 8);
      p.fill(INK[0], INK[1], INK[2], 90);
      p.textSize(Math.max(10, p.width * 0.009));
    }
  };
}

// ======================================================
// FÁBRICA DE SKETCH: CAPAS
// La rima semántica entre frase y pictograma, para la
// diapositiva #s6-capas (casos de pictos.cl). Reutiliza
// el dibujo original del esquema semantic-correspondence
// (tarjeta bip en el torniquete del metro) recortado en
// public/images/capas/: acción, elemento, contexto y la
// escena compuesta.
//
// Hilo mental en tres actos:
//   1. FRASE   — el paso en lenguaje llano aparece y se
//                colorea por partes: acción, elemento,
//                contexto. La frase ya viene en capas.
//   2. CAPAS   — cada parte de la frase levanta su capa
//                visual: tres tarjetas que se suman.
//   3. RIMA    — las capas componen la escena completa y
//                la correspondencia se demuestra sola:
//                cada palabra se ilumina junto a su capa.
//
// Interacción: clic avanza de acto; en el acto 3 cambia
// la correspondencia iluminada.
// ======================================================
function capasFactory(parentEl) {
  return function (p) {

    // --- Roles semánticos con colores de la paleta del deck
    const ROLES = [
      { key: 'accion',   label: 'la acción',   words: 'Pasa',              col: [239, 106, 18] },  // naranja
      { key: 'elemento', label: 'el elemento', words: 'tu tarjeta',        col: [13, 79, 82] },    // petróleo
      { key: 'contexto', label: 'el contexto', words: 'por el torniquete', col: [58, 90, 64] }     // verde bosque
    ];
    const INK = [28, 20, 31];
    const TERRA = [179, 45, 19];

    const ACT1_MS = 4200;     // frase y coloreado
    const ACT2_MS = 4600;     // levantar capas
    const RIMA_HOLD = 2200;   // ms por correspondencia iluminada en acto 3

    let imgs = {};            // capa-accion/elemento/contexto/escena
    let phase = 'frase';      // 'frase' | 'capas' | 'rima'
    let phaseStart = 0;
    let riming = 0;           // rol iluminado en acto 3
    let lastRime = 0;
    let L = {};               // geometría calculada en layout()

    const ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Carga de las imágenes recortadas (con transparencia).
    // p5 2.x retiró preload(): el setup asíncrono espera las
    // imágenes antes de dibujar el primer frame.
    p.setup = async function () {
      const c = p.createCanvas(parentEl.clientWidth, parentEl.clientHeight);
      c.parent(parentEl);
      p.textFont('Lexend');
      const base = 'images/capas/';
      [imgs.accion, imgs.elemento, imgs.contexto, imgs.escena] = await Promise.all([
        'capa-accion.png', 'capa-elemento.png', 'capa-contexto.png', 'escena.png'
      ].map(f => p.loadImage(base + f)));
      layout();
      phaseStart = p.millis();
    };

    p.windowResized = function () {
      if (!p.canvas) return;
      p.resizeCanvas(parentEl.clientWidth, parentEl.clientHeight);
      layout();
    };

    /**
     * Geometría: la frase abajo (medida palabra a palabra para
     * anclar los conectores), la hilera de capas al centro y la
     * escena compuesta arriba a la derecha.
     */
    function layout() {
      const W = p.width, H = p.height;
      L.fraseY = H * 0.86;
      L.fraseSize = Math.max(20, W * 0.028);

      // Medir cada parte de la frase para conocer sus anclas.
      p.textSize(L.fraseSize);
      p.textStyle(p.BOLD);
      const gaps = L.fraseSize * 0.34;
      const widths = ROLES.map(r => p.textWidth(r.words));
      const total = widths.reduce((a, b) => a + b, 0) + gaps * (ROLES.length - 1);
      let x = (W - total) / 2;
      L.parts = ROLES.map((r, i) => {
        const part = { x0: x, x1: x + widths[i], cx: x + widths[i] / 2 };
        x += widths[i] + gaps;
        return part;
      });
      p.textStyle(p.NORMAL);

      // Hilera:  capa + capa + capa   =   escena
      // Se posiciona a partir de los anchos REALES de cada imagen para
      // que las capas queden equidistantes y los signos (+, =) caigan
      // siempre en los huecos, nunca tapados. La suma (escena) queda a
      // la derecha, separada por un hueco mayor. Si la fila excede el
      // canvas, se escala todo junto para que quepa.
      const cy = H * 0.42;
      let cardH = H * 0.30;
      let escH = H * 0.42;
      let gapPlus = W * 0.055;   // hueco para el signo +
      let gapEq = W * 0.11;      // hueco mayor para el = y la suma a la derecha

      const cardAR = ROLES.map(r => {
        const im = imgs[r.key];
        return im && im.width ? im.width / im.height : 0.86;
      });
      const escAR = (imgs.escena && imgs.escena.width)
        ? imgs.escena.width / imgs.escena.height : 1.4;

      const rowW = () => cardAR.reduce((a, ar) => a + cardH * ar, 0)
        + gapPlus * (ROLES.length - 1) + gapEq + escH * escAR;
      const maxW = W * 0.94;
      if (rowW() > maxW) {
        const s = maxW / rowW();
        cardH *= s; escH *= s; gapPlus *= s; gapEq *= s;
      }

      // Recorrer de izquierda a derecha, centrando la fila completa.
      x = (W - rowW()) / 2;
      L.cards = [];
      L.plusX = [];
      for (let i = 0; i < ROLES.length; i++) {
        const w = cardH * cardAR[i];
        L.cards.push({ w, h: cardH, cx: x + w / 2, cy });
        x += w;
        if (i < ROLES.length - 1) { L.plusX.push(x + gapPlus / 2); x += gapPlus; }
      }
      L.eqX = x + gapEq / 2;
      x += gapEq;
      const ew = escH * escAR;
      L.escena = { w: ew, h: escH, cx: x + ew / 2, cy };
    }

    p.mousePressed = function () {
      const inside = p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
      if (!inside) return;
      if (phase === 'frase') { phase = 'capas'; phaseStart = p.millis(); }
      else if (phase === 'capas') { phase = 'rima'; phaseStart = p.millis(); lastRime = p.millis(); }
      else { riming = (riming + 1) % ROLES.length; lastRime = p.millis(); }
    };

    p.draw = function () {
      p.clear();
      if (p.width < 4 || p.height < 4) return;
      const t = p.millis() - phaseStart;
      if (phase === 'frase' && t > ACT1_MS) { phase = 'capas'; phaseStart = p.millis(); }
      else if (phase === 'capas' && t > ACT2_MS) { phase = 'rima'; phaseStart = p.millis(); lastRime = p.millis(); }
      if (phase === 'rima' && p.millis() - lastRime > RIMA_HOLD) {
        riming = (riming + 1) % ROLES.length;
        lastRime = p.millis();
      }

      // Progreso del coloreado (acto 1) y del despliegue (acto 2).
      const colorK = phase === 'frase' ? p.constrain((t - 1200) / 1800, 0, 1) : 1;
      const riseK = phase === 'frase' ? 0 : (phase === 'capas' ? p.constrain(t / 1800, 0, 1) : 1);
      const sceneK = phase === 'rima' ? p.constrain(t / 1200, 0, 1) : 0;

      if (riseK > 0) drawCards(riseK, sceneK);
      if (sceneK > 0) drawEscena(sceneK);
      drawFrase(colorK, riseK, sceneK);
      drawCaptions();
    };

    /**
     * La frase del paso, palabra a palabra: primero en tinta,
     * luego cada parte toma el color de su rol con un subrayado
     * y su etiqueta. En el acto 3, la parte que rima se ilumina
     * y las demás bajan de intensidad.
     */
    function drawFrase(colorK, riseK, sceneK) {
      p.textSize(L.fraseSize);
      p.textStyle(p.BOLD);
      p.textAlign(p.LEFT, p.BASELINE);
      for (let i = 0; i < ROLES.length; i++) {
        const r = ROLES[i], part = L.parts[i];
        // Cada parte se colorea escalonada en el acto 1.
        const k = p.constrain(colorK * 3 - i, 0, 1);
        const active = phase !== 'rima' || riming === i;
        const alpha = phase === 'rima' ? (active ? 255 : 90) : 255;
        const col = [
          p.lerp(INK[0], r.col[0], k),
          p.lerp(INK[1], r.col[1], k),
          p.lerp(INK[2], r.col[2], k)
        ];
        p.noStroke();
        p.fill(col[0], col[1], col[2], alpha);
        p.text(r.words, part.x0, L.fraseY);

        // Subrayado y etiqueta del rol.
        if (k > 0.4) {
          p.stroke(col[0], col[1], col[2], alpha);
          p.strokeWeight(active && phase === 'rima' ? 4 : 2.5);
          p.line(part.x0, L.fraseY + 10, part.x1, L.fraseY + 10);
          p.noStroke();
          p.textStyle(p.NORMAL);
          p.textSize(L.fraseSize * 0.42);
          p.textAlign(p.CENTER, p.TOP);
          p.fill(col[0], col[1], col[2], alpha * 0.85);
          p.text(r.label, part.cx, L.fraseY + 18);
          p.textAlign(p.LEFT, p.BASELINE);
          p.textSize(L.fraseSize);
          p.textStyle(p.BOLD);
        }
      }
      p.textStyle(p.NORMAL);
    }

    /**
     * Las tres capas suben desde su parte de la frase hasta la
     * hilera central, conectadas por una curva fina del color
     * del rol. En el acto 3, la capa que rima se levanta.
     */
    function drawCards(riseK, sceneK) {
      for (let i = 0; i < ROLES.length; i++) {
        const r = ROLES[i], card = L.cards[i], part = L.parts[i];
        const k = ease(p.constrain(riseK * 2.2 - i * 0.55, 0, 1));
        if (k <= 0) continue;
        const active = phase !== 'rima' || riming === i;
        const lift = (phase === 'rima' && active) ? -10 : 0;
        const cx = p.lerp(part.cx, card.cx, k);
        const cy = p.lerp(L.fraseY - 30, card.cy, k) + lift;
        const alpha = phase === 'rima' ? (active ? 255 : 110) : 255;

        // Conector palabra→capa.
        p.noFill();
        p.stroke(r.col[0], r.col[1], r.col[2], alpha * 0.6);
        p.strokeWeight(1.5);
        p.bezier(part.cx, L.fraseY - L.fraseSize * 1.1,
                 part.cx, cy + card.h * 0.8,
                 cx, cy + card.h * 0.75,
                 cx, cy + card.h * 0.55);

        // La capa (dibujo original recortado) con su etiqueta.
        const im = imgs[r.key];
        if (im && im.width) {
          p.push();
          if (alpha < 255) p.tint(255, alpha);
          p.imageMode(p.CENTER);
          p.image(im, cx, cy, card.w * k, card.h * k);
          p.pop();
          if (typeof p.noTint === 'function') p.noTint();
        }
        // (Sin etiqueta bajo la tarjeta: el conector de color y la
        //  etiqueta bajo la palabra ya establecen la correspondencia.)
        // Signo + centrado en el hueco entre capa i y capa i+1.
        if (i < ROLES.length - 1 && k > 0.9) {
          p.noStroke();
          p.fill(INK[0], INK[1], INK[2], 140);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(Math.max(18, p.width * 0.02));
          p.text('+', L.plusX[i], card.cy);
        }
      }
      // Signo = centrado en el hueco mayor, antes de la escena.
      if (riseK >= 1) {
        p.noStroke();
        p.fill(INK[0], INK[1], INK[2], sceneK > 0 ? 180 : 60);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(Math.max(22, p.width * 0.024));
        p.text('=', L.eqX, L.cards[2].cy);
      }
    }

    /**
     * La escena compuesta: la suma de las capas, apareciendo
     * con la frase completa debajo como en la señalética real
     * de PICTOS.
     */
    function drawEscena(k) {
      const im = imgs.escena;
      if (!im || !im.width) return;
      const e = L.escena;
      p.push();
      p.tint(255, 255 * ease(k));
      p.imageMode(p.CENTER);
      p.image(im, e.cx, e.cy, e.w * (0.94 + 0.06 * ease(k)), e.h * (0.94 + 0.06 * ease(k)));
      p.pop();
      if (typeof p.noTint === 'function') p.noTint();
      if (k >= 1) {
        p.noStroke();
        p.fill(TERRA[0], TERRA[1], TERRA[2]);
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(Math.max(12, p.width * 0.013));
        p.text('un paso = una frase + una imagen que riman', e.cx, e.cy + e.h / 2 + 10);
      }
    }

    /**
     * Titular del acto en curso, mismo tratamiento tipográfico
     * que los demás sketches del deck.
     */
    function drawCaptions() {
      const msgs = {
        frase: 'El paso se dice en lenguaje llano — la frase ya viene en capas',
        capas: 'Cada parte de la frase levanta su capa visual',
        rima: 'Rima semántica: cada palabra vive en la imagen'
      };
      p.noStroke();
      p.fill(INK[0], INK[1], INK[2], 210);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(Math.max(15, p.width * 0.017));
      p.text(msgs[phase], 10, 8);
      p.fill(INK[0], INK[1], INK[2], 90);
      p.textSize(Math.max(10, p.width * 0.009));
    }
  };
}
