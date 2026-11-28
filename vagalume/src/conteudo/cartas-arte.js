// Vagalume — ZERA!: desenhos em pixel art feitos em canvas (cartas, mesa de feltro, cadeiras e a sala), no
// estilo dos quartos isométricos do hotel (ladrilho de 64 × 32, linhas em degrau de 2 para 1). Nenhuma imagem
// externa: tudo é desenhado aqui, pixel a pixel, e guardado.
(function (raiz) {
  'use strict';
  const VL = (raiz.VL = raiz.VL || {});
  const CW = 26, CH = 36; // tamanho da carta em pixels de arte
  const COR = {
    vermelho: { base: '#e2392b', claro: '#ff8f74', escuro: '#981a12', painel: '#bb261b', nome: 'Vermelho' },
    amarelo: { base: '#f3bf17', claro: '#ffe98c', escuro: '#a27300', painel: '#d29a00', nome: 'Amarelo' },
    verde: { base: '#38a637', claro: '#8fe06e', escuro: '#1a671f', painel: '#26882a', nome: 'Verde' },
    azul: { base: '#2a72dc', claro: '#86b8ff', escuro: '#163d8a', painel: '#2059b9', nome: 'Azul' },
    coringa: { base: '#2b2b38', claro: '#62627a', escuro: '#0f0f15', painel: '#1b1b26' },
  };
  const ORDEM_CORES = ['vermelho', 'amarelo', 'verde', 'azul'];
  const PRETO = '#121212';

  function tela(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  }
  const ret = (x, X, Y, w, h, cor) => { x.fillStyle = cor; x.fillRect(X, Y, w, h); };

  // ---------- fontes e ícones em pixel ('#' = pixel aceso) ----------
  const G = { // números grandes, traço de 2 px
    '0': ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
    '1': ['.##..', '###..', '.##..', '.##..', '.##..', '.##..', '####.'],
    '2': ['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####'],
    '3': ['####.', '...##', '...##', '.###.', '...##', '...##', '####.'],
    '4': ['##.##', '##.##', '##.##', '#####', '...##', '...##', '...##'],
    '5': ['#####', '##...', '####.', '...##', '...##', '##.##', '.###.'],
    '6': ['.###.', '##...', '##...', '####.', '##.##', '##.##', '.###.'],
    '7': ['#####', '...##', '...##', '..##.', '.##..', '.##..', '.##..'],
    '8': ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '.###.'],
    '9': ['.###.', '##.##', '##.##', '.####', '...##', '...##', '.###.'],
  };
  const P = { // 3 × 5
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'], 'Z': ['###', '..#', '.#.', '#..', '###'],
    'E': ['###', '#..', '##.', '#..', '###'], 'R': ['##.', '#.#', '##.', '#.#', '#.#'], 'A': ['.#.', '#.#', '###', '#.#', '#.#'], '!': ['#', '#', '#', '.', '#'],
  };
  // Círculo cortado (Pular): anel de 2 px com a barra na diagonal.
  function anelCortado(r) {
    const linhas = [];
    for (let j = 0; j <= 2 * r; j++) {
      let s = '';
      for (let i = 0; i <= 2 * r; i++) { const d = Math.hypot(i - r, j - r); s += (d <= r + 0.3 && d >= r - 1.8) || (Math.abs(i - j) <= 1 && d < r) ? '#' : '.'; }
      linhas.push(s);
    }
    return linhas;
  }
  // Duas setas, uma para cada lado (Inverter).
  function setas() {
    const w = 12, cima = [], baixo = [];
    for (let j = 0; j < 6; j++) {
      let a = '', b = '';
      for (let i = 0; i < w; i++) {
        const k = i - 7; // ponta da seta de cima à direita
        const sobe = (j === 2 || j === 3) && i >= 1 && i <= 7 || (k >= 0 && k <= 2 && j >= k && j <= 5 - k);
        const m = (w - 1 - i) - 7; // a de baixo, espelhada
        const desce = (j === 2 || j === 3) && i >= 4 && i <= 10 || (m >= 0 && m <= 2 && j >= m && j <= 5 - m);
        a += sobe ? '#' : '.'; b += desce ? '#' : '.';
      }
      cima.push(a); baixo.push(b);
    }
    return cima.concat(['.'.repeat(w)], baixo);
  }
  const ICONE = {
    pular: anelCortado(6), inverter: setas(),
    pularP: ['.###.', '#..##', '#.#.#', '##..#', '.###.'], inverterP: ['...#.', '#####', '.....', '#####', '.#...'],
  };
  // Desenha um glifo: sombra de 1 px embaixo, contorno de 1 px e o miolo.
  function glifo(x, g, X, Y, esc, cor, contorno, sombra) {
    const pts = [];
    g.forEach((l, j) => { for (let i = 0; i < l.length; i++) if (l[i] === '#') pts.push([i, j]); });
    if (sombra) { x.fillStyle = sombra; for (const [i, j] of pts) x.fillRect(X + i * esc - 1, Y + j * esc, esc + 2, esc + 2); }
    if (contorno) { x.fillStyle = contorno; for (const [i, j] of pts) x.fillRect(X + i * esc - 1, Y + j * esc - 1, esc + 2, esc + 2); }
    x.fillStyle = cor;
    for (const [i, j] of pts) x.fillRect(X + i * esc, Y + j * esc, esc, esc);
  }
  function texto(x, s, X, Y, cor, contorno) {
    let cx = X;
    for (const ch of s) { const g = P[ch]; if (!g) { cx += 2; continue; } glifo(x, g, cx, Y, 1, cor, contorno); cx += g[0].length + 1; }
  }
  const larguraTexto = (s) => [...s].reduce((t, ch) => t + (P[ch] ? P[ch][0].length + 1 : 2), -1);

  // ---------- cartas ----------
  // Moldura: contorno escuro com cantos cortados, relevo claro em cima e escuro embaixo.
  function moldura(x, k) {
    ret(x, 2, 0, CW - 4, CH, PRETO); ret(x, 0, 2, CW, CH - 4, PRETO); ret(x, 1, 1, CW - 2, CH - 2, PRETO);
    ret(x, 2, 1, CW - 4, CH - 2, k.base); ret(x, 1, 2, CW - 2, CH - 4, k.base);
    ret(x, 2, 1, CW - 4, 1, k.claro); ret(x, 1, 2, 1, CH - 4, k.claro);
    ret(x, 2, CH - 2, CW - 4, 1, k.escuro); ret(x, CW - 2, 2, 1, CH - 4, k.escuro);
  }
  // Painel afundado no meio (o símbolo fica em cima dele).
  function painel(x, k, cor) {
    const X0 = 4, Y0 = 7, X1 = CW - 5, Y1 = CH - 8;
    ret(x, X0 + 1, Y0, X1 - X0 - 1, Y1 - Y0 + 1, cor || k.painel); ret(x, X0, Y0 + 1, X1 - X0 + 1, Y1 - Y0 - 1, cor || k.painel);
    ret(x, X0 + 1, Y0, X1 - X0 - 1, 1, k.escuro); ret(x, X0, Y0 + 1, 1, Y1 - Y0 - 1, k.escuro);
    ret(x, X0 + 1, Y1, X1 - X0 - 1, 1, k.claro); ret(x, X1, Y0 + 1, 1, Y1 - Y0 - 1, k.claro);
    x.fillStyle = 'rgba(255,255,255,.09)';
    for (let yy = Y0 + 2; yy < Y1; yy++) for (let xx = X0 + 2; xx < X1; xx++) if ((xx * 3 + yy) % 7 === 0) x.fillRect(xx, yy, 1, 1);
  }
  // Círculo de quatro cores dos coringas (centro cx, cy; raio r), com borda branca e brilho.
  function roda(x, cx, cy, r) {
    const cores = [COR.amarelo.base, COR.vermelho.base, COR.verde.base, COR.azul.base];
    for (let yy = -r - 1; yy <= r; yy++) {
      for (let xx = -r - 1; xx <= r; xx++) {
        const d = Math.hypot(xx + 0.5, yy + 0.5);
        if (d > r + 0.9) continue;
        if (d > r - 0.6) { ret(x, cx + xx, cy + yy, 1, 1, d > r + 0.2 ? PRETO : '#ffffff'); continue; }
        ret(x, cx + xx, cy + yy, 1, 1, cores[(xx >= 0 ? 0 : 1) + (yy >= 0 ? 2 : 0)]);
      }
    }
    ret(x, cx - 3, cy - 4, 2, 1, 'rgba(255,255,255,.8)'); ret(x, cx - 4, cy - 3, 1, 1, 'rgba(255,255,255,.8)');
  }
  // Índice do canto (de cima) num quadradinho transparente; o de baixo é o mesmo girado meia volta.
  function indice(c, k) {
    const [t, x] = tela(10, 8);
    const X = 1, Y = 1;
    if (/^\d$/.test(c.valor)) glifo(x, P[c.valor], X, Y, 1, '#ffffff', k.escuro);
    else if (c.valor === 'pular') glifo(x, ICONE.pularP, X, Y, 1, '#ffffff', k.escuro);
    else if (c.valor === 'inverter') glifo(x, ICONE.inverterP, X, Y, 1, '#ffffff', k.escuro);
    else if (c.valor === '+2' || c.valor === '+4') { glifo(x, P['+'], X, Y, 1, '#ffffff', k.escuro); glifo(x, P[c.valor[1]], X + 4, Y, 1, '#ffffff', k.escuro); }
    else { ret(x, X, Y, 2, 2, COR.vermelho.base); ret(x, X + 2, Y, 2, 2, COR.amarelo.base); ret(x, X, Y + 2, 2, 2, COR.azul.base); ret(x, X + 2, Y + 2, 2, 2, COR.verde.base); }
    return t;
  }
  function face(c, corEscolhida) {
    const [cv, x] = tela(CW, CH);
    const k = COR[c.cor || 'coringa'];
    moldura(x, k);
    painel(x, k, !c.cor && corEscolhida && COR[corEscolhida] ? COR[corEscolhida].painel : null);
    const meioX = CW / 2, meioY = 7 + (CH - 15) / 2;
    if (/^\d$/.test(c.valor)) {
      glifo(x, G[c.valor], Math.round(meioX - 5), Math.round(meioY - 7), 2, '#ffffff', PRETO, k.escuro);
    } else if (c.valor === 'pular' || c.valor === 'inverter') {
      const g = ICONE[c.valor];
      glifo(x, g, Math.round(meioX - g[0].length / 2), Math.round(meioY - g.length / 2), 1, '#ffffff', PRETO, k.escuro);
    } else if (c.valor === '+2') {
      // Duas cartinhas empilhadas e o +2 embaixo.
      ret(x, 8, 9, 7, 9, PRETO); ret(x, 9, 10, 5, 7, '#ffffff'); ret(x, 11, 11, 7, 9, PRETO); ret(x, 12, 12, 5, 7, '#ffffff');
      glifo(x, P['+'], 7, 22, 1, '#ffffff', PRETO, k.escuro); glifo(x, G['2'], 12, 21, 1, '#ffffff', PRETO, k.escuro);
    } else if (c.valor === 'coringa') {
      roda(x, Math.round(meioX), Math.round(meioY), 7);
    } else if (c.valor === '+4') {
      [[6, 8], [9, 10], [12, 12], [15, 14]].forEach(([X, Y], i) => { ret(x, X, Y, 6, 8, PRETO); ret(x, X + 1, Y + 1, 4, 6, COR[ORDEM_CORES[i]].base); });
      glifo(x, P['+'], 7, 22, 1, '#ffffff', PRETO, k.escuro); glifo(x, G['4'], 12, 21, 1, '#ffffff', PRETO, k.escuro);
    }
    const ind = indice(c, k);
    x.drawImage(ind, 2, 1);
    x.save(); x.translate(CW - 2, CH - 1); x.rotate(Math.PI); x.drawImage(ind, 0, 0); x.restore();
    return cv;
  }
  function verso() {
    const [cv, x] = tela(CW, CH);
    moldura(x, { base: '#2e2152', claro: '#6650aa', escuro: '#160e2c' });
    x.fillStyle = '#3b2b69';
    for (let yy = 2; yy < CH - 2; yy++) for (let xx = 2; xx < CW - 2; xx++) if ((xx + yy) % 5 === 0) x.fillRect(xx, yy, 1, 1);
    // Faixa vermelha com o nome do jogo e as quatro cores nos cantos.
    const fy = 13;
    ret(x, 2, fy, CW - 4, 11, PRETO); ret(x, 3, fy + 1, CW - 6, 9, '#d8342a'); ret(x, 3, fy + 1, CW - 6, 1, '#ff7a5c'); ret(x, 3, fy + 9, CW - 6, 1, '#8c160f');
    texto(x, 'ZERA!', Math.round(CW / 2 - larguraTexto('ZERA!') / 2), fy + 3, '#ffe25a', PRETO);
    ORDEM_CORES.forEach((n, i) => ret(x, i % 2 ? CW - 7 : 4, i < 2 ? 5 : CH - 8, 3, 3, COR[n].base));
    return cv;
  }
  const cache = new Map(), urls = new Map();
  const chave = (c, cor) => (c ? (c.cor || 'x') + ':' + c.valor + ':' + (c.cor ? '' : cor || '') : 'verso');
  function carta(c, corEscolhida) {
    const k = chave(c, corEscolhida);
    if (!cache.has(k)) cache.set(k, c ? face(c, corEscolhida) : verso());
    return cache.get(k);
  }
  function url(c, corEscolhida) {
    const k = chave(c, corEscolhida);
    if (!urls.has(k)) urls.set(k, carta(c, corEscolhida).toDataURL('image/png'));
    return urls.get(k);
  }

  // ---------- isométrico ----------
  const isoDe = (ox, oy) => (x, y, z) => [ox + (x - y) * 32, oy + (x + y) * 16 - (z || 0)];
  // Preenche um polígono convexo pelos centros dos pixels (bordas em degrau, sem suavizar).
  function poli(x, pts, cor) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    x.fillStyle = cor;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      const yc = y + 0.5;
      let a = Infinity, b = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        if ((p[1] <= yc && q[1] > yc) || (q[1] <= yc && p[1] > yc)) {
          const xx = p[0] + (yc - p[1]) * (q[0] - p[0]) / (q[1] - p[1]);
          a = Math.min(a, xx); b = Math.max(b, xx);
        }
      }
      if (b > a) { const xa = Math.round(a), xb = Math.round(b); if (xb > xa) x.fillRect(xa, y, xb - xa, 1); }
    }
  }
  function linha(x, p, q, cor) {
    let x0 = Math.round(p[0]), y0 = Math.round(p[1]);
    const x1 = Math.round(q[0]), y1 = Math.round(q[1]);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    x.fillStyle = cor;
    for (let k = 0; k < 4000; k++) {
      x.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // Caixa isométrica (de x0,y0 a x1,y1, de z0 a z1): as duas faces da frente e o tampo.
  function caixa(x, I, x0, y0, x1, y1, z0, z1, cores) {
    poli(x, [I(x0, y1, z1), I(x1, y1, z1), I(x1, y1, z0), I(x0, y1, z0)], cores.esq);
    poli(x, [I(x1, y0, z1), I(x1, y1, z1), I(x1, y1, z0), I(x1, y0, z0)], cores.dir);
    poli(x, [I(x0, y0, z1), I(x1, y0, z1), I(x1, y1, z1), I(x0, y1, z1)], cores.topo);
    if (cores.linha) {
      linha(x, I(x0, y1, z1), I(x1, y1, z1), cores.linha); linha(x, I(x1, y0, z1), I(x1, y1, z1), cores.linha);
      linha(x, I(x1, y1, z1), I(x1, y1, z0), cores.linha);
    }
  }

  // ---------- sala (chão de tacos, paredes, tapete) ----------
  const A = -2, B = 8; // o quarto vai de -2 a 8 nos dois eixos; a mesa fica em 0..3
  function sala(Wc, Hc, OX, OY) {
    const [cv, x] = tela(Wc, Hc);
    const I = isoDe(OX, OY), ALT = 160;
    ret(x, 0, 0, Wc, Hc, '#07080c');
    const esq = (a, h) => I(A, a, h), dir = (a, h) => I(a, A, h);
    const parede = (Pt, a0, a1, h0, h1, cor) => poli(x, [Pt(a0, h1), Pt(a1, h1), Pt(a1, h0), Pt(a0, h0)], cor);
    // Papel de parede com listras finas e rodapé de madeira.
    parede(esq, A, B, 0, ALT, '#5a7a9c'); parede(dir, A, B, 0, ALT, '#48657f');
    for (let k = A + 0.25; k < B; k += 0.5) { linha(x, esq(k, 36), esq(k, ALT), '#6687a9'); linha(x, dir(k, 36), dir(k, ALT), '#536f8b'); }
    parede(esq, A, B, 0, 34, '#6b4428'); parede(dir, A, B, 0, 34, '#5a381f');
    linha(x, esq(A, 34), esq(B, 34), '#9b6a3e'); linha(x, dir(A, 34), dir(B, 34), '#87592f');
    linha(x, esq(A, 35), esq(B, 35), '#2e1c0e'); linha(x, dir(A, 35), dir(B, 35), '#2e1c0e');
    // Um quadro na parede da esquerda e uma janela com a noite na da direita.
    parede(esq, 2.0, 3.2, 64, 100, '#c79a3a'); parede(esq, 2.1, 3.1, 68, 96, '#2d5b3a');
    const [qx, qy] = esq(2.6, 82);
    ret(x, Math.round(qx) - 7, Math.round(qy) - 6, 6, 9, '#f3f3f3'); ret(x, Math.round(qx) - 6, Math.round(qy) - 5, 4, 7, COR.vermelho.base);
    ret(x, Math.round(qx) + 1, Math.round(qy) - 4, 6, 9, '#f3f3f3'); ret(x, Math.round(qx) + 2, Math.round(qy) - 3, 4, 7, COR.azul.base);
    parede(dir, 3.0, 4.4, 56, 104, '#e8e2d0'); parede(dir, 3.1, 4.3, 60, 100, '#101a3a');
    const [lx, ly] = dir(4.0, 92);
    ret(x, Math.round(lx), Math.round(ly), 4, 4, '#fff3b0'); ret(x, Math.round(lx) + 1, Math.round(ly) - 1, 2, 1, '#fff3b0');
    for (let s = 0; s < 7; s++) { const [sx, sy] = dir(3.2 + s * 0.15, 64 + ((s * 11) % 32)); ret(x, Math.round(sx), Math.round(sy), 1, 1, '#ffffff'); }
    linha(x, dir(3.7, 100), dir(3.7, 60), '#e8e2d0'); linha(x, dir(3.1, 80), dir(4.3, 80), '#e8e2d0');
    // Chão de tacos (xadrez suave) com rejunte.
    poli(x, [I(A, A, 0), I(B, A, 0), I(B, B, 0), I(A, B, 0)], '#9d7650');
    for (let yy = A; yy < B; yy++) for (let xx = A; xx < B; xx++) if (((xx + yy) % 2 + 2) % 2 === 0) poli(x, [I(xx + 0.05, yy + 0.05, 0), I(xx + 0.95, yy + 0.05, 0), I(xx + 0.95, yy + 0.95, 0), I(xx + 0.05, yy + 0.95, 0)], '#a68058');
    for (let k = A; k <= B; k++) { linha(x, I(A, k, 0), I(B, k, 0), '#86613d'); linha(x, I(k, A, 0), I(k, B, 0), '#86613d'); }
    // Tapete vermelho com barra dourada debaixo da mesa e das cadeiras.
    const t0 = -1.6, t1 = 4.6, tap = (m, cor) => poli(x, [I(t0 + m, t0 + m, 0), I(t1 - m, t0 + m, 0), I(t1 - m, t1 - m, 0), I(t0 + m, t1 - m, 0)], cor);
    tap(0, '#d1a03c'); tap(0.15, '#8a2424'); tap(0.42, '#d1a03c'); tap(0.5, '#a32d2d');
    for (let k = t0 + 0.8; k < t1 - 0.6; k += 0.6) linha(x, I(t0 + 0.5, k, 0), I(t1 - 0.5, k, 0), '#972929');
    linha(x, I(A, A, 0), I(A, B, 0), '#2a1a0c'); linha(x, I(A, A, 0), I(B, A, 0), '#2a1a0c');
    return cv;
  }

  // ---------- mesa de jogo (3 × 3 ladrilhos, tampo a 28 px) ----------
  const ALTURA_MESA = 28;
  const MADEIRA = { topo: '#b4773f', esq: '#7a4a22', dir: '#93602f', linha: '#3a220e' };
  function mesa(Wc, Hc, OX, OY) {
    const [cv, x] = tela(Wc, Hc);
    const I = isoDe(OX, OY), Z = ALTURA_MESA;
    for (const [px, py] of [[0.35, 2.65], [2.65, 2.65], [2.65, 0.35]]) caixa(x, I, px - 0.13, py - 0.13, px + 0.13, py + 0.13, 0, Z - 6, MADEIRA);
    caixa(x, I, -0.06, -0.06, 3.06, 3.06, Z - 6, Z, { topo: '#a46a36', esq: '#6a3f1c', dir: '#83552a' });
    linha(x, I(-0.06, 3.06, Z - 6), I(3.06, 3.06, Z - 6), MADEIRA.linha); linha(x, I(3.06, -0.06, Z - 6), I(3.06, 3.06, Z - 6), MADEIRA.linha);
    linha(x, I(-0.06, 3.06, Z), I(3.06, 3.06, Z), '#c58a4f'); linha(x, I(3.06, -0.06, Z), I(3.06, 3.06, Z), '#b27a43');
    const losango = (m, cor) => poli(x, [I(m, m, Z), I(3 - m, m, Z), I(3 - m, 3 - m, Z), I(m, 3 - m, Z)], cor);
    losango(0.18, '#d8ad4e'); losango(0.24, '#24774a'); losango(0.3, '#2b8a55'); losango(0.95, '#2f935b');
    linha(x, I(0.3, 0.3, Z), I(2.7, 0.3, Z), '#1f6640'); linha(x, I(0.3, 0.3, Z), I(0.3, 2.7, Z), '#1f6640');
    // Textura do feltro: pontinhos só dentro do feltro.
    x.fillStyle = 'rgba(255,255,255,.06)';
    for (let py = 0; py < Hc; py++) {
      for (let px = (py % 4 === 0 ? 0 : 2); px < Wc; px += 4) {
        if (py % 2) continue;
        const u = (px + 0.5 - OX) / 32, v = (py + 0.5 - OY + Z) / 16;
        const tx = (u + v) / 2, ty = (v - u) / 2;
        if (tx > 0.32 && tx < 2.68 && ty > 0.32 && ty < 2.68) x.fillRect(px, py, 1, 1);
      }
    }
    return cv;
  }

  // ---------- cadeira (estofado vermelho, encosto do lado de trás) ----------
  // lado 'L': a pessoa olha para +x (encosto em x pequeno); 'R': olha para +y (encosto em y pequeno);
  // 'F': a sua cadeira, de costas para a câmera (olha para -y; o encosto fica na frente e vai em `frente`).
  function cadeira(lado) {
    const Wc = 72, Hc = 76, OX = 36, OY = 56;
    const [cv, x] = tela(Wc, Hc);
    const I = isoDe(OX, OY - 16); // o centro do ladrilho fica em (OX, OY)
    const a = 0.2, b = 0.8, S = 15;
    const madeira = { topo: '#9c6431', esq: '#64391a', dir: '#7d4c24', linha: '#2e1a0a' };
    const pe = (px, py) => caixa(x, I, px - 0.05, py - 0.05, px + 0.05, py + 0.05, 0, S - 3, madeira);
    pe(a + 0.05, a + 0.05);
    if (lado === 'L') {
      caixa(x, I, a, a, a + 0.1, b, S, 44, madeira);
      poli(x, [I(a + 0.1, a + 0.12, 41), I(a + 0.1, b - 0.12, 41), I(a + 0.1, b - 0.12, S + 6), I(a + 0.1, a + 0.12, S + 6)], '#b5342a');
      linha(x, I(a + 0.1, a + 0.12, 41), I(a + 0.1, b - 0.12, 41), '#e0584a');
    } else if (lado === 'R') {
      caixa(x, I, a, a, b, a + 0.1, S, 44, madeira);
      poli(x, [I(a + 0.12, a + 0.1, 41), I(b - 0.12, a + 0.1, 41), I(b - 0.12, a + 0.1, S + 6), I(a + 0.12, a + 0.1, S + 6)], '#a52e25');
      linha(x, I(a + 0.12, a + 0.1, 41), I(b - 0.12, a + 0.1, 41), '#d4503f');
    }
    pe(a + 0.05, b - 0.05); pe(b - 0.05, b - 0.05); pe(b - 0.05, a + 0.05);
    caixa(x, I, a, a, b, b, S - 3, S, madeira);
    poli(x, [I(a + 0.04, a + 0.04, S + 2), I(b - 0.04, a + 0.04, S + 2), I(b - 0.04, b - 0.04, S + 2), I(a + 0.04, b - 0.04, S + 2)], '#c23a2e');
    linha(x, I(a + 0.04, a + 0.04, S + 2), I(b - 0.04, a + 0.04, S + 2), '#ee6a5a');
    let frente = null;
    if (lado === 'F') {
      const [cf, xf] = tela(Wc, Hc);
      caixa(xf, I, a, b - 0.1, b, b, S, 44, madeira);
      linha(xf, I(a + 0.06, b, 39), I(b - 0.06, b, 39), '#b07a45'); linha(xf, I(a + 0.06, b, 28), I(b - 0.06, b, 28), '#b07a45');
      frente = cf;
    }
    return { canvas: cv, frente, ox: OX, oy: OY };
  }

  // ---------- peças pequenas ----------
  // Carta deitada no tampo (losango) — monte e descarte.
  function deitada(x, I, cx, cy, z, cor, claro) {
    const w = 0.25, h = 0.35;
    poli(x, [I(cx - w, cy - h, z), I(cx + w, cy - h, z), I(cx + w, cy + h, z), I(cx - w, cy + h, z)], PRETO);
    poli(x, [I(cx - w + 0.05, cy - h + 0.06, z), I(cx + w - 0.05, cy - h + 0.06, z), I(cx + w - 0.05, cy + h - 0.06, z), I(cx - w + 0.05, cy + h - 0.06, z)], cor);
    if (claro) linha(x, I(cx - w + 0.05, cy - h + 0.06, z), I(cx + w - 0.05, cy - h + 0.06, z), claro);
  }
  // Leque de cartas viradas na mão de quem está na mesa.
  function leque(n) {
    const qtd = Math.max(0, Math.min(8, n));
    const [cv, x] = tela(40, 16);
    for (let i = 0; i < qtd; i++) {
      const X = 20 - Math.round((qtd - 1) * 1.6) + Math.round(i * 3.2) - 3, Y = 3 + Math.round(Math.abs(i - (qtd - 1) / 2) * 0.6);
      ret(x, X, Y, 7, 10, PRETO); ret(x, X + 1, Y + 1, 5, 8, '#2e2152'); ret(x, X + 1, Y + 1, 5, 1, '#6650aa'); ret(x, X + 2, Y + 4, 3, 2, '#d8342a');
    }
    return cv;
  }
  // Placa de "pulou" que aparece em cima da cabeça.
  function iconePular() {
    const [cv, x] = tela(17, 17);
    for (let yy = 0; yy < 17; yy++) {
      for (let xx = 0; xx < 17; xx++) {
        const d = Math.hypot(xx - 8, yy - 8);
        if (d <= 8.4 && d > 5.6) ret(x, xx, yy, 1, 1, d > 7.6 ? PRETO : '#ef3b2c');
        else if (d <= 5.6) ret(x, xx, yy, 1, 1, '#ffffff');
      }
    }
    for (let k = -4; k <= 4; k++) ret(x, 8 + k - 1, 8 + k - 1, 3, 3, '#ef3b2c');
    return cv;
  }

  // Coroa dourada do pódio (pixel a pixel, com contorno).
  let coroaUrl = null;
  function coroa() {
    if (coroaUrl) return coroaUrl;
    const mapa = ['.r.....b.....r.', '.y.....y.....y.', '.yy...yyy...yy.', '.yyy.yyyyy.yyy.', '.yyyyyyyyyyyyy.', '.yYyYyYyYyYyYy.', '.yyyyyyyyyyyyy.', '..ooooooooooo..'];
    const cor = { y: '#ffd23a', Y: '#e09a00', r: '#e2392b', b: '#2a72dc', o: '#9a6a00' };
    const [cv, x] = tela(17, 10);
    mapa.forEach((l, j) => { for (let i = 0; i < l.length; i++) if (l[i] !== '.') ret(x, i, j, 3, 3, PRETO); });
    mapa.forEach((l, j) => { for (let i = 0; i < l.length; i++) if (l[i] !== '.') ret(x, i + 1, j + 1, 1, 1, cor[l[i]]); });
    return (coroaUrl = cv.toDataURL('image/png'));
  }
  // Três cartas em escada (arte da sala de espera, do convite e da lista de jogos).
  let iconeUrl = null;
  function icone() {
    if (iconeUrl) return iconeUrl;
    const [cv, x] = tela(CW + 16, CH + 8);
    x.drawImage(carta(null), 0, 8); x.drawImage(carta({ cor: 'azul', valor: '+2' }), 8, 4); x.drawImage(carta({ cor: 'vermelho', valor: '7' }), 16, 0);
    return (iconeUrl = cv.toDataURL('image/png'));
  }

  VL.cartasArte = { CW, CH, COR, ORDEM_CORES, ALTURA_MESA, carta, url, icone, coroa, sala, mesa, cadeira, deitada, leque, iconePular, isoDe, poli, linha, tela, glifo, P };
})(typeof globalThis !== 'undefined' ? globalThis : this);
