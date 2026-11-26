// Vagalume — Ludo para 2 a 4 (pedido do usuário em 2026-11-26). Puro: tabuleiro 15 × 15, regras, bot.
// Cada um tem 4 peões na base. Tire 6 para sair. Ande o número do dado pelo caminho (52 casas) e depois pela
// reta da sua cor (5 casas) até o centro, com o número exato. Cair na casa de um adversário o manda para a
// base (menos nas casas seguras: as de saída e as estrelas). Tirar 6 ou capturar dá mais uma jogada.
(function (raiz) {
  'use strict';
  // Caminho em volta (52 casas, [linha, coluna]), começando na saída do jogador 0.
  const CAMINHO = (function () {
    const c = [];
    const seg = (l0, c0, dl, dc, n) => { for (let k = 0; k < n; k++) c.push([l0 + dl * k, c0 + dc * k]); };
    seg(6, 1, 0, 1, 5); seg(5, 6, -1, 0, 6); seg(0, 7, 0, 1, 2); seg(1, 8, 1, 0, 5); seg(6, 9, 0, 1, 6); seg(7, 14, 1, 0, 2);
    seg(8, 13, 0, -1, 5); seg(9, 8, 1, 0, 6); seg(14, 7, 0, -1, 2); seg(13, 6, -1, 0, 5); seg(8, 5, 0, -1, 6); seg(7, 0, -1, 0, 2);
    return c;
  })();
  const SAIDA = [0, 13, 26, 39];
  const SEGURAS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  // Reta de cada cor (5 casas antes do centro) e a base (4 lugares no canto).
  const RETA = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]];
  const BASE = [[[2, 2], [2, 3], [3, 2], [3, 3]], [[2, 11], [2, 12], [3, 11], [3, 12]], [[11, 11], [11, 12], [12, 11], [12, 12]], [[11, 2], [11, 3], [12, 2], [12, 3]]];
  const CORES = ['lima', 'azul', 'rosa', 'laranja'];
  const FIM = 56; // progresso: -1 base, 0..50 caminho (relativo à saída), 51..55 reta, 56 centro

  function nova(jogadores, aleatorio) {
    const lugares = jogadores.length === 2 ? [0, 2] : [0, 1, 2, 3].slice(0, jogadores.length);
    const js = jogadores.slice(0, 4).map((p, i) => ({ nome: p.nome, bot: p.bot || null, lugar: lugares[i], peoes: [-1, -1, -1, -1] }));
    return { js, vez: 0, dado: null, rolou: false, seis: 0, fim: null, ultimo: null, desde: Date.now(), sorte: aleatorio || null };
  }
  const absoluta = (lugar, prog) => (SAIDA[lugar] + prog) % 52;
  // Onde o peão fica no tabuleiro ([linha, coluna]) ou null no centro.
  function casa(lugar, prog, i) {
    if (prog < 0) return BASE[lugar][i];
    if (prog <= 50) return CAMINHO[absoluta(lugar, prog)];
    if (prog <= 55) return RETA[lugar][prog - 51];
    return null;
  }
  function destino(prog, d) {
    if (prog < 0) return d === 6 ? 0 : null;
    const n = prog + d;
    return n <= FIM ? n : null;
  }
  const podeMover = (e, j, d) => j.peoes.map((p) => destino(p, d) != null);
  const daVez = (e) => e.js[e.vez];
  function passarVez(e) { e.vez = (e.vez + 1) % e.js.length; e.rolou = false; e.dado = null; e.seis = 0; e.desde = Date.now(); }

  // Ações: { tipo: 'rolar' } | { tipo: 'mover', peao }.
  function aplicar(e, nome, a) {
    const j = daVez(e);
    if (e.fim || !a || !j || j.nome !== nome) return false;
    if (a.tipo === 'rolar') {
      if (e.rolou) return false;
      e.dado = 1 + Math.floor((e.sorte || Math.random)() * 6);
      e.rolou = true; e.desde = Date.now();
      e.ultimo = { nome, tipo: 'rolou', dado: e.dado };
      if (e.dado === 6 && ++e.seis === 3) { e.ultimo.tres = true; passarVez(e); return true; } // três seis seguidos: perde a vez
      if (!podeMover(e, j, e.dado).some(Boolean)) passarVez(e);
      return true;
    }
    if (a.tipo !== 'mover' || !e.rolou) return false;
    const i = Number(a.peao);
    const novo = destino(j.peoes[i], e.dado);
    if (!(i >= 0 && i < 4) || novo == null) return false;
    j.peoes[i] = novo;
    let capturou = false;
    if (novo <= 50) {
      const abs = absoluta(j.lugar, novo);
      if (!SEGURAS.has(abs)) for (const o of e.js) if (o !== j) o.peoes.forEach((p, k) => { if (p >= 0 && p <= 50 && absoluta(o.lugar, p) === abs) { o.peoes[k] = -1; capturou = true; } });
    }
    e.ultimo = { nome, tipo: 'moveu', dado: e.dado, capturou, chegou: novo === FIM };
    if (j.peoes.every((p) => p === FIM)) { e.fim = { ordem: [j.nome].concat(e.js.filter((o) => o !== j).sort((x, y) => soma(y) - soma(x)).map((o) => o.nome)) }; return true; }
    if (e.dado === 6 || capturou || novo === FIM) { e.rolou = false; e.dado = null; e.desde = Date.now(); } else passarVez(e);
    return true;
  }
  const soma = (j) => j.peoes.reduce((s, p) => s + Math.max(0, p), 0);
  // Bot: captura > chegar > sair da base > fugir para casa segura > o peão mais adiantado.
  function jogadaDoBot(e) {
    const j = daVez(e);
    if (!e.rolou) return { tipo: 'rolar' };
    let melhor = null, nota = -1;
    j.peoes.forEach(function (p, i) {
      const n = destino(p, e.dado);
      if (n == null) return;
      let s = n;
      if (n === FIM) s += 200;
      if (p < 0) s += 150;
      if (n <= 50) {
        const abs = absoluta(j.lugar, n);
        if (!SEGURAS.has(abs) && e.js.some((o) => o !== j && o.peoes.some((q) => q >= 0 && q <= 50 && absoluta(o.lugar, q) === abs))) s += 300;
        if (SEGURAS.has(abs)) s += 40;
      }
      if (s > nota) { nota = s; melhor = i; }
    });
    return melhor == null ? null : { tipo: 'mover', peao: melhor };
  }
  function tick(e, agora) {
    const j = daVez(e);
    if (e.fim || !j || !j.bot || (agora == null ? Date.now() : agora) - e.desde < 800) return false;
    const a = jogadaDoBot(e);
    return a ? aplicar(e, j.nome, a) : false;
  }
  function sair(e, nome) {
    const i = e.js.findIndex((j) => j.nome === nome);
    if (i < 0) return;
    e.js.splice(i, 1);
    if (e.js.length < 2) { e.fim = { ordem: e.js.map((j) => j.nome), texto: 'Os outros saíram.' }; return; }
    if (i < e.vez) e.vez--;
    if (e.vez >= e.js.length) e.vez = 0;
    e.rolou = false; e.dado = null;
  }
  function visao(e) {
    const j = daVez(e);
    return { js: e.js.map((x) => ({ nome: x.nome, bot: !!x.bot, lugar: x.lugar, peoes: x.peoes.slice() })), vez: j ? j.nome : null, dado: e.dado, rolou: e.rolou, ultimo: e.ultimo,
      movem: j && e.rolou ? podeMover(e, j, e.dado) : [false, false, false, false], fim: !!e.fim };
  }
  const api = { CAMINHO, SAIDA, SEGURAS, RETA, BASE, CORES, FIM, nova, casa, destino, aplicar, jogadaDoBot, tick, sair, visao, absoluta };
  raiz.VL = raiz.VL || {};
  raiz.VL.ludo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
