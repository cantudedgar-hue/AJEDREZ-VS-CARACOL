
(() => {
  'use strict';

  const CFG = {
    slideMs: 420,       // duración de un movimiento normal
    captureMs: 480,     // duración si hay captura
    snailMs: 720,       // duración del avance del caracol
    snailDelay: 380,    // los caracoles arrancan después de la jugada
    ghostMs: 460,       // duración de la pieza capturada aplastándose
    stretch: [1.32, 0.78],       // [largo, ancho] en pleno vuelo
    land: [1.2, 0.8],            // aterrizaje normal [ancho, alto]
    landStrong: [1.38, 0.62],    // aterrizaje con captura
    origin: '50% 88%'            // ancla: la "base" de la pieza
  };

  const E_OUT = 'cubic-bezier(.25,.8,.35,1)';
  const E_IO = 'ease-in-out';

  const SQ = () => document.querySelectorAll('#b .s');
  const pieceEl = i => {
    const s = SQ()[i];
    return s ? s.querySelector(':scope > img, :scope > svg') : null;
  };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tf = (x = 0, y = 0, a = 0, sx = 1, sy = 1) =>
    `translate(${x}px,${y}px) rotate(${a}rad) scale(${sx},${sy}) rotate(${-a}rad)`;

  function geom(from, to) {
    const r = SQ(), a = r[from].getBoundingClientRect(), b = r[to].getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    return { dx, dy, s: b.width, ang: Math.atan2(dy, dx) };
  }

  function run(el, frames, dur, delay = 0) {
    if (!el || !el.animate) return;
    const host = el.parentElement;
    host.style.overflow = 'visible';
    host.style.zIndex = '4';
    el.style.transformOrigin = CFG.origin;
    const anim = el.animate(frames, { duration: dur, delay, fill: 'backwards' });
    const done = () => { host.style.overflow = ''; host.style.zIndex = ''; el.style.transformOrigin = ''; };
    (anim.finished || Promise.resolve()).then(done, done);
  }

  function slide(from, to, { strong = false, knight = false } = {}) {
    const el = pieceEl(to); if (!el) return;
    const { dx, dy, s, ang } = geom(from, to);
    const L = strong ? CFG.landStrong : CFG.land;
    const rb = strong ? [0.86, 1.2] : [0.94, 1.1];
    const tail = [
      { offset: 0.68, transform: tf(0, 0, 0, L[0], L[1]), easing: E_IO },
      { offset: 0.84, transform: tf(0, 0, 0, rb[0], rb[1]), easing: E_IO },
      { offset: 1, transform: tf() }
    ];
    const head = knight
      ? [
          { offset: 0, transform: tf(dx, dy, 0, 0.9, 1.1), easing: E_OUT },
          { offset: 0.3, transform: tf(dx * 0.55, dy * 0.55 - s * 0.5, 0, 0.88, 1.18), easing: E_OUT },
          { offset: 0.55, transform: tf(0, 0, 0, 0.95, 1.1), easing: E_IO }
        ]
      : [
          { offset: 0, transform: tf(dx, dy, ang, 0.9, 1.1), easing: E_OUT },
          { offset: 0.5, transform: tf(0, 0, ang, CFG.stretch[0], CFG.stretch[1]), easing: E_IO }
        ];
    run(el, [...head, ...tail], strong ? CFG.captureMs : CFG.slideMs);
  }

  function snailCrawl(from, to, { eat = false } = {}) {
    const el = pieceEl(to); if (!el) return;
    const { dx, dy, ang } = geom(from, to);
    run(el, [
      { offset: 0, transform: tf(dx, dy, ang, 1, 1), easing: E_IO },
      { offset: 0.22, transform: tf(dx * 0.7, dy * 0.7, ang, 1.3, 0.82), easing: E_IO },
      { offset: 0.42, transform: tf(dx * 0.45, dy * 0.45, ang, 0.85, 1.1), easing: E_IO },
      { offset: 0.64, transform: tf(dx * 0.1, dy * 0.1, ang, 1.28, 0.84), easing: E_IO },
      { offset: 0.8, transform: tf(0, 0, 0, eat ? 1.4 : 1.12, eat ? 0.6 : 0.84), easing: E_IO },
      { offset: 0.92, transform: tf(0, 0, 0, 0.95, 1.07), easing: E_IO },
      { offset: 1, transform: tf() }
    ], CFG.snailMs, CFG.snailDelay);
  }

  function ghost(node, idx, { dur = CFG.ghostMs, delay = 0, hold = 0.5 } = {}) {
    const host = SQ()[idx];
    if (!node || !host || !node.animate) return;
    host.prepend(node);
    node.style.transformOrigin = CFG.origin;
    const mid = hold + (1 - hold) * 0.35;
    const anim = node.animate([
      { offset: 0, transform: tf(), opacity: 1 },
      { offset: hold, transform: tf(), opacity: 1, easing: E_IO },
      { offset: mid, transform: tf(0, 0, 0, 1.55, 0.4), opacity: 0.95, easing: E_IO },
      { offset: 1, transform: tf(0, 6, 0, 1.9, 0.06), opacity: 0 }
    ], { duration: dur, delay, fill: 'both' });
    const done = () => node.remove();
    (anim.finished || Promise.resolve()).then(done, done);
  }

  function jelly(i) {
    const el = pieceEl(i); if (!el) return;
    run(el, [
      { offset: 0, transform: tf(), easing: E_OUT },
      { offset: 0.3, transform: tf(0, 0, 0, 1.14, 0.88), easing: E_IO },
      { offset: 0.6, transform: tf(0, 0, 0, 0.95, 1.08), easing: E_IO },
      { offset: 1, transform: tf() }
    ], 280);
  }

  const _move = window.move, _click = window.click;

  window.move = function (m) {
    if (reduced()) return _move(m);

    const before = G.b.slice();
    const side = col(before[m.f]);
    const epSq = m.ep ? m.t + (side === 'w' ? 8 : -8) : -1;
    const kingIdx = { k: before.indexOf('k'), K: before.indexOf('K') };

    const grab = i => {
      const n = i >= 0 && pieceEl(i);
      return n ? n.cloneNode(true) : null;
    };
    const snap = {};
    [m.t, epSq, kingIdx.k, kingIdx.K].forEach(i => { if (i >= 0 && !(i in snap)) snap[i] = grab(i); });

    _move(m);               o
    const after = G.b;

    const captured = before[m.t] && col(before[m.t]);
    const knight = before[m.f] && before[m.f].toLowerCase() === 'n';
    slide(m.f, m.t, { strong: !!(captured || m.ep), knight });
    if (captured) ghost(snap[m.t], m.t);
    if (m.ep) ghost(snap[epSq], epSq);

    if (m.c > 0) slide(m.f + 3, m.f + 1);
    if (m.c < 0) slide(m.f - 4, m.f - 1);

    for (const sn of ['x', 'y']) {
      const a = before.indexOf(sn), b = after.indexOf(sn);
      if (a >= 0 && b >= 0 && a !== b) {
        const eat = !!before[b] && !isSnailCell(before[b]);
        snailCrawl(a, b, { eat });
        if (eat && snap[b]) ghost(snap[b], b, { dur: CFG.snailMs, delay: CFG.snailDelay, hold: 0.75 });
      }
    }
  };

  const isSnailCell = p => p === 'x' || p === 'y';

  window.click = function (i) {
    const prev = sel;
    _click(i);
    if (!reduced() && !over && sel !== null && sel !== prev) jelly(sel);
  };
})();
