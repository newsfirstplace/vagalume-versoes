// Vagalume — Ludo na mesa de jogos (regras em core/ludo.js).
// Tabuleiro clássico (bases coloridas com os ninhos, caminho branco, retas coloridas, estrelas e o centro em
// quatro triângulos) em pixel art no jeito do ZERA! (desenhado ponto a ponto e ampliado 2×), peões e dado em sprites
// e peões que pulam casa por casa. Cada lance vem numerado do
// anfitrião e a tela toca um de cada vez, na ordem.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.ludo || !VL.camada) return;
  const L = VL.ludo;
  const el = VL.camada.el;
  const COR = ['#a9d02a', '#2f86e6', '#e6508f', '#f08a24'];
  const NOME_COR = ['Lima', 'Azul', 'Rosa', 'Laranja'];
  const CANTO = [[0, 0], [0, 9], [9, 9], [9, 0]];        // base de cada cor (linha, coluna)
  const CHEGADA = [[7, 6], [6, 7], [7, 8], [8, 7]];      // triângulo do centro de cada cor
  const SETA = [0, 90, 180, 270];                         // sentido da casa de saída
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const FONTE = "Goldfish, Volter, 'Ubuntu', system-ui, sans-serif";
  const CSS = `
  .vl-ld { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 22px; align-items: start; font-family: ${FONTE}; }
  .vl-ld-tab { --c: 32px; position: relative; margin: 10px; width: calc(var(--c) * 15); height: calc(var(--c) * 15); background: #1d2733;
    box-shadow: 0 0 0 2px #000, 0 0 0 4px #c58a4f, 0 0 0 8px #a46a36, 0 0 0 10px #000, 0 12px 0 10px rgba(0,0,0,.35); }
  .vl-ld-fundo { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
  .vl-ld-nome-base { position: absolute; width: calc(var(--c) * 6); height: var(--c); display: grid; place-items: center; padding: 0 6px; box-sizing: border-box; overflow: hidden;
    font: 700 calc(var(--c) * .5)/1 ${FONTE}; color: #fff; white-space: nowrap; text-overflow: ellipsis; text-shadow: 2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000; pointer-events: none; }
  .vl-ld-peao { position: absolute; left: 0; top: 0; width: var(--c); height: var(--c); display: grid; place-items: end center; z-index: 3; pointer-events: none; border: 0; padding: 0; background: none; }
  .vl-ld-peao i { display: block; width: calc(var(--c) * .875); height: calc(var(--c) * 1.25); margin-bottom: calc(var(--c) * .06); pointer-events: none;
    background: var(--img) center bottom / 100% 100% no-repeat; image-rendering: pixelated; }
  .vl-ld-peao.pode { pointer-events: auto; cursor: pointer; z-index: 7; }
  .vl-ld-peao.pode i { animation: vl-ld-pula .36s steps(3) infinite alternate; filter: drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 0 6px #fff); }
  .vl-ld-peao:focus-visible { outline: 2px solid #ffcc00; outline-offset: -2px; }
  .vl-ld-lado { display: grid; gap: 12px; align-content: start; min-width: 0; }
  .vl-ld-jog { --cor: #888; display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 6px; border: 2px solid #000;
    background: linear-gradient(#34495e, #2a3b4c); box-shadow: inset 0 0 0 2px rgba(255,255,255,.07); }
  .vl-ld-jog.vez { background: linear-gradient(#3e5872, #30465b); box-shadow: inset 0 0 0 2px rgba(255,255,255,.1), 0 0 0 3px var(--cor), 0 0 14px color-mix(in srgb, var(--cor) 55%, transparent); }
  .vl-ld-jog .vl-jg-cabeca { width: 42px; height: 42px; border-radius: 6px; background: var(--cor); box-shadow: 0 0 0 2px #000, inset 0 0 0 2px rgba(255,255,255,.3); font-size: 18px; }
  .vl-ld-jog .vl-jg-cabeca img { image-rendering: pixelated; transform: translate(-50%, -54%) scale(.95); }
  .vl-ld-jog .quem { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .vl-ld-jog .quem b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 17px/1.1 ${FONTE}; color: #fff; }
  .vl-ld-jog .quem small { font: 15px/1 ${FONTE}; color: #ffe27a; }
  .vl-ld-casas { display: flex; gap: 5px; }
  .vl-ld-casas i { width: 9px; height: 9px; background: rgba(0,0,0,.4); box-shadow: 0 0 0 2px #000; }
  .vl-ld-casas i.ok { background: var(--cor); box-shadow: 0 0 0 2px #000, inset 0 2px 0 rgba(255,255,255,.45); }
  .vl-ld-dado-caixa { --cor: #ffcc00; position: relative; display: grid; justify-items: center; gap: 6px; padding: 14px 12px 12px; border-radius: 6px; border: 2px solid #000;
    background: linear-gradient(#2c3e50, #1f2d3a); box-shadow: inset 0 0 0 2px rgba(255,255,255,.06); transition: box-shadow .2s; }
  .vl-ld-dado-caixa.pode { cursor: pointer; box-shadow: inset 0 0 0 2px rgba(255,255,255,.06), 0 0 0 3px var(--cor), 0 0 18px color-mix(in srgb, var(--cor) 55%, transparent); }
  .vl-ld-dado-caixa small { font: 16px/1 ${FONTE}; color: #fff; text-shadow: 0 2px 0 #000; }
  .vl-ld-palco { width: 96px; height: 84px; display: grid; place-items: center; }
  .vl-ld-dado { width: 64px; height: 64px; background: var(--face) center / 100% 100% no-repeat; image-rendering: pixelated; }
  .vl-ld-sombra { width: 56px; height: 8px; margin-top: -10px; background: var(--sombra) center / 100% 100% no-repeat; image-rendering: pixelated; }
  .vl-ld-msg { text-align: center; min-height: 42px; font: 17px/1.3 ${FONTE}; color: #eef3f8; }
  .vl-ld-msg b { color: #ffcc00; font-weight: 700; }
  .vl-jg .vl-ld .vl-ld-rolar.vl-jg-botao.forte { width: 100%; font: 700 22px/1 ${FONTE}; padding: 11px 14px 12px; border: 2px solid #000; border-radius: 6px; background: linear-gradient(#fff07a, #f5b81c);
    color: #111; text-transform: none; letter-spacing: 0; box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), 0 3px 0 #000; }
  .vl-jg .vl-ld .vl-ld-rolar.vl-jg-botao.forte:active:not(:disabled) { transform: translateY(2px); box-shadow: inset 0 -1px 0 rgba(0,0,0,.18), 0 1px 0 #000; }
  .vl-ld-nota { margin: 0; color: #b9c8d8; font: 14px/1.25 ${FONTE}; text-align: center; }
  @keyframes vl-ld-pula { to { transform: translateY(-6px); } }
  @media (max-width: 760px) { .vl-ld { grid-template-columns: 1fr; justify-items: center; } .vl-ld-tab { --c: min(30px, calc((100vw - 80px) / 15)); } .vl-ld-lado { width: 100%; } }
  @media (prefers-reduced-motion: reduce) { .vl-ld-peao.pode i { animation: none; } }
  `;

  // ---------- pixel art ----------
  // Cores de cada lugar: base, claro (brilho), escuro (sombra) e linha (contorno).
  const PAL = [
    { base: '#a9d02a', claro: '#d3f05c', escuro: '#6f8f12', linha: '#33450a' },
    { base: '#2f86e6', claro: '#72b8ff', escuro: '#1a58a6', linha: '#0b2a55' },
    { base: '#e6508f', claro: '#ff8fbe', escuro: '#a8285f', linha: '#4f0d2c' },
    { base: '#f08a24', claro: '#ffb866', escuro: '#b0590c', linha: '#552a04' },
  ];
  const BRANCO = { base: '#f3efe4', claro: '#ffffff', escuro: '#d8d0bf', linha: '#9a8f78' };
  function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  const ponto = (x, X, Y, W, H, cor) => { x.fillStyle = cor; x.fillRect(X, Y, W, H); };
  // Desenho em texto ('#' cheio): devolve os pontos e gira de 90 em 90 graus.
  const mapa = (linhas) => linhas.map((l) => [...l].map((ch) => ch === '#'));
  const girar = (m) => m[0].map((_, x) => m.map((linha) => linha[x]).reverse());
  const ESTRELA = mapa(['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.']);
  const SETA_PX = mapa(['.....#...', '.....##..', '########.', '#########', '########.', '.....##..', '.....#...']);
  function carimbar(x, m, X, Y, cor, sombra) {
    m.forEach((linha, y) => linha.forEach((cheio, k) => {
      if (!cheio) return;
      if (sombra) ponto(x, X + k + 1, Y + y + 1, 1, 1, sombra);
      ponto(x, X + k, Y + y, 1, 1, cor);
    }));
  }
  function contornar(x, m, X, Y, cor) { // contorno de 1 ponto em volta do desenho
    const h = m.length, w = m[0].length, cheio = (k, y) => y >= 0 && y < h && k >= 0 && k < w && m[y][k];
    for (let y = -1; y <= h; y++) for (let k = -1; k <= w; k++) if (!cheio(k, y) && (cheio(k + 1, y) || cheio(k - 1, y) || cheio(k, y + 1) || cheio(k, y - 1))) ponto(x, X + k, Y + y, 1, 1, cor);
  }
  // Casa com bisel: contorno em cima e à esquerda, brilho e sombra por dentro.
  function ladrilho(x, X, Y, T, p) {
    ponto(x, X, Y, T, T, p.linha);
    ponto(x, X + 1, Y + 1, T - 1, T - 1, p.base);
    ponto(x, X + 1, Y + 1, T - 2, 1, p.claro); ponto(x, X + 1, Y + 1, 1, T - 2, p.claro);
    ponto(x, X + 1, Y + T - 1, T - 1, 1, p.escuro); ponto(x, X + T - 1, Y + 1, 1, T - 1, p.escuro);
  }
  function circulo(x, cx, cy, r, cor) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.8) ponto(x, cx + dx, cy + dy, 1, 1, cor);
  }
  // Tabuleiro inteiro (15 × 15 casas de 16 pontos).
  function desenharTabuleiro() {
    const T = 16, [cv, x] = tela(15 * T, 15 * T);
    ponto(x, 0, 0, cv.width, cv.height, BRANCO.linha);
    L.CAMINHO.forEach(function ([l, c], i) {
      const saida = L.SAIDA.indexOf(i);
      ladrilho(x, c * T, l * T, T, saida >= 0 ? PAL[saida] : BRANCO);
      if (saida >= 0) {
        let m = SETA_PX;
        for (let g = 0; g < SETA[saida] / 90; g++) m = girar(m);
        carimbar(x, m, c * T + Math.floor((T - m[0].length) / 2), l * T + Math.floor((T - m.length) / 2), '#ffffff', PAL[saida].linha);
      } else if (L.SEGURAS.has(i)) carimbar(x, ESTRELA, c * T + 4, l * T + 3, '#c2b69b', '#e8e1d0');
    });
    L.RETA.forEach((r, k) => r.forEach(([l, c]) => ladrilho(x, c * T, l * T, T, PAL[k])));
    // Bases: cor com pontinhos, bisel grosso, quintal branco de cantos cortados e os quatro ninhos.
    CANTO.forEach(function ([l0, c0], k) {
      const p = PAL[k], X = c0 * T, Y = l0 * T, S = 6 * T;
      ponto(x, X, Y, S, S, p.linha);
      ponto(x, X + 2, Y + 2, S - 4, S - 4, p.base);
      for (let yy = Y + 4; yy < Y + S - 4; yy += 4) for (let xx = X + 4 + ((yy / 4) % 2) * 2; xx < X + S - 4; xx += 4) ponto(x, xx, yy, 1, 1, p.claro);
      ponto(x, X + 2, Y + 2, S - 4, 2, p.claro); ponto(x, X + 2, Y + 2, 2, S - 4, p.claro);
      ponto(x, X + 2, Y + S - 4, S - 4, 2, p.escuro); ponto(x, X + S - 4, Y + 2, 2, S - 4, p.escuro);
      const QX = X + T - 2, QY = Y + T - 2, Q = 4 * T + 4;
      ponto(x, QX + 2, QY, Q - 4, Q, '#1c1c1c'); ponto(x, QX, QY + 2, Q, Q - 4, '#1c1c1c'); ponto(x, QX + 1, QY + 1, Q - 2, Q - 2, '#1c1c1c');
      ponto(x, QX + 3, QY + 2, Q - 6, Q - 4, '#fbf8f0'); ponto(x, QX + 2, QY + 3, Q - 4, Q - 6, '#fbf8f0');
      ponto(x, QX + 3, QY + 2, Q - 6, 3, '#ded7c6'); ponto(x, QX + 2, QY + 3, 2, Q - 6, '#e9e3d5');
      for (const [l, c] of L.BASE[k]) {
        const cx = c * T + 8, cy = l * T + 8;
        circulo(x, cx, cy, 6, p.linha); circulo(x, cx, cy, 5, p.escuro);
        ponto(x, cx - 2, cy + 3, 5, 1, p.base); ponto(x, cx - 3, cy + 2, 1, 1, p.base); ponto(x, cx + 3, cy + 2, 1, 1, p.base);
      }
    });
    // Centro: quatro triângulos com as linhas das diagonais e a estrela branca.
    const C0 = 6 * T, N = 3 * T, M = N / 2;
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      const dx = xx + 0.5 - M, dy = yy + 0.5 - M;
      const k = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 1 : 3) : (dx < 0 ? 0 : 2);
      const borda = Math.max(Math.abs(dx), Math.abs(dy)) > M - 2.5;
      const cor = Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8 ? '#1c1c1c' : borda ? PAL[k].claro : PAL[k].base;
      ponto(x, C0 + xx, C0 + yy, 1, 1, cor);
    }
    contornar(x, ESTRELA, C0 + M - 4, C0 + M - 5, '#1c1c1c');
    carimbar(x, ESTRELA, C0 + M - 4, C0 + M - 5, '#ffffff');
    ponto(x, C0, C0, N, 1, '#1c1c1c'); ponto(x, C0, C0, 1, N, '#1c1c1c'); ponto(x, C0, C0 + N - 1, N, 1, '#1c1c1c'); ponto(x, C0 + N - 1, C0, 1, N, '#1c1c1c');
    return cv;
  }
  // Peão (12 × 16 pontos, como as peças de jogo do hotel): contorno preto, brilho à esquerda, sombra à direita.
  const PEAO = mapa(['....####....', '...######...', '..########..', '..########..', '..########..', '...######...', '....####....', '....####....', '...######...', '..########..',
    '...######...', '...######...', '..########..', '.##########.', '############', '############']);
  function spritePeao(p) {
    const [cv, x] = tela(14, 20);
    ponto(x, 3, 18, 8, 1, 'rgba(0,0,0,.35)'); ponto(x, 2, 17, 10, 1, 'rgba(0,0,0,.3)');
    contornar(x, PEAO, 1, 1, '#141414');
    PEAO.forEach(function (linha, y) {
      const x0 = linha.indexOf(true), x1 = linha.lastIndexOf(true);
      linha.forEach(function (cheio, k) {
        if (!cheio) return;
        let cor = k <= x0 + 1 ? p.claro : k >= x1 - 1 ? p.escuro : p.base;
        if (y >= 14) cor = k === x0 ? p.base : p.escuro;
        ponto(x, 1 + k, 1 + y, 1, 1, cor);
      });
    });
    ponto(x, 1 + 4, 1 + 1, 2, 1, '#ffffff'); ponto(x, 1 + 3, 1 + 2, 1, 2, '#ffffff');
    return cv.toDataURL();
  }
  // Dado de cima (16 × 16 pontos): branco com bisel, contorno preto, pintas pretas (o 1 é vermelho).
  const PINTA = { 1: [3, 3], 2: [7, 3], 3: [11, 3], 4: [3, 7], 5: [7, 7], 6: [11, 7], 7: [3, 11], 8: [7, 11], 9: [11, 11] };
  function spriteFace(n) {
    const [cv, x] = tela(16, 16);
    ponto(x, 1, 0, 14, 16, '#141414'); ponto(x, 0, 1, 16, 14, '#141414');
    ponto(x, 1, 1, 14, 14, '#f7f8fb');
    ponto(x, 1, 1, 13, 1, '#ffffff'); ponto(x, 1, 1, 1, 13, '#ffffff');
    ponto(x, 1, 13, 14, 1, '#d5dae4'); ponto(x, 1, 14, 14, 1, '#a9b1c0'); ponto(x, 14, 1, 1, 14, '#c3c9d6');
    for (const p of PIPS[n]) { const [px, py] = PINTA[p]; if (n === 1) ponto(x, px - 1 + 1, py - 1 + 1, 3, 3, '#d8342a'); else ponto(x, px, py, 2, 2, '#1c1f26'); }
    return cv.toDataURL();
  }
  function spriteSombra() { const [cv, x] = tela(14, 2); ponto(x, 2, 0, 10, 1, 'rgba(0,0,0,.45)'); ponto(x, 0, 1, 14, 1, 'rgba(0,0,0,.45)'); return cv.toDataURL(); }
  let ARTE = null; // feita na primeira partida (precisa de canvas)
  const arte = () => ARTE || (ARTE = { tabuleiro: desenharTabuleiro(), peoes: PAL.map(spritePeao), faces: [0, 1, 2, 3, 4, 5, 6].map((n) => (n ? spriteFace(n) : '')), sombra: spriteSombra() });
  // Bots com visual do hotel (como no ZERA!).
  const VISUAIS_BOT = ['hd-180-1.hr-828-61.ch-3030-110.lg-275-110.sh-290-62', 'hd-600-1.hr-515-33.ch-635-70.lg-716-66.sh-735-68', 'hd-190-2.hr-115-42.ch-215-82.lg-285-82.sh-305-62', 'hd-600-2.hr-890-40.ch-660-73.lg-700-62.sh-725-62'];
  const fotoBot = (nome) => 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(VISUAIS_BOT[[...String(nome)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % VISUAIS_BOT.length]) + '&headonly=1&direction=2&head_direction=3';

  VL.mesa.registrar('ludo', {
    nome: 'Ludo', glifo: '🎲', min: 2, max: 4,
    texto: 'Tire 6 para sair da base, dê a volta no tabuleiro e leve os 4 peões ao centro. Cair num adversário manda ele de volta para a base (menos nas estrelas). 6 ou captura: joga de novo.',
    fatos: ['De 2 a 4 jogadores', 'Com bots', 'Dado e peões animados'],
    bots: [['normal', 'Bot']],
    nova: (jogadores) => L.nova(jogadores),
    aplicar: (e, nome, a) => L.aplicar(e, nome, a),
    tick: (e) => L.tick(e),
    sair: (e, nome) => L.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.texto || e.fim.ordem[0] + ' levou os 4 peões ao centro!', detalhe: Object.fromEntries(e.js.map((j) => [j.nome, j.peoes.filter((p) => p === L.FIM).length + ' de 4 no centro'])) } : null),
    visao: (e) => L.visao(e),
    montar(api) {
      const tab = el('div', { class: 'vl-ld-tab', role: 'img', 'aria-label': 'Tabuleiro de Ludo' });
      const lado = el('div', { class: 'vl-ld-lado' });
      const raizEl = el('div', { class: 'vl-ld' }, [el('style', { texto: CSS }), tab, lado]);
      let parado = false;
      try { parado = raiz.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sem matchMedia */ }
      // ---------- fundo fixo: o tabuleiro em pixel art e os nomes das bases ----------
      const A = arte();
      const fundoCv = A.tabuleiro.cloneNode(false);
      fundoCv.className = 'vl-ld-fundo';
      fundoCv.getContext('2d').drawImage(A.tabuleiro, 0, 0);
      const fundo = [fundoCv].concat(CANTO.map(([l0, c0], k) => el('span', { class: 'vl-ld-nome-base', 'data-lugar': String(k), style: 'left:calc(var(--c) * ' + c0 + ');top:calc(var(--c) * ' + (l0 + 5) + ')' })));
      const camadaPeoes = el('div');
      tab.append(...fundo, camadaPeoes);
      // ---------- lado: jogadores, dado, mensagem ----------
      const listaJog = el('div', { style: 'display:grid;gap:6px' });
      // Dado visto de cima: gira trocando de face e para de pé, mostrando só a face de cima.
      const dado = el('div', { class: 'vl-ld-dado', 'aria-hidden': 'true' });
      const mostrarFace = (n) => { dado.setAttribute('data-n', String(n)); dado.style.setProperty('--face', 'url(' + A.faces[n] + ')'); };
      mostrarFace(6);
      const legendaDado = el('small', { texto: 'Dado' });
      const caixaDado = el('div', { class: 'vl-ld-dado-caixa', role: 'button', tabindex: '-1', 'aria-label': 'Dado' }, [el('div', { class: 'vl-ld-palco' }, [dado]), el('i', { class: 'vl-ld-sombra', style: '--sombra:url(' + A.sombra + ')' }), legendaDado]);
      const msg = el('div', { class: 'vl-ld-msg', role: 'status', 'aria-live': 'polite' });
      const rolar = el('button', { type: 'button', class: 'vl-jg-botao forte grande vl-ld-rolar', texto: '🎲 Rolar o dado' });
      const nota = el('p', { class: 'vl-ld-nota' });
      lado.append(listaJog, caixaDado, msg, rolar, nota);
      // ---------- estado mostrado (anda atrás do estado real enquanto as animações tocam) ----------
      let v = null, ultimoN = null, fila = [], tocando = false, pedido = false, evMostrado = null, eraMinha = false, autoMover = null;
      let mostrado = new Map();     // lugar -> [4 progressos]
      const fichas = new Map();     // 'lugar-i' -> botão do peão
      const C = () => (tab.clientWidth || 480) / 15;
      const posDe = (lugar, prog, i) => (prog >= L.FIM ? CHEGADA[lugar] : L.casa(lugar, prog, i));
      const OFF = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
      function montarFichas() {
        const chave = v.js.map((j) => j.lugar).join(',');
        if (camadaPeoes.getAttribute('data-chave') === chave) return;
        camadaPeoes.setAttribute('data-chave', chave);
        fichas.clear();
        const nos = [];
        for (const j of v.js) for (let i = 0; i < 4; i++) {
          const b = el('button', { type: 'button', class: 'vl-ld-peao', style: '--cor:' + COR[j.lugar] + ';--img:url(' + A.peoes[j.lugar] + ')', 'aria-label': 'Peão ' + (i + 1) + ' de ' + j.nome, tabindex: '-1',
            onclick() { moverPeao(j.lugar, i); } }, [el('i')]);
          fichas.set(j.lugar + '-' + i, b);
          nos.push(b);
        }
        camadaPeoes.replaceChildren(...nos);
        CANTO.forEach((_, k) => { const base = tab.querySelector('.vl-ld-nome-base[data-lugar="' + k + '"]'); const j = v.js.find((x) => x.lugar === k); if (base) base.textContent = j ? j.nome : ''; });
      }
      // Põe cada peão na casa dele; peões na mesma casa ficam menores, cada um num canto.
      function posicionar() {
        const c = C(), porCasa = new Map();
        for (const [lugar, ps] of mostrado) ps.forEach(function (p, i) {
          const pos = posDe(lugar, p, i), k = pos.join(',');
          if (!porCasa.has(k)) porCasa.set(k, []);
          porCasa.get(k).push({ lugar, i, pos });
        });
        for (const lista of porCasa.values()) lista.forEach(function ({ lugar, i, pos }, k) {
          const f = fichas.get(lugar + '-' + i);
          if (!f) return;
          const n = lista.length, o = n > 1 ? OFF[k % 4] : [0, 0];
          f.style.transform = 'translate(' + ((pos[1] + o[0]) * c) + 'px,' + ((pos[0] + o[1]) * c) + 'px) scale(' + (n > 1 ? 0.68 : 1) + ')';
        });
      }
      function sincronizar() {
        mostrado = new Map(v.js.map((j) => [j.lugar, j.peoes.slice()]));
        montarFichas();
        posicionar();
      }
      // Fim de uma animação, com prazo: com a aba escondida o navegador pausa as animações e o jogo não pode travar.
      const terminar = (a, ms) => Promise.race([a.finished.catch(() => {}), new Promise((ok) => setTimeout(ok, ms + 250))]).then(() => { try { a.cancel(); } catch (e) { /* já acabou */ } });
      const semAnimar = () => parado || (raiz.document && raiz.document.visibilityState === 'hidden');
      const xy = (lugar, prog, i) => { const p = posDe(lugar, prog, i), c = C(); return [p[1] * c, p[0] * c]; };
      function pulo(f, de, para, dur, altura, giro) {
        if (semAnimar() || !f.animate) { f.style.transform = 'translate(' + para[0] + 'px,' + para[1] + 'px)'; return Promise.resolve(); }
        f.style.zIndex = '9';
        const a = f.animate([
          { transform: 'translate(' + de[0] + 'px,' + de[1] + 'px) scale(1) rotate(0deg)' },
          { transform: 'translate(' + (de[0] + para[0]) / 2 + 'px,' + ((de[1] + para[1]) / 2 - altura) + 'px) scale(1.22) rotate(' + (giro || 0) / 2 + 'deg)', offset: 0.5 },
          { transform: 'translate(' + para[0] + 'px,' + para[1] + 'px) scale(1) rotate(' + (giro || 0) + 'deg)' },
        ], { duration: dur, easing: 'ease-in-out' });
        f.style.transform = 'translate(' + para[0] + 'px,' + para[1] + 'px)';
        return terminar(a, dur).then(() => { f.style.zIndex = ''; });
      }
      // ---------- animações dos lances ----------
      function animarDado(ev) {
        return new Promise(function (ok) {
          api.som('dado');
          caixaDado.style.setProperty('--cor', COR[ev.lugar] || '#d6f24a');
          const acabar = () => { mostrarFace(ev.dado); evMostrado = ev; pintarLado(); setTimeout(ok, ev.semJogada || ev.tres ? 900 : 120); };
          if (semAnimar() || !dado.animate) { acabar(); return; }
          // Pula pela caixa trocando de face (pixel art não gira) e para mostrando a face de cima.
          const lado = Math.random() < 0.5 ? -1 : 1;
          const a = dado.animate([
            { transform: 'translate(0, 0)' },
            { transform: 'translate(' + (-10 * lado) + 'px, -18px)', offset: 0.25 },
            { transform: 'translate(' + (6 * lado) + 'px, 2px)', offset: 0.5 },
            { transform: 'translate(' + (2 * lado) + 'px, -8px)', offset: 0.72 },
            { transform: 'translate(0, 0)' },
          ], { duration: 950, easing: 'steps(14)' });
          dado.classList.add('girando');
          const troca = setInterval(() => mostrarFace(1 + Math.floor(Math.random() * 6)), 70);
          setTimeout(() => { clearInterval(troca); dado.classList.remove('girando'); mostrarFace(ev.dado); }, 760);
          terminar(a, 950).then(function () {
            clearInterval(troca); dado.classList.remove('girando');
            if (dado.animate && !semAnimar()) dado.animate([{ transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { duration: 180, easing: 'steps(3)' });
            acabar();
          });
        });
      }
      async function animarMovimento(ev) {
        const f = fichas.get(ev.lugar + '-' + ev.peao), ps = mostrado.get(ev.lugar);
        evMostrado = ev; pintarLado();
        if (f && ps) {
          const passos = ev.de < 0 ? [0] : Array.from({ length: Math.max(0, ev.para - ev.de) }, (_, k) => ev.de + 1 + k);
          let atual = ps[ev.peao];
          for (const p of passos) {
            api.som('pulo', 0.4 + 0.1 * (p % 3));
            await pulo(f, xy(ev.lugar, atual, ev.peao), xy(ev.lugar, p, ev.peao), 175, C() * 0.5);
            atual = p; ps[ev.peao] = p;
          }
          ps[ev.peao] = ev.para;
        }
        posicionar();
        if (ev.capturados && ev.capturados.length) {
          api.som('captura');
          await Promise.all(ev.capturados.map(function (c) {
            const g = fichas.get(c.lugar + '-' + c.peao), qs = mostrado.get(c.lugar);
            if (!g || !qs) return Promise.resolve();
            const de = xy(c.lugar, qs[c.peao], c.peao);
            qs[c.peao] = -1;
            return pulo(g, de, xy(c.lugar, -1, c.peao), 620, C() * 3, 360);
          }));
          posicionar();
        }
        if (ev.chegou) api.som('chegou');
      }
      async function tocar() {
        if (tocando) return;
        tocando = true;
        while (fila.length) {
          const ev = fila.shift();
          if (ev.tipo === 'rolou') await animarDado(ev);
          else if (ev.tipo === 'moveu') await animarMovimento(ev);
        }
        tocando = false;
        if (v) sincronizar();
        pintarLado();
      }
      function moverPeao(lugar, i) {
        if (!podeAgir() || !v.rolou) return;
        const minha = v.js.find((j) => j.nome === api.eu);
        if (!minha || minha.lugar !== lugar || !v.movem[i]) return;
        clearTimeout(autoMover);
        pedir({ tipo: 'mover', peao: i });
        pintarLado();
      }
      const podeAgir = () => v && !v.fim && v.vez === api.eu && !tocando && !fila.length && !pedido;
      function rolarDado() { if (!podeAgir() || v.rolou) return; pedir({ tipo: 'rolar' }); pintarLado(); }
      // Manda a jogada e espera a resposta; se o anfitrião não responder em 3 s, libera de novo.
      let soltar = null;
      function pedir(acao) { pedido = true; clearTimeout(soltar); soltar = setTimeout(() => { pedido = false; pintarLado(); }, 3000); api.agir(acao); }
      rolar.addEventListener('click', rolarDado);
      caixaDado.addEventListener('click', rolarDado);
      // ---------- texto e botões ----------
      const quem = (nome) => (nome === api.eu ? 'Você' : nome);
      function textoDo(ev) {
        if (!ev) return '';
        if (ev.tipo === 'rolou') return quem(ev.nome) + ' tirou ' + ev.dado + (ev.tres ? ': três 6 seguidos, perdeu a vez.' : ev.semJogada ? ': nenhum peão pode andar.' : '.');
        let t = quem(ev.nome) + (ev.de < 0 ? ' tirou um peão da base' : ' andou ' + ev.dado + (ev.dado === 1 ? ' casa' : ' casas'));
        if (ev.capturou) t += ' e capturou ' + (ev.capturados || []).map((c) => (c.nome === api.eu ? 'o seu peão' : 'um peão de ' + c.nome)).join(' e ') + '!';
        else if (ev.chegou) t += ' e chegou ao centro!';
        else t += '.';
        if (ev.dado === 6 || ev.capturou || ev.chegou) t += ' Joga de novo.';
        return t;
      }
      function pintarLado() {
        if (!v) return;
        const animando = tocando || fila.length > 0;
        const vez = animando && evMostrado ? evMostrado.nome : v.vez;
        listaJog.replaceChildren(...v.js.map((j) => el('div', { class: 'vl-ld-jog' + (j.nome === vez && !v.fim ? ' vez' : ''), style: '--cor:' + COR[j.lugar] }, [
          j.bot ? el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true' }, [el('img', { alt: '', src: fotoBot(j.nome) })]) : api.cabeca(j.nome),
          el('span', { class: 'quem' }, [el('b', { texto: j.nome + (j.nome === api.eu ? ' (você)' : '') }), el('small', { texto: NOME_COR[j.lugar] + (j.bot ? ' · bot' : '') })]),
          el('span', { class: 'vl-ld-casas', title: 'Peões no centro', 'aria-label': j.peoes.filter((p) => p === L.FIM).length + ' de 4 no centro' }, j.peoes.map((p) => el('i', { class: p === L.FIM ? 'ok' : '' }))),
        ])));
        const minhaVez = !animando && !v.fim && v.vez === api.eu;
        const jogVez = v.js.find((j) => j.nome === vez);
        caixaDado.style.setProperty('--cor', COR[jogVez ? jogVez.lugar : 0]);
        const podeRolar = minhaVez && !v.rolou && !pedido;
        caixaDado.classList.toggle('pode', podeRolar);
        caixaDado.tabIndex = podeRolar ? 0 : -1;
        legendaDado.textContent = podeRolar ? 'Clique para rolar' : vez === api.eu ? 'Sua vez' : vez ? 'Vez de ' + vez : 'Dado';
        rolar.hidden = !podeRolar;
        const instrucao = v.fim ? '' : minhaVez ? (v.rolou ? 'Escolha o peão que vai andar.' : 'Sua vez: role o dado!') : animando ? '' : 'Vez de ' + v.vez + '.';
        msg.replaceChildren(...[textoDo(evMostrado), instrucao ? el('br') : null, instrucao ? el('b', { texto: instrucao }) : null].filter(Boolean));
        const minha = v.js.find((j) => j.nome === api.eu);
        nota.textContent = minha ? 'Sua cor: ' + NOME_COR[minha.lugar] + '. Tire 6 para sair da base; estrelas são casas seguras.' : '';
        // Peões que podem andar pulam e aceitam clique.
        for (const [chave, f] of fichas) {
          const [lugar, i] = chave.split('-').map(Number);
          const pode = minhaVez && v.rolou && !pedido && minha && minha.lugar === lugar && v.movem[i];
          f.classList.toggle('pode', !!pode);
          f.tabIndex = pode ? 0 : -1;
        }
        if (minhaVez && !eraMinha) api.som('vez');
        eraMinha = minhaVez;
        // Só um peão pode andar: anda sozinho depois de um instante.
        clearTimeout(autoMover);
        if (minhaVez && v.rolou && !pedido && v.movem.filter(Boolean).length === 1) {
          const i = v.movem.indexOf(true), lugar = minha && minha.lugar;
          autoMover = setTimeout(() => moverPeao(lugar, i), 650);
        }
      }
      return {
        el: raizEl,
        atualizar(nova) {
          if (!nova || !Array.isArray(nova.js)) return;
          const antes = v;
          v = nova;
          if (!antes || (nova.n || 0) < (ultimoN || 0)) { ultimoN = nova.n || 0; evMostrado = (nova.eventos || []).slice(-1)[0] || null; sincronizar(); pintarLado(); return; }
          const novos = (nova.eventos || []).filter((ev) => ev.n > ultimoN);
          if (novos.length) {
            pedido = false;
            const seguido = novos[0].n === ultimoN + 1;
            ultimoN = novos[novos.length - 1].n;
            if (seguido && fila.length + novos.length <= 6) { fila.push(...novos); tocar(); }
            else { fila = []; evMostrado = novos[novos.length - 1]; if (!tocando) sincronizar(); } // perdeu lances: pula para o estado atual
          } else if (!tocando) sincronizar();
          pintarLado();
        },
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
