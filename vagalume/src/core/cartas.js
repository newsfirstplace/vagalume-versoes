// Vagalume — ZERA!: jogo de cartas de descartar por cor ou número (pedido do usuário em 2026-11-27, com as regras
// clássicas desse tipo de jogo). Puro: baralho, regras, bots e o que cada jogador vê.
// Regras: na sua vez, jogue uma carta da mesma cor ou do mesmo número/símbolo da carta de cima, ou um coringa.
// Sem carta, compre uma; se a comprada servir, pode jogar, senão a vez passa. Pular, Inverter (com dois jogadores
// vale como Pular), +2, Coringa (escolhe a cor) e Coringa +4. Acúmulo: em cima de um +2 dá para jogar outro +2
// ou um +4; em cima de um +4, só outro +4. Quem não tiver compra tudo e perde a vez.
// Ao ficar com uma carta, avise "Última!"; quem esquecer pode ser pego nos 3 s seguintes e compra 2.
// Ganha quem zerar a mão; os pontos são as cartas que sobraram com os outros.
(function (raiz) {
  'use strict';
  const CORES = ['vermelho', 'amarelo', 'verde', 'azul'];
  const ESPECIAIS = ['pular', 'inverter', '+2'];
  const INICIAIS = 7;
  const JANELA = 3000; // ms para pegar quem esqueceu do "Última!"
  // Quanto tempo cada lance leva na tela (os bots esperam a animação acabar).
  const DURA = { inicio: 0, jogou: 620, coringa: 520, acumulou: 380, pulou: 760, inverteu: 820, comprou: 260, porCarta: 150, passou: 300, ultima: 600, pego: 420, salvou: 450, embaralhou: 800, tempo: 300 };

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
  const coringa = (c) => c.cor == null;
  const pontosDe = (c) => (/^\d$/.test(c.valor) ? Number(c.valor) : coringa(c) ? 50 : 20);
  const pontosDaMao = (mao) => mao.reduce((s, c) => s + pontosDe(c), 0);
  const agoraDe = (agora) => (agora == null ? Date.now() : agora);

  function nova(jogadores, opcoes, aleatorio, agora) {
    const r = aleatorio || Math.random, t = agoraDe(agora);
    const pilha = embaralhar(baralho(), r);
    const maos = {}, ordem = jogadores.map((p) => p.nome), bots = {};
    for (const p of jogadores) { maos[p.nome] = []; if (p.bot) bots[p.nome] = p.bot; }
    // Distribui uma por vez, em volta da mesa (é assim que a tela anima).
    for (let k = 0; k < INICIAIS; k++) for (const n of ordem) maos[n].push(pilha.pop());
    // A primeira carta da mesa é um número.
    const i = pilha.findIndex((c) => /^\d$/.test(c.valor));
    const topo = pilha.splice(i, 1)[0];
    const segundos = Number(opcoes && opcoes.tempo);
    const e = {
      pilha, descarte: [topo], cor: topo.cor, maos, ordem, bots, vez: Math.floor(r() * ordem.length), sentido: 1,
      acumulado: 0, ultimoMais: null, comprada: null, ultima: {}, esquecido: null, fim: null,
      eventos: [], n: 0, livre: t, desde: t, limite: segundos > 0 ? segundos * 1000 : 0, pensa: 0, decidiu: false, rnd: r,
    };
    evento(e, { t: 'inicio', topo, vez: e.ordem[e.vez] }, 900 + ordem.length * INICIAIS * 70, t);
    e.desde = e.livre;
    e.pensa = 700 + r() * 700;
    return e;
  }
  const topo = (e) => e.descarte[e.descarte.length - 1];
  const daVez = (e) => e.ordem[e.vez];
  const vizinho = (e, passos) => e.ordem[((e.vez + e.sentido * passos) % e.ordem.length + e.ordem.length) % e.ordem.length];
  // A carta pode ser jogada agora? Com +2/+4 pendente, só acumular.
  function pode(e, c) {
    if (e.acumulado > 0) return c.valor === '+4' || (c.valor === '+2' && e.ultimoMais === '+2');
    return coringa(c) || c.cor === e.cor || c.valor === topo(e).valor;
  }
  function evento(e, ev, dura, agora) {
    ev.n = ++e.n;
    e.eventos.push(ev);
    if (e.eventos.length > 30) e.eventos.shift();
    e.livre = Math.max(e.livre, agoraDe(agora)) + (dura || 0);
    return ev;
  }
  function proximo(e, passos, agora) {
    const n = e.ordem.length;
    e.vez = ((e.vez + e.sentido * passos) % n + n) % n;
    e.comprada = null;
    e.decidiu = false;
    e.desde = Math.max(e.livre, agoraDe(agora));
    e.pensa = 650 + e.rnd() * 750;
  }
  function comprar(e, nome, n, agora) {
    const mao = e.maos[nome];
    let feitas = 0;
    for (let k = 0; k < n; k++) {
      if (!e.pilha.length) { // remonta o monte com o descarte (menos a de cima); coringas voltam sem cor
        if (e.descarte.length <= 1) break;
        const t = e.descarte.pop();
        e.pilha = embaralhar(e.descarte, e.rnd);
        e.descarte = [t];
        evento(e, { t: 'embaralhou', qtd: e.pilha.length }, DURA.embaralhou, agora);
      }
      mao.push(e.pilha.pop());
      feitas++;
    }
    if (mao.length > 2) e.ultima[nome] = false;
    return feitas;
  }
  // Quem pode pegar quem esqueceu: cada bot decide se percebe e em quanto tempo (pelo nível).
  const PERCEBE = { facil: [0.3, 1700, 2700], normal: [0.6, 1000, 1900], dificil: [0.9, 550, 1100] };
  function abrirJanela(e, nome, agora) {
    const inicio = Math.max(e.livre, agoraDe(agora));
    const bots = {};
    for (const b of e.ordem) {
      const nivel = e.bots[b];
      if (!nivel) continue;
      const [chance, de, ate] = PERCEBE[nivel] || PERCEBE.normal;
      if (b === nome) { if (e.rnd() < (nivel === 'facil' ? 0.2 : 0.45)) bots[b] = inicio + 700 + e.rnd() * 1500; continue; }
      if (e.rnd() < chance) bots[b] = inicio + de + e.rnd() * (ate - de);
    }
    e.esquecido = { nome, ate: inicio + JANELA, bots };
  }
  function fechar(e, agora) { e.esquecido = null; e.desde = Math.max(e.desde, e.livre, agoraDe(agora)); }

  // Ação: { tipo: 'jogar', id, cor? } | 'comprar' | 'passar' | 'ultima' | 'pegar'.
  function aplicar(e, nome, a, agora) {
    if (e.fim || !a || !e.maos[nome]) return false;
    const t = agoraDe(agora), mao = e.maos[nome];
    // Alguém esqueceu do "Última!": até a janela fechar, só dá para avisar (quem esqueceu) ou pegar (os outros).
    if (e.esquecido) {
      const w = e.esquecido;
      if (a.tipo === 'ultima' && nome === w.nome) { e.ultima[nome] = true; evento(e, { t: 'salvou', quem: nome }, DURA.salvou, t); fechar(e, t); return true; }
      if (a.tipo === 'pegar' && nome !== w.nome && e.maos[w.nome]) {
        evento(e, { t: 'pego', quem: w.nome, por: nome }, DURA.pego, t);
        const q = comprar(e, w.nome, 2, t);
        evento(e, { t: 'comprou', quem: w.nome, qtd: q, castigo: true }, DURA.comprou + q * DURA.porCarta, t);
        fechar(e, t);
        return true;
      }
      return false;
    }
    if (a.tipo === 'pegar') return false;
    if (a.tipo === 'ultima') {
      if (mao.length > 2 || e.ultima[nome]) return false;
      e.ultima[nome] = true;
      evento(e, { t: 'ultima', quem: nome }, DURA.ultima, t);
      return true;
    }
    if (daVez(e) !== nome) return false;
    if (a.tipo === 'comprar') {
      if (e.acumulado > 0) {
        const total = e.acumulado;
        e.acumulado = 0; e.ultimoMais = null;
        const q = comprar(e, nome, total, t);
        evento(e, { t: 'comprou', quem: nome, qtd: q, acumulo: total }, DURA.comprou + q * DURA.porCarta, t);
        proximo(e, 1, t);
        return true;
      }
      if (e.comprada != null) return false;
      const q = comprar(e, nome, 1, t);
      evento(e, { t: 'comprou', quem: nome, qtd: q }, DURA.comprou + q * DURA.porCarta, t);
      const c = mao[mao.length - 1];
      if (q && pode(e, c)) { e.comprada = c.id; e.desde = Math.max(e.livre, t); } else proximo(e, 1, t);
      return true;
    }
    if (a.tipo === 'passar') {
      if (e.comprada == null) return false;
      evento(e, { t: 'passou', quem: nome }, DURA.passou, t);
      proximo(e, 1, t);
      return true;
    }
    if (a.tipo !== 'jogar') return false;
    const i = mao.findIndex((c) => c.id === Number(a.id));
    if (i < 0) return false;
    const c = mao[i];
    if (e.comprada != null && c.id !== e.comprada) return false; // depois de comprar, só a comprada
    if (!pode(e, c)) return false;
    if (coringa(c) && !CORES.includes(a.cor)) return false;
    mao.splice(i, 1);
    e.descarte.push(c);
    e.cor = coringa(c) ? a.cor : c.cor;
    e.comprada = null;
    evento(e, { t: 'jogou', quem: nome, carta: c, cor: e.cor, resta: mao.length }, DURA.jogou + (coringa(c) ? DURA.coringa : 0), t);
    if (c.valor === '+2' || c.valor === '+4') {
      e.acumulado += c.valor === '+2' ? 2 : 4;
      e.ultimoMais = c.valor;
      evento(e, { t: 'acumulou', quem: nome, total: e.acumulado, alvo: vizinho(e, 1) }, DURA.acumulou, t);
    }
    if (!mao.length) {
      // Zerou com +2/+4: o próximo ainda compra o que estava acumulado (conta nos pontos).
      if (e.acumulado > 0) {
        const alvo = vizinho(e, 1), total = e.acumulado;
        e.acumulado = 0; e.ultimoMais = null;
        const q = comprar(e, alvo, total, t);
        evento(e, { t: 'comprou', quem: alvo, qtd: q, acumulo: total }, DURA.comprou + q * DURA.porCarta, t);
      }
      const outros = e.ordem.filter((n) => n !== nome).sort((x, y) => pontosDaMao(e.maos[x]) - pontosDaMao(e.maos[y]) || e.maos[x].length - e.maos[y].length);
      const pontos = outros.reduce((s, n) => s + pontosDaMao(e.maos[n]), 0);
      e.fim = { ordem: [nome].concat(outros), pontos };
      evento(e, { t: 'venceu', quem: nome, pontos }, 0, t);
      return true;
    }
    const n = e.ordem.length;
    if (c.valor === 'inverter') {
      e.sentido = -e.sentido;
      evento(e, { t: 'inverteu', quem: nome, sentido: e.sentido }, DURA.inverteu, t);
      if (n === 2) { evento(e, { t: 'pulou', quem: vizinho(e, 1), por: nome }, DURA.pulou, t); proximo(e, 2, t); } else proximo(e, 1, t);
    } else if (c.valor === 'pular') {
      evento(e, { t: 'pulou', quem: vizinho(e, 1), por: nome }, DURA.pulou, t);
      proximo(e, 2, t);
    } else proximo(e, 1, t);
    // Ficou com uma carta sem avisar: abre a janela para alguém pegar (o jogo espera ela fechar).
    if (mao.length === 1 && !e.ultima[nome]) { evento(e, { t: 'esqueceu', quem: nome }, 0, t); abrirJanela(e, nome, t); }
    return true;
  }

  // ---------- bots ----------
  function corPreferida(e, mao, nivel) {
    if (nivel === 'facil' && e.rnd() < 0.4) return CORES[Math.floor(e.rnd() * 4)];
    const conta = {};
    for (const x of mao) if (x.cor) conta[x.cor] = (conta[x.cor] || 0) + (nivel === 'dificil' ? 1 + pontosDe(x) / 20 : 1);
    const ordem = CORES.slice().sort((a, b) => (conta[b] || 0) - (conta[a] || 0));
    return conta[ordem[0]] ? ordem[0] : CORES[Math.floor(e.rnd() * 4)];
  }
  function jogadaDoBot(e, nome) {
    const mao = e.maos[nome], nivel = e.bots[nome] || 'normal';
    const opcoes = mao.filter((c) => pode(e, c) && (e.comprada == null || c.id === e.comprada));
    const com = (c) => (coringa(c) ? { tipo: 'jogar', id: c.id, cor: corPreferida(e, mao.filter((x) => x !== c), nivel) } : { tipo: 'jogar', id: c.id });
    if (e.acumulado > 0) {
      if (!opcoes.length || (nivel === 'facil' && e.rnd() < 0.25)) return { tipo: 'comprar' };
      opcoes.sort((x, y) => (x.valor === '+4') - (y.valor === '+4')); // guarda o +4 se der para devolver com +2
      return com(opcoes[0]);
    }
    if (!opcoes.length) return e.comprada != null ? { tipo: 'passar' } : { tipo: 'comprar' };
    let escolha;
    if (nivel === 'facil') {
      const comuns = opcoes.filter((c) => !coringa(c));
      const lista = comuns.length && e.rnd() < 0.75 ? comuns : opcoes;
      escolha = lista[Math.floor(e.rnd() * lista.length)];
    } else {
      const prox = e.maos[vizinho(e, 1)] || [];
      const ataque = (c) => ['+2', '+4', 'pular'].includes(c.valor) || (c.valor === 'inverter' && e.ordem.length === 2);
      const nota = (c) => {
        let s = coringa(c) ? -30 : 0;
        if (c.cor === e.cor) s += 6;
        s += pontosDe(c) / (nivel === 'dificil' ? 4 : 10);
        if (nivel === 'dificil' && prox.length <= 2 && ataque(c)) s += 60; // segura quem está perto de zerar
        if (nivel === 'dificil' && c.valor === '+4' && prox.length > 3) s -= 25;
        return s;
      };
      escolha = opcoes.slice().sort((x, y) => nota(y) - nota(x))[0];
    }
    return com(escolha);
  }
  // Bots jogam quando é a vez deles e a animação do lance anterior acabou; também pegam (ou se salvam)
  // na janela do "Última!". Quem não joga a tempo (com o limite ligado) compra e passa.
  function tick(e, agora) {
    if (e.fim) return false;
    const t = agoraDe(agora);
    if (e.esquecido) {
      const w = e.esquecido;
      let quem = null, quando = Infinity;
      for (const b of Object.keys(w.bots)) if (e.maos[b] && w.bots[b] <= t && w.bots[b] < quando) { quem = b; quando = w.bots[b]; }
      if (quem) return aplicar(e, quem, quem === w.nome ? { tipo: 'ultima' } : { tipo: 'pegar' }, t);
      if (t >= w.ate) { evento(e, { t: 'escapou', quem: w.nome }, 0, t); fechar(e, t); return true; }
      return false;
    }
    const nome = daVez(e), nivel = e.bots[nome];
    if (nivel) {
      if (t < Math.max(e.livre, e.desde) + e.pensa) return false;
      const mao = e.maos[nome];
      // Antes de jogar a penúltima, o bot avisa "Última!" (ou esquece, conforme o nível).
      if (!e.decidiu && mao.length === 2 && !e.ultima[nome] && mao.some((c) => pode(e, c) && (e.comprada == null || c.id === e.comprada))) {
        e.decidiu = true;
        if (e.rnd() < (nivel === 'facil' ? 0.55 : nivel === 'dificil' ? 1 : 0.82)) { aplicar(e, nome, { tipo: 'ultima' }, t); e.pensa = 350; return true; }
      }
      const a = jogadaDoBot(e, nome);
      if (aplicar(e, nome, a, t)) return true;
      return aplicar(e, nome, e.comprada != null ? { tipo: 'passar' } : { tipo: 'comprar' }, t);
    }
    if (e.limite && t > Math.max(e.desde, e.livre) + e.limite) {
      evento(e, { t: 'tempo', quem: nome }, DURA.tempo, t);
      if (e.comprada != null) return aplicar(e, nome, { tipo: 'passar' }, t);
      aplicar(e, nome, { tipo: 'comprar' }, t);
      if (e.comprada != null && daVez(e) === nome) aplicar(e, nome, { tipo: 'passar' }, t);
      return true;
    }
    return false;
  }
  function sair(e, nome, agora) {
    const i = e.ordem.indexOf(nome);
    if (i < 0 || e.fim) return;
    const t = agoraDe(agora);
    e.pilha = embaralhar(e.pilha.concat(e.maos[nome]), e.rnd);
    delete e.maos[nome];
    e.ordem.splice(i, 1);
    if (e.esquecido && (e.esquecido.nome === nome)) fechar(e, t);
    if (e.esquecido) delete e.esquecido.bots[nome];
    evento(e, { t: 'saiu', quem: nome }, 0, t);
    if (e.ordem.length < 2) {
      e.fim = { ordem: e.ordem.slice(), pontos: 0, texto: 'Os outros saíram da mesa.' };
      evento(e, { t: 'venceu', quem: e.ordem[0], pontos: 0 }, 0, t);
      return;
    }
    const eraVez = i === e.vez;
    if (i < e.vez || (eraVez && e.sentido < 0)) e.vez--; // a vez segue no sentido do jogo
    e.vez = ((e.vez % e.ordem.length) + e.ordem.length) % e.ordem.length;
    if (eraVez) { e.comprada = null; e.decidiu = false; e.desde = Math.max(e.livre, t); }
  }
  function visao(e, nome, agora) {
    const t = agoraDe(agora), vez = daVez(e);
    return {
      mao: (e.maos[nome] || []).slice(), topo: topo(e), descarte: e.descarte.slice(-6), cor: e.cor, vez, sentido: e.sentido,
      acumulado: e.acumulado, ultimoMais: e.ultimoMais, comprada: vez === nome ? e.comprada : null,
      jogadores: e.ordem.map((n) => ({ nome: n, cartas: e.maos[n].length, bot: e.bots[n] || null, ultima: !!e.ultima[n] })),
      pilha: e.pilha.length, eventos: e.eventos.slice(-18), n: e.n,
      esquecido: e.esquecido ? { nome: e.esquecido.nome, resta: Math.max(0, e.esquecido.ate - t) } : null,
      tempo: e.limite && !e.bots[vez] && !e.fim && !e.esquecido ? { limite: e.limite, resta: Math.max(0, Math.max(e.desde, e.livre) + e.limite - t) } : null,
      livreEm: Math.max(0, e.livre - t), fim: e.fim ? { vencedor: e.fim.ordem[0], pontos: e.fim.pontos } : null,
    };
  }
  function resultado(e) {
    if (!e.fim) return null;
    const detalhe = {};
    e.fim.ordem.forEach((n, i) => {
      const m = e.maos[n] || [];
      detalhe[n] = i === 0 ? (e.fim.pontos ? '+' + e.fim.pontos + ' pontos' : 'Zerou a mão') : m.length + (m.length === 1 ? ' carta · ' : ' cartas · ') + pontosDaMao(m) + ' pts';
    });
    return { ordem: e.fim.ordem, texto: e.fim.texto || e.fim.ordem[0] + ' zerou a mão!', detalhe };
  }

  const api = { CORES, JANELA, baralho, embaralhar, nova, aplicar, pode, jogadaDoBot, tick, sair, visao, resultado, topo, daVez, pontosDe, pontosDaMao };
  raiz.VL = raiz.VL || {};
  raiz.VL.cartas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
