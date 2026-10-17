/* =========================================================
   audio.js — efectos de sonido y música para "Caracoles vs Ajedrez"
   Se carga DESPUÉS de main.js. No modifica main.js: envuelve
   las funciones globales move(), click() e init() y detecta
   los eventos comparando el estado antes/después.
   Archivos de sonido en ./sounds/
   ========================================================= */
(() => {
  'use strict';

  const DIR = 'sounds/';
  const SFX = [
    'select', 'illegal', 'move', 'capture', 'castle', 'promote', 'check',
    'snail_move', 'snail_warn', 'snail_eat', 'checkmate', 'win', 'draw',
    'new_game', 'ui_pop'
  ];

  /* ---------- estado persistente (mute) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* sin storage */ } }
  };
  let sfxOn = store.get('cc_sfx', true);
  let musicOn = store.get('cc_music', true);

  /* ---------- efectos: HTMLAudioElement (funciona también con file://) ---------- */
  const base = {};
  SFX.forEach(n => { const a = new Audio(DIR + n + '.wav'); a.preload = 'auto'; base[n] = a; });

  function play(name, vol = 0.8) {
    if (!sfxOn || !base[name]) return;
    const a = base[name].cloneNode(); // permite sonidos superpuestos
    a.volume = vol;
    a.play().catch(() => { /* bloqueado hasta el primer gesto del usuario */ });
  }

  /* ---------- música de fondo ---------- */
  const music = new Audio(DIR + 'music_loop.wav');
  music.loop = true;
  music.volume = 0.25;
  let musicStarted = false;

  function startMusic() {
    if (!musicOn) return;
    music.play().then(() => { musicStarted = true; }).catch(() => { /* reintenta en el próximo gesto */ });
  }
  function stopMusic() { music.pause(); }

  // Los navegadores exigen un gesto del usuario antes de reproducir audio
  const unlock = () => { startMusic(); if (musicStarted) removeEventListener('pointerdown', unlock); };
  addEventListener('pointerdown', unlock);

  // Bajar música si la pestaña no está visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.pause(); else if (musicOn && musicStarted) music.play().catch(() => {});
  });

  /* ---------- botones de sonido / música (se inyectan en .ctl) ---------- */
  function makeToggle(id, label, get, set) {
    const b = document.createElement('button');
    b.id = id; b.type = 'button';
    const paint = () => { b.textContent = label + (get() ? ' ON' : ' OFF'); b.style.opacity = get() ? '1' : '.6'; };
    b.onclick = () => { set(!get()); paint(); };
    paint();
    return b;
  }
  const ctl = document.querySelector('.ctl');
  if (ctl) {
    ctl.appendChild(makeToggle('snd', '🔊 Efectos', () => sfxOn, v => {
      sfxOn = v; store.set('cc_sfx', v); if (v) play('ui_pop');
    }));
    ctl.appendChild(makeToggle('mus', '🎵 Música', () => musicOn, v => {
      musicOn = v; store.set('cc_music', v); v ? startMusic() : stopMusic();
    }));
  }

  /* ---------- utilidades de detección ---------- */
  const isSnail = p => p === 'x' || p === 'y';
  const snailPos = b => ({ x: b.indexOf('x'), y: b.indexOf('y') });
  const kingNear = b => {
    // ¿algún caracol a ≤2 casillas (Chebyshev) de SU rey objetivo?
    for (const [s, k] of [['x', 'k'], ['y', 'K']]) {
      const i = b.indexOf(s), j = b.indexOf(k);
      if (i < 0 || j < 0) continue;
      const d = Math.max(Math.abs((i >> 3) - (j >> 3)), Math.abs((i & 7) - (j & 7)));
      if (d <= 2) return true;
    }
    return false;
  };

  /* ---------- envoltorios de las funciones del juego ---------- */
  const _move = window.move, _click = window.click, _init = window.init;

  window.move = function (m) {
    const before = G.b;
    const mover = G.t;
    const target = before[m.t];
    const captured = !!m.ep || (target && !isSnail(target));
    const sp0 = snailPos(before);

    _move(m);

    const after = G.b;
    const sp1 = snailPos(after);
    const snailsMoved = sp0.x !== sp1.x || sp0.y !== sp1.y || (over && /devor/.test(over));

    // 1) sonido principal de la jugada
    if (m.pr) play('promote');
    else if (m.c) play('castle');
    else if (captured) play('capture');
    else play('move');

    // 2) fin de partida
    if (over) {
      if (/devor/.test(over)) { setTimeout(() => play('snail_eat'), 150); }
      else if (/mate/i.test(over)) { setTimeout(() => { play('checkmate'); setTimeout(() => play('win'), 700); }, 200); }
      else { setTimeout(() => play('draw'), 200); }
      return;
    }

    // 3) caracoles avanzaron (+ aviso de cercanía)
    if (snailsMoved && /caracoles avanzaron/i.test(document.getElementById('st').textContent)) {
      setTimeout(() => play('snail_move'), 250);
      if (kingNear(after)) setTimeout(() => play('snail_warn'), 900);
    }

    // 4) jaque
    if (/jaque/i.test(document.getElementById('st').textContent)) {
      setTimeout(() => play('check'), 120);
    }
  };

  window.click = function (i) {
    if (over) return;
    const prevSel = sel;
    const wasLegal = prevSel !== null && leg.some(m => m.f === prevSel && m.t === i);
    _click(i);
    if (wasLegal) return;                 // move() ya hizo su sonido
    if (sel !== null && sel !== prevSel) play('select');
    else if (prevSel !== null && sel === null) {
      // clic en casilla no válida con pieza seleccionada
      if (col(G.b[i]) !== G.t) play('illegal', 0.5);
    }
  };

  window.init = function () {
    _init();
    play('new_game', 0.7);
    startMusic();
  };

  /* los handlers de main.js capturaron las referencias originales: rebindear */
  const nw = document.getElementById('nw');
  if (nw) nw.onclick = window.init;
  const sp = document.getElementById('sp');
  if (sp) sp.onchange = e => { every = +e.target.value; window.init(); };
  const th = document.getElementById('th');
  if (th) {
    const prev = th.onchange;
    th.onchange = e => { prev && prev(e); play('ui_pop'); };
  }
})();
