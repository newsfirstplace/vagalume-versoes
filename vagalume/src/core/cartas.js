// Vagalume — Vagacartas: jogo de descartar cartas por cor ou número (pedido do usuário em 2026-11-26, no estilo
// dos jogos de cartas coloridas). Puro: baralho, regras, bot e o que cada jogador vê.
// Regras: na sua vez, jogue uma carta da mesma cor ou do mesmo número/símbolo da carta de cima, ou um coringa.
// Sem carta, compre uma; se a comprada servir, pode jogar, senão passa. Especiais: Pular, Inverter, +2, Coringa
// (escolhe a cor) e Coringa +4. Ao ficar com uma carta, aperte "Última!" antes de jogar a penúltima ou compre 2.
// Ganha quem ficar sem cartas.
(function (raiz) {
  'use strict';
  const CORES = ['lima', 'azul', 'rosa', 'laranja'];
  const ESPECIAIS = ['pular', 'inverter', '+2'];

  function baralho() {
    const c = [];
    let id = 1;
    for (const cor of CORES) {
      c.push({ id: id++, cor, valor: '0' });
      for (let n = 1; n <= 9; n++) for (let k = 0; k < 2; k++) c.push({ id: id++, cor, valor: String(n) });
      for (const v of ESPECIAIS) for (let k = 0; k < 2; k++) c.push({ id: id++, cor, valor: v });
    }
    for (let k = 0; k < 4; k++) { c.push({ id: id++, cor: null, valor: 'coringa' }); c.push({ id: id++, cor: null, valor: '+4' }); }
    return c;
  }
  function embaralhar(lista, aleatorio) {
    const a = lista.slice(), r = aleatorio || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const curinga = (c) => c.cor == null;

  function nova(jogadores, aleatorio) {
    const pilha = embaralhar(baralho(), aleatorio);
    const maos = {}, ordem = jogadores.map((p) => p.nome), bots = {};
    for (const p of jogadores) { maos[p.nome] = pilha.splice(0, 7); if (p.bot) bots[p.nome] = p.bot; }
    // A primeira carta da mesa é um número.
    let i = pilha.findIndex((c) => /^\d$/.test(c.valor));
    const topo = pilha.splice(i, 1)[0];
    return { pilha, descarte: [topo], cor: topo.cor, maos, ordem, bots, vez: 0, sentido: 1, comprada: null, ultima: {}, fim: null, ultimaJogada: null, n: 0, desde: Date.now() };
  }
  const topo = (e) => e.descarte[e.descarte.length - 1];
  const daVez = (e) => e.ordem[e.vez];
  function serve(e, c) { const t = topo(e); return curinga(c) || c.cor === e.cor || c.valor === t.valor; }
  function proximo(e, passos) { const n = e.ordem.length; e.vez = ((e.vez + e.sentido * (passos || 1)) % n + n) % n; e.comprada = null; e.desde = Date.now(); }
  function comprar(e, nome, n) {
    const mao = e.maos[nome];
    for (let k = 0; k < n; k++) {
      if (!e.pilha.length) { // remonta a pilha com o descarte (menos a de cima)
        const t = e.descarte.pop();
        e.pilha = embaralhar(e.descarte);
        e.descarte = [t];
        if (!e.pilha.length) break;
      }
      mao.push(e.pilha.pop());
    }
  }

  // Ação: { tipo: 'jogar', id, cor? } | { tipo: 'comprar' } | { tipo: 'passar' } | { tipo: 'ultima' }.
  function aplicar(e, nome, a) {
    if (e.fim || !a || !e.maos[nome]) return false;
    if (a.tipo === 'ultima') { if (e.maos[nome].length <= 2) { e.ultima[nome] = true; return true; } return false; }
    if (daVez(e) !== nome) return false;
    const mao = e.maos[nome];
    if (a.tipo === 'comprar') {
      if (e.comprada != null) return false;
      comprar(e, nome, 1);
      const c = mao[mao.length - 1];
      e.ultimaJogada = { n: ++e.n, nome, tipo: 'comprou', qtd: 1 };
      if (c && serve(e, c)) e.comprada = c.id; else proximo(e);
      return true;
    }
    if (a.tipo === 'passar') { if (e.comprada == null) return false; e.ultimaJogada = { n: ++e.n, nome, tipo: 'passou' }; proximo(e); return true; }
    if (a.tipo !== 'jogar') return false;
    const i = mao.findIndex((c) => c.id === Number(a.id));
    if (i < 0) return false;
    const c = mao[i];
    if (e.comprada != null && c.id !== e.comprada) return false; // depois de comprar, só a comprada
    if (!serve(e, c)) return false;
    if (curinga(c) && !CORES.includes(a.cor)) return false;
    mao.splice(i, 1);
    e.descarte.push(c);
    e.cor = curinga(c) ? a.cor : c.cor;
    e.ultimaJogada = { n: ++e.n, nome, tipo: 'jogou', carta: c, cor: e.cor };
    // Esqueceu de avisar a última carta: compra 2.
    if (mao.length === 1 && !e.ultima[nome]) { comprar(e, nome, 2); e.ultimaJogada.esqueceu = true; }
    if (mao.length !== 1) e.ultima[nome] = false;
    if (!mao.length) { e.fim = { ordem: [nome].concat(e.ordem.filter((n) => n !== nome).sort((x, y) => e.maos[x].length - e.maos[y].length)) }; return true; }
    const n = e.ordem.length;
    if (c.valor === 'inverter') { e.sentido = -e.sentido; proximo(e, n === 2 ? 2 : 1); }
    else if (c.valor === 'pular') proximo(e, 2);
    else if (c.valor === '+2' || c.valor === '+4') { proximo(e); e.ultimaJogada.vitima = daVez(e); e.ultimaJogada.qtd = c.valor === '+2' ? 2 : 4; comprar(e, daVez(e), e.ultimaJogada.qtd); proximo(e); }
    else proximo(e);
    return true;
  }
  // Bot: joga a primeira carta que serve (prefere a mesma cor e deixa os coringas para depois).
  function jogadaDoBot(e, nome) {
    const mao = e.maos[nome];
    if (mao.length === 2 && !e.ultima[nome]) return { tipo: 'ultima' };
    const pode = mao.filter((c) => serve(e, c) && (e.comprada == null || c.id === e.comprada));
    if (!pode.length) return e.comprada != null ? { tipo: 'passar' } : { tipo: 'comprar' };
    pode.sort((x, y) => curinga(x) - curinga(y) || (y.cor === e.cor) - (x.cor === e.cor));
    const c = pode[0];
    if (!curinga(c)) return { tipo: 'jogar', id: c.id };
    const conta = {};
    for (const x of mao) if (x.cor) conta[x.cor] = (conta[x.cor] || 0) + 1;
    const cor = CORES.slice().sort((a, b) => (conta[b] || 0) - (conta[a] || 0))[0];
    return { tipo: 'jogar', id: c.id, cor };
  }
  // O bot joga quando é a vez dele, depois de uma pausa para dar para ver.
  function tick(e, agora) {
    if (e.fim) return false;
    const nome = daVez(e);
    if (!e.bots[nome] || (agora == null ? Date.now() : agora) - e.desde < 1500) return false;
    return aplicar(e, nome, jogadaDoBot(e, nome));
  }
  function sair(e, nome) {
    const i = e.ordem.indexOf(nome);
    if (i < 0) return;
    e.pilha = embaralhar(e.pilha.concat(e.maos[nome]));
    delete e.maos[nome];
    e.ordem.splice(i, 1);
    if (e.ordem.length < 2) { e.fim = { ordem: e.ordem.slice(), texto: 'Os outros saíram.' }; return; }
    if (e.vez >= e.ordem.length || i < e.vez) e.vez = (e.vez - (i < e.vez ? 1 : 0) + e.ordem.length) % e.ordem.length;
    e.comprada = null;
  }
  function visao(e, nome) {
    return {
      mao: (e.maos[nome] || []).slice(), topo: topo(e), descarte: e.descarte.slice(-4), cor: e.cor, vez: daVez(e), sentido: e.sentido, comprada: daVez(e) === nome ? e.comprada : null,
      outros: e.ordem.map((n) => ({ nome: n, cartas: e.maos[n].length, bot: !!e.bots[n], ultima: !!e.ultima[n] })), pilha: e.pilha.length,
      ultimaJogada: e.ultimaJogada, avisei: !!e.ultima[nome], fim: !!e.fim,
    };
  }

  const api = { CORES, baralho, embaralhar, nova, aplicar, serve, jogadaDoBot, tick, sair, visao, topo, daVez };
  raiz.VL = raiz.VL || {};
  raiz.VL.cartas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
