// Vagalume — marca em pixel art, no jeito do Habbo (pedido do usuário em 2026-11-15: "algo mais Habbo,
// pixelado"). Arquivo puro (sem DOM, sem chrome.*): monta um SVG de quadradinhos, usado como imagem
// data: (a CSP do Habblet aceita data: em img-src). As animações são SMIL em passos (discretas), como
// os quadros de um sprite, e rodam mesmo com o SVG como imagem.
(function (raiz) {
  'use strict';

  const COR = {
    K: '#141a0e', // contorno
    B: '#33402a', // corpo
    b: '#5b6f3c', // brilho do corpo
    W: '#e4f1f6', // asa
    w: '#9fbccb', // sombra da asa
    Y: '#fbffd6', // cauda, ponto mais claro
    L: '#d6f24a', // limão
    S: '#a9c92a', // gomos da cauda
    G: '#7f9f18', // sombra da cauda
    E: '#ffffff', // olho e miolo da luz
    P: '#141a0e', // pupila
  };

  // ---------- grade ----------
  function grade(l, a) { return { l, a, c: Array.from({ length: a }, () => Array(l).fill(null)) }; }
  function por(g, x, y, cor) { if (x >= 0 && y >= 0 && x < g.l && y < g.a) g.c[y][x] = cor; }
  function pegar(g, x, y) { return x >= 0 && y >= 0 && x < g.l && y < g.a ? g.c[y][x] : null; }
  // Contorno de 1 pixel em volta de tudo que não é contorno (vizinhos nas 4 direções).
  function contornar(g) {
    const marcar = [];
    for (let y = 0; y < g.a; y++) {
      for (let x = 0; x < g.l; x++) {
        if (g.c[y][x]) continue;
        const viz = [pegar(g, x + 1, y), pegar(g, x - 1, y), pegar(g, x, y + 1), pegar(g, x, y - 1)];
        if (viz.some((v) => v && v !== 'K')) marcar.push([x, y]);
      }
    }
    for (const [x, y] of marcar) g.c[y][x] = 'K';
  }
  // SVG: junta pixels vizinhos da mesma cor numa linha em um retângulo só.
  function retangulos(g, dx, dy) {
    const porCor = {};
    for (let y = 0; y < g.a; y++) {
      let x = 0;
      while (x < g.l) {
        const k = g.c[y][x];
        if (!k) { x++; continue; }
        let fim = x + 1;
        while (fim < g.l && g.c[y][fim] === k) fim++;
        (porCor[k] = porCor[k] || []).push('<rect x="' + (x + dx) + '" y="' + (y + dy) + '" width="' + (fim - x) + '" height="1"/>');
        x = fim;
      }
    }
    return Object.keys(porCor).map((k) => '<g fill="' + (COR[k] || k) + '">' + porCor[k].join('') + '</g>').join('');
  }

  // ---------- o vagalume: sprite desenhado pixel a pixel (26 × 17) ----------
  // K contorno, B/b corpo, L/Y/S/G cauda acesa, E/P olho, W/w asa. A asa é uma camada à parte, com dois
  // quadros (em cima e embaixo), como o sprite de um mobi animado.
  const CORPO = [
    '........................LL',
    '.......................K..',
    '......................K...',
    '.....................K....',
    '.....................K....',
    '...................KKKKK..',
    '..................KbbBBBK.',
    '...............KKKbBBBEPK.',
    '....KKKKKKK...KbBBKBBBBBK.',
    '..KKLLYYYLLKKKbBBBBKBBBK..',
    '.KLLYYYYYYYLSKBBBBBBKKK...',
    'KLSLYYYYYYYLSKBBBBBBK.....',
    'KLSLLYYYYYLLSKBBBBBK......',
    'KGSLLLLLLLLLSKKBBBK.......',
    '.KGSGLLLLLGSGKKKKK........',
    '..KKGGGGGGGGKK.K.K........',
    '....KKKKKKKK...K.K........',
  ];
  const ASA_CIMA = [
    '',
    '.........KKKKK',
    '.......KKWWWWWKK',
    '......KWWWWWWWWWK',
    '......KWWWWWWWWWWK',
    '.......KWWWWWWwwwK',
    '........KWwwwwwwK',
    '.........KKwwwwKK',
    '...........KKKK',
  ];
  const ASA_BAIXO = [
    '',
    '',
    '',
    '',
    '',
    '',
    '........KKKKKK',
    '......KKWWWWWWKK',
    '.....KWWWWWWWwwwK',
    '......KKwwwwwwKKK',
    '........KKKKKK',
  ];
  // o miolo da cauda, que pisca mais forte
  const LUZ = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '......EE',
    '.....EEEE',
    '......EE',
  ];
  const MARGEM_X = 6; // espaço em volta do sprite para o brilho não ser cortado
  const MARGEM_Y = 7;
  const LARG = 26 + MARGEM_X * 2;
  const ALT = 17 + MARGEM_Y * 2;
  function doDesenho(linhas) {
    const g = grade(LARG, ALT);
    linhas.forEach((linha, y) => [...linha].forEach((k, x) => { if (k !== '.') por(g, x + MARGEM_X, y + MARGEM_Y, k); }));
    return g;
  }

  // Brilho redondo em degraus em volta da cauda, com pontilhado na borda (como o Habbo faz com a luz).
  function brilho() {
    const cx = MARGEM_X + 7;
    const cy = MARGEM_Y + 12;
    const anel = (dentro) => {
      const g = grade(LARG, ALT);
      for (let y = 0; y < ALT; y++) {
        for (let x = 0; x < LARG; x++) {
          const r = Math.hypot((x + 0.5 - cx) / 1.2, y + 0.5 - cy);
          if (dentro(r, x, y)) por(g, x, y, 'L');
        }
      }
      return g;
    };
    return '<g opacity=".3">' + retangulos(anel((r) => r < 5.5), 0, 0) + '</g>'
      + '<g opacity=".15">' + retangulos(anel((r) => r >= 5.5 && r < 8), 0, 0) + '</g>'
      + '<g opacity=".15">' + retangulos(anel((r, x, y) => r >= 8 && r < 10.5 && (x + y) % 2 === 0), 0, 0) + '</g>';
  }

  // Brilhinho em cruz (5 pixels), piscando em passos.
  function faisca(x, y, atraso) {
    return '<g opacity="0"><animate attributeName="opacity" values="0;.5;1;.5;0;0;0;0" dur="2.4s" begin="' + atraso + 's" calcMode="discrete" repeatCount="indefinite"/>'
      + '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + COR.Y + '"/>'
      + '<g fill="' + COR.L + '"><rect x="' + (x - 1) + '" y="' + y + '" width="1" height="1"/><rect x="' + (x + 1) + '" y="' + y + '" width="1" height="1"/>'
      + '<rect x="' + x + '" y="' + (y - 1) + '" width="1" height="1"/><rect x="' + x + '" y="' + (y + 1) + '" width="1" height="1"/></g></g>';
  }

  // O vagalume animado (LARG × ALT pixels), posto em (dx, dy) e ampliado por "escala".
  function desenhoVagalume(dx, dy, escala) {
    return '<g transform="translate(' + dx + ' ' + dy + ') scale(' + (escala || 1) + ')">'
      + '<g><animate attributeName="opacity" values=".55;.8;1;.8" dur="1.6s" calcMode="discrete" repeatCount="indefinite"/>' + brilho() + '</g>'
      + faisca(3, 6, 0) + faisca(34, 25, 0.8) + faisca(4, 26, 1.6) + faisca(35, 4, 1.2)
      + '<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0;0 1" dur="1.2s" calcMode="discrete" repeatCount="indefinite"/>'
      + retangulos(doDesenho(CORPO), 0, 0)
      + '<g><animate attributeName="opacity" values="0;.6;1;.6" dur="1.6s" calcMode="discrete" repeatCount="indefinite"/>' + retangulos(doDesenho(LUZ), 0, 0) + '</g>'
      + '<g><animate attributeName="opacity" values="1;0" dur=".36s" calcMode="discrete" repeatCount="indefinite"/>' + retangulos(doDesenho(ASA_CIMA), 0, 0) + '</g>'
      + '<g opacity="0"><animate attributeName="opacity" values="0;1" dur=".36s" calcMode="discrete" repeatCount="indefinite"/>' + retangulos(doDesenho(ASA_BAIXO), 0, 0) + '</g>'
      + '</g></g>';
  }

  // ---------- o nome em letras de pixel ----------
  const LETRAS = {
    V: ['1...1', '1...1', '1...1', '1...1', '.1.1.', '.1.1.', '..1..'],
    A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
    G: ['.111.', '1...1', '1....', '1.111', '1...1', '1...1', '.111.'],
    L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
    U: ['1...1', '1...1', '1...1', '1...1', '1...1', '1...1', '.111.'],
    M: ['1...1', '11.11', '1.1.1', '1.1.1', '1...1', '1...1', '1...1'],
    E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
  };
  // Cada pixel da letra vira 2 × 2; em cima mais claro, embaixo mais escuro, com "espessura" verde-escura
  // por baixo e contorno, como os logos do Habbo.
  function palavra(texto) {
    const g = grade(texto.length * 12 + 2, 19);
    const cheio = new Set();
    [...texto].forEach((ch, i) => {
      const forma = LETRAS[ch];
      if (!forma) return;
      forma.forEach((linha, ly) => [...linha].forEach((p, lx) => {
        if (p !== '1') return;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) cheio.add((2 + i * 12 + lx * 2 + b) + ',' + (1 + ly * 2 + a));
      }));
    });
    for (const k of cheio) {
      const [x, y] = k.split(',').map(Number);
      const linha = y - 1;
      por(g, x, y, linha <= 1 ? '#f6ffc8' : linha >= 10 ? '#a3c41f' : COR.L);
    }
    // espessura: 2 pixels abaixo de cada pixel da letra que não tem letra embaixo
    for (const k of cheio) {
      const [x, y] = k.split(',').map(Number);
      for (let d = 1; d <= 2; d++) if (!cheio.has(x + ',' + (y + d)) && !pegar(g, x, y + d)) por(g, x, y + d, '#4c6116');
    }
    contornar(g);
    return g;
  }

  // Só o vagalume.
  function vagalume() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + LARG + ' ' + ALT + '" width="' + LARG * 8 + '" height="' + ALT * 8 + '" shape-rendering="crispEdges">'
      + desenhoVagalume(0, 0, 1) + '</svg>';
  }

  // ---------- pote de vagalumes (como um mobi do Habbo), 34 × 34 ----------
  Object.assign(COR, { c: '#d9a868', C: '#a0682f', D: '#6b4420', i: '#1c3532', g: '#4d7a72', h: '#bfe3da' });
  const POTE_L = 34;
  const POTE_A = 34;
  function desenhoPote(dx, dy, escala, semEnfeite) {
    const g = grade(POTE_L, POTE_A);
    const cx = 17;
    // tampa de rolha
    for (let x = cx - 5; x < cx + 5; x++) { por(g, x, 3, 'c'); por(g, x, 4, x === cx - 5 ? 'c' : 'C'); por(g, x, 5, x === cx - 5 ? 'c' : 'C'); por(g, x, 6, 'D'); }
    // gargalo e corpo de vidro
    const meio = [4, 4, 6, 8, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9, 8, 7];
    meio.forEach((hw, i) => {
      const y = 7 + i;
      for (let x = cx - hw; x < cx + hw; x++) {
        const borda = x === cx - hw || x === cx + hw - 1 || i === meio.length - 1;
        por(g, x, y, borda ? 'g' : 'i');
      }
      if (i >= 4 && i <= 17) por(g, cx - hw + 2, y, 'h');
      if (i >= 6 && i <= 8) por(g, cx + hw - 3, y, 'h');
    });
    contornar(g);
    // vagalumes dentro do pote, cada um piscando no seu tempo
    const bichos = [[13, 14, 0], [20, 12, 0.5], [16, 19, 1.1], [21, 22, 0.3], [12, 23, 1.6], [17, 26, 0.8]];
    const luzes = bichos.map(([x, y, atraso]) => {
      const halo = grade(POTE_L, POTE_A);
      for (const [a, b] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 1], [1, 1]]) por(halo, x + a, y + b, 'L');
      const miolo = grade(POTE_L, POTE_A);
      por(miolo, x, y, 'Y'); por(miolo, x + 1, y, 'L');
      return '<g opacity="0"><animate attributeName="opacity" values="0;.5;1;1;.5;0;0" dur="2.2s" begin="' + atraso + 's" calcMode="discrete" repeatCount="indefinite"/>'
        + '<g opacity=".35">' + retangulos(halo, 0, 0) + '</g>' + retangulos(miolo, 0, 0) + '</g>';
    }).join('');
    // brilho em volta do pote
    const anel = (dentro) => {
      const a = grade(POTE_L, POTE_A);
      for (let y = 0; y < POTE_A; y++) for (let x = 0; x < POTE_L; x++) { const r = Math.hypot(x + 0.5 - cx, (y + 0.5 - 19) / 1.15); if (dentro(r, x, y)) por(a, x, y, 'L'); }
      return a;
    };
    const brilhoPote = '<g><animate attributeName="opacity" values=".6;.85;1;.85" dur="1.8s" calcMode="discrete" repeatCount="indefinite"/>'
      + '<g opacity=".14">' + retangulos(anel((r) => r >= 10 && r < 13), 0, 0) + '</g>'
      + '<g opacity=".14">' + retangulos(anel((r, x, y) => r >= 13 && r < 16 && (x + y) % 2 === 0), 0, 0) + '</g></g>';
    return '<g transform="translate(' + dx + ' ' + dy + ') scale(' + (escala || 1) + ')">'
      + (semEnfeite ? '' : brilhoPote) + retangulos(g, 0, 0) + luzes
      + (semEnfeite ? '' : faisca(4, 6, 0) + faisca(30, 28, 0.9) + faisca(29, 5, 1.7))
      + '</g>';
  }

  function sombraDe(nome) { return Object.assign({}, nome, { c: nome.c.map((l) => l.map((k) => (k ? '#000000' : null))) }); }

  // O logo inteiro. Variantes: 'vagalume' (o vagalume grande em cima do nome), 'pote' (pote de
  // vagalumes em cima do nome) e 'nome' (só o nome, com um vagalume pequeno voando e deixando rastro).
  function logo(variante) {
    const nome = palavra('VAGALUME');
    const sombra = sombraDe(nome);
    const svg = (l, a, miolo) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + l + ' ' + a + '" width="' + l * 4 + '" height="' + a * 4 + '" shape-rendering="crispEdges">' + miolo + '</svg>';
    const comNome = (dx, topo) => '<g opacity=".55">' + retangulos(sombra, dx + 1, topo + 1) + '</g>' + retangulos(nome, dx, topo);
    if (variante === 'nome') {
      const largura = nome.l + 4;
      const topo = 20;
      // rastro pontilhado do vagalume, num arco por cima do nome
      let rastro = '';
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const x = Math.round(4 + t * 66);
        const y = Math.round(topo - 2 - Math.sin(t * Math.PI) * 9 - t * 4);
        rastro += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + COR.L + '" opacity="' + (0.15 + t * 0.6).toFixed(2) + '"/>';
      }
      return svg(largura, topo + nome.a + 1,
        rastro + desenhoVagalume(largura - LARG + 2, -6, 1) + comNome(2, topo)
        + faisca(10, 6, 0.4) + faisca(46, 4, 1.4) + faisca(92, 40, 2));
    }
    if (variante === 'pote') {
      const largura = Math.max(nome.l + 2, POTE_L * 2);
      const topo = POTE_A * 2 - 4;
      return svg(largura, topo + nome.a + 1, desenhoPote(Math.floor((largura - POTE_L * 2) / 2), 0, 2) + comNome(Math.floor((largura - nome.l) / 2), topo));
    }
    const largura = Math.max(nome.l + 2, LARG * 2);
    const topo = ALT * 2 - 6;
    return svg(largura, topo + nome.a + 1, desenhoVagalume(Math.floor((largura - LARG * 2) / 2), 0, 2) + comNome(Math.floor((largura - nome.l) / 2), topo));
  }

  // Ícone da barra do hotel (pedido do usuário em 2026-11-15: o ponto verde do Vagalume, em pixel art,
  // com jeito de ícone nativo): bolinha limão com contorno escuro, brilho em cima à esquerda, sombra
  // embaixo e halo pontilhado em volta que pulsa devagar. 32 × 32, 1 pixel do desenho = 1 da tela.
  // Ícone da barra do hotel (pedido do usuário em 2026-11-16: "mais bonito"): uma esfera de luz limão em
  // pixel art, com degradê de cinco tons a partir de um brilho no alto à esquerda, contorno escuro,
  // um halo suave que pulsa e duas faíscas em cruz que piscam em tempos diferentes.
  function icone() {
    const L = 32;
    const c = 15.5;
    const bola = grade(L, L);
    for (let y = 0; y < L; y++) {
      for (let x = 0; x < L; x++) {
        const dx = x - c;
        const dy = y - c;
        if (Math.hypot(dx, dy) > 9.6) continue;
        const luz = Math.hypot(dx + 3.2, dy + 3.6); // distância do ponto de luz
        let k = '#5f7a12';                           // borda escura (sombra)
        if (luz < 1.7) k = '#ffffff';
        else if (luz < 3.4) k = '#f8ffd0';
        else if (luz < 6) k = '#ecff86';
        else if (luz < 9) k = '#d6f24a';
        else if (luz < 11.4) k = '#a9c92a';
        else if (luz < 12.8) k = '#86a51d';
        // reflexo de baixo (luz rebatida), como numa esfera de vidro
        if (dx - 1 > 0 && dy > 4.2 && Math.hypot(dx - 2.4, dy - 5.6) < 2.2) k = '#c7e45a';
        por(bola, x, y, k);
      }
    }
    contornar(bola);
    // Halo suave (não pixelado) atrás da esfera, pulsando devagar.
    const halo = '<defs><radialGradient id="vlh" cx="50%" cy="50%" r="50%">'
      + '<stop offset="45%" stop-color="#d6f24a" stop-opacity=".55"/><stop offset="70%" stop-color="#d6f24a" stop-opacity=".18"/><stop offset="100%" stop-color="#d6f24a" stop-opacity="0"/>'
      + '</radialGradient></defs>'
      + '<circle cx="16" cy="16" r="16" fill="url(#vlh)"><animate attributeName="opacity" values=".55;1;.55" dur="2.4s" repeatCount="indefinite"/></circle>';
    // Faíscas em cruz (pixels), cada uma piscando no seu tempo.
    const faisca = (x, y, atraso, cor) => '<g fill="' + cor + '" opacity="0">'
      + '<rect x="' + x + '" y="' + (y - 1) + '" width="1" height="3"/><rect x="' + (x - 1) + '" y="' + y + '" width="3" height="1"/>'
      + '<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.15;.3;1" dur="2.4s" begin="' + atraso + 's" repeatCount="indefinite"/></g>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + L + ' ' + L + '" width="' + L + '" height="' + L + '">'
      + halo + '<g shape-rendering="crispEdges">' + retangulos(bola, 0, 0) + faisca(26, 6, 0.3, '#fbffd6') + faisca(5, 25, 1.4, '#ecff86') + '</g></svg>';
  }

  function dataUrl(svg) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  const api = { vagalume, logo, icone, dataUrl, COR };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    raiz.VL = raiz.VL || {};
    raiz.VL.marca = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
