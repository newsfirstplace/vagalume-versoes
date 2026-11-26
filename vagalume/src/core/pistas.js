// Vagalume — Duelo de Pistas: dois times, 25 palavras, e um mestre em cada time que vê quais palavras são de
// quem (pedido do usuário em 2026-11-26, no estilo dos jogos de pistas em equipe; nome e palavras próprios).
// O mestre da vez dá uma pista (uma palavra e um número); o time escolhe palavras. Acertar a do próprio time
// continua (até número + 1); errar para a do outro time ou neutra passa a vez; a palavra-bomba perde na hora.
// Ganha quem revelar todas as suas palavras primeiro.
(function (raiz) {
  'use strict';
  const PALAVRAS = ('abelha abacaxi agulha alface âncora anel aranha arco areia árvore avião bala balão banana banco bandeira barco bateria '
    + 'baú bicicleta bigode bola bolo bomba borracha bota braço bruxa cabelo cachorro cadeira café caixa cama câmera campo caneta canhão '
    + 'carro casa castelo cavalo chapéu chave chocolate chuva cinema circo cobra coelho cofre coroa coruja cozinha dado dente diamante '
    + 'dinossauro disco dragão escada escola escudo espada espelho estrela faca fada fantasma farol fazenda ferro festa fogo foguete folha '
    + 'fonte fruta fumaça gato gelo girafa guitarra helicóptero hospital ilha igreja janela jardim jogo joia lâmpada lápis leão leite lixo '
    + 'livro lobo lua luva maçã madeira mágico mala mapa mar martelo máscara mesa microfone moeda montanha morango mosca motor música navio '
    + 'neve ninja nuvem olho onda ouro ovo palhaço panela papel parede pássaro pato peixe pena pente pérola piano pimenta pinguim pipoca '
    + 'pirata planeta polvo ponte porta praia prato presente quadro queijo rádio raio rainha relógio rio robô roda rosa sapo sereia sino '
    + 'sol sombra sorvete tambor tartaruga teatro telefone tesoura tigre tijolo tomate torre trem trevo tubarão unicórnio urso vaca vampiro '
    + 'vela vento vulcão xícara zebra').split(' ');
  const TIMES = ['lima', 'rosa'];
  const outro = (t) => (t === 'lima' ? 'rosa' : 'lima');
  function embaralhar(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((r || Math.random)() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Times alternados; o primeiro de cada time é o mestre. Quem começa tem 9 palavras, o outro 8.
  function nova(jogadores, aleatorio) {
    const nomes = jogadores.filter((p) => !p.bot).map((p) => p.nome);
    const times = {}, mestres = {};
    nomes.forEach((n, i) => { times[n] = TIMES[i % 2]; });
    for (const t of TIMES) mestres[t] = nomes.find((n) => times[n] === t) || null;
    const comeca = TIMES[Math.floor((aleatorio || Math.random)() * 2)];
    const tipos = embaralhar([].concat(Array(9).fill(comeca), Array(8).fill(outro(comeca)), Array(7).fill('neutra'), ['bomba']), aleatorio);
    const cartas = embaralhar(PALAVRAS, aleatorio).slice(0, 25).map((p, i) => ({ p, tipo: tipos[i], aberta: false }));
    return { cartas, times, mestres, vez: comeca, fase: 'pista', pista: null, restam: null, fim: null, log: [] };
  }
  const faltam = (e, t) => e.cartas.filter((c) => c.tipo === t && !c.aberta).length;
  function trocarVez(e) { e.vez = outro(e.vez); e.fase = 'pista'; e.pista = null; e.restam = null; }
  function ganhar(e, t, motivo) { e.fim = { time: t, motivo, ordem: Object.keys(e.times).filter((n) => e.times[n] === t) }; }

  // Ações: { tipo: 'pista', palavra, n } (só o mestre da vez) | { tipo: 'escolher', i } | { tipo: 'passar' }.
  function aplicar(e, nome, a) {
    if (e.fim || !a || !e.times[nome]) return false;
    const time = e.times[nome], mestre = e.mestres[time] === nome;
    if (time !== e.vez) return false;
    if (a.tipo === 'pista') {
      if (e.fase !== 'pista' || !mestre) return false;
      const palavra = String(a.palavra || '').trim().toLowerCase().slice(0, 24);
      const n = Number(a.n);
      if (!/^[a-zà-ú-]{2,24}$/i.test(palavra) || !Number.isInteger(n) || n < 0 || n > 9) return false;
      if (e.cartas.some((c) => !c.aberta && c.p === palavra)) return false; // a pista não pode ser uma palavra da mesa
      e.pista = { palavra, n }; e.restam = n === 0 ? 25 : n + 1; e.fase = 'palpite';
      e.log.push(nome + ': ' + palavra + ' ' + n);
      return true;
    }
    if (e.fase !== 'palpite' || mestre) return false;
    if (a.tipo === 'passar') { e.log.push(nome + ' passou'); trocarVez(e); return true; }
    if (a.tipo !== 'escolher') return false;
    const c = e.cartas[Number(a.i)];
    if (!c || c.aberta) return false;
    c.aberta = true;
    e.log.push(nome + ' abriu ' + c.p);
    if (c.tipo === 'bomba') { ganhar(e, outro(time), 'bomba'); return true; }
    for (const t of TIMES) if (!faltam(e, t)) { ganhar(e, t, 'todas'); return true; }
    if (c.tipo !== time) { trocarVez(e); return true; }
    if (--e.restam <= 0) trocarVez(e);
    return true;
  }
  function sair(e, nome) {
    const t = e.times[nome];
    delete e.times[nome];
    if (t && e.mestres[t] === nome) e.mestres[t] = Object.keys(e.times).find((n) => e.times[n] === t) || null;
    for (const x of TIMES) if (!Object.values(e.times).includes(x)) { ganhar(e, outro(x), 'saiu'); return; }
  }
  // O mestre vê o tipo de todas; os outros só das abertas.
  function visao(e, nome) {
    const time = e.times[nome] || null, mestre = !!time && e.mestres[time] === nome;
    return {
      cartas: e.cartas.map((c) => ({ p: c.p, aberta: c.aberta, tipo: c.aberta || mestre || e.fim ? c.tipo : null })),
      time, mestre, vez: e.vez, fase: e.fase, pista: e.pista, restam: e.restam, mestres: e.mestres,
      times: e.times, faltam: { lima: faltam(e, 'lima'), rosa: faltam(e, 'rosa') }, log: e.log.slice(-6), fim: e.fim,
    };
  }
  const api = { PALAVRAS, TIMES, nova, aplicar, sair, visao, faltam };
  raiz.VL = raiz.VL || {};
  raiz.VL.pistas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
