// Vagalume — balão de "digitando" personalizado (2026-11-20, pedido do usuário). Contas puras.
// O desenho do jogo (avatar_addition_user_typing, 22 × 18, no pacote avatar_additions.nitro) tem
// três cores: contorno e bolinhas pretos, miolo cinza-claro e um brilho branco em cima. Os estilos
// do Vagalume repintam esse mesmo desenho com outras cores; "jogo" deixa o original.
(function (raiz) {
  'use strict';
  // c = contorno, m = miolo, b = brilho, 1/2/3 = bolinhas (da esquerda para a direita), . = vazio.
  const FORMA = [
    '.....cccccccccccc.....',
    '...ccmmmmmmmmmmmmcc...',
    '..cmbbbbbbbbbbbbbbmc..',
    '.cmbbbbbbbbbbbbbbbbmc.',
    '.cmmbbbbbbbbbbbbbbmmc.',
    'cmmmmmmmmmmmmmmmmmmmmc',
    'cmmmmmmmmmmmmmmmmmmmmc',
    'cmmmmmmmmmmmmmmmmmmmmc',
    'cmmmmm11mm22mm33mmmmmc',
    '.cmmmm11mm22mm33mmmmc.',
    '.cmmmmmmmmmmmmmmmmmmc.',
    '..cmmmmmmmmmmmmmmmmc..',
    '...ccmmmmmmmmmmmmcc...',
    '.....ccmmmmcccccc.....',
    '......cmmmc...........',
    '......cmmc............',
    '......cmc.............',
    '......cc..............',
  ];
  const LARGURA = 22;
  const ALTURA = 18;
  // Cores em hexadecimal; as bolinhas podem ter uma cor cada.
  const ESTILOS = [
    { id: 'jogo', nome: 'Do jogo (original)', cores: { c: '#000000', m: '#ececec', b: '#ffffff', 1: '#000000', 2: '#000000', 3: '#000000' } },
    { id: 'vagalume', nome: 'Vagalume (escuro com bolinhas limão)', cores: { c: '#0b0e14', m: '#263042', b: '#36435c', 1: '#d6f24a', 2: '#d6f24a', 3: '#d6f24a' } },
    { id: 'limao', nome: 'Limão (limão com bolinhas escuras)', cores: { c: '#2c3a06', m: '#d6f24a', b: '#f2ffb0', 1: '#12161f', 2: '#12161f', 3: '#12161f' } },
    { id: 'noite', nome: 'Noite (bolinhas acendendo)', cores: { c: '#05070b', m: '#151a24', b: '#202838', 1: '#5f7a12', 2: '#9bbf22', 3: '#e9ff7a' } },
    { id: 'brilho', nome: 'Brilho (branco com contorno limão)', cores: { c: '#6f8f10', m: '#ffffff', b: '#ffffff', 1: '#8fb11a', 2: '#8fb11a', 3: '#8fb11a' } },
  ];
  // Balões temáticos em imagem (core/digitando-temas.js): maiores que o do jogo e já com os quadros.
  const TEMAS = ['pergaminho', 'floresta', 'neon', 'galaxia', 'bolha', 'explosao', 'gatinho', 'coracao', 'nuvem', 'melancia', 'gelo', 'docinho', 'vulcao'];
  const IDS = ESTILOS.map((e) => e.id).concat(TEMAS);

  function rgb(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Pixels RGBA (22 × 18) do estilo; null para estilo desconhecido.
  function pixels(id) {
    const e = ESTILOS.find((x) => x.id === id);
    if (!e) return null;
    const saida = new Uint8ClampedArray(LARGURA * ALTURA * 4);
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const k = FORMA[y][x];
        if (k === '.') continue;
        const [r, g, b] = rgb(e.cores[k]);
        const i = (y * LARGURA + x) * 4;
        saida[i] = r; saida[i + 1] = g; saida[i + 2] = b; saida[i + 3] = 255;
      }
    }
    return saida;
  }
  function valido(id) { return IDS.includes(id); }

  // Animação (2026-11-20, pedido do usuário): as três bolinhas pulam uma depois da outra, como
  // "digitando". QUADROS quadros de PASSO_MS cada; em cada quadro a bolinha k está ALTURAS[...]
  // pixels acima do lugar (o miolo do balão tem 3 linhas livres acima das bolinhas).
  const QUADROS = 8;
  const PASSO_MS = 110;
  const SUBIDA = [0, 1, 2, 1, 0, 0, 0, 0];
  const COLUNAS_BOLINHAS = { 1: 6, 2: 10, 3: 14 }; // coluna da esquerda de cada bolinha 2 × 2
  const LINHA_BOLINHAS = 8;
  function quadro(id, n) {
    const e = ESTILOS.find((x) => x.id === id);
    if (!e) return null;
    const saida = new Uint8ClampedArray(LARGURA * ALTURA * 4);
    const pintar = (x, y, cor) => {
      const [r, g, b] = rgb(cor);
      const i = (y * LARGURA + x) * 4;
      saida[i] = r; saida[i + 1] = g; saida[i + 2] = b; saida[i + 3] = 255;
    };
    // O balão sem as bolinhas (no lugar delas, o miolo).
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const k = FORMA[y][x];
        if (k === '.') continue;
        pintar(x, y, /[123]/.test(k) ? e.cores.m : e.cores[k]);
      }
    }
    // As bolinhas, cada uma na sua altura neste quadro (atraso de 2 quadros entre elas).
    for (const k of ['1', '2', '3']) {
      const sobe = SUBIDA[((n - 2 * (Number(k) - 1)) % QUADROS + QUADROS) % QUADROS];
      const x0 = COLUNAS_BOLINHAS[k];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) pintar(x0 + dx, LINHA_BOLINHAS + dy - sobe, e.cores[k]);
    }
    return saida;
  }
  function quadros(id) {
    if (!ESTILOS.some((e) => e.id === id)) return null;
    return Array.from({ length: QUADROS }, (_, n) => quadro(id, n));
  }

  // Zzz de ausente nas cores do balão Limão (2026-11-20, pedido do usuário; uma cor só, sem escolha).
  // Mesmos desenhos do jogo (avatar_addition_user_idle_<lado>_<1|2>, em avatar_additions.nitro),
  // conferidos pixel a pixel: c = contorno, b = parte clara de cima, m = parte de baixo.
  const ZZZ = {
    left_1: ['cccccccc....', 'cbbbbbbc....', 'cbbbbbbc....', 'cccccbbc....', '...cbbc.....', '..cmmc......', '.cmmc.......', 'cmmccccc....', 'cmmmmmmc....', 'cmmmmmmc....', 'cccccccc....', '............', '............', '............', '......cccccc', '......cbbbbc', '......ccccmc', '........cmc.', '.......cmc..', '......cmcccc', '......cmmmmc', '......cccccc'],
    left_2: ['cccccccc.', 'cbbbbbbc.', 'cbbbbbbc.', 'cccccbbc.', '...cbbc..', '..cmmc...', '.cmmc....', 'cmmccccc.', 'cmmmmmmc.', 'cmmmmmmc.', 'cccccccc.', '.........', '.........', '...cccccc', '...cbbbbc', '...ccccmc', '.....cmc.', '....cmc..', '...cmcccc', '...cmmmmc', '...cccccc'],
    right_1: ['....cccccccc', '....cbbbbbbc', '....cbbbbbbc', '....cccccbbc', '.......cbbc.', '......cmmc..', '.....cmmc...', '....cmmccccc', '....cmmmmmmc', '....cmmmmmmc', '....cccccccc', '............', '............', 'cccccc......', 'cbbbbc......', 'ccccmc......', '..cmc.......', '.cmc........', 'cmcccc......', 'cmmmmc......', 'cccccc......'],
    right_2: ['cccccccc', 'cbbbbbbc', 'cbbbbbbc', 'cccccbbc', '...cbbc.', '..cmmc..', '.cmmc...', 'cmmccccc', 'cmmmmmmc', 'cmmmmmmc', 'cccccccc', '........', '........', '........', 'cccccc..', 'cbbbbc..', 'ccccmc..', '..cmc...', '.cmc....', 'cmcccc..', 'cmmmmc..', 'cccccc..'],
  };
  // Pixels RGBA de um desenho do Zzz no tema Limão: { largura, altura, pixels }.
  function zzz(nome) {
    const forma = ZZZ[nome];
    if (!forma) return null;
    const cores = ESTILOS.find((e) => e.id === 'limao').cores;
    const largura = forma[0].length, altura = forma.length;
    const pixels = new Uint8ClampedArray(largura * altura * 4);
    for (let y = 0; y < altura; y++) {
      for (let x = 0; x < largura; x++) {
        const k = forma[y][x];
        if (k === '.') continue;
        const [r, g, b] = rgb(cores[k]);
        const i = (y * largura + x) * 4;
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
      }
    }
    return { largura, altura, pixels };
  }

  const api = { FORMA, LARGURA, ALTURA, ESTILOS, TEMAS, IDS, QUADROS, PASSO_MS, ZZZ, pixels, valido, quadros, zzz };
  raiz.VL = raiz.VL || {};
  raiz.VL.digitando = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
