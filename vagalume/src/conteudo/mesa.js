// Vagalume — mesa de jogos para mais de duas pessoas (pedido do usuário em 2026-11-26).
// Quem abre a mesa é o anfitrião: guarda o estado do jogo, roda os bots e manda a cada jogador o que ele pode
// ver. Os outros só mandam as jogadas. Tudo vai pelo canal direto entre Vagalumes do mesmo quarto
// (VL.comunidade.direto). Cada jogo é um "plugin" registrado com VL.mesa.registrar(id, def):
//   def = { nome, glifo, texto, fatos: [3 textos], min, max, minPessoas?, bots: [[id, rótulo]],
//           opcoes?: [{ id, rotulo, valores: [[id, texto]], padrao }], nova(jogadores, opcoes),
//           aplicar(estado, nome, acao), tick?(estado) -> mudou, sair?(estado, nome), visao(estado, nome),
//           fim(estado) -> null | { ordem, texto, vencedores?, detalhe? }, montar(api) -> { el, atualizar(visao) } }
// A janela usa o visual da janela de Jogos (classes vl-jg-*, do módulo Jogos, que é quem inicia a mesa).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada) return;
  const camada = VL.camada;
  const el = camada.el;
  const JOGOS = {};
  const CSS = `
  .vl-jg.vl-ms { width: min(900px, calc(100vw - 24px)); }
  .vl-ms .vl-jg-corpo { padding: 14px 16px 16px; }
  .vl-ms-arte { position: absolute; inset: 0; pointer-events: none; }
  .vl-jg-cartao .vl-jg-mini.corrida, .vl-jg-cartao .vl-jg-mini.cartas, .vl-jg-cartao .vl-jg-mini.pistas, .vl-jg-cartao .vl-jg-mini.ludo, .vl-jg-cartao .vl-jg-mini.sinuca,
  .vl-jg-arte.corrida, .vl-jg-arte.cartas, .vl-jg-arte.pistas, .vl-jg-arte.ludo, .vl-jg-arte.sinuca { position: relative; overflow: hidden; -webkit-text-stroke: 0; }
  .vl-ms-convite-arte { position: relative; overflow: hidden; width: 72px; height: 72px; margin: 0 auto 10px; border-radius: 18px; font-size: 44px; box-shadow: 0 10px 22px rgba(0,0,0,.45); }
  /* Corrida: teclado com um vagalume correndo */
  .vl-jg-cartao .vl-jg-mini.corrida, .vl-jg-arte.corrida, .vl-ms-convite-arte.corrida { background: repeating-linear-gradient(0deg, transparent 0 17%, rgba(214,242,74,.13) 17% 19%), linear-gradient(160deg, #2a3346, #10141d); }
  .vl-ms-arte.corrida .teclas { position: absolute; left: 12%; right: 12%; top: 38%; height: 40%; border-radius: 12% / 20%; background-color: #1b2130;
    box-shadow: 0 .05em 0 #07090d, inset 0 0 0 .03em rgba(214,242,74,.55);
    background-image: linear-gradient(#d6f24a, #d6f24a), repeating-linear-gradient(90deg, #e9eef6 0 10%, transparent 10% 13%), repeating-linear-gradient(90deg, #e9eef6 0 10%, transparent 10% 13%);
    background-size: 44% 15%, 86% 19%, 78% 19%; background-position: 50% 84%, 50% 16%, 46% 48%; background-repeat: no-repeat; }
  .vl-ms-arte.corrida .rastro { position: absolute; left: 14%; top: 17%; width: 52%; height: 9%; border-radius: 99px; background: linear-gradient(90deg, transparent, rgba(214,242,74,.75)); }
  .vl-ms-arte.corrida .luz { position: absolute; left: 60%; top: 9%; width: 24%; height: 24%; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fbffd0, #d6f24a 55%, #6f8f10); box-shadow: 0 0 .3em #d6f24a; }
  /* Vagacartas: leque de cartas */
  .vl-jg-cartao .vl-jg-mini.cartas, .vl-jg-arte.cartas, .vl-ms-convite-arte.cartas { background: radial-gradient(circle at 50% 38%, #2f6a4a, #16362a 78%); }
  .vl-ms-arte.cartas i { position: absolute; left: 50%; bottom: 13%; width: 36%; height: 56%; margin-left: -18%; border-radius: 14% / 10%; border: .045em solid #fff; transform-origin: 50% 100%; box-shadow: 0 .05em .12em rgba(0,0,0,.5); box-sizing: border-box; }
  .vl-ms-arte.cartas i::after { content: ''; position: absolute; inset: 17% 10%; border-radius: 50%; background: rgba(255,255,255,.92); transform: rotate(-24deg); }
  .vl-ms-arte.cartas i:nth-child(1) { background: #3a8ee8; transform: rotate(-26deg); }
  .vl-ms-arte.cartas i:nth-child(2) { background: #f39232; transform: rotate(-9deg); }
  .vl-ms-arte.cartas i:nth-child(3) { background: #ea5a9e; transform: rotate(9deg); }
  .vl-ms-arte.cartas i:nth-child(4) { background: #1a1d26; transform: rotate(26deg); }
  .vl-ms-arte.cartas i:nth-child(4)::after { background: conic-gradient(#b9dc2e 0 25%, #3a8ee8 0 50%, #ea5a9e 0 75%, #f39232 0); }
  /* Duelo de Pistas: grade de palavras */
  .vl-jg-cartao .vl-jg-mini.pistas, .vl-jg-arte.pistas, .vl-ms-convite-arte.pistas { background: linear-gradient(160deg, #2b2340, #141824); }
  .vl-ms-arte.pistas { display: grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); gap: 7%; padding: 15%; }
  .vl-ms-arte.pistas i { border-radius: 20%; background: #e9e2cf; box-shadow: 0 .04em 0 rgba(0,0,0,.45); }
  .vl-ms-arte.pistas i.l { background: #b9dc2e; } .vl-ms-arte.pistas i.r { background: #ea5a9e; }
  .vl-ms-arte.pistas i.b { background: #0b0d12; box-shadow: inset 0 0 0 .035em #e5484d, 0 .04em 0 rgba(0,0,0,.45); }
  /* Ludo: tabuleiro de quatro cores */
  .vl-jg-cartao .vl-jg-mini.ludo, .vl-jg-arte.ludo, .vl-ms-convite-arte.ludo { background:
    conic-gradient(from -45deg, #3a8ee8 0 25%, #ea5a9e 0 50%, #f39232 0 75%, #b9dc2e 0) 50% 50% / 30% 30% no-repeat,
    linear-gradient(#f4f6fa, #f4f6fa) 50% 50% / 30% 100% no-repeat, linear-gradient(#f4f6fa, #f4f6fa) 50% 50% / 100% 30% no-repeat,
    conic-gradient(#3a8ee8 0 25%, #ea5a9e 0 50%, #f39232 0 75%, #b9dc2e 0); }
  .vl-ms-arte.ludo i { position: absolute; width: 21%; height: 21%; border-radius: 24%; background: #fff; box-shadow: 0 .03em .05em rgba(0,0,0,.3); }
  .vl-ms-arte.ludo i::after { content: ''; position: absolute; inset: 24%; border-radius: 50%; box-shadow: inset 0 -.03em 0 rgba(0,0,0,.3); }
  .vl-ms-arte.ludo i:nth-child(1) { left: 7%; top: 7%; } .vl-ms-arte.ludo i:nth-child(1)::after { background: #b9dc2e; }
  .vl-ms-arte.ludo i:nth-child(2) { right: 7%; top: 7%; } .vl-ms-arte.ludo i:nth-child(2)::after { background: #3a8ee8; }
  .vl-ms-arte.ludo i:nth-child(3) { right: 7%; bottom: 7%; } .vl-ms-arte.ludo i:nth-child(3)::after { background: #ea5a9e; }
  .vl-ms-arte.ludo i:nth-child(4) { left: 7%; bottom: 7%; } .vl-ms-arte.ludo i:nth-child(4)::after { background: #f39232; }
  /* Sinuca: pano verde, borda de madeira e bolas */
  .vl-jg-cartao .vl-jg-mini.sinuca, .vl-jg-arte.sinuca, .vl-ms-convite-arte.sinuca { background: radial-gradient(ellipse at 50% 45%, #2fa066, #17703f 68%, #0f4d2c); }
  .vl-jg-arte.sinuca { box-shadow: inset 0 0 0 .1em #4b2f19, inset 0 0 0 .13em #23150b, inset 0 0 .3em .13em rgba(0,0,0,.5), 0 12px 26px rgba(0,0,0,.45); }
  .vl-jg-cartao .vl-jg-mini.sinuca, .vl-ms-convite-arte.sinuca { box-shadow: inset 0 0 0 .1em #4b2f19, inset 0 0 .25em .1em rgba(0,0,0,.45); }
  .vl-ms-arte.sinuca i { position: absolute; width: 25%; height: 25%; border-radius: 50%; box-shadow: .02em .05em .06em rgba(0,0,0,.55); }
  .vl-ms-arte.sinuca i::before { content: ''; position: absolute; left: 18%; top: 14%; width: 32%; height: 26%; border-radius: 50%; background: rgba(255,255,255,.8); }
  .vl-ms-arte.sinuca i.b0 { left: 15%; top: 21%; background: radial-gradient(circle at 40% 35%, #fff, #e9e4d6 60%, #b9b3a3); }
  .vl-ms-arte.sinuca i.b1 { left: 27%; top: 55%; background: radial-gradient(circle at 40% 35%, #ffe27a, #f2c41b 55%, #a17f06); }
  .vl-ms-arte.sinuca i.b11 { left: 61%; top: 58%; background: linear-gradient(#f3efe4 0 27%, #e23a2e 27% 73%, #f3efe4 73%); }
  .vl-ms-arte.sinuca i.b8 { left: 51%; top: 28%; background: radial-gradient(circle at 50% 50%, #fff 0 23%, #2b2b2b 25%, #050505 75%); }
  .vl-ms-arte.sinuca i.b8::after { content: '8'; position: absolute; inset: 0; display: grid; place-items: center; font: 900 .15em/1 system-ui, sans-serif; color: #111; }
  .vl-jg-heroi.corrida { background: linear-gradient(120deg, rgba(214,242,74,.26), rgba(214,242,74,0) 62%), #151a25; }
  .vl-jg-heroi.cartas { background: linear-gradient(120deg, rgba(234,90,158,.38), rgba(243,146,50,.12) 45%, rgba(0,0,0,0) 70%), #151a25; }
  .vl-jg-heroi.pistas { background: linear-gradient(120deg, rgba(150,110,230,.4), rgba(150,110,230,0) 62%), #151a25; }
  .vl-jg-heroi.ludo { background: linear-gradient(120deg, rgba(58,142,232,.42), rgba(185,220,46,.12) 50%, rgba(0,0,0,0) 72%), #151a25; }
  .vl-jg-heroi.sinuca { background: linear-gradient(120deg, rgba(31,150,88,.5), rgba(31,150,88,0) 62%), #151a25; }
  .vl-ms-opcoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px 16px; }
  .vl-ms-op { display: flex; flex-direction: column; gap: 6px; }
  .vl-ms-op .vl-jg-rotulo { margin: 0; }
  .vl-ms-lugares { display: flex; flex-direction: column; gap: 6px; max-height: 236px; overflow: auto; padding-right: 2px; }
  .vl-ms-lugar.vazio { border: 1px dashed rgba(255,255,255,.12); background: transparent; }
  .vl-ms-lugar.vazio .vl-jg-cabeca { background: rgba(255,255,255,.05); color: #6c778c; }
  .vl-ms-lugar.vazio .quem b { color: #7f8aa0; font-weight: 500; }
  .vl-ms-lugar.bot .quem small::before { background: #9b8cff; }
  .vl-ms-tag { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: rgba(214,242,74,.14); color: #e9ffa0; border: 1px solid rgba(214,242,74,.3); white-space: nowrap; }
  .vl-ms-bots { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.07); }
  .vl-ms-bots-linha { display: flex; gap: 8px; align-items: center; }
  .vl-ms-bots-linha .vl-jg-seg { flex: 1; }
  .vl-jg-seg button:disabled { cursor: default; opacity: .55; }
  .vl-jg-seg button[aria-pressed="true"]:disabled { opacity: .8; }
  .vl-ms-espera { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; background: rgba(214,242,74,.06); border: 1px solid rgba(214,242,74,.2); color: #e9ffa0; }
  .vl-ms-espera i { width: 10px; height: 10px; flex: none; border-radius: 50%; background: #d6f24a; box-shadow: 0 0 10px #d6f24a; animation: vl-ms-pisca 1.2s ease-in-out infinite; }
  @keyframes vl-ms-pisca { 50% { opacity: .25; transform: scale(.7); } }
  .vl-ms-comecar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .vl-ms-comecar .vl-jg-botao.grande { margin-top: 0; min-width: 220px; }
  .vl-ms-comecar .vl-jg-nota { margin: 0; }
  .vl-ms-convite { pointer-events: auto; position: fixed; z-index: 40; left: 50%; top: 40%; transform: translate(-50%, -50%); width: min(340px, calc(100vw - 24px)); background: linear-gradient(180deg, #1a1f2b, #10131b); border: 1px solid rgba(214,242,74,.6); border-radius: 18px; padding: 18px; color: #e8eef7; text-align: center; box-shadow: 0 0 30px rgba(214,242,74,.22), 0 20px 50px rgba(0,0,0,.6); font: 13px/1.4 system-ui, sans-serif; }
  .vl-ms-convite b { display: block; font-size: 15px; }
  .vl-ms-convite p { color: #aab5c7; margin: 6px 0 0; font-size: 12px; }
  .vl-ms-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; align-items: center; justify-content: center; }
  .vl-ms-acoes .vl-jg-botao { min-width: 110px; }
  .vl-ms-res { position: relative; margin-top: 14px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(214,242,74,.1), rgba(214,242,74,.02)); border: 1px solid rgba(214,242,74,.3); }
  .vl-ms-res h3 { margin: 0 0 14px; font-size: 18px; color: #f2ffc0; text-align: center; text-transform: none; letter-spacing: 0; }
  .vl-ms-podio { display: flex; align-items: flex-end; justify-content: center; gap: 10px; }
  .vl-ms-degrau { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 128px; min-width: 0; }
  .vl-ms-degrau .vl-jg-cabeca { width: 40px; height: 40px; }
  .vl-ms-degrau.p1 .vl-jg-cabeca { width: 48px; height: 48px; box-shadow: 0 0 0 2px #f2d14b, 0 0 16px rgba(242,209,75,.6); }
  .vl-ms-degrau b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .vl-ms-degrau small { color: #c9d3e2; font-size: 11.5px; }
  .vl-ms-degrau .bloco { width: 100%; border-radius: 10px 10px 4px 4px; display: grid; place-items: center; font: 900 22px system-ui, sans-serif; color: #241c05; box-shadow: inset 0 2px 0 rgba(255,255,255,.4); }
  .vl-ms-degrau.p1 .bloco { height: 84px; background: linear-gradient(180deg, #f6e27a, #c99a22); }
  .vl-ms-degrau.p2 .bloco { height: 60px; background: linear-gradient(180deg, #eef2f7, #a2adbd); }
  .vl-ms-degrau.p3 .bloco { height: 44px; background: linear-gradient(180deg, #f2bf92, #ad6a36); }
  .vl-ms-resto { margin: 12px auto 0; max-width: 380px; display: grid; gap: 4px; }
  .vl-ms-resto div { display: flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 8px; background: rgba(255,255,255,.04); }
  .vl-ms-resto div span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vl-ms-resto small { color: #aab5c7; }
  .vl-ms-vencedores { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .vl-ms-vencedores span { display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px; background: rgba(242,209,75,.12); border: 1px solid rgba(242,209,75,.45); font-weight: 600; }
  @media (max-width: 640px) { .vl-ms-degrau { width: 96px; } }
  `;
  const sessaoNova = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const NOMES_BOT = ['Bot Faísca', 'Bot Lume', 'Bot Brilho', 'Bot Estrela', 'Bot Cometa', 'Bot Neon', 'Bot Pirilampo'];
  // Desenho de cada jogo (cartão da lista de jogos, cabeçalho da sala e convite); escala pelo tamanho da caixa.
  const ARTE = {
    corrida: () => [el('i', { class: 'teclas' }), el('i', { class: 'rastro' }), el('i', { class: 'luz' })],
    cartas: () => [el('i'), el('i'), el('i'), el('i')],
    pistas: () => ['', 'l', '', 'r', 'b', 'l', '', 'r', ''].map((c) => el('i', { class: c || null })),
    ludo: () => [el('i'), el('i'), el('i'), el('i')],
    sinuca: () => ['b0', 'b1', 'b11', 'b8'].map((c) => el('i', { class: c })),
  };
  function arte(id) {
    if (!ARTE[id]) return document.createTextNode(JOGOS[id] ? JOGOS[id].glifo : '');
    return el('span', { class: 'vl-ms-arte ' + id, 'aria-hidden': 'true' }, ARTE[id]());
  }
  // Opções do jogo (rodadas, modo…): só valores conhecidos; o que faltar fica no padrão.
  function opcoesValidas(def, op) {
    const r = {};
    for (const o of def.opcoes || []) { const v = op && op[o.id]; r[o.id] = o.valores.some(([id]) => id === v) ? v : o.padrao; }
    return r;
  }

  function registrar(id, def) { JOGOS[id] = def; }

  function iniciar(ctx, opcoesMesa) {
    const op = opcoesMesa || {};
    const estilo = el('style', { texto: CSS });
    camada.area().appendChild(estilo);
    let janela = null, corpo = null, titulo = null, icone = null, voltarBotao = null;
    let mesa = null;   // { jogo, sessao, anfitriao, souAnfitriao, jogadores: [{ nome, bot }], opcoes, nivelBot, fase, estado, versao, visao, tela }
    let convite = null; // convite recebido: { no, relogio }
    let relogio = null;
    const eu = () => (VL.pessoas && VL.pessoas.eu && VL.pessoas.eu()) || 'Você';
    const mesmo = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    const vagalumesNoQuarto = () => ((VL.pessoas && VL.pessoas.lista && VL.pessoas.lista()) || [])
      .filter((n) => !mesmo(n, eu()) && VL.comunidade && VL.comunidade.usaVagalume && VL.comunidade.usaVagalume(n));
    const ehBot = (nome) => !!(mesa && mesa.jogadores.some((p) => p.bot && mesmo(p.nome, nome)));
    // Rosto da pessoa (o módulo Jogos passa o dele); bots ganham o robozinho.
    function rosto(nome) {
      if (ehBot(nome) || /^Bot /.test(String(nome || ''))) return el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: '🤖' });
      if (op.cabeca) return op.cabeca(nome);
      return el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: String(nome || '?').charAt(0).toUpperCase() });
    }
    // Sons curtos dos jogos da mesa (respeitam o ajuste "Sons" dos Jogos).
    let audio = null;
    function som(tipo, forca) {
      try { if (ctx.secao && ctx.secao() && ctx.secao().som === false) return; } catch (e) { /* sem ajuste */ }
      try {
        audio = audio || new (raiz.AudioContext || raiz.webkitAudioContext)();
        const a = audio, t0 = a.currentTime, f = Math.max(0.05, Math.min(1, forca == null ? 0.6 : forca));
        const tom = (freq, dur, vol, onda, ate, atraso) => {
          const t = t0 + (atraso || 0), o = a.createOscillator(), g = a.createGain();
          o.type = onda || 'triangle'; o.frequency.setValueAtTime(freq, t);
          if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
        };
        const ruido = (dur, vol, freq, q, atraso) => {
          const n = Math.max(1, Math.ceil(a.sampleRate * dur)), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
          const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
          s.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q || 1.2; g.gain.value = vol;
          s.connect(bp).connect(g).connect(a.destination); s.start(t0 + (atraso || 0));
        };
        if (tipo === 'bola') { ruido(0.025, 0.55 * f, 3600, 2.4); tom(2100 + 500 * f, 0.02, 0.04 * f, 'sine'); }
        else if (tipo === 'tabela') ruido(0.08, 0.4 * f, 380, 1.1);
        else if (tipo === 'cacapa') { ruido(0.14, 0.45, 240, 0.9); tom(190, 0.2, 0.07, 'sine', 95, 0.03); }
        else if (tipo === 'taco') ruido(0.045, 0.25 + 0.4 * f, 1700, 1.6);
        else if (tipo === 'carta') ruido(0.07, 0.3, 2400, 0.7);
        else if (tipo === 'dado') { for (let k = 0; k < 6; k++) ruido(0.03, 0.35 - k * 0.04, 1500 + k * 260, 2, k * 0.085 + Math.random() * 0.02); }
        else if (tipo === 'pulo') tom(560 + 120 * f, 0.07, 0.06, 'triangle');
        else if (tipo === 'captura') { tom(420, 0.12, 0.08, 'square', 210); tom(210, 0.22, 0.07, 'square', 90, 0.1); }
        else if (tipo === 'chegou') [660, 830, 990, 1320].forEach((fr, k) => tom(fr, 0.16, 0.07, 'triangle', null, k * 0.08));
        else if (tipo === 'vez') { tom(740, 0.1, 0.05, 'sine'); tom(990, 0.14, 0.05, 'sine', null, 0.09); }
        else if (tipo === 'erro') tom(170, 0.12, 0.05, 'square');
        else if (tipo === 'tique') tom(880, 0.05, 0.05, 'sine');
        else if (tipo === 'largada') tom(1320, 0.3, 0.08, 'triangle');
        else if (tipo === 'ponto') { tom(880, 0.09, 0.06, 'triangle'); tom(1320, 0.14, 0.06, 'triangle', null, 0.07); }
      } catch (e) { /* sem som */ }
    }

    function mandar(nome, dado) {
      if (!VL.comunidade || !VL.comunidade.direto) return Promise.resolve(null);
      return VL.comunidade.direto(nome, Object.assign({ s: mesa ? mesa.sessao : dado.s }, dado));
    }
    const pessoas = () => mesa.jogadores.filter((p) => !p.bot && !mesmo(p.nome, eu()));

    // ---------- janela ----------
    function montarJanela() {
      titulo = el('b', { texto: 'Jogos' });
      icone = el('span', { class: 'vl-jg-ic', 'aria-hidden': 'true' });
      voltarBotao = el('button', { type: 'button', class: 'vl-jg-voltar', title: 'Todos os jogos', 'aria-label': 'Todos os jogos', texto: '‹', onclick() { if (mesa && mesa.fase === 'jogo') return; sair(); if (op.voltar) op.voltar(); } });
      const cab = el('div', { class: 'vl-jg-cab' }, [voltarBotao, icone, titulo, el('span', { class: 'vl-jg-esp' }),
        el('button', { type: 'button', title: 'Fechar', 'aria-label': 'Fechar', texto: '×', onclick: sair })]);
      corpo = el('div', { class: 'vl-jg-corpo vl-ms-corpo' });
      janela = el('div', { class: 'vl-jg vl-ms', role: 'dialog', 'aria-label': 'Mesa de jogos', tabindex: '0' }, [cab, corpo]);
      janela.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Escape' && !(mesa && mesa.fase === 'jogo')) sair(); });
      cab.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || ev.target.closest('button')) return;
        const r = janela.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY;
        cab.setPointerCapture(ev.pointerId);
        const mover = (e) => { janela.style.transform = 'none'; janela.style.left = Math.max(0, Math.min(innerWidth - janela.offsetWidth, r.left + e.clientX - x0)) + 'px'; janela.style.top = Math.max(0, Math.min(innerHeight - 44, r.top + e.clientY - y0)) + 'px'; };
        const fim = () => { cab.removeEventListener('pointermove', mover); cab.removeEventListener('pointerup', fim); };
        cab.addEventListener('pointermove', mover); cab.addEventListener('pointerup', fim);
      });
      camada.area().appendChild(janela);
    }
    function mostrar() { if (!janela) montarJanela(); janela.style.display = ''; desenhar(); }

    function desenhar() {
      if (!janela || !mesa) return;
      const def = JOGOS[mesa.jogo];
      titulo.textContent = def.nome;
      icone.textContent = def.glifo;
      voltarBotao.hidden = mesa.fase === 'jogo';
      if (mesa.fase === 'sala') { camada.trocar(corpo, telaSala(def)); return; }
      if (!mesa.tela) { mesa.tela = def.montar(apiTela()); corpo.replaceChildren(mesa.tela.el); }
      if (mesa.visao) mesa.tela.atualizar(mesa.visao);
      const fim = mesa.fase === 'fim' && mesa.resultado;
      const resAntigo = corpo.querySelector('.vl-ms-res');
      if (resAntigo) resAntigo.remove();
      if (fim) {
        corpo.appendChild(telaResultado(fim));
        if (!mesa.festejado) {
          mesa.festejado = true;
          const vencedores = fim.vencedores || (fim.ordem || []).slice(0, 1);
          const venci = vencedores.some((n) => mesmo(n, eu()));
          const pos = (fim.ordem || []).findIndex((n) => mesmo(n, eu()));
          if (op.festa) op.festa(janela, venci ? 'venceu' : 'perdeu', venci ? 'Vitória!' : pos > 0 && !fim.vencedores ? (pos + 1) + 'º lugar' : 'Fim de jogo', String(fim.texto || ''));
        }
      }
    }
    function apiTela() {
      return { eu: eu(), agir, anfitriao: () => mesa && mesa.souAnfitriao, cabeca: rosto, som, opcoes: () => (mesa ? opcoesValidas(JOGOS[mesa.jogo], mesa.opcoes) : {}) };
    }
    // Botões de escolha no jeito da sala do Xadrez.
    function seg(rotulo, opcoes, atual, escolher, desligado) {
      return el('div', { class: 'vl-jg-seg', role: 'group', 'aria-label': rotulo }, opcoes.map(([id, texto]) => el('button', {
        type: 'button', 'aria-pressed': String(atual === id), 'data-foco': 'op-' + rotulo + '-' + id, disabled: !!desligado, onclick() { if (!desligado) escolher(id); },
      }, [el('span', { texto })])));
    }
    function telaSala(def) {
      const anf = mesa.souAnfitriao, jogo = mesa.jogo;
      const escolhas = opcoesValidas(def, mesa.opcoes);
      const cheio = mesa.jogadores.length >= def.max;
      const humanos = mesa.jogadores.filter((p) => !p.bot).length;
      const pode = mesa.jogadores.length >= def.min && humanos >= (def.minPessoas || 0);
      const nivelRotulo = (id) => (def.bots.length > 1 ? 'Bot ' + String((def.bots.find(([b]) => b === id) || [, ''])[1]).toLowerCase() : 'Bot');
      const lugares = mesa.jogadores.map((p) => el('div', { class: 'vl-jg-linha-pessoa vl-ms-lugar' + (p.bot ? ' bot' : '') }, [
        rosto(p.nome),
        el('span', { class: 'quem' }, [el('b', { texto: p.nome + (mesmo(p.nome, eu()) ? ' (você)' : '') }), el('small', { texto: p.bot ? nivelRotulo(p.bot) : mesmo(p.nome, mesa.anfitriao) ? 'Abriu a mesa' : 'Na mesa' })]),
        mesmo(p.nome, mesa.anfitriao) ? el('span', { class: 'vl-ms-tag', texto: 'Anfitrião' }) : null,
        anf && !mesmo(p.nome, eu()) ? el('button', { type: 'button', class: 'vl-jg-botao discreto', 'data-foco': 'tirar-' + p.nome, texto: 'Tirar', onclick() { tirar(p.nome); } }) : null,
      ]));
      for (let k = 0, vagas = Math.min(3, def.max - mesa.jogadores.length); k < vagas; k++) {
        lugares.push(el('div', { class: 'vl-jg-linha-pessoa vl-ms-lugar vazio' }, [el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: '+' }), el('span', { class: 'quem' }, [el('b', { texto: 'Lugar livre' })])]));
      }
      if (!mesa.nivelBot && def.bots.length) mesa.nivelBot = def.bots[Math.min(1, def.bots.length - 1)][0];
      const blocoJogadores = el('section', { class: 'vl-jg-bloco' }, [
        el('div', { class: 'vl-jg-bloco-cab' }, [el('span', { class: 'ic', 'aria-hidden': 'true', texto: '🪑' }), el('h3', { texto: 'Na mesa · ' + mesa.jogadores.length + ' de ' + def.max })]),
        el('div', { class: 'vl-ms-lugares' }, lugares),
        anf && def.bots.length ? el('div', { class: 'vl-ms-bots' }, [
          el('span', { class: 'vl-jg-rotulo', texto: 'Adicionar bot' }),
          el('div', { class: 'vl-ms-bots-linha' }, [
            def.bots.length > 1 ? seg('Nível do bot', def.bots, mesa.nivelBot, (id) => { mesa.nivelBot = id; desenhar(); }) : null,
            el('button', { type: 'button', class: 'vl-jg-botao', 'data-foco': 'mais-bot', disabled: cheio, onclick() { botNovo(mesa.nivelBot); } }, [el('span', { texto: '+ 🤖 Bot' })]),
          ]),
        ]) : null,
      ]);
      let blocoLado;
      if (anf) {
        const convidados = vagalumesNoQuarto();
        const linhas = convidados.length ? convidados.map((n) => {
          const dentro = mesa.jogadores.some((p) => mesmo(p.nome, n));
          const chamado = mesa.chamados && mesa.chamados.has(n.toLowerCase());
          return el('div', { class: 'vl-jg-linha-pessoa' }, [rosto(n),
            el('span', { class: 'quem' }, [el('b', { texto: n }), el('small', { texto: dentro ? 'Já está na mesa' : chamado ? 'Esperando aceitar…' : 'Neste quarto' })]),
            el('button', { type: 'button', class: 'vl-jg-botao' + (dentro || chamado ? ' discreto' : ''), 'data-foco': 'conv-' + n, texto: dentro ? 'Na mesa' : chamado ? 'Chamado' : 'Convidar', disabled: dentro || chamado || cheio, onclick() { convidar(n); } })]);
        }) : [el('div', { class: 'vl-jg-vazio' }, [el('b', { texto: 'Ninguém com o Vagalume no quarto' }), el('span', { texto: def.bots.length ? 'Dá para jogar com bots enquanto isso.' : 'Este jogo precisa de pessoas: chame quem usa o Vagalume para o quarto.' })])];
        blocoLado = el('section', { class: 'vl-jg-bloco' }, [
          el('div', { class: 'vl-jg-bloco-cab' }, [el('span', { class: 'ic', 'aria-hidden': 'true', texto: '👥' }), el('h3', { texto: 'Chamar quem está no quarto' })]),
          el('div', { class: 'vl-jg-gente' }, linhas),
          el('p', { class: 'vl-jg-nota', texto: 'O convite aparece na tela da pessoa; ela precisa usar o Vagalume.' }),
        ]);
      } else {
        blocoLado = el('section', { class: 'vl-jg-bloco' }, [
          el('div', { class: 'vl-jg-bloco-cab' }, [el('span', { class: 'ic', 'aria-hidden': 'true', texto: '⏳' }), el('h3', { texto: 'Esperando começar' })]),
          el('div', { class: 'vl-ms-espera' }, [el('i'), el('span', { texto: mesa.anfitriao + ' vai começar a partida.' })]),
          el('p', { class: 'vl-jg-nota', texto: 'Quem abriu a mesa escolhe as regras, chama os jogadores e começa.' }),
          el('button', { type: 'button', class: 'vl-jg-botao discreto grande', 'data-foco': 'sair-mesa', texto: 'Sair da mesa', onclick: sair }),
        ]);
      }
      const opcoes = (def.opcoes || []).length ? el('div', { class: 'vl-ms-opcoes' }, def.opcoes.map((o) => el('div', { class: 'vl-ms-op' }, [
        el('span', { class: 'vl-jg-rotulo', texto: o.rotulo + (anf ? '' : ' (escolhido por ' + mesa.anfitriao + ')') }),
        seg(o.rotulo, o.valores, escolhas[o.id], (id) => { mesa.opcoes = Object.assign({}, escolhas, { [o.id]: id }); avisarSala(); }, !anf),
      ]))) : null;
      return [el('div', { class: 'vl-jg-sala' }, [
        el('div', { class: 'vl-jg-heroi ' + jogo }, [
          el('span', { class: 'vl-jg-arte ' + jogo, 'aria-hidden': 'true' }, [arte(jogo)]),
          el('div', { class: 'vl-jg-heroi-texto' }, [
            el('h2', { texto: def.nome }),
            el('p', { texto: def.texto }),
            def.fatos ? el('div', { class: 'vl-jg-fatos' }, def.fatos.map((x) => el('span', { class: 'vl-jg-fato', texto: x }))) : null,
          ]),
        ]),
        opcoes,
        el('div', { class: 'vl-jg-colunas' }, [blocoJogadores, blocoLado]),
        anf ? el('div', { class: 'vl-ms-comecar' }, [
          el('button', { type: 'button', class: 'vl-jg-botao forte grande', 'data-foco': 'comecar', disabled: !pode, onclick: comecar }, [el('span', { 'aria-hidden': 'true', texto: '▶' }), el('span', { texto: 'Começar a partida' })]),
          el('p', { class: 'vl-jg-nota', texto: pode ? 'Tudo pronto: ' + mesa.jogadores.length + ' na mesa.' : (def.minPessoas ? 'Precisa de pelo menos ' + def.minPessoas + ' pessoas com o Vagalume (este jogo não tem bots).' : 'Precisa de pelo menos ' + def.min + ' jogadores (bots contam).') }),
        ]) : null,
      ])];
    }
    function telaResultado(r) {
      const ordem = r.ordem || [];
      const detalhe = (n) => (r.detalhe && r.detalhe[n] ? el('small', { texto: r.detalhe[n] }) : null);
      const nomeVisto = (n) => n + (mesmo(n, eu()) ? ' (você)' : '');
      let meio;
      if (r.vencedores) {
        meio = el('div', { class: 'vl-ms-vencedores' }, r.vencedores.map((n) => el('span', null, [rosto(n), nomeVisto(n)])));
      } else {
        const degrau = (n, pos) => (n ? el('div', { class: 'vl-ms-degrau p' + pos }, [rosto(n), el('b', { texto: nomeVisto(n) }), detalhe(n), el('div', { class: 'bloco', texto: pos + 'º' })]) : null);
        meio = [el('div', { class: 'vl-ms-podio' }, [degrau(ordem[1], 2), degrau(ordem[0], 1), degrau(ordem[2], 3)]),
          ordem.length > 3 ? el('div', { class: 'vl-ms-resto' }, ordem.slice(3).map((n, i) => el('div', null, [el('b', { texto: (i + 4) + 'º' }), el('span', { texto: nomeVisto(n) }), detalhe(n)]))) : null];
      }
      return el('div', { class: 'vl-ms-res', role: 'status' }, [
        el('h3', { texto: r.texto || 'Fim de jogo' }),
      ].concat(meio, [
        el('div', { class: 'vl-ms-acoes' }, [
          mesa.souAnfitriao ? el('button', { type: 'button', class: 'vl-jg-botao forte', texto: 'Jogar de novo', onclick: deNovo }) : el('span', { class: 'vl-jg-nota', texto: 'Esperando ' + mesa.anfitriao + '…' }),
          el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Sair', onclick: sair }),
        ]),
      ]));
    }

    // ---------- anfitrião ----------
    function abrir(jogo) {
      const def = JOGOS[jogo];
      if (!def) return;
      if (mesa && mesa.fase !== 'fim' && mesa.jogo !== jogo) { camada.aviso('Termine ou saia da mesa de ' + JOGOS[mesa.jogo].nome + ' primeiro.', { tipo: 'erro' }); mostrar(); return; }
      if (!mesa || mesa.jogo !== jogo || mesa.fase === 'fim') mesa = { jogo, sessao: sessaoNova(), anfitriao: eu(), souAnfitriao: true, jogadores: [{ nome: eu(), bot: null }], fase: 'sala', chamados: new Set(), opcoes: opcoesValidas(def, null) };
      mostrar();
    }
    function convidar(nome) {
      mesa.chamados.add(nome.toLowerCase());
      mandar(nome, { t: 'ms:convite', j: mesa.jogo });
      camada.aviso('Convite enviado a ' + nome + '.');
      desenhar();
      setTimeout(function () { if (mesa && mesa.chamados) { mesa.chamados.delete(nome.toLowerCase()); desenhar(); } }, 45000);
    }
    function botNovo(nivel) {
      const def = JOGOS[mesa.jogo];
      if (mesa.jogadores.length >= def.max) return;
      const usados = new Set(mesa.jogadores.map((p) => p.nome));
      const nome = NOMES_BOT.find((n) => !usados.has(n)) || ('Bot ' + mesa.jogadores.length);
      mesa.jogadores.push({ nome, bot: def.bots.some(([id]) => id === nivel) ? nivel : (def.bots[0] || [])[0] });
      avisarSala();
    }
    function tirar(nome) {
      mesa.jogadores = mesa.jogadores.filter((p) => !mesmo(p.nome, nome));
      mandar(nome, { t: 'ms:fim', m: 'Você saiu da mesa.' });
      avisarSala();
    }
    function avisarSala() {
      for (const p of pessoas()) mandar(p.nome, { t: 'ms:sala', j: mesa.jogo, a: mesa.anfitriao, js: mesa.jogadores, op: mesa.opcoes });
      desenhar();
    }
    function comecar() {
      const def = JOGOS[mesa.jogo];
      if (mesa.jogadores.length < def.min || mesa.jogadores.filter((p) => !p.bot).length < (def.minPessoas || 0)) return;
      mesa.estado = def.nova(mesa.jogadores, opcoesValidas(def, mesa.opcoes));
      mesa.fase = 'jogo'; mesa.versao = 0; mesa.tela = null; mesa.resultado = null; mesa.festejado = false;
      publicar();
      clearInterval(relogio);
      relogio = setInterval(function () {
        if (!mesa || !mesa.souAnfitriao || mesa.fase !== 'jogo') return;
        if (def.tick && def.tick(mesa.estado)) publicar();
        else if (Date.now() - (mesa.publicadoEm || 0) > 3000) publicar(); // de novo, para quem perdeu uma mensagem
      }, 150);
    }
    function deNovo() { mesa.fase = 'sala'; mesa.tela = null; mesa.estado = null; mesa.festejado = false; avisarSala(); }
    // Manda a cada pessoa o que ela pode ver e desenha a minha.
    function publicar() {
      const def = JOGOS[mesa.jogo];
      mesa.versao++;
      mesa.publicadoEm = Date.now();
      const fim = def.fim(mesa.estado);
      if (fim && mesa.fase === 'jogo') { mesa.fase = 'fim'; mesa.resultado = fim; clearInterval(relogio); }
      for (const p of pessoas()) mandar(p.nome, { t: 'ms:estado', j: mesa.jogo, v: mesa.versao, vi: def.visao(mesa.estado, p.nome), f: mesa.fase === 'fim' ? fim : null, js: mesa.jogadores, a: mesa.anfitriao });
      mesa.visao = def.visao(mesa.estado, eu());
      desenhar();
    }
    function agir(acao) {
      if (!mesa || mesa.fase !== 'jogo') return;
      if (mesa.souAnfitriao) { if (JOGOS[mesa.jogo].aplicar(mesa.estado, eu(), acao)) publicar(); return; }
      mandar(mesa.anfitriao, { t: 'ms:acao', a: acao });
    }
    function sair() {
      if (mesa) {
        if (mesa.souAnfitriao) for (const p of pessoas()) mandar(p.nome, { t: 'ms:fim', m: mesa.anfitriao + ' fechou a mesa.' });
        else mandar(mesa.anfitriao, { t: 'ms:sair' });
      }
      clearInterval(relogio);
      mesa = null;
      if (janela) janela.style.display = 'none';
    }

    // ---------- mensagens ----------
    function receber(m) {
      if (!m || m.de !== 'sala' || m.tipo !== 'presenca:direto' || !m.dado || typeof m.dado !== 'object') return;
      const d = m.dado, de = String(m.nome || '').slice(0, 40);
      if (!/^ms:/.test(String(d.t || '')) || !/^[a-f0-9]{16}$/.test(String(d.s || '')) || !de) return;
      if (d.t === 'ms:convite') { if (JOGOS[d.j]) mostrarConvite(de, d); return; }
      if (!mesa || d.s !== mesa.sessao) return;
      if (mesa.souAnfitriao) {
        const p = mesa.jogadores.find((x) => mesmo(x.nome, de));
        if (d.t === 'ms:entrar' && !p && mesa.fase === 'sala') {
          if (mesa.jogadores.length >= JOGOS[mesa.jogo].max) { mandar(de, { t: 'ms:fim', m: 'A mesa está cheia.' }); return; }
          mesa.jogadores.push({ nome: de, bot: null }); mesa.chamados.delete(de.toLowerCase()); avisarSala(); camada.aviso(de + ' entrou na mesa.');
        } else if (d.t === 'ms:recusar') { mesa.chamados.delete(de.toLowerCase()); desenhar(); camada.aviso(de + ' recusou o convite.'); }
        else if (d.t === 'ms:sair' && p) {
          mesa.jogadores = mesa.jogadores.filter((x) => x !== p);
          if (mesa.fase === 'jogo' && JOGOS[mesa.jogo].sair) { JOGOS[mesa.jogo].sair(mesa.estado, p.nome); publicar(); }
          else avisarSala();
          camada.aviso(de + ' saiu da mesa.');
        } else if (d.t === 'ms:acao' && p && mesa.fase === 'jogo' && d.a && typeof d.a === 'object') {
          if (JOGOS[mesa.jogo].aplicar(mesa.estado, p.nome, d.a)) publicar();
        }
        return;
      }
      if (!mesmo(de, mesa.anfitriao)) return;
      if (d.t === 'ms:sala') {
        mesa.jogadores = Array.isArray(d.js) ? d.js.slice(0, 12) : mesa.jogadores;
        mesa.opcoes = opcoesValidas(JOGOS[mesa.jogo], d.op);
        if (mesa.fase !== 'sala') { mesa.fase = 'sala'; mesa.tela = null; mesa.festejado = false; }
        desenhar();
      } else if (d.t === 'ms:estado' && Number(d.v) > (mesa.versao || 0)) {
        mesa.versao = Number(d.v); mesa.visao = d.vi; mesa.jogadores = Array.isArray(d.js) ? d.js.slice(0, 12) : mesa.jogadores;
        if (mesa.fase === 'sala') { mesa.fase = 'jogo'; mesa.tela = null; mesa.festejado = false; }
        if (d.f) { mesa.fase = 'fim'; mesa.resultado = d.f; }
        else if (mesa.fase === 'fim') { mesa.fase = 'jogo'; mesa.resultado = null; mesa.festejado = false; }
        desenhar();
      } else if (d.t === 'ms:fim') { camada.aviso(String(d.m || 'A mesa foi fechada.').slice(0, 120)); mesa = null; if (janela) janela.style.display = 'none'; }
    }
    function mostrarConvite(de, d) {
      if (convite) fecharConvite();
      const def = JOGOS[d.j];
      const no = el('div', { class: 'vl-ms-convite', role: 'dialog', 'aria-label': 'Convite para jogar' }, [
        el('div', { class: 'vl-ms-convite-arte ' + d.j, 'aria-hidden': 'true' }, [arte(d.j)]),
        el('b', { texto: de + ' chamou você para ' + def.nome }),
        el('p', { texto: def.texto }),
        el('div', { class: 'vl-ms-acoes' }, [
          el('button', { type: 'button', class: 'vl-jg-botao recusar', texto: 'Recusar', onclick() { VL.comunidade.direto(de, { t: 'ms:recusar', s: d.s }); fecharConvite(); } }),
          el('button', { type: 'button', class: 'vl-jg-botao aceitar', texto: 'Entrar', onclick() {
            fecharConvite();
            if (mesa && mesa.souAnfitriao) sair();
            mesa = { jogo: d.j, sessao: d.s, anfitriao: de, souAnfitriao: false, jogadores: [], fase: 'sala', versao: 0, opcoes: opcoesValidas(def, null) };
            mandar(de, { t: 'ms:entrar' });
            mostrar();
          } }),
        ]),
      ]);
      camada.area().appendChild(no);
      som('vez');
      convite = { no, relogio: setTimeout(fecharConvite, 45000) };
    }
    function fecharConvite() { if (!convite) return; clearTimeout(convite.relogio); convite.no.remove(); convite = null; }

    let tirarOuvinte = null, tentativas = 0;
    const ligar = function () {
      if (VL.comunidade && VL.comunidade.aoAcao) { tirarOuvinte = VL.comunidade.aoAcao(receber); return; }
      if (++tentativas < 60) setTimeout(ligar, 1000);
    };
    ligar();
    ctx.aoParar(function () { sair(); fecharConvite(); if (tirarOuvinte) tirarOuvinte(); estilo.remove(); if (janela) janela.remove(); janela = null; });
    return { abrir, receber, mesa: () => mesa };
  }

  VL.mesa = { registrar, iniciar, arte, JOGOS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
