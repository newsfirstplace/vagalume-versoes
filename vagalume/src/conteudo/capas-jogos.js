// Capas ilustradas dos jogos (16:9), desenhadas num canvas: tabuleiros em perspectiva,
// peças com sombra, cartas na mesa, bolas com reflexo. Sem imagem externa; o resultado
// vira um endereço data: guardado por jogo e tamanho.
(function () {
  'use strict';
  const VL = (globalThis.VL = globalThis.VL || {});
  const BASE_L = 320, BASE_A = 180; // todas as cenas são desenhadas nesse espaço
  const cache = {};

  // ---------- apoio ----------
  // Plano em perspectiva: leva (u, v) do quadrado unitário ao quadrilátero
  // [trás-esq, trás-dir, frente-dir, frente-esq] (homografia de Heckbert).
  function plano(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let a, b, c, d, e, f, g = 0, h = 0;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
      a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0;
    } else {
      const den = dx1 * dy2 - dx2 * dy1;
      g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den;
      a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
      d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
    }
    const p = (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
    // Largura na tela de um passo du em (u, v): dá o tamanho das coisas naquele ponto.
    p.passo = (u, v, du) => { const [ax, ay] = p(u - du / 2, v), [bx, by] = p(u + du / 2, v); return Math.hypot(bx - ax, by - ay); };
    return p;
  }
  function quad(c, p, u0, v0, u1, v1, cor) {
    const a = p(u0, v0), b = p(u1, v0), d = p(u1, v1), e = p(u0, v1);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath();
    if (cor) { c.fillStyle = cor; c.fill(); }
  }
  function linear(c, x0, y0, x1, y1, paradas) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    paradas.forEach((cor, i) => g.addColorStop(Array.isArray(cor) ? cor[0] : i / (paradas.length - 1), Array.isArray(cor) ? cor[1] : cor));
    return g;
  }
  function radial(c, x, y, r0, r1, paradas, x1, y1) {
    const g = c.createRadialGradient(x, y, r0, x1 == null ? x : x1, y1 == null ? y : y1, r1);
    paradas.forEach((cor, i) => g.addColorStop(Array.isArray(cor) ? cor[0] : i / (paradas.length - 1), Array.isArray(cor) ? cor[1] : cor));
    return g;
  }
  function fundo(c, x, y, r, paradas) { c.fillStyle = radial(c, x, y, 0, r, paradas); c.fillRect(0, 0, BASE_L, BASE_A); }
  function sombra(c, x, y, rx, ry, alfa, borrao) {
    c.save(); c.filter = 'blur(' + (borrao == null ? 3 : borrao) + 'px)';
    c.fillStyle = 'rgba(0,0,0,' + alfa + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  function vinheta(c) {
    c.fillStyle = radial(c, BASE_L / 2, BASE_A * 0.45, BASE_A * 0.35, BASE_L * 0.72, ['rgba(0,0,0,0)', 'rgba(0,0,0,.5)']);
    c.fillRect(0, 0, BASE_L, BASE_A);
  }
  function brilhoDeLuz(c, x, y, r, cor) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = radial(c, x, y, 0, r, [cor, 'rgba(0,0,0,0)']);
    c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  }
  function cantoRedondo(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  const FONTE = "'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif";

  // ---------- peças de xadrez (perfil girado, sombreado como cilindro) ----------
  const PERFIS = {
    peao: [[.4, 0], [.4, .08], [.3, .13], [.22, .18], [.15, .42], [.13, .56], [.25, .6], [.25, .64], [.12, .66]],
    torre: [[.44, 0], [.44, .09], [.34, .14], [.27, .22], [.24, .74], [.34, .8], [.34, 1.02]],
    rei: [[.46, 0], [.46, .09], [.36, .14], [.28, .22], [.18, .74], [.31, .8], [.31, .85], [.2, .88], [.27, 1.1], [.07, 1.15]],
  };
  function peca(c, tipo, x, y, s, clara) {
    const pts = PERFIS[tipo], larg = Math.max.apply(null, pts.map((q) => q[0])) * s;
    const tinta = linear(c, x - larg, 0, x + larg, 0, clara
      ? [[0, '#cdb894'], [.32, '#fffaf0'], [.62, '#e2d2b1'], [1, '#8a7452']]
      : [[0, '#3a3a44'], [.32, '#6f6f7d'], [.62, '#2b2b33'], [1, '#0d0d11']]);
    sombra(c, x + s * .32, y + s * .02, s * .62, s * .2, .5, 3);
    c.fillStyle = tinta; c.strokeStyle = clara ? 'rgba(90,70,40,.55)' : 'rgba(0,0,0,.7)'; c.lineWidth = Math.max(.6, s * .025);
    c.beginPath(); c.moveTo(x - pts[0][0] * s, y);
    for (const [hw, hy] of pts) c.lineTo(x - hw * s, y - hy * s);
    for (let i = pts.length - 1; i >= 0; i--) c.lineTo(x + pts[i][0] * s, y - pts[i][1] * s);
    c.ellipse(x, y, pts[0][0] * s, pts[0][0] * s * .3, 0, 0, Math.PI);
    c.closePath(); c.fill(); c.stroke();
    // anéis do torneado
    c.strokeStyle = clara ? 'rgba(120,95,55,.45)' : 'rgba(255,255,255,.12)';
    for (const hy of [.09, .14]) { c.beginPath(); c.ellipse(x, y - hy * s, pts[1][0] * s * (hy > .1 ? .78 : 1), s * .07, 0, 0, Math.PI); c.stroke(); }
    const topo = pts[pts.length - 1][1] * s;
    if (tipo === 'peao') {
      const r = s * .19, cy = y - topo - r * .82;
      c.fillStyle = radial(c, x - r * .35, cy - r * .4, r * .1, r * 1.1, clara ? ['#fffef8', '#e7d7b6', '#9b8460'] : ['#7d7d8c', '#2e2e37', '#0b0b0f'], x, cy);
      c.beginPath(); c.arc(x, cy, r, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (tipo === 'torre') {
      const w = .34 * s, h = s * .14, yt = y - topo;
      c.fillStyle = tinta;
      for (let i = 0; i < 3; i++) { const x0 = x - w + i * (w * 2 / 3) + w * .08; c.fillRect(x0, yt - h, w * 2 / 3 - w * .16, h); c.strokeRect(x0, yt - h, w * 2 / 3 - w * .16, h); }
    } else if (tipo === 'rei') {
      const yt = y - topo, b = s * .055, a = s * .3;
      c.fillStyle = tinta;
      c.fillRect(x - b, yt - a, b * 2, a); c.strokeRect(x - b, yt - a, b * 2, a);
      c.fillRect(x - a * .38, yt - a * .72, a * .76, b * 2); c.strokeRect(x - a * .38, yt - a * .72, a * .76, b * 2);
    }
    // luz de contorno
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = clara ? 'rgba(255,245,215,.25)' : 'rgba(170,190,255,.22)'; c.lineWidth = s * .03;
    c.beginPath(); c.moveTo(x - pts[2][0] * s * .9, y - pts[2][1] * s); c.lineTo(x - pts[pts.length - 2][0] * s * .9, y - pts[pts.length - 2][1] * s); c.stroke(); c.restore();
  }

  // ---------- pedra de damas (cilindro baixo) ----------
  function pedra(c, x, y, r, clara, dama) {
    const t = r * .32, ry = r * .42;
    sombra(c, x + r * .25, y + t + r * .08, r * 1.05, ry * 1.05, .5, 2.5);
    const camada = (cy, topoComBrilho) => {
      c.fillStyle = clara ? '#a98a62' : '#5c0f12';
      c.beginPath(); c.ellipse(x, cy + t, r, ry, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = linear(c, x - r, 0, x + r, 0, clara ? ['#b89a70', '#f6e8cc', '#a2845c'] : ['#7d1418', '#d63c3a', '#5e0c10']);
      c.fillRect(x - r, cy, r * 2, t);
      c.fillStyle = radial(c, x - r * .35, cy - ry * .4, r * .05, r * 1.1, clara ? ['#fffaf0', '#efdfc1', '#c6aa80'] : ['#ff6b5f', '#d0302f', '#8a1418'], x, cy);
      c.beginPath(); c.ellipse(x, cy, r, ry, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = clara ? 'rgba(120,90,50,.45)' : 'rgba(60,0,0,.5)'; c.lineWidth = r * .06;
      c.beginPath(); c.ellipse(x, cy, r * .68, ry * .68, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(x, cy, r * .4, ry * .4, 0, 0, Math.PI * 2); c.stroke();
      if (topoComBrilho) { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - r * .38, cy - ry * .42, r * .28, ry * .16, -.2, 0, Math.PI * 2); c.fill(); }
    };
    camada(y, !dama);
    if (dama) {
      camada(y - t * 1.05, true);
      const cy = y - t * 1.05;
      c.fillStyle = '#f6cd4c'; c.strokeStyle = '#7a5600'; c.lineWidth = r * .05;
      c.beginPath();
      c.moveTo(x - r * .42, cy + ry * .12); c.lineTo(x - r * .48, cy - ry * .55); c.lineTo(x - r * .2, cy - ry * .15);
      c.lineTo(x, cy - ry * .75); c.lineTo(x + r * .2, cy - ry * .15); c.lineTo(x + r * .48, cy - ry * .55); c.lineTo(x + r * .42, cy + ry * .12);
      c.closePath(); c.fill(); c.stroke();
    }
  }

  // ---------- bola com reflexo (sinuca) ----------
  const CORES_BOLA = ['#f4c20d', '#1f4fc9', '#d4232b', '#5b2a86', '#f07b1c', '#18804a', '#7a1e1e', '#141414'];
  function bola(c, x, y, r, n) {
    sombra(c, x + r * .45, y + r * .8, r * 1.05, r * .36, .55, Math.max(1, r * .25));
    const cor = n === 0 ? '#f6f3ea' : CORES_BOLA[(n - 1) % 8], listra = n > 8;
    c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = listra ? '#f4f1e8' : cor; c.fillRect(x - r, y - r, r * 2, r * 2);
    if (listra) { c.fillStyle = cor; c.beginPath(); c.ellipse(x, y + r * .08, r * 1.2, r * .5, -.25, 0, Math.PI * 2); c.fill(); }
    if (n > 0) {
      c.fillStyle = '#fbf8ef'; c.beginPath(); c.ellipse(x - r * .12, y - r * .02, r * .42, r * .38, -.25, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#151515'; c.font = '800 ' + (r * .52).toFixed(1) + 'px ' + FONTE; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(n), x - r * .12, y + r * .01);
    }
    c.fillStyle = radial(c, x - r * .38, y - r * .42, r * .05, r * 1.15, [[0, 'rgba(255,255,255,.4)'], [.42, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.62)']], x, y);
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.fillStyle = 'rgba(120,255,190,.18)'; c.beginPath(); c.ellipse(x + r * .25, y + r * .72, r * .55, r * .22, 0, 0, Math.PI * 2); c.fill(); // reflexo do pano
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.ellipse(x - r * .38, y - r * .44, r * .2, r * .12, -.6, 0, Math.PI * 2); c.fill();
  }

  // ---------- carta (Vagacartas) ----------
  const CORES_CARTA = { lima: '#8fc823', azul: '#2f7de1', rosa: '#e8457f', laranja: '#f28b1e' };
  function carta(c, x, y, ang, cor, valor) {
    const w = 58, h = 86;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.save(); c.filter = 'blur(4px)'; c.fillStyle = 'rgba(0,0,0,.45)'; cantoRedondo(c, -w / 2 + 5, -h / 2 + 7, w, h, 8); c.fill(); c.restore();
    c.fillStyle = '#fbfbfd'; cantoRedondo(c, -w / 2, -h / 2, w, h, 8); c.fill();
    const fundoCarta = cor ? CORES_CARTA[cor] : '#15151c';
    c.fillStyle = linear(c, 0, -h / 2, 0, h / 2, [fundoCarta, cor ? fundoCarta : '#2b2b36']); cantoRedondo(c, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 6); c.fill();
    c.save(); c.rotate(-.5); c.fillStyle = cor ? '#fff' : 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(0, 0, w * .34, h * .4, 0, 0, Math.PI * 2); c.fill(); c.restore();
    if (!cor) { // coringa: círculo de quatro cores
      const k = Object.values(CORES_CARTA);
      for (let i = 0; i < 4; i++) { c.fillStyle = k[i]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, w * .27, i * Math.PI / 2 - .5, (i + 1) * Math.PI / 2 - .5); c.closePath(); c.fill(); }
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, w * .27, 0, Math.PI * 2); c.stroke();
    } else {
      c.font = '900 34px ' + FONTE; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.55)'; c.strokeText(valor, 0, 1);
      c.fillStyle = fundoCarta; c.fillText(valor, 0, 1);
    }
    c.fillStyle = '#fff'; c.font = '800 11px ' + FONTE; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(cor ? valor : '★', -w / 2 + 7, -h / 2 + 6);
    c.save(); c.rotate(Math.PI); c.fillText(cor ? valor : '★', -w / 2 + 7, -h / 2 + 6); c.restore();
    c.fillStyle = 'rgba(255,255,255,.22)'; cantoRedondo(c, -w / 2 + 4, -h / 2 + 4, w - 8, h * .22, 6); c.fill();
    c.restore();
  }

  // ---------- cenas ----------
  const CENAS = {
    xadrez(c) {
      fundo(c, 160, 30, 300, ['#4a3420', '#1d140c', '#090604']);
      brilhoDeLuz(c, 150, 20, 140, 'rgba(255,210,150,.25)');
      const p = plano([[96, 64], [224, 64], [384, 222], [-64, 222]]);
      quad(c, p, -.03, -.04, 1.03, 1.03, '#2a1a0e');
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) quad(c, p, j / 8, i / 8, (j + 1) / 8, (i + 1) / 8, (i + j) % 2 ? '#8f5f3a' : '#ead2aa');
      c.fillStyle = linear(c, 0, 64, 0, 180, ['rgba(255,240,210,.18)', 'rgba(0,0,0,0)']); quad(c, p, 0, 0, 1, 1); c.fill();
      const pe = (t, cl, col, lin, k) => { const [x, y] = p((col + .5) / 8, (lin + .62) / 8); peca(c, t, x, y, p.passo((col + .5) / 8, (lin + .5) / 8, 1 / 8) * (k || 1), cl); };
      pe('torre', false, 1, 1); pe('peao', false, 4, 2); pe('peao', false, 5, 1); pe('rei', false, 6, 0, 1.05);
      pe('peao', true, 2, 4); pe('rei', true, 4, 5, 1.08); pe('torre', true, 6, 5);
      vinheta(c);
    },
    damas(c) {
      fundo(c, 170, 20, 300, ['#5c2720', '#22100c', '#0b0504']);
      brilhoDeLuz(c, 170, 10, 150, 'rgba(255,190,140,.22)');
      const p = plano([[90, 58], [230, 58], [392, 222], [-72, 222]]);
      quad(c, p, -.03, -.04, 1.03, 1.03, '#3a1a10');
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) quad(c, p, j / 8, i / 8, (j + 1) / 8, (i + 1) / 8, (i + j) % 2 ? '#5a2a1c' : '#f0dcb8');
      c.fillStyle = linear(c, 0, 58, 0, 180, ['rgba(255,230,200,.16)', 'rgba(0,0,0,0)']); quad(c, p, 0, 0, 1, 1); c.fill();
      const pd = (cl, col, lin, dama) => { const [x, y] = p((col + .5) / 8, (lin + .5) / 8); pedra(c, x, y, p.passo((col + .5) / 8, (lin + .5) / 8, 1 / 8) * .4, cl, dama); };
      [[1, 0], [3, 0], [5, 0], [7, 0], [0, 1], [2, 1], [6, 1], [5, 2]].forEach(([a, b]) => pd(false, a, b));
      pd(false, 3, 3, true);
      [[2, 4], [6, 4], [1, 5], [5, 5], [0, 6]].forEach(([a, b]) => pd(true, a, b));
      pd(true, 3, 5, true);
      vinheta(c);
    },
    pingpong(c) {
      c.fillStyle = linear(c, 0, 0, 0, BASE_A, ['#0c1838', '#060b1c']); c.fillRect(0, 0, BASE_L, BASE_A);
      brilhoDeLuz(c, 160, -10, 170, 'rgba(120,170,255,.35)');
      for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(255,255,255,' + (.05 + (i % 3) * .03) + ')'; c.fillRect(8 + i * 36, 34, 22, 3); } // luzes da arquibancada
      const p = plano([[78, 74], [242, 74], [326, 168], [-6, 168]]);
      c.fillStyle = '#0a1a38'; c.beginPath(); const fe = p(0, 1), fd = p(1, 1); c.moveTo(fe[0], fe[1]); c.lineTo(fd[0], fd[1]); c.lineTo(fd[0] - 4, fd[1] + 9); c.lineTo(fe[0] + 4, fe[1] + 9); c.fill();
      c.fillStyle = linear(c, 0, 74, 0, 168, ['#2b6fd4', '#1650a8']); quad(c, p, 0, 0, 1, 1); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6;
      quad(c, p, .015, .02, .985, .985); c.stroke();
      c.lineWidth = 1; const ct = p(.5, .02), cb = p(.5, .985); c.beginPath(); c.moveTo(ct[0], ct[1]); c.lineTo(cb[0], cb[1]); c.stroke();
      // rede
      const re = p(-.04, .46), rd = p(1.04, .46), alt = 13;
      c.fillStyle = 'rgba(230,240,255,.2)'; c.beginPath(); c.moveTo(re[0], re[1]); c.lineTo(rd[0], rd[1]); c.lineTo(rd[0], rd[1] - alt); c.lineTo(re[0], re[1] - alt); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = .6;
      for (let i = 0; i <= 40; i++) { const x = re[0] + (rd[0] - re[0]) * i / 40; c.beginPath(); c.moveTo(x, re[1]); c.lineTo(x, re[1] - alt); c.stroke(); }
      c.fillStyle = '#fff'; c.fillRect(re[0], re[1] - alt - 1.5, rd[0] - re[0], 2.5);
      c.fillStyle = '#c9d3e6'; c.fillRect(re[0] - 2, re[1] - alt - 3, 3, alt + 3); c.fillRect(rd[0] - 1, rd[1] - alt - 3, 3, alt + 3);
      // rastro e bola
      for (let i = 0; i < 12; i++) { const t = i / 11, x = 60 + t * 112, y = 120 - Math.sin(t * Math.PI) * 70 + t * 4; c.fillStyle = 'rgba(255,190,90,' + (t * .35) + ')'; c.beginPath(); c.arc(x, y, 1.5 + t * 3, 0, Math.PI * 2); c.fill(); }
      sombra(c, 178, 116, 7, 2.5, .45, 1.5);
      brilhoDeLuz(c, 172, 54, 22, 'rgba(255,170,70,.55)');
      c.fillStyle = radial(c, 169, 51, 1, 7, ['#fff3d9', '#ff9b2e', '#c45a00'], 172, 54); c.beginPath(); c.arc(172, 54, 6.5, 0, Math.PI * 2); c.fill();
      // raquete
      c.save(); c.translate(262, 124); c.rotate(-.42);
      sombra(c, 10, 30, 34, 10, .4, 4);
      c.fillStyle = linear(c, -6, 30, 6, 30, ['#7a4a22', '#c7894c', '#6b3d18']); cantoRedondo(c, -7, 26, 14, 42, 5); c.fill();
      c.fillStyle = '#2a0a0c'; c.beginPath(); c.ellipse(0, 0, 37, 40, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = radial(c, -12, -14, 2, 40, ['#ff5a5f', '#d81f2a', '#7d0a12'], 0, 0); c.beginPath(); c.ellipse(0, 0, 34, 37, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(-12, -15, 13, 8, -.6, 0, Math.PI * 2); c.fill();
      c.restore();
      vinheta(c);
    },
    corrida(c) {
      c.fillStyle = linear(c, 0, 0, 0, BASE_A, ['#1a0633', '#06010e']); c.fillRect(0, 0, BASE_L, BASE_A);
      brilhoDeLuz(c, 70, 40, 120, 'rgba(255,60,170,.3)'); brilhoDeLuz(c, 260, 60, 120, 'rgba(40,220,255,.25)');
      for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(80,240,255,' + (.12 + (i % 3) * .06) + ')'; c.fillRect(-10 + (i * 37) % 90, 18 + i * 6, 60 + (i % 4) * 22, 1.2); }
      const p = plano([[34, 96], [286, 96], [360, 214], [-40, 214]]);
      quad(c, p, -.02, -.06, 1.02, 1.04, '#120a22');
      const teclas = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'], acesas = { V: '#ff4fa8', A: '#3ff0ff', G: '#ff4fa8', L: '#3ff0ff', U: '#ff4fa8', M: '#3ff0ff', E: '#ff4fa8' };
      teclas.forEach((linha, r) => {
        const v0 = r * .3 + .03, v1 = v0 + .25, recuo = r * .035;
        for (let k = 0; k < linha.length; k++) {
          const u0 = recuo + k * .096 + .01, u1 = u0 + .082, cor = acesas[linha[k]];
          const a = p(u0, v1), b = p(u1, v1), alt = p.passo(u0, v1, .09) * .22;
          c.fillStyle = cor ? cor : '#1b1430'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] + alt); c.lineTo(a[0], a[1] + alt); c.fill();
          if (cor) { c.save(); c.shadowColor = cor; c.shadowBlur = 14; }
          c.fillStyle = cor ? linear(c, 0, p(u0, v0)[1], 0, a[1], ['#fff', cor]) : linear(c, 0, p(u0, v0)[1], 0, a[1], ['#3a2f58', '#251c3c']);
          quad(c, p, u0, v0, u1, v1); c.fill();
          if (cor) c.restore();
          const [tx, ty] = p((u0 + u1) / 2, (v0 + v1) / 2), fs = p.passo((u0 + u1) / 2, (v0 + v1) / 2, .08) * .42;
          c.fillStyle = cor ? '#1a0633' : 'rgba(220,210,255,.7)'; c.font = '700 ' + fs.toFixed(1) + 'px ' + FONTE; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(linha[k], tx, ty);
        }
      });
      // frase digitada
      c.fillStyle = 'rgba(10,4,24,.75)'; cantoRedondo(c, 58, 22, 204, 40, 10); c.fill();
      c.strokeStyle = 'rgba(63,240,255,.55)'; c.lineWidth = 1; c.stroke();
      c.font = '700 15px ui-monospace, Consolas, monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
      c.fillStyle = '#7dffb0'; c.fillText('o vagalume', 72, 42);
      const w1 = c.measureText('o vagalume').width;
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillText(' voa alto', 72 + w1, 42);
      c.fillStyle = '#3ff0ff'; c.fillRect(72 + w1 + 1, 33, 2, 18);
      c.fillStyle = '#ff4fa8'; cantoRedondo(c, 214, 14, 56, 18, 9); c.fill();
      c.fillStyle = '#fff'; c.font = '800 10px ' + FONTE; c.textAlign = 'center'; c.fillText('112 ppm', 242, 23.5);
      vinheta(c);
    },
    cartas(c) {
      fundo(c, 160, 110, 260, ['#3b2a8c', '#1a1250', '#08051f']);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) { c.fillStyle = 'rgba(160,140,255,.05)'; c.beginPath(); c.moveTo(160, 120); c.arc(160, 120, 260, i * .63, i * .63 + .26); c.closePath(); c.fill(); }
      c.restore();
      c.fillStyle = radial(c, 160, 150, 10, 150, ['rgba(90,220,160,.35)', 'rgba(20,90,70,.0)']); c.beginPath(); c.ellipse(160, 150, 170, 56, 0, 0, Math.PI * 2); c.fill();
      carta(c, 54, 78, -.42, null, '');
      carta(c, 268, 70, .38, 'laranja', '+2');
      const mao = [['azul', '7'], ['rosa', '3'], ['lima', '9'], ['laranja', '5'], ['azul', '⇄']];
      mao.forEach(([cor, v], i) => {
        const ang = (i - 2) * .26, x = 160 + Math.sin(ang) * 118, y = 206 - Math.cos(ang) * 118;
        carta(c, x, y, ang, cor, v);
      });
      for (let i = 0; i < 14; i++) { const x = (i * 71) % 320, y = 10 + (i * 37) % 70; brilhoDeLuz(c, x, y, 5 + (i % 3) * 2, 'rgba(214,242,74,.5)'); }
      vinheta(c);
    },
    pistas(c) {
      fundo(c, 150, 40, 280, ['#2a4046', '#121c1f', '#060a0b']);
      brilhoDeLuz(c, 150, 30, 150, 'rgba(255,240,200,.2)');
      const p = plano([[58, 36], [262, 36], [350, 196], [-30, 196]]);
      const palavras = ['LUA', 'FOGO', 'MAPA', 'REI', 'PONTE', 'ONDA', 'CHAVE', 'SOL', 'TREM', 'OLHO', 'GELO', 'NAVE', 'PIANO', 'RODA', 'CAMPO', 'LAGO', 'VENTO', 'ILHA', 'NEVE', 'TORRE'];
      const cores = { 1: 'lima', 6: 'rosa', 8: 'lima', 12: 'bomba', 13: 'rosa', 17: 'lima' };
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
        const i = r * 5 + k, u0 = k * .2 + .015, u1 = u0 + .17, v0 = r * .25 + .02, v1 = v0 + .2, tipo = cores[i];
        const a = p(u0, v1), b = p(u1, v1), alt = p.passo(u0, v1, .2) * .05;
        c.fillStyle = 'rgba(0,0,0,.35)'; quad(c, p, u0 + .01, v0 + .02, u1 + .01, v1 + .02); c.fill();
        c.fillStyle = tipo === 'bomba' ? '#060607' : '#a7967a'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] + alt); c.lineTo(a[0], a[1] + alt); c.fill();
        const topo = tipo === 'lima' ? ['#c6ec5c', '#8fc823'] : tipo === 'rosa' ? ['#ff8fb4', '#e8457f'] : tipo === 'bomba' ? ['#2a2a30', '#141418'] : ['#f6ecd6', '#e3d3b2'];
        c.fillStyle = linear(c, 0, p(u0, v0)[1], 0, a[1], topo); quad(c, p, u0, v0, u1, v1); c.fill();
        const [tx, ty] = p((u0 + u1) / 2, (v0 + v1) / 2), fs = p.passo((u0 + u1) / 2, (v0 + v1) / 2, .17) * .2;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        if (tipo === 'bomba') { c.fillStyle = '#ff4040'; c.font = '900 ' + (fs * 1.5).toFixed(1) + 'px ' + FONTE; c.fillText('✸', tx, ty); }
        else { c.fillStyle = tipo ? 'rgba(20,20,20,.85)' : '#3b3326'; c.font = '800 ' + fs.toFixed(1) + "px 'Courier New', monospace"; c.fillText(palavras[i], tx, ty); }
      }
      // lupa
      c.save(); c.translate(256, 112); c.rotate(-.7);
      sombra(c, 14, 46, 30, 9, .45, 5);
      c.fillStyle = linear(c, -6, 0, 6, 0, ['#3a2410', '#8a5a2c', '#2e1c0c']); cantoRedondo(c, -6, 32, 12, 52, 5); c.fill();
      c.fillStyle = '#c9a24a'; c.fillRect(-7, 28, 14, 8);
      c.lineWidth = 6; c.strokeStyle = linear(c, -30, -30, 30, 30, ['#f3d27a', '#a07818', '#6a4c08']); c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.stroke();
      c.fillStyle = radial(c, -10, -12, 2, 32, ['rgba(255,255,255,.4)', 'rgba(180,230,255,.12)', 'rgba(120,180,220,.2)'], 0, 0); c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-11, -12, 9, 4.5, -.7, 0, Math.PI * 2); c.fill();
      c.restore();
      vinheta(c);
    },
    ludo(c) {
      fundo(c, 160, 40, 280, ['#5fb4ff', '#2a7fd6', '#0e3c7d']);
      const p = plano([[100, 20], [220, 20], [300, 172], [20, 172]]);
      c.fillStyle = 'rgba(0,0,0,.25)'; quad(c, p, .02, .03, 1.03, 1.05); c.fill();
      quad(c, p, -.02, -.02, 1.02, 1.02, '#d8dbe4');
      quad(c, p, 0, 0, 1, 1, '#fbfbfd');
      const n = 15, cel = (x, y, cor) => quad(c, p, x / n, y / n, (x + 1) / n, (y + 1) / n, cor);
      const bases = [[0, 0, '#e5423b'], [9, 0, '#2fb35a'], [9, 9, '#f7c32a'], [0, 9, '#2f7de1']];
      for (const [bx, by, cor] of bases) {
        quad(c, p, bx / n, by / n, (bx + 6) / n, (by + 6) / n, cor);
        quad(c, p, (bx + 1) / n, (by + 1) / n, (bx + 5) / n, (by + 5) / n, '#fbfbfd');
      }
      for (let i = 1; i < 6; i++) { cel(i, 7, '#e5423b'); cel(7, i, '#2fb35a'); cel(14 - i, 7, '#f7c32a'); cel(7, 14 - i, '#2f7de1'); }
      cel(1, 6, '#e5423b'); cel(8, 1, '#2fb35a'); cel(13, 8, '#f7c32a'); cel(6, 13, '#2f7de1');
      c.strokeStyle = 'rgba(30,40,60,.25)'; c.lineWidth = .6;
      for (let i = 0; i <= n; i++) {
        if (i >= 6 && i <= 9) { let a = p(i / n, 0), b = p(i / n, 1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); a = p(0, i / n); b = p(1, i / n); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
        else { for (const [a, b] of [[p(i / n, 6 / n), p(i / n, 9 / n)], [p(6 / n, i / n), p(9 / n, i / n)]]) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } }
      }
      const centro = p(.5, .5), tri = [[6, 6, 9, 6, '#2fb35a'], [9, 6, 9, 9, '#f7c32a'], [9, 9, 6, 9, '#2f7de1'], [6, 9, 6, 6, '#e5423b']];
      for (const [a1, b1, a2, b2, cor] of tri) { const q1 = p(a1 / n, b1 / n), q2 = p(a2 / n, b2 / n); c.fillStyle = cor; c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.lineTo(centro[0], centro[1]); c.fill(); }
      const peao = (x, y, cor) => {
        const [px, py] = p((x + .5) / n, (y + .7) / n), s = p.passo((x + .5) / n, (y + .5) / n, 1 / n) * 1.05;
        sombra(c, px + s * .2, py, s * .42, s * .14, .4, 2);
        c.fillStyle = linear(c, px - s * .35, 0, px + s * .35, 0, ['#fff', cor, 'rgba(0,0,0,.6)']);
        c.beginPath(); c.moveTo(px - s * .34, py); c.lineTo(px - s * .12, py - s * .62); c.lineTo(px + s * .12, py - s * .62); c.lineTo(px + s * .34, py); c.ellipse(px, py, s * .34, s * .12, 0, 0, Math.PI); c.fill();
        c.fillStyle = cor; c.fillRect(px - s * .34, py - s * .02, s * .68, s * .04);
        c.fillStyle = radial(c, px - s * .08, py - s * .82, s * .02, s * .24, ['#fff', cor, 'rgba(0,0,0,.55)'], px, py - s * .74); c.beginPath(); c.arc(px, py - s * .74, s * .2, 0, Math.PI * 2); c.fill();
      };
      peao(2, 2, '#e5423b'); peao(11, 3, '#2fb35a'); peao(3, 6, '#e5423b'); peao(8, 4, '#2fb35a'); peao(6, 10, '#2f7de1'); peao(12, 11, '#f7c32a'); peao(10, 8, '#f7c32a');
      // dado
      const dx = 276, dy = 128, s = 22;
      sombra(c, dx + 6, dy + s * 1.1, s * 1.3, s * .4, .45, 4);
      const topo = [[dx, dy - s], [dx + s, dy - s * .5], [dx, dy], [dx - s, dy - s * .5]];
      const esq = [[dx - s, dy - s * .5], [dx, dy], [dx, dy + s], [dx - s, dy + s * .5]];
      const dir = [[dx, dy], [dx + s, dy - s * .5], [dx + s, dy + s * .5], [dx, dy + s]];
      const face = (pts, cor) => { c.fillStyle = cor; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = .8; c.stroke(); };
      face(esq, '#d9dce6'); face(dir, '#b9bdcb'); face(topo, '#ffffff');
      const ponto = (pts, u, v, cor) => { const [a, b, , d] = pts, x = a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, y = a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v; c.fillStyle = cor; c.beginPath(); c.ellipse(x, y, s * .11, s * .07, 0, 0, Math.PI * 2); c.fill(); };
      ponto(topo, .5, .5, '#e5423b');
      [[.25, .25], [.75, .75], [.25, .75], [.75, .25]].forEach(([u, v]) => ponto(esq, u, v, '#22252e'));
      [[.25, .25], [.5, .5], [.75, .75]].forEach(([u, v]) => ponto(dir, u, v, '#22252e'));
      vinheta(c);
    },
    sinuca(c) {
      fundo(c, 160, 10, 300, ['#3c3220', '#15130d', '#060605']);
      brilhoDeLuz(c, 160, 40, 170, 'rgba(255,220,150,.25)');
      const borda = plano([[34, 44], [286, 44], [372, 214], [-52, 214]]);
      c.fillStyle = linear(c, 0, 44, 0, 180, ['#6b3a22', '#3b1d0f']); quad(c, borda, 0, 0, 1, 1); c.fill();
      c.fillStyle = 'rgba(255,230,190,.18)'; quad(c, borda, 0, 0, 1, .02); c.fill();
      const p = plano([[52, 56], [268, 56], [342, 214], [-22, 214]]);
      c.fillStyle = radial(c, 160, 110, 10, 190, ['#2f9a5f', '#1b6f42', '#0d4027']); quad(c, p, 0, 0, 1, 1); c.fill();
      c.fillStyle = 'rgba(0,0,0,.25)'; quad(c, p, 0, 0, 1, .04); c.fill(); // almofada de trás
      for (const [u, v] of [[0, 0], [1, 0], [0, .62], [1, .62]]) { const [x, y] = p(u, v), r = p.passo(u, v, .05); c.fillStyle = '#050505'; c.beginPath(); c.ellipse(x, y, r * .9, r * .45, 0, 0, Math.PI * 2); c.fill(); }
      for (let i = 1; i < 4; i++) { const [x, y] = borda(i / 4, .012); c.fillStyle = '#f0e2c0'; c.beginPath(); c.ellipse(x, y, 2.2, 1.2, 0, 0, Math.PI * 2); c.fill(); }
      const triangulo = [1, 9, 2, 10, 8, 3, 11, 7, 14, 4, 5, 13, 15, 6, 12], lista = [];
      let k = 0;
      for (let fila = 0; fila < 5; fila++) for (let j = 0; j <= fila; j++) lista.push({ u: .6 + (j - fila / 2) * .058, v: .5 - fila * .058, n: triangulo[k++] });
      lista.push({ u: .3, v: .74, n: 0 });
      lista.sort((a, b) => a.v - b.v).forEach((b) => { const [x, y] = p(b.u, b.v); bola(c, x, y - p.passo(b.u, b.v, .058) * .45, p.passo(b.u, b.v, .058) * .47, b.n); });
      // taco
      const [bx, by] = p(.3, .74), r = p.passo(.3, .74, .058) * .47;
      const ang = Math.PI - .5; c.save(); c.translate(bx + Math.cos(ang) * r * 1.4, by + Math.sin(ang) * r * 1.4); c.rotate(ang);
      sombra(c, 90, 24, 100, 6, .4, 4);
      c.fillStyle = linear(c, 0, -4, 0, 4, ['#f6d6a0', '#c48a48', '#7a4a1c']);
      c.beginPath(); c.moveTo(4, -2); c.lineTo(230, -6.5); c.lineTo(230, 6.5); c.lineTo(4, 2); c.closePath(); c.fill();
      c.fillStyle = '#1a1a1a'; c.beginPath(); c.moveTo(130, -4.3); c.lineTo(230, -6.5); c.lineTo(230, 6.5); c.lineTo(130, 4.3); c.closePath(); c.fill();
      c.fillStyle = '#f4f1e8'; c.fillRect(4, -2.2, 7, 4.4);
      c.fillStyle = '#3b7bd6'; c.fillRect(0, -2, 4, 4);
      c.restore();
      vinheta(c);
    },
  };

  // Endereço data: da capa (largura em px de tela; a altura segue 16:9).
  function url(id, largura) {
    const cena = CENAS[id];
    if (!cena || typeof document === 'undefined') return '';
    const l = Math.round(largura || BASE_L), chave = id + ':' + l;
    if (cache[chave]) return cache[chave];
    try {
      const tela = document.createElement('canvas'), escala = Math.min(2, (globalThis.devicePixelRatio || 1) * 1.25);
      tela.width = Math.round(l * escala); tela.height = Math.round(l * 9 / 16 * escala);
      const c = tela.getContext && tela.getContext('2d');
      if (!c) return '';
      c.scale(tela.width / BASE_L, tela.height / BASE_A);
      cena(c);
      return (cache[chave] = tela.toDataURL('image/webp', .9));
    } catch (e) {
      console.error('[Vagalume] capa de ' + id + ':', e);
      return '';
    }
  }

  VL.capasJogos = { url, cenas: Object.keys(CENAS), plano };
})();
