// Vagalume — Corrida de digitação (pedido do usuário em 2026-11-26, no estilo dos jogos de digitar rápido).
// Puro (sem página): frases próprias em português, conta de acertos e de palavras por minuto, e o estado da
// corrida que a pessoa que abriu a mesa guarda (as outras mandam quanto já digitaram).
(function (raiz) {
  'use strict';
  const FRASES = [
    'O vagalume acendeu a cauda e o quarto inteiro ficou verde por um instante.',
    'Quem chega cedo ao quarto escolhe o melhor lugar perto da janela.',
    'Uma pilha de mobis bem feita parece mágica para quem olha de longe.',
    'Ela trocou o visual três vezes antes de sair para a festa do hotel.',
    'O piso quadriculado combinava com a luz azul que vinha do teto.',
    'Ninguém sabia quem tinha colocado aquela cadeira em cima da mesa.',
    'Depois da chuva, as luzes da cidade pareciam vagalumes no asfalto.',
    'O segredo de uma boa construção é paciência e um pouco de altura.',
    'Os amigos combinaram de se encontrar no quarto do grupo às oito.',
    'Quando a música começou, todo mundo correu para a pista de dança.',
    'A raposa pulou o muro baixo e sumiu no meio do jardim escuro.',
    'Um café quente e uma boa conversa resolvem quase qualquer problema.',
    'O mapa do tesouro estava escondido atrás do quadro da sala.',
    'Cada pixel daquele balão foi pintado com muito cuidado e carinho.',
    'Na praia, o vento levou o chapéu dela para longe das ondas.',
    'O relógio da praça marcava meia-noite quando a luz se apagou.',
    'Aprender a digitar rápido é como aprender a andar de bicicleta.',
    'O gato dormia em cima do teclado e escreveu uma palavra estranha.',
    'Ganhar é bom, mas jogar com os amigos é o que deixa a noite boa.',
    'A lua cheia iluminava o lago e os sapos cantavam sem parar.',
    'Ele guardou a última fatia de bolo para dividir com a irmã.',
    'No fim da trilha havia uma cachoeira e uma pedra perfeita para sentar.',
    'O foguete subiu devagar e depois sumiu entre as nuvens brancas.',
    'Quem planta flores no domingo colhe sorrisos durante a semana.',
    'O robô aprendeu a fazer pipoca, mas sempre queimava a primeira leva.',
    'As estrelas pareciam mais perto naquela noite fria de inverno.',
    'Uma boa partida de xadrez começa com calma e termina com atenção.',
    'O carteiro tocou a campainha duas vezes e deixou o pacote na porta.',
    'Pinte o quarto da cor que te deixa feliz quando você acorda.',
    'O trem atrasou cinco minutos e todo mundo reclamou ao mesmo tempo.',
  ];
  const NIVEIS_BOT = { facil: 28, medio: 48, dificil: 75 }; // palavras por minuto
  const DURACAO = 90000, LARGADA = 3500, PAUSA = 7000, FOLGA_BOTS = 8000;

  // Quantos caracteres do começo estão certos e onde está o primeiro erro (ou -1).
  function conferir(frase, digitado) {
    const d = String(digitado || '');
    let certos = 0;
    while (certos < d.length && certos < frase.length && d[certos] === frase[certos]) certos++;
    return { certos, erroEm: certos < d.length ? certos : -1, completo: certos === frase.length && d.length === frase.length };
  }
  // Palavras por minuto: 5 caracteres contam como uma palavra.
  function ppm(caracteres, ms) { return ms > 0 ? Math.round((caracteres / 5) / (ms / 60000)) : 0; }

  // Estado (guardado por quem abriu a mesa): várias rodadas, cada uma com uma frase nova; pontos por colocação.
  // opcoes = { rodadas: 1 a 10 }. jogadores da rodada: { nome: { pos, fimMs, bot } }.
  function nova(jogadores, opcoes, agora) {
    const t = agora == null ? Date.now() : agora;
    const rodadas = Math.max(1, Math.min(10, Number(opcoes && opcoes.rodadas) || 1));
    const e = { rodada: 0, rodadas, placar: {}, bots: {}, usadas: [], historico: [], jogadores: {}, frase: '', comeca: 0, pausaAte: null, limiteBots: null, ultima: null, fim: null };
    for (const p of jogadores) { e.placar[p.nome] = 0; if (p.bot) e.bots[p.nome] = p.bot; }
    proximaRodada(e, t);
    return e;
  }
  function proximaRodada(e, t) {
    const livres = FRASES.map((_, i) => i).filter((i) => !e.usadas.includes(i));
    const lista = livres.length ? livres : FRASES.map((_, i) => i);
    const i = lista[Math.floor(Math.random() * lista.length)];
    e.usadas.push(i);
    e.rodada++;
    e.frase = FRASES[i];
    e.jogadores = {};
    for (const nome of Object.keys(e.placar)) e.jogadores[nome] = { pos: 0, fimMs: null, bot: e.bots[nome] || null };
    e.comeca = t + LARGADA; e.pausaAte = null; e.limiteBots = null;
  }
  // Ação de quem digita: { pos } (caracteres certos). Devolve true se mudou algo.
  function aplicar(e, nome, acao, agora) {
    const p = e.jogadores[nome];
    if (!p || p.fimMs != null || e.fim || e.pausaAte != null || !acao) return false;
    const t = agora == null ? Date.now() : agora;
    if (t < e.comeca) return false;
    const pos = Math.max(0, Math.min(e.frase.length, Number(acao.pos) | 0));
    if (pos <= p.pos) return false;
    p.pos = pos;
    if (pos === e.frase.length) p.fimMs = t - e.comeca;
    if (Object.values(e.jogadores).every((x) => x.fimMs != null)) fecharRodada(e, t, false);
    return true;
  }
  // Os bots andam pelo relógio de quem abriu a mesa.
  function andarBots(e, agora) {
    let mudou = false;
    const t = agora == null ? Date.now() : agora;
    if (e.fim || e.pausaAte != null) return false;
    for (const [nome, p] of Object.entries(e.jogadores)) {
      if (!p.bot || p.fimMs != null || t < e.comeca) continue;
      const porSeg = (NIVEIS_BOT[p.bot] || 45) * 5 / 60;
      const pos = Math.min(e.frase.length, Math.floor((t - e.comeca) / 1000 * porSeg));
      if (pos > p.pos) mudou = aplicar(e, nome, { pos }, t) || mudou;
    }
    return mudou;
  }
  // Fim da rodada: pontos pela colocação (o 1º leva tantos pontos quantos jogadores; quem não terminou, 0).
  function fecharRodada(e, t, porTempo) {
    const ordem = classificacao(e), n = ordem.length, pontos = {}, ppms = {}, tempos = {};
    ordem.forEach(function (nome, i) {
      const p = e.jogadores[nome];
      pontos[nome] = p.fimMs != null ? n - i : 0;
      e.placar[nome] = (e.placar[nome] || 0) + pontos[nome];
      tempos[nome] = p.fimMs;
      ppms[nome] = ppm(p.fimMs != null ? e.frase.length : p.pos, p.fimMs != null ? p.fimMs : Math.max(1, t - e.comeca));
    });
    e.ultima = { rodada: e.rodada, ordem, pontos, ppm: ppms, tempos, porTempo: !!porTempo };
    e.historico.push(e.ultima);
    if (e.rodada >= e.rodadas) e.fim = { ordem: geral(e), tempo: !!porTempo, placar: Object.assign({}, e.placar) };
    else e.pausaAte = t + PAUSA;
  }
  // Ordem da rodada: quem terminou (pelo tempo) e depois quem andou mais.
  function classificacao(e) {
    return Object.entries(e.jogadores).sort(([, a], [, b]) => (a.fimMs == null) - (b.fimMs == null) || (a.fimMs != null ? a.fimMs - b.fimMs : b.pos - a.pos)).map(([nome]) => nome);
  }
  // Ordem geral: mais pontos; no empate, quem foi melhor na última rodada.
  function geral(e) {
    const ult = e.ultima ? e.ultima.ordem : [];
    return Object.keys(e.placar).sort((a, b) => e.placar[b] - e.placar[a] || ult.indexOf(a) - ult.indexOf(b));
  }
  // Tempo-limite: 90 s depois do começo, a rodada acaba com quem estiver na frente.
  function tempoEsgotado(e, agora) {
    const t = agora == null ? Date.now() : agora;
    if (e.fim || e.pausaAte != null || t < e.comeca + DURACAO) return false;
    fecharRodada(e, t, true);
    return true;
  }
  // Relógio do anfitrião: bots, tempo-limite, folga para os bots lentos e o intervalo entre as rodadas.
  function tick(e, agora) {
    const t = agora == null ? Date.now() : agora;
    if (e.fim) return false;
    if (e.pausaAte != null) { if (t < e.pausaAte) return false; proximaRodada(e, t); return true; }
    if (andarBots(e, t) || tempoEsgotado(e, t)) return true;
    const ps = Object.values(e.jogadores);
    if (!e.limiteBots && ps.some((p) => p.bot && p.fimMs == null) && ps.every((p) => p.bot || p.fimMs != null)) { e.limiteBots = t + FOLGA_BOTS; return true; }
    if (e.limiteBots && t >= e.limiteBots) { fecharRodada(e, t, false); return true; }
    return false;
  }
  // Alguém saiu da mesa no meio da corrida.
  function sair(e, nome) {
    delete e.jogadores[nome]; delete e.placar[nome]; delete e.bots[nome];
    if (e.fim || e.pausaAte != null) return;
    const ps = Object.values(e.jogadores);
    if (!ps.length) { e.fim = { ordem: [], placar: {} }; return; }
    if (ps.every((p) => p.fimMs != null)) fecharRodada(e, Date.now(), false);
  }

  const api = { FRASES, NIVEIS_BOT, DURACAO, conferir, ppm, nova, aplicar, andarBots, classificacao, geral, tempoEsgotado, tick, sair };
  raiz.VL = raiz.VL || {};
  raiz.VL.corrida = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
