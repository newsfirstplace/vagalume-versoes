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
  const sorteio = (n, semente) => Math.abs(Math.floor(Math.sin((semente || Date.now()) * 12.9898) * 43758.5453)) % n;

  // Quantos caracteres do começo estão certos e onde está o primeiro erro (ou -1).
  function conferir(frase, digitado) {
    const d = String(digitado || '');
    let certos = 0;
    while (certos < d.length && certos < frase.length && d[certos] === frase[certos]) certos++;
    return { certos, erroEm: certos < d.length ? certos : -1, completo: certos === frase.length && d.length === frase.length };
  }
  // Palavras por minuto: 5 caracteres contam como uma palavra.
  function ppm(caracteres, ms) { return ms > 0 ? Math.round((caracteres / 5) / (ms / 60000)) : 0; }

  // Estado da corrida (guardado por quem abriu a mesa): jogadores { nome: { pos, fimMs, bot } }.
  function nova(jogadores, semente) {
    const frase = FRASES[sorteio(FRASES.length, semente)];
    const j = {};
    for (const p of jogadores) j[p.nome] = { pos: 0, fimMs: null, bot: p.bot || null };
    return { frase, jogadores: j, comeca: Date.now() + 3500, fim: null };
  }
  // Ação de quem digita: { pos } (caracteres certos). Devolve true se mudou algo.
  function aplicar(e, nome, acao, agora) {
    const p = e.jogadores[nome];
    if (!p || p.fimMs != null || e.fim || !acao) return false;
    const t = agora == null ? Date.now() : agora;
    if (t < e.comeca) return false;
    const pos = Math.max(0, Math.min(e.frase.length, Number(acao.pos) | 0));
    if (pos <= p.pos) return false;
    p.pos = pos;
    if (pos === e.frase.length) p.fimMs = t - e.comeca;
    fechar(e);
    return true;
  }
  // Os bots andam pelo relógio de quem abriu a mesa.
  function andarBots(e, agora) {
    let mudou = false;
    const t = agora == null ? Date.now() : agora;
    for (const [nome, p] of Object.entries(e.jogadores)) {
      if (!p.bot || p.fimMs != null || t < e.comeca) continue;
      const porSeg = (NIVEIS_BOT[p.bot] || 45) * 5 / 60;
      const pos = Math.min(e.frase.length, Math.floor((t - e.comeca) / 1000 * porSeg));
      if (pos > p.pos) mudou = aplicar(e, nome, { pos }, t) || mudou;
    }
    return mudou;
  }
  function fechar(e) {
    if (e.fim) return;
    const todos = Object.values(e.jogadores);
    if (todos.every((p) => p.fimMs != null)) e.fim = { ordem: classificacao(e) };
  }
  // Ordem: quem terminou (pelo tempo) e depois quem andou mais.
  function classificacao(e) {
    return Object.entries(e.jogadores).sort(([, a], [, b]) => (a.fimMs == null) - (b.fimMs == null) || (a.fimMs != null ? a.fimMs - b.fimMs : b.pos - a.pos)).map(([nome]) => nome);
  }
  // Tempo-limite: 90 s depois do começo, a corrida acaba com quem estiver na frente.
  function tempoEsgotado(e, agora) {
    if (e.fim || (agora == null ? Date.now() : agora) < e.comeca + 90000) return false;
    e.fim = { ordem: classificacao(e), tempo: true };
    return true;
  }

  const api = { FRASES, NIVEIS_BOT, conferir, ppm, nova, aplicar, andarBots, classificacao, tempoEsgotado };
  raiz.VL = raiz.VL || {};
  raiz.VL.corrida = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
