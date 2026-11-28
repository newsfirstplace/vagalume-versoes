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

  // ---------- chat da partida (a mesa e a janela de um contra um usam) ----------
  const limparFala = (x) => String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  // Botão 💬 (com as não lidas) para o título da janela e um painel por cima do jogo; op.mandar(texto) envia.
  function criarChat(op) {
    let aberto = false, naoLidas = 0, ultimo = 0;
    const contador = el('span', { class: 'vl-chat-n', 'aria-hidden': 'true', hidden: true });
    const botao = el('button', { type: 'button', class: 'vl-jg-chat-bt', title: 'Chat da partida', 'aria-label': 'Chat da partida', 'aria-pressed': 'false', hidden: true, onclick() { alternar(); } },
      [el('span', { 'aria-hidden': 'true', texto: '💬' }), contador]);
    const vazio = el('p', { class: 'vl-chat-vazio', texto: 'Mande um oi! Quem joga e quem assiste lê aqui.' });
    const lista = el('div', { class: 'vl-chat-lista', role: 'log', 'aria-live': 'polite', 'aria-label': 'Mensagens da partida' });
    const campo = el('input', { type: 'text', maxlength: '140', autocomplete: 'off', placeholder: 'Escreva aqui…', 'aria-label': 'Mensagem para a partida' });
    campo.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Escape') alternar(false); }); // o jogo não reage ao que se digita aqui
    const painel = el('div', { class: 'vl-chat', hidden: true, role: 'dialog', 'aria-label': 'Chat da partida' }, [
      el('div', { class: 'vl-chat-cab' }, [el('b', { texto: 'Chat da partida' }), el('button', { type: 'button', title: 'Fechar o chat', 'aria-label': 'Fechar o chat', texto: '×', onclick() { alternar(false); } })]),
      vazio, lista,
      el('form', { class: 'vl-chat-form', onsubmit(ev) {
        ev.preventDefault();
        const x = limparFala(campo.value);
        if (!x || Date.now() - ultimo < 700) return;
        ultimo = Date.now();
        campo.value = '';
        op.mandar(x);
      } }, [campo, el('button', { type: 'submit', class: 'vl-jg-botao', texto: 'Enviar' })]),
    ]);
    function contar() { contador.hidden = !naoLidas; contador.textContent = naoLidas > 9 ? '9+' : String(naoLidas); botao.classList.toggle('novas', naoLidas > 0); }
    function alternar(abrir) {
      aberto = typeof abrir === 'boolean' ? abrir : !aberto;
      painel.hidden = !aberto;
      botao.setAttribute('aria-pressed', String(aberto));
      if (aberto) { naoLidas = 0; contar(); lista.scrollTop = lista.scrollHeight; setTimeout(() => campo.focus(), 0); }
    }
    return {
      botao, painel,
      nova(de, texto, minha) {
        const x = limparFala(texto);
        if (!x) return;
        vazio.hidden = true;
        lista.appendChild(el('div', { class: 'vl-chat-msg' + (minha ? ' minha' : '') }, [el('b', { texto: minha ? 'Você' : String(de || '?').slice(0, 40) }), el('span', { texto: x })]));
        while (lista.childElementCount > 60) lista.firstElementChild.remove();
        lista.scrollTop = lista.scrollHeight;
        if (!aberto && !minha) { naoLidas++; contar(); }
      },
      limpar() { lista.replaceChildren(); vazio.hidden = false; naoLidas = 0; contar(); },
      mostrar(sim) { botao.hidden = !sim; if (!sim && aberto) alternar(false); },
    };
  }
  const CSS_CHAT = `
  .vl-jg-chat-bt { position: relative; }
  .vl-jg-chat-bt.novas { animation: vl-chat-pisca .9s ease-in-out infinite alternate; }
  @keyframes vl-chat-pisca { to { box-shadow: 0 0 0 2px var(--n-acento, #d6f24a), 0 0 12px var(--n-acento, #d6f24a); } }
  .vl-chat-n { position: absolute; top: -6px; right: -6px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: #e5484d; color: #fff; border: 1px solid #000; font: 700 10px/14px system-ui, sans-serif; }
  .vl-jg-corpo { isolation: isolate; } /* o que o jogo empilha fica dentro do corpo; o chat fica na frente */
  .vl-chat { position: absolute; z-index: 40; right: 10px; top: 58px; bottom: 10px; width: min(290px, calc(100% - 20px)); display: flex; flex-direction: column; border-radius: 12px; overflow: hidden;
    background: #0e131c; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 14px 40px rgba(0,0,0,.55); color: #e9eef7; font: 13px/1.35 system-ui, 'Segoe UI', sans-serif; }
  .vl-chat[hidden], .vl-jg-chat-bt[hidden], .vl-chat-vazio[hidden], .vl-chat-n[hidden] { display: none !important; }
  .vl-jg.minimizada .vl-chat { display: none !important; }
  .vl-chat-cab { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 8px 12px; background: rgba(255,255,255,.05); border-bottom: 1px solid rgba(255,255,255,.08); }
  .vl-chat-cab button { width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,.15); background: transparent; color: inherit; cursor: pointer; }
  .vl-chat-vazio { margin: 12px; color: #8f9bb0; font-size: 12px; }
  .vl-chat-lista { flex: 1; min-height: 0; overflow: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .vl-chat-msg { align-self: flex-start; max-width: 92%; padding: 6px 9px; border-radius: 10px 10px 10px 3px; background: rgba(255,255,255,.07); overflow-wrap: anywhere; }
  .vl-chat-msg b { display: block; font-size: 11px; color: var(--n-acento, #d6f24a); }
  .vl-chat-msg.minha { align-self: flex-end; border-radius: 10px 10px 3px 10px; background: color-mix(in srgb, var(--n-acento, #d6f24a) 22%, transparent); }
  .vl-chat-msg.minha b { color: #fff; }
  .vl-chat-form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid rgba(255,255,255,.08); }
  .vl-chat-form input { flex: 1; min-width: 0; padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.35); color: #fff; font: inherit; }
  .vl-chat-form input:focus { outline: none; border-color: var(--n-acento, #d6f24a); }
  .vl-chat-form .vl-jg-botao { padding: 6px 12px; font-size: 12px; }
  .vl-ms-assistindo { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin: -4px 0 12px; border-radius: 10px; background: rgba(229,72,77,.14); border: 1px solid rgba(229,72,77,.4); font-size: 12.5px; }
  .vl-ms-assistindo i { width: 8px; height: 8px; border-radius: 50%; background: #e5484d; box-shadow: 0 0 8px #e5484d; animation: vl-ms-pisca 1.2s ease-in-out infinite; }
  .vl-ms-assistindo .vl-jg-esp { flex: 1; }
  .vl-ms-assistindo .vl-jg-botao { padding: 4px 12px; font-size: 12px; }
  `;
  const CSS = `
  .vl-jg.vl-ms { width: min(900px, calc(100vw - 24px)); }
  .vl-ms .vl-jg-corpo { padding: 14px 16px 16px; }
  .vl-ms-arte { position: absolute; inset: 0; pointer-events: none; }
  .vl-jg-cartao .vl-jg-mini.corrida, .vl-jg-cartao .vl-jg-mini.pistas, .vl-jg-cartao .vl-jg-mini.ludo, .vl-jg-cartao .vl-jg-mini.sinuca, .vl-jg-cartao .vl-jg-mini.cartas,
  .vl-jg-arte.corrida, .vl-jg-arte.pistas, .vl-jg-arte.ludo, .vl-jg-arte.sinuca, .vl-jg-arte.cartas { position: relative; overflow: hidden; -webkit-text-stroke: 0; }
  .vl-ms-convite-arte { position: relative; overflow: hidden; width: 72px; height: 72px; margin: 0 auto 10px; border-radius: 18px; font-size: 44px; box-shadow: 0 10px 22px rgba(0,0,0,.45); }
  /* Corrida: teclado com um vagalume correndo */
  .vl-jg-cartao .vl-jg-mini.corrida, .vl-jg-arte.corrida, .vl-ms-convite-arte.corrida { background: repeating-linear-gradient(0deg, transparent 0 17%, rgba(214,242,74,.13) 17% 19%), linear-gradient(160deg, #2a3346, #10141d); }
  .vl-ms-arte.corrida .teclas { position: absolute; left: 12%; right: 12%; top: 38%; height: 40%; border-radius: 12% / 20%; background-color: #1b2130;
    box-shadow: 0 .05em 0 #07090d, inset 0 0 0 .03em rgba(214,242,74,.55);
    background-image: linear-gradient(#d6f24a, #d6f24a), repeating-linear-gradient(90deg, #e9eef6 0 10%, transparent 10% 13%), repeating-linear-gradient(90deg, #e9eef6 0 10%, transparent 10% 13%);
    background-size: 44% 15%, 86% 19%, 78% 19%; background-position: 50% 84%, 50% 16%, 46% 48%; background-repeat: no-repeat; }
  .vl-ms-arte.corrida .rastro { position: absolute; left: 14%; top: 17%; width: 52%; height: 9%; border-radius: 99px; background: linear-gradient(90deg, transparent, rgba(214,242,74,.75)); }
  .vl-ms-arte.corrida .luz { position: absolute; left: 60%; top: 9%; width: 24%; height: 24%; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fbffd0, #d6f24a 55%, #6f8f10); box-shadow: 0 0 .3em #d6f24a; }
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
  /* ZERA!: três cartas em pixel art */
  .vl-jg-cartao .vl-jg-mini.cartas, .vl-jg-arte.cartas, .vl-ms-convite-arte.cartas { background: radial-gradient(ellipse at 50% 60%, #2f935b, #1d5c38 70%, #143f27); box-shadow: inset 0 0 0 3px #8c5a30, inset 0 0 0 5px #3a220e; }
  .vl-ms-arte.cartas img { position: absolute; left: 14%; top: 12%; width: 72%; height: 76%; object-fit: contain; image-rendering: pixelated; filter: drop-shadow(0 .03em 0 rgba(0,0,0,.45)); }
  .vl-jg-heroi.cartas { background: linear-gradient(120deg, rgba(255,204,0,.28), rgba(255,204,0,0) 60%), #1b2a38; }
  .vl-jg-heroi.corrida { background: linear-gradient(120deg, rgba(214,242,74,.26), rgba(214,242,74,0) 62%), #151a25; }
  .vl-jg-heroi.pistas { background: linear-gradient(120deg, rgba(150,110,230,.4), rgba(150,110,230,0) 62%), #151a25; }
  .vl-jg-heroi.ludo { background: linear-gradient(120deg, rgba(58,142,232,.42), rgba(185,220,46,.12) 50%, rgba(0,0,0,0) 72%), #151a25; }
  .vl-jg-heroi.sinuca { background: linear-gradient(120deg, rgba(31,150,88,.5), rgba(31,150,88,0) 62%), #151a25; }
  .vl-ms-opcoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px 16px; }
  .vl-ms-op { display: flex; flex-direction: column; gap: 6px; }
  .vl-ms-op .vl-jg-rotulo { margin: 0; }
  .vl-ms-lugares { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 190px)); justify-content: center; gap: 8px; }
  .vl-ms-lugar { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; padding: 12px 8px 10px; border-radius: 12px; text-align: center;
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
  .vl-ms-lugar .vl-jg-cabeca { width: 46px; height: 46px; font-size: 18px; margin-bottom: 3px; box-shadow: 0 0 0 2px rgba(0,0,0,.35); }
  .vl-ms-lugar .vl-jg-cabeca img { transform: translate(-50%, -52%) scale(1.05); }
  .vl-ms-lugar b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .vl-ms-lugar small { color: #8f9bb0; font-size: 11px; }
  .vl-ms-lugar .num { position: absolute; left: 9px; top: 6px; font-size: 11px; font-weight: 800; color: rgba(255,255,255,.3); }
  .vl-ms-lugar .tirar { position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,.15); background: rgba(0,0,0,.25); color: #cdd6e4; cursor: pointer; font-size: 13px; line-height: 1; }
  .vl-ms-lugar .tirar:hover, .vl-ms-lugar .tirar:focus-visible { background: #c0392b; color: #fff; border-color: #000; }
  .vl-ms-lugar.dono small { color: #e9ffa0; font-weight: 700; }
  .vl-ms-lugar.eu { border-color: rgba(214,242,74,.6); box-shadow: inset 0 0 0 1px rgba(214,242,74,.35); }
  .vl-ms-lugar.bot .vl-jg-cabeca { background: rgba(155,140,255,.2); }
  .vl-ms-lugar.vazio { border-style: dashed; border-color: rgba(255,255,255,.18); background: transparent; }
  .vl-ms-lugar.vazio .vl-jg-cabeca { background: rgba(255,255,255,.05); color: #6c778c; box-shadow: none; }
  .vl-ms-lugar.vazio b { color: #7f8aa0; font-weight: 500; }
  .vl-ms-lugar.vazio .vl-jg-botao { padding: 4px 14px; font-size: 12px; margin-top: 3px; }
  .vl-ms-tag { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: rgba(214,242,74,.14); color: #e9ffa0; border: 1px solid rgba(214,242,74,.3); white-space: nowrap; }
  .vl-jg-bloco-cab .vl-jg-esp { flex: 1; }
  .vl-ms-nivel { display: flex; align-items: center; gap: 8px; }
  .vl-ms-nivel .vl-jg-rotulo { margin: 0; }
  .vl-ms-nivel .vl-jg-seg button { padding: 4px 12px; font-size: 12px; }
  .vl-ms-chamar-colunas { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .vl-ms-chamar { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .vl-ms-chamar .vl-jg-rotulo { margin: 0; }
  .vl-jg-vazio.pequeno { padding: 12px; font-size: 12px; }
  .vl-jg.vl-nativo .vl-ms-lugar { background: var(--n-cartao); border-color: var(--n-cartao-borda); }
  .vl-jg.vl-nativo .vl-ms-lugar.vazio { background: transparent; }
  .vl-jg.vl-nativo .vl-ms-lugar.eu { border-color: var(--n-acento); box-shadow: inset 0 0 0 1px var(--n-acento); }
  .vl-jg.vl-nativo .vl-ms-lugar.dono small { color: var(--n-acento); }
  .vl-jg.vl-nativo.tema-cartas .vl-ms-lugar b, .vl-jg.vl-nativo.tema-ludo .vl-ms-lugar b { font-family: Goldfish, Volter, 'Ubuntu', system-ui, sans-serif; font-size: 14px; }
  .vl-jg-seg button:disabled { cursor: default; opacity: .55; }
  .vl-jg-seg button[aria-pressed="true"]:disabled { opacity: .8; }
  .vl-ms-espera { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; background: rgba(214,242,74,.06); border: 1px solid rgba(214,242,74,.2); color: #e9ffa0; }
  .vl-ms-espera i { width: 10px; height: 10px; flex: none; border-radius: 50%; background: #d6f24a; box-shadow: 0 0 10px #d6f24a; animation: vl-ms-pisca 1.2s ease-in-out infinite; }
  @keyframes vl-ms-pisca { 50% { opacity: .25; transform: scale(.7); } }
  .vl-ms-comecar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; position: sticky; bottom: -16px; z-index: 2; margin: 0 -16px -16px; padding: 12px 16px 14px;
    background: rgba(10,14,22,.82); backdrop-filter: blur(6px); border-top: 1px solid rgba(255,255,255,.08); }
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
  // Mesa com gente de outro quarto (pedido de 2026-11-27): uma sala de partida no servidor ("9" + 11 dígitos) e o
  // convite pelo console, com o código do jogo, da sala e da sessão.
  const novoCanal = () => '9' + Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => String(n % 10000).padStart(4, '0')).join('').slice(0, 11);
  const LETRA_MESA = { corrida: 'r', cartas: 'c', pistas: 'p', ludo: 'l', sinuca: 's' };
  const JOGO_DA_LETRA = Object.fromEntries(Object.entries(LETRA_MESA).map(([j, l]) => [l, j]));
  const CODIGO_MESA = /vl-mesa-([a-z])(9\d{11})([a-f0-9]{16})/;
  const NOMES_BOT = ['Bot Faísca', 'Bot Lume', 'Bot Brilho', 'Bot Estrela', 'Bot Cometa', 'Bot Neon', 'Bot Pirilampo'];
  // Desenho de cada jogo (cartão da lista de jogos, cabeçalho da sala e convite); escala pelo tamanho da caixa.
  const ARTE = {
    corrida: () => [el('i', { class: 'teclas' }), el('i', { class: 'rastro' }), el('i', { class: 'luz' })],
    pistas: () => ['', 'l', '', 'r', 'b', 'l', '', 'r', ''].map((c) => el('i', { class: c || null })),
    ludo: () => [el('i'), el('i'), el('i'), el('i')],
    sinuca: () => ['b0', 'b1', 'b11', 'b8'].map((c) => el('i', { class: c })),
    cartas: () => [el('img', { alt: '', src: VL.cartasArte ? VL.cartasArte.icone() : '', draggable: 'false' })],
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
    const estilo = el('style', { texto: CSS + CSS_CHAT });
    camada.area().appendChild(estilo);
    let janela = null, corpo = null, titulo = null, icone = null, voltarBotao = null, fase = null, minimizada = false, compacta = false, chat = null, chatDaMesa = null;
    function alternarMinimizada() {
      if (!janela) return;
      minimizada = !minimizada;
      janela.classList.toggle('minimizada', minimizada);
      const b = janela.querySelector('.vl-jg-min');
      b.textContent = minimizada ? '□' : '−';
      b.title = minimizada ? 'Restaurar' : 'Minimizar';
      mostrarFase();
    }
    function alternarTamanho() {
      if (!janela) return;
      const r = janela.getBoundingClientRect();
      compacta = !compacta;
      janela.classList.toggle('compacta', compacta);
      if (janela.style.transform === 'none') { const z = janela.getBoundingClientRect().width / (janela.offsetWidth || 1) || 1; janela.style.left = r.left / z + 'px'; janela.style.top = r.top / z + 'px'; }
      const b = janela.querySelector('.vl-jg-tam');
      b.textContent = compacta ? '⤢' : '⤡';
      b.title = compacta ? 'Tamanho normal' : 'Diminuir a janela';
    }
    // Fase da partida no título da janela minimizada: a tela do jogo diz (resumo) ou vem da vez da visão.
    function faseDaMesa() {
      if (!mesa) return { texto: '', minha: false };
      if (mesa.fase === 'sala') return { texto: 'Sala de espera · ' + mesa.jogadores.length + ' na mesa', minha: false };
      if (mesa.fase === 'fim') return { texto: 'Fim de partida', minha: false };
      if (mesa.assistindo && mesa.visao && typeof mesa.visao.vez === 'string') return { texto: 'Assistindo · vez de ' + mesa.visao.vez, minha: false };
      if (mesa.tela && mesa.tela.resumo) { try { const r = mesa.tela.resumo(); if (r) return r; } catch (e) { /* segue com a vez */ } }
      const v = mesa.visao || {}, vez = typeof v.vez === 'string' ? v.vez : null;
      return vez ? { texto: mesmo(vez, eu()) ? 'Sua vez' : 'Vez de ' + vez, minha: mesmo(vez, eu()) } : { texto: JOGOS[mesa.jogo].nome + ' em andamento', minha: false };
    }
    function mostrarFase() {
      if (!fase) return;
      const f = faseDaMesa();
      fase.textContent = f.texto;
      fase.classList.toggle('minha', !!f.minha);
    }
    const relogioFase = setInterval(function () { if (minimizada) mostrarFase(); }, 1000);
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
        else if (tipo === 'compra') { ruido(0.05, 0.18, 3200, 0.9); tom(1500, 0.03, 0.02, 'sine'); }
        else if (tipo === 'pular') { tom(330, 0.09, 0.08, 'square', 300); tom(180, 0.16, 0.08, 'square', 120, 0.09); }
        else if (tipo === 'inverter') { tom(300, 0.22, 0.06, 'triangle', 900); tom(900, 0.22, 0.05, 'triangle', 300, 0.2); }
        else if (tipo === 'coringa') [523, 659, 784, 1047, 1319].forEach((fr, k) => tom(fr, 0.14, 0.05, 'triangle', null, k * 0.06));
        else if (tipo === 'acumulo') { ruido(0.12, 0.35, 160, 0.8); tom(220, 0.25, 0.07, 'sawtooth', 440, 0.04); }
        else if (tipo === 'ultima') { [880, 1175, 880, 1175].forEach((fr, k) => tom(fr, 0.11, 0.07, 'square', null, k * 0.12)); }
        else if (tipo === 'pegou') { tom(600, 0.18, 0.07, 'square', 300); tom(400, 0.3, 0.07, 'square', 160, 0.17); }
        else if (tipo === 'embaralhar') { for (let k = 0; k < 10; k++) ruido(0.03, 0.22, 2600 + k * 90, 1.4, k * 0.055); }
        else if (tipo === 'ponto') { tom(880, 0.09, 0.06, 'triangle'); tom(1320, 0.14, 0.06, 'triangle', null, 0.07); }
      } catch (e) { /* sem som */ }
    }

    // ---------- caminho das mensagens ----------
    // Com a sala da partida aberta, vai pelo id de quem está nela (serve para quem está em outro quarto); sem
    // ela, pelo canal direto do quarto (pelo apelido).
    const meuId = () => (VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null);
    function salaDoFundo(tipo, dados) {
      try { return Promise.resolve(chrome.runtime.sendMessage(Object.assign({ tipo: 'sala:' + tipo }, dados || {}))).catch(() => null); } catch (e) { return Promise.resolve(null); }
    }
    let naSala = new Map(); // apelido (minúsculo) -> id de quem está na sala da partida
    let esperasNaSala = [];
    function entrarNaSala(canal) {
      if (!canal || !meuId() || !eu()) return Promise.resolve(false);
      return salaDoFundo('mesa:entrar', { canal, id: String(meuId()), nome: eu() }).then((r) => !!(r && r.ok));
    }
    function sairDaSala() { naSala = new Map(); esperasNaSala = []; salaDoFundo('mesa:sair'); }
    // Espera alguém aparecer na sala da partida; true se chegou a tempo.
    function esperarNaSala(nome, ms) {
      const chave = String(nome).toLowerCase();
      if (naSala.has(chave)) return Promise.resolve(true);
      return new Promise(function (resolver) {
        const w = { chave, ok() { clearTimeout(relogioEspera); resolver(true); } };
        const relogioEspera = setTimeout(function () { esperasNaSala = esperasNaSala.filter((x) => x !== w); resolver(false); }, ms);
        esperasNaSala.push(w);
      });
    }
    function mandar(nome, dado) {
      const msg = Object.assign({ s: mesa ? mesa.sessao : dado.s }, dado);
      const id = mesa && mesa.canal ? naSala.get(String(nome).toLowerCase()) : null;
      const envio = id ? salaDoFundo('mesa:enviar', { para: id, dado: msg })
        : VL.comunidade && VL.comunidade.direto ? VL.comunidade.direto(nome, msg) : Promise.resolve(null);
      return envio.then(function (r) {
        if (r && r.erro) console.warn('[Vagalume] mesa: não foi para ' + nome + ' (' + dado.t + '): ' + r.erro);
        return r;
      });
    }
    function aoAvisoDaSala(m) {
      if (!m || m.de !== 'sala' || !mesa || !mesa.canal || String(m.canal) !== mesa.canal) return;
      if (m.tipo === 'mesa:pessoas') {
        naSala = new Map((Array.isArray(m.nomes) ? m.nomes : []).map((x) => [String(x[1] || '').toLowerCase(), String(x[0])]));
        esperasNaSala = esperasNaSala.filter((w) => { if (naSala.has(w.chave)) { w.ok(); return false; } return true; });
      } else if (m.tipo === 'mesa:direto' && m.dado && typeof m.dado === 'object') {
        receber({ de: 'sala', tipo: 'presenca:direto', nome: String(m.nome || ''), dado: m.dado });
      }
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(aoAvisoDaSala);
      ctx.aoParar(function () { chrome.runtime.onMessage.removeListener(aoAvisoDaSala); });
    }
    const pessoas = () => mesa.jogadores.filter((p) => !p.bot && !mesmo(p.nome, eu()));
    // Quem recebe as mensagens da mesa: os jogadores (menos eu e os bots) e quem assiste.
    const quemRecebe = () => pessoas().map((p) => p.nome).concat(mesa.plateia ? [...mesa.plateia.values()].map((x) => x.nome) : []);

    // ---------- chat ----------
    let falouEm = new Map(); // anfitrião: quando cada um falou (uma fala a cada 0,6 s por pessoa)
    function falar(texto) {
      const x = limparFala(texto);
      if (!x || !mesa) return;
      if (mesa.souAnfitriao) { espalharFala(eu(), x); return; }
      mandar(mesa.anfitriao, { t: 'ms:chat', x });
      mostrarFala(eu(), x);
    }
    function mostrarFala(de, x) {
      if (chat) chat.nova(de, x, mesmo(de, eu()));
      try { if (mesa && mesa.tela && mesa.tela.fala) mesa.tela.fala(de, x); } catch (e) { /* a tela pode não ter onde mostrar */ }
    }
    // Anfitrião: mostra e repassa a fala a todos, menos a quem falou.
    function espalharFala(de, x) {
      mostrarFala(de, x);
      for (const nome of quemRecebe()) if (!mesmo(nome, de)) mandar(nome, { t: 'ms:chat', de, x });
    }

    // ---------- assistir uma partida em andamento ----------
    // Quem assiste pede ao anfitrião (no quarto ou pela sala da partida) e pede de novo a cada 20 s.
    function assistir(info) {
      const def = JOGOS[info && info.j];
      if (!def || !/^[a-f0-9]{16}$/.test(String(info.s || '')) || !info.a) return;
      if (mesa && mesa.sessao === info.s) { mostrar(); return; }
      if (mesa && !mesa.assistindo && mesa.fase !== 'fim') { camada.aviso('Saia da mesa de ' + JOGOS[mesa.jogo].nome + ' antes de assistir outra.', { tipo: 'erro' }); mostrar(); return; }
      if (mesa) sair();
      naSala = new Map(); esperasNaSala = [];
      const canal = /^9\d{11}$/.test(String(info.c || '')) ? String(info.c) : null;
      const m = mesa = { jogo: info.j, sessao: info.s, canal, anfitriao: String(info.a), souAnfitriao: false, assistindo: true, jogadores: [], fase: 'jogo', versao: 0, opcoes: opcoesValidas(def, null) };
      mostrar();
      const pedir = () => { if (mesa === m) mandar(m.anfitriao, { t: 'ms:assistir' }); };
      const noQuarto = vagalumesNoQuarto().some((n) => mesmo(n, m.anfitriao));
      const pronto = noQuarto || !canal ? Promise.resolve(true) : entrarNaSala(canal).then((ok) => (ok ? esperarNaSala(m.anfitriao, 6000) : false));
      pronto.then(function (ok) {
        if (mesa !== m) return;
        if (!ok) { camada.aviso('Não deu para assistir a mesa de ' + m.anfitriao + ' agora.', { tipo: 'erro' }); sair(); return; }
        pedir();
        m.manter = setInterval(pedir, 20000);
      });
      setTimeout(function () { if (mesa === m && !m.visao && m.fase === 'jogo') { camada.aviso(m.anfitriao + ' não respondeu. A partida pode ter acabado.', { tipo: 'erro' }); sair(); } }, 9000);
    }

    // ---------- janela ----------
    function montarJanela() {
      titulo = el('b', { texto: 'Jogos' });
      icone = el('span', { class: 'vl-jg-ic', 'aria-hidden': 'true' });
      voltarBotao = el('button', { type: 'button', class: 'vl-jg-voltar', title: 'Todos os jogos', 'aria-label': 'Todos os jogos', texto: '‹', onclick() { if (mesa && mesa.fase === 'jogo') return; sair(); if (op.voltar) op.voltar(); } });
      fase = el('span', { class: 'vl-jg-fase', role: 'status', title: 'Abrir', onclick: alternarMinimizada });
      chat = criarChat({ mandar: falar });
      const cab = el('div', { class: 'vl-jg-cab' }, [voltarBotao, icone, titulo, fase, el('span', { class: 'vl-jg-esp' }),
        chat.botao,
        el('button', { type: 'button', class: 'vl-jg-tam', title: 'Diminuir a janela', 'aria-label': 'Diminuir a janela', texto: '⤡', onclick: alternarTamanho }),
        el('button', { type: 'button', class: 'vl-jg-min', title: 'Minimizar', 'aria-label': 'Minimizar', texto: '−', onclick: alternarMinimizada }),
        el('button', { type: 'button', title: 'Fechar', 'aria-label': 'Fechar', texto: '×', onclick: sair })]);
      cab.addEventListener('dblclick', function (ev) { if (!ev.target.closest('button')) alternarMinimizada(); });
      corpo = el('div', { class: 'vl-jg-corpo vl-ms-corpo' });
      janela = el('div', { class: 'vl-jg vl-ms', role: 'dialog', 'aria-label': 'Mesa de jogos', tabindex: '0' }, [cab, corpo, chat.painel]);
      janela.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Escape' && !(mesa && mesa.fase === 'jogo')) sair(); });
      cab.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || ev.target.closest('button')) return;
        const r = janela.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY;
        cab.setPointerCapture(ev.pointerId);
        const z = r.width / (janela.offsetWidth || r.width) || 1; // na janela menor o zoom também encolhe left/top
        const mover = (e) => { janela.style.transform = 'none'; janela.style.left = Math.max(0, Math.min(innerWidth - r.width, r.left + e.clientX - x0)) / z + 'px'; janela.style.top = Math.max(0, Math.min(innerHeight - 44, r.top + e.clientY - y0)) / z + 'px'; };
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
      // Cada jogo com a cara dele (temas no CSS do módulo Jogos).
      janela.className = String(janela.className || 'vl-jg vl-ms').replace(/\s*\b(tema-[\w-]+|vl-nativo)\b/g, '') + ' vl-nativo tema-' + mesa.jogo;
      icone.textContent = def.glifo;
      voltarBotao.hidden = mesa.fase === 'jogo';
      if (chatDaMesa !== mesa.sessao) { chatDaMesa = mesa.sessao; chat.limpar(); }
      chat.mostrar(!!(mesa.assistindo || mesa.plateia && mesa.plateia.size || mesa.jogadores.some((p) => !p.bot && !mesmo(p.nome, eu()))));
      if (mesa.fase === 'sala') { camada.trocar(corpo, telaSala(def)); mostrarFase(); return; }
      if (mesa.assistindo && !mesa.visao) { camada.trocar(corpo, [el('div', { class: 'vl-jg-vazio' }, [el('b', { texto: 'Entrando para assistir…' }), el('span', { texto: 'Pedindo a partida a ' + mesa.anfitriao + '.' })])]); mostrarFase(); return; }
      if (!mesa.tela) {
        mesa.tela = def.montar(apiTela());
        corpo.replaceChildren(mesa.assistindo ? el('div', { class: 'vl-ms-assistindo', role: 'status' }, [el('i', { 'aria-hidden': 'true' }), el('span', null, ['Assistindo a mesa de ', el('b', { texto: mesa.anfitriao })]), el('span', { class: 'vl-jg-esp' }),
          el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Parar de assistir', onclick: sair })]) : '', mesa.tela.el);
      }
      if (mesa.visao) mesa.tela.atualizar(mesa.visao);
      mostrarFase();
      const fim = mesa.fase === 'fim' && mesa.resultado;
      const resAntigo = corpo.querySelector('.vl-ms-res');
      if (resAntigo) resAntigo.remove();
      if (fim) {
        if (!def.resultadoProprio) corpo.appendChild(telaResultado(fim));
        if (!mesa.festejado && mesa.assistindo) mesa.festejado = true;
        if (!mesa.festejado) {
          mesa.festejado = true;
          const vencedores = fim.vencedores || (fim.ordem || []).slice(0, 1);
          const venci = vencedores.some((n) => mesmo(n, eu()));
          const pos = (fim.ordem || []).findIndex((n) => mesmo(n, eu()));
          if (op.festa) op.festa(def.resultadoProprio ? null : janela, venci ? 'venceu' : 'perdeu', venci ? 'Vitória!' : pos > 0 && !fim.vencedores ? (pos + 1) + 'º lugar' : 'Fim de jogo', String(fim.texto || ''));
        }
      }
    }
    function apiTela() {
      return { eu: eu(), agir, assistindo: () => !!(mesa && mesa.assistindo), anfitriao: () => mesa && mesa.souAnfitriao, nomeAnfitriao: () => mesa && mesa.anfitriao, deNovo() { if (mesa && mesa.souAnfitriao) deNovo(); }, sair, cabeca: rosto, som, opcoes: () => (mesa ? opcoesValidas(JOGOS[mesa.jogo], mesa.opcoes) : {}) };
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
      // Lugares em cartões, como as cadeiras da mesa: avatar, nome e quem é; um lugar livre chama um bot.
      if (!mesa.nivelBot && def.bots.length) mesa.nivelBot = def.bots[Math.min(1, def.bots.length - 1)][0];
      const lugares = mesa.jogadores.map((p, i) => {
        const voce = mesmo(p.nome, eu()), dono = mesmo(p.nome, mesa.anfitriao);
        return el('div', { class: 'vl-ms-lugar' + (p.bot ? ' bot' : '') + (voce ? ' eu' : '') + (dono ? ' dono' : '') }, [
          el('span', { class: 'num', 'aria-hidden': 'true', texto: String(i + 1) }),
          rosto(p.nome),
          el('b', { texto: voce ? 'Você' : p.nome, title: p.nome }),
          el('small', { texto: p.bot ? nivelRotulo(p.bot) : dono ? 'Anfitrião' : 'Pronto' }),
          anf && !voce ? el('button', { type: 'button', class: 'tirar', 'data-foco': 'tirar-' + p.nome, title: 'Tirar da mesa', 'aria-label': 'Tirar ' + p.nome + ' da mesa', texto: '×', onclick() { tirar(p.nome); } }) : null,
        ]);
      });
      const livres = def.max <= 8 ? def.max - mesa.jogadores.length : Math.min(2, def.max - mesa.jogadores.length);
      for (let k = 0; k < livres; k++) {
        const i = mesa.jogadores.length + k;
        lugares.push(el('div', { class: 'vl-ms-lugar vazio' }, [
          el('span', { class: 'num', 'aria-hidden': 'true', texto: String(i + 1) }),
          el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: '+' }),
          el('b', { texto: 'Lugar livre' }),
          anf && def.bots.length ? el('button', { type: 'button', class: 'vl-jg-botao discreto', 'data-foco': 'bot-' + i, onclick() { botNovo(mesa.nivelBot); } }, [el('span', { texto: '+ Bot' })])
            : el('small', { texto: anf ? 'Chame alguém' : 'Esperando alguém' }),
        ]));
      }
      const blocoJogadores = el('section', { class: 'vl-jg-bloco' }, [
        el('div', { class: 'vl-jg-bloco-cab' }, [el('span', { class: 'ic', 'aria-hidden': 'true', texto: '🪑' }), el('h3', { texto: 'Na mesa · ' + mesa.jogadores.length + ' de ' + def.max }),
          el('span', { class: 'vl-jg-esp' }),
          anf && def.bots.length > 1 && !cheio ? el('div', { class: 'vl-ms-nivel' }, [el('span', { class: 'vl-jg-rotulo', texto: 'Nível dos bots' }), seg('Nível do bot', def.bots, mesa.nivelBot, (id) => { mesa.nivelBot = id; desenhar(); })]) : null]),
        el('div', { class: 'vl-ms-lugares' }, lugares),
      ]);
      let blocoLado;
      if (anf) {
        const noQuarto = vagalumesNoQuarto();
        const nomesNoQuarto = new Set(((VL.pessoas && VL.pessoas.lista && VL.pessoas.lista()) || []).map((n) => String(n).toLowerCase()));
        const amigos = mesa.naSala ? ((VL.amigos && VL.amigos.lista && VL.amigos.lista()) || [])
          .filter((a) => a && a.online && a.id && a.nome && !nomesNoQuarto.has(String(a.nome).toLowerCase()) && !mesmo(a.nome, eu())) : [];
        const linha = (n, sub, acao) => {
          const dentro = mesa.jogadores.some((p) => mesmo(p.nome, n));
          const chamado = mesa.chamados && mesa.chamados.has(String(n).toLowerCase());
          return el('div', { class: 'vl-jg-linha-pessoa' }, [rosto(n),
            el('span', { class: 'quem' }, [el('b', { texto: n }), el('small', { texto: dentro ? 'Já está na mesa' : chamado ? 'Esperando aceitar…' : sub })]),
            el('button', { type: 'button', class: 'vl-jg-botao' + (dentro || chamado ? ' discreto' : ''), 'data-foco': 'conv-' + n, texto: dentro ? 'Na mesa' : chamado ? 'Chamado' : 'Convidar', disabled: dentro || chamado || cheio, onclick: acao })]);
        };
        const lista = (rotulo, linhas, vazio) => el('div', { class: 'vl-ms-chamar' }, [
          el('span', { class: 'vl-jg-rotulo', texto: rotulo + ' · ' + linhas.length }),
          linhas.length ? el('div', { class: 'vl-jg-gente' }, linhas) : el('div', { class: 'vl-jg-vazio pequeno' }, [el('span', { texto: vazio })]),
        ]);
        blocoLado = el('section', { class: 'vl-jg-bloco' }, [
          el('div', { class: 'vl-jg-bloco-cab' }, [el('span', { class: 'ic', 'aria-hidden': 'true', texto: '👥' }), el('h3', { texto: 'Chamar para a mesa' })]),
          el('div', { class: 'vl-ms-chamar-colunas' }, [
            lista('Neste quarto', noQuarto.map((n) => linha(n, 'Neste quarto', () => convidar(n))), 'Ninguém com o Vagalume neste quarto.' + (def.bots.length ? ' Dá para jogar com bots.' : '')),
            lista('Amigos online', amigos.map((a) => linha(a.nome, 'Em outro quarto', () => convidarAmigo(a))), mesa.naSala ? 'Nenhum amigo online agora.' : 'Ligue a Conexão do jogo para chamar amigos de outros quartos.'),
          ]),
          el('p', { class: 'vl-jg-nota', texto: 'Quem está no quarto recebe o convite na tela; amigos de outros quartos, pelo console. A pessoa precisa usar o Vagalume.' }),
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
        blocoJogadores, blocoLado,
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
      if (!mesa || mesa.jogo !== jogo || mesa.fase === 'fim') {
        naSala = new Map(); esperasNaSala = [];
        const m = mesa = { jogo, sessao: sessaoNova(), canal: novoCanal(), anfitriao: eu(), souAnfitriao: true, jogadores: [{ nome: eu(), bot: null }], fase: 'sala', chamados: new Set(), opcoes: opcoesValidas(def, null), plateia: new Map() };
        entrarNaSala(m.canal).then(function (ok) { if (mesa === m) { m.naSala = ok; desenhar(); } });
      }
      mostrar();
    }
    function convidar(nome) {
      mesa.chamados.add(nome.toLowerCase());
      mandar(nome, { t: 'ms:convite', j: mesa.jogo, c: mesa.canal });
      camada.aviso('Convite enviado a ' + nome + '.');
      desenhar();
      setTimeout(function () { if (mesa && mesa.chamados) { mesa.chamados.delete(nome.toLowerCase()); desenhar(); } }, 45000);
    }
    // Amigo de outro quarto: o convite vai pelo console, com a sala da partida e a sessão.
    function convidarAmigo(a) {
      const def = JOGOS[mesa.jogo];
      if (!mesa.naSala || !VL.conexao || !VL.conexao.enviar || !VL.codigos) { camada.aviso('Ligue a Conexão do jogo para chamar amigos de outros quartos.', { tipo: 'erro' }); return; }
      const chave = String(a.nome).toLowerCase();
      mesa.chamados.add(chave);
      VL.conexao.enviar(VL.codigos.SAIDA.MENSAGEM_PRIVADA, [['i', Number(a.id)], ['s', def.glifo + ' Bora jogar ' + def.nome + '? Convite do Vagalume: vl-mesa-' + LETRA_MESA[mesa.jogo] + mesa.canal + mesa.sessao]]);
      camada.aviso('Convite enviado a ' + a.nome + ' pelo console.');
      desenhar();
      const m = mesa;
      setTimeout(function () { if (mesa === m && m.chamados) { m.chamados.delete(chave); desenhar(); } }, 60000);
    }
    function botNovo(nivel) {
      const def = JOGOS[mesa.jogo];
      if (mesa.jogadores.length >= def.max) return;
      const usados = new Set(mesa.jogadores.map((p) => p.nome));
      const nome = (def.nomesBot || NOMES_BOT).find((n) => !usados.has(n)) || ('Bot ' + mesa.jogadores.length);
      mesa.jogadores.push({ nome, bot: def.bots.some(([id]) => id === nivel) ? nivel : (def.bots[0] || [])[0] });
      avisarSala();
    }
    function tirar(nome) {
      mesa.jogadores = mesa.jogadores.filter((p) => !mesmo(p.nome, nome));
      mandar(nome, { t: 'ms:fim', m: 'Você saiu da mesa.' });
      avisarSala();
    }
    function avisarSala() {
      for (const nome of quemRecebe()) mandar(nome, { t: 'ms:sala', j: mesa.jogo, a: mesa.anfitriao, js: mesa.jogadores, op: mesa.opcoes });
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
        let mudou = false;
        try { mudou = !!(def.tick && def.tick(mesa.estado)); } catch (e) { console.error('[Vagalume] mesa:', e); } // um erro do jogo não para a mesa
        if (mudou) publicar();
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
      // Quem assiste vê o que ninguém esconde (sem a mão de ninguém).
      if (mesa.plateia && mesa.plateia.size) {
        const agora = Date.now();
        for (const [k, x] of mesa.plateia) if (agora - x.em > 50000) mesa.plateia.delete(k); // não pediu de novo: foi embora
        const vista = def.visao(mesa.estado, '');
        for (const x of mesa.plateia.values()) mandar(x.nome, { t: 'ms:estado', j: mesa.jogo, v: mesa.versao, vi: vista, f: mesa.fase === 'fim' ? fim : null, js: mesa.jogadores, a: mesa.anfitriao });
      }
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
        if (mesa.souAnfitriao) for (const nome of quemRecebe()) mandar(nome, { t: 'ms:fim', m: mesa.anfitriao + ' fechou a mesa.' });
        else mandar(mesa.anfitriao, { t: 'ms:sair' });
      }
      clearInterval(relogio);
      if (mesa && mesa.manter) clearInterval(mesa.manter);
      const tinhaSala = !!(mesa && mesa.canal);
      mesa = null;
      if (janela) janela.style.display = 'none';
      if (tinhaSala) setTimeout(function () { if (!mesa || !mesa.canal) sairDaSala(); }, 400);
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
        } else if (d.t === 'ms:sair' && mesa.plateia && mesa.plateia.delete(de.toLowerCase())) {
          desenhar();
        } else if (d.t === 'ms:assistir' && !p) {
          const k = de.toLowerCase(), novo = !mesa.plateia.has(k);
          if (novo && mesa.plateia.size >= 12) return;
          mesa.plateia.set(k, { nome: de, em: Date.now() });
          if (novo) { camada.aviso(de + ' está assistindo a mesa.'); desenhar(); }
          if (mesa.fase === 'sala') mandar(de, { t: 'ms:sala', j: mesa.jogo, a: mesa.anfitriao, js: mesa.jogadores, op: mesa.opcoes });
          if (novo && mesa.fase !== 'sala') publicar();
        } else if (d.t === 'ms:chat' && (p || mesa.plateia.has(de.toLowerCase()))) {
          const x = limparFala(d.x), agora = Date.now();
          if (!x || agora - (falouEm.get(de.toLowerCase()) || 0) < 600) return;
          falouEm.set(de.toLowerCase(), agora);
          espalharFala(p ? p.nome : de, x);
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
      } else if (d.t === 'ms:chat' && typeof d.de === 'string') {
        mostrarFala(d.de.slice(0, 40), limparFala(d.x));
      } else if (d.t === 'ms:fim') { if (mesa.manter) clearInterval(mesa.manter); camada.aviso(String(d.m || 'A mesa foi fechada.').slice(0, 120)); mesa = null; if (janela) janela.style.display = 'none'; sairDaSala(); }
    }
    function mostrarConvite(de, d) {
      if (convite) fecharConvite();
      const def = JOGOS[d.j];
      const canal = /^9\d{11}$/.test(String(d.c || '')) ? String(d.c) : null;
      const no = el('div', { class: 'vl-ms-convite', role: 'dialog', 'aria-label': 'Convite para jogar' }, [
        el('div', { class: 'vl-ms-convite-arte ' + d.j, 'aria-hidden': 'true' }, [arte(d.j)]),
        el('b', { texto: de + ' chamou você para ' + def.nome }),
        el('p', { texto: d.deId ? 'Pelo console: você entra na mesa de onde estiver.' : def.texto }),
        el('div', { class: 'vl-ms-acoes' }, [
          el('button', { type: 'button', class: 'vl-jg-botao recusar', texto: 'Recusar', onclick() {
            if (!d.deId && VL.comunidade && VL.comunidade.direto) VL.comunidade.direto(de, { t: 'ms:recusar', s: d.s });
            fecharConvite();
          } }),
          el('button', { type: 'button', class: 'vl-jg-botao aceitar', texto: 'Entrar', onclick() { fecharConvite(); entrarNaMesa(de, d, canal); } }),
        ]),
      ]);
      camada.area().appendChild(no);
      som('vez');
      convite = { no, sessao: d.s, relogio: setTimeout(fecharConvite, d.deId ? 60000 : 45000) };
    }
    function entrarNaMesa(de, d, canal) {
      if (mesa) sair();
      naSala = new Map(); esperasNaSala = []; // a sala de partida antiga não vale para a mesa nova
      const def = JOGOS[d.j];
      const m = mesa = { jogo: d.j, sessao: d.s, canal, anfitriao: de, souAnfitriao: false, jogadores: [], fase: 'sala', versao: 0, opcoes: opcoesValidas(def, null) };
      mostrar();
      if (!d.deId) { mandar(de, { t: 'ms:entrar' }); entrarNaSala(canal); return; } // mesmo quarto: pelo canal do quarto
      // Pelo console: entra na sala da partida e espera quem chamou para pedir o lugar.
      entrarNaSala(canal).then((ok) => (ok ? esperarNaSala(de, 8000) : false)).then(function (chegou) {
        if (mesa !== m) return;
        if (!chegou) {
          camada.aviso(meuId() ? 'O convite de ' + de + ' não vale mais.' : 'Ligue a Conexão do jogo para entrar na mesa de ' + de + '.', { tipo: 'erro' });
          mesa = null;
          if (janela) janela.style.display = 'none';
          sairDaSala();
          return;
        }
        mandar(de, { t: 'ms:entrar' });
      });
    }
    function fecharConvite() { if (!convite) return; clearTimeout(convite.relogio); convite.no.remove(); convite = null; }

    if (ctx.ouvir) ctx.ouvir('amigos:mensagem', function (d) {
      const m = d && CODIGO_MESA.exec(String(d.texto || ''));
      if (!m || d.de == null) return;
      const jogo = JOGO_DA_LETRA[m[1]];
      if (!JOGOS[jogo] || (mesa && mesa.sessao === m[3]) || (convite && convite.sessao === m[3])) return;
      mostrarConvite(String(d.autor || 'Um amigo'), { j: jogo, s: m[3], c: m[2], deId: String(d.de) });
    });
    let tirarOuvinte = null, tentativas = 0;
    const ligar = function () {
      if (VL.comunidade && VL.comunidade.aoAcao) { tirarOuvinte = VL.comunidade.aoAcao(receber); return; }
      if (++tentativas < 60) setTimeout(ligar, 1000);
    };
    ligar();
    ctx.aoParar(function () { clearInterval(relogioFase); sair(); sairDaSala(); fecharConvite(); if (tirarOuvinte) tirarOuvinte(); estilo.remove(); if (janela) janela.remove(); janela = null; });
    return { abrir, receber, assistir, sair, mesa: () => mesa };
  }

  VL.mesa = { registrar, iniciar, arte, JOGOS, criarChat, limparFala };
})(typeof globalThis !== 'undefined' ? globalThis : this);
