// Vagalume — módulo "midia": imagens, GIFs e áudios no chat e chamada de voz no quarto, só entre quem
// usa o Vagalume (pedido do usuário em 2026-11-15; refeito em 2026-11-16 depois do primeiro teste).
// - Enviar: botões dentro do campo de chat do jogo (imagem ou GIF do computador, busca de GIFs, áudio de
//   até 60 s) e colar imagem no chat. O arquivo vai para o servidor da comunidade; na fala vai só um
//   emoji com o código escondido (VL.servidor.marcar). Quem não usa o Vagalume vê só o emoji.
// - Receber: o Vagalume esconde o emoji e o código e põe no balão só a imagem, o GIF ou o botão de tocar.
//   Dá para ampliar, denunciar e parar de ver as mídias de alguém.
// - Voz: o botão do fone abre o painel da chamada do quarto (quem está, com rosto, e quem está mudo);
//   "Entrar" liga o microfone; dentro, "Mutar"/"Desmutar", volume e silenciar por pessoa, e "Sair".
// Rede, microfone e som ficam na página escondida da extensão (src/sala), pelo fundo.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.servidor) return;
  const { nucleo, camada, jogo, servidor } = VL;
  const el = camada.el;

  // Botões dentro do campo de chat (página do jogo) e mídia dentro dos balões.
  const CSS_PAGINA = '.chatinput-container[data-vl-midia] { display: flex !important; align-items: center; }'
    + '.chatinput-container[data-vl-midia] > input.chat-input { flex: 1 1 auto; min-width: 0; }'
    + '.vl-chat-botoes { display: flex; align-items: center; gap: 2px; flex: none; margin: 0 30px 0 2px; }'
    + '.vl-chat-botoes button { all: unset; box-sizing: border-box; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 6px; cursor: pointer; color: #4a5263; }'
    + '.vl-chat-botoes button:hover { background: rgba(0, 0, 0, .08); }'
    + '.vl-chat-botoes button.ativo { background: #d6f24a; color: #12161f; }'
    + '.vl-chat-botoes button.gravando { width: auto; padding: 0 7px; background: #e5484d; color: #fff; font: 700 11px/1 system-ui, sans-serif; animation: vl-chat-pulsa 1s ease-in-out infinite; }'
    + '.vl-chat-botoes svg { width: 17px; height: 17px; display: block; }'
    + '.vl-chat-botoes .vl-gif-txt { font: 900 9px/1 system-ui, sans-serif; letter-spacing: .02em; border: 1.6px solid currentColor; border-radius: 3px; padding: 2px 2px 1px; }'
    + '@keyframes vl-chat-pulsa { 50% { opacity: .75; } }'
    + '.vl-midia { display: inline-flex; align-items: center; vertical-align: middle; margin: 1px 0 1px 2px; }'
    + '.vl-midia img { display: block; width: auto; height: auto; max-width: 110px; max-height: 68px; object-fit: contain; border-radius: 4px; cursor: zoom-in; }'
    + '.vl-pm-oculta { display: none !important; }'
    + '.vl-midia.vl-midia-pm { display: flex; margin: 3px 0; }'
    + '.vl-midia.vl-midia-pm img { max-width: 190px; max-height: 150px; }'
    + '.vl-pm-botoes { display: inline-flex !important; align-items: center; gap: 1px; margin: 0 3px; flex: none; }'
    + '.vl-pm-botoes button { width: 22px !important; height: 22px !important; }'
    + '.vl-pm-botoes svg { width: 15px !important; height: 15px !important; }'
    // A fileira do campo (input + botões + Fale) fica numa linha só; o campo encolhe.
    + ':has(> .vl-pm-botoes) { display: flex !important; flex-wrap: nowrap !important; align-items: center !important; }'
    + ':has(> .vl-pm-botoes) > input { flex: 1 1 auto !important; min-width: 0 !important; width: auto !important; }'
    + '.vl-audio { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 3px; border-radius: 999px; background: #1b2330; border: 1px solid #3b4a2a; pointer-events: auto; }'
    + '.vl-audio button { all: unset; width: 22px; height: 22px; border-radius: 50%; background: #d6f24a; color: #12161f; display: grid; place-items: center; cursor: pointer; font: 700 10px/1 system-ui, sans-serif; }'
    + '.vl-audio input[type=range] { width: 90px; height: 14px; margin: 0; accent-color: #d6f24a; cursor: pointer; }'
    + '.vl-audio span { font: 600 10.5px/1 system-ui, sans-serif; color: #d9e2c4; min-width: 62px; font-variant-numeric: tabular-nums; }'
    + '.vl-midia-carregando { font: 600 10px/1 system-ui, sans-serif; color: #8ea06b; }'
    + '[data-vl-marca-oculta] { display: none !important; }'
    + '.nitro-friends-messenger .vl-msg-botao { box-sizing: border-box; min-width: 26px; height: 22px; padding: 0 4px !important; display: inline-grid !important; place-items: center; cursor: pointer; margin-left: 3px; vertical-align: middle; }'
    + '.nitro-friends-messenger .vl-msg-botao svg { width: 14px; height: 14px; display: block; }';

  const CSS_CAMADA = '.vl-voz { position: fixed; width: 270px; pointer-events: auto; z-index: 3; background: linear-gradient(180deg, #1b2330, #12161f); border: 1px solid rgba(214, 242, 74, .45); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.55); color: #e8edf5; font: 12px/1.4 system-ui, sans-serif; overflow: hidden; }'
    + '.vl-voz-topo { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-bottom: 1px solid #2a3446; cursor: move; user-select: none; }'
    + '.vl-voz.minimizado .vl-voz-lista, .vl-voz.minimizado .vl-voz-acoes { display: none; }'
    // Minimizado: só os rostos, menores, com o anel verde em quem fala (pedido do usuário em 2026-11-19).
    + '.vl-voz-mini { display: none; flex-wrap: wrap; gap: 6px; padding: 0 10px 9px; }'
    + '.vl-voz.minimizado .vl-voz-mini { display: flex; }'
    + '.vl-voz-mini .vl-voz-rosto { width: 26px; height: 26px; font-size: 11px; }'
    + '.vl-voz-mini .vl-voz-rosto img { left: -9px; top: -12px; width: 44px; }'
    + '.vl-voz-mini .vl-voz-rosto.mudo::after { content: ""; position: absolute; right: 0; bottom: 0; width: 8px; height: 8px; border-radius: 50%; background: #e5484d; box-shadow: 0 0 0 1.5px #12161f; }'
    + '.vl-voz-mini button.vl-voz-rosto { all: unset; position: relative; flex: none; width: 26px; height: 26px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; cursor: pointer; background: #242d3d; color: #d6f24a; font-weight: 700; font-size: 11px; box-shadow: 0 0 0 2px #e5484d; }'
    + '.vl-voz-mini button.vl-voz-rosto.falando { box-shadow: 0 0 0 2px #d6f24a, 0 0 8px #d6f24a; }'
    + '.vl-voz.minimizado .vl-voz-topo { border-bottom: 0; }'
    + '.vl-voz-topo b { color: #d6f24a; flex: 1; }'
    + '.vl-voz-topo button { all: unset; cursor: pointer; color: #8d99ad; font-size: 15px; padding: 0 4px; }'
    + '.vl-voz-topo button:hover { color: #fff; }'
    + '.vl-voz-lista { max-height: 260px; overflow: auto; padding: 4px 0; }'
    + '.vl-voz-pessoa { display: flex; align-items: center; gap: 8px; padding: 4px 10px; }'
    + '.vl-voz-rosto { position: relative; flex: none; width: 34px; height: 34px; border-radius: 50%; background: #242d3d; overflow: hidden; display: grid; place-items: center; color: #d6f24a; font-weight: 700; box-shadow: 0 0 0 2px #2a3446; }'
    + '.vl-voz-rosto.falando { box-shadow: 0 0 0 2px #d6f24a, 0 0 10px #d6f24a; }'
    + '.vl-voz-rosto img { position: absolute; left: -12px; top: -16px; width: 58px; image-rendering: pixelated; }'
    + '.vl-voz-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }'
    + '.vl-voz-nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }'
    + '.vl-voz-mic { font-size: 10.5px; color: #9be8ad; }'
    + '.vl-voz-mic.mudo { color: #ff8a8d; }'
    + '.vl-voz input[type=range] { width: 64px; accent-color: #d6f24a; }'
    + '.vl-voz-pessoa button { all: unset; cursor: pointer; width: 24px; text-align: center; font-size: 13px; }'
    // Botões em grade, ícone em cima e nome curto embaixo, para caberem os quatro numa linha.
    + '.vl-voz-acoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(54px, 1fr)); gap: 6px; padding: 9px 10px; border-top: 1px solid #2a3446; }'
    + '.vl-voz-acoes button { min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 1px solid #36435c; background: #242d3d; color: #e8edf5; border-radius: 8px; cursor: pointer; font: 600 10.5px/1.1 system-ui, sans-serif; padding: 7px 4px; white-space: nowrap; }'
    + '.vl-voz-acoes button svg { width: 18px; height: 18px; flex: none; }'
    + '.vl-voz-acoes button:hover { border-color: #d6f24a; }'
    + '.vl-voz-acoes button.entrar { grid-column: 1 / -1; flex-direction: row; gap: 6px; font-size: 12px; padding: 9px 10px; }'
    + '.vl-voz-acoes button.ativo { background: #2a3518; border-color: #d6f24a; color: #d6f24a; }'
    // Quem está compartilhando a tela: pílula AO VIVO, como no Discord; clicar abre a tela de novo.
    + '.vl-voz-nomelinha { display: flex; align-items: center; gap: 6px; min-width: 0; }'
    + '.vl-voz-pessoa .vl-voz-tela { all: unset; flex: none; width: auto; white-space: nowrap; cursor: pointer; padding: 3px 7px; border-radius: 999px; background: #e5484d; color: #fff; font: 800 9.5px/1 system-ui, sans-serif; letter-spacing: .04em; }'
    + '.vl-voz-pessoa .vl-voz-tela:hover { filter: brightness(1.12); }'
    + '.vl-voz-pessoa .vl-voz-tela.vendo { background: #2a3518; color: #d6f24a; box-shadow: inset 0 0 0 1px #d6f24a; }'
    + '.vl-voz-pessoa .vl-voz-tela:focus-visible { outline: 2px solid #d6f24a; outline-offset: 1px; }'
    + '.vl-voz-acoes button.entrar { background: #d6f24a; border-color: #d6f24a; color: #12161f; }'
    + '.vl-voz-acoes button.mudo { background: #3a2226; border-color: #e5484d; color: #ff8a8d; }'
    + '.vl-voz-acoes button.sair { background: #e5484d; border-color: #e5484d; color: #fff; }'
    + '.vl-voz-vazio { padding: 10px; color: #8d99ad; }'
    + '.vl-gifs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; max-height: 340px; overflow: auto; margin: 8px 0; }'
    + '.vl-gifs button { padding: 0; border: 1px solid #2a3446; border-radius: 6px; overflow: hidden; background: #12161f; cursor: pointer; aspect-ratio: 1; }'
    + '.vl-gifs button:hover { border-color: #d6f24a; }'
    + '.vl-gifs img { width: 100%; height: 100%; object-fit: cover; display: block; }'
    + '.vl-gifs-mais { width: 100%; }'
    + '.vl-midia-grande { display: block; max-width: min(70vw, 720px); max-height: 60vh; margin: 6px auto; border-radius: 8px; }'
    + '.vl-fonte-gif { font-size: 10px; color: #8d99ad; text-align: right; }'
    + '.vl-ligacao { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 244px; padding: 24px 18px 18px; border-radius: 16px; background: #10141c; border: 1px solid rgba(214, 242, 74, .3); box-shadow: 0 24px 60px rgba(0, 0, 0, .65); text-align: center; pointer-events: auto; z-index: 6; color: #e8edf5; font-family: system-ui, "Segoe UI", sans-serif; animation: vl-lig-entra .22s ease-out; }'
    + '@keyframes vl-lig-entra { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }'
    + '.vl-ligacao-anel { position: relative; width: 100px; height: 100px; margin: 0 auto 14px; }'
    + '.vl-ligacao.tocando .vl-ligacao-anel::before, .vl-ligacao.tocando .vl-ligacao-anel::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 2px solid #d6f24a; animation: vl-lig-onda 1.6s ease-out infinite; }'
    + '.vl-ligacao.tocando .vl-ligacao-anel::after { animation-delay: .8s; }'
    + '@keyframes vl-lig-onda { from { transform: scale(1); opacity: .8; } to { transform: scale(1.45); opacity: 0; } }'
    + '.vl-ligacao-foto { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 50% 35%, #2d3a52, #171d29); box-shadow: 0 0 0 4px #1c2331; display: grid; place-items: center; color: #d6f24a; font: 700 36px/1 system-ui, sans-serif; }'
    + '.vl-ligacao-foto img { position: absolute; width: 90px; height: 130px; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(2); image-rendering: pixelated; }'
    + '.vl-ligacao b { display: block; font-size: 18px; margin-bottom: 3px; }'
    + '.vl-ligacao-sub { color: #9aa4b5; font-size: 13px; }'
    + '.vl-ligacao-botoes { display: flex; justify-content: center; gap: 14px; margin-top: 20px; }'
    + '.vl-ligacao-botoes button { width: 66px; height: 46px; border: 0; border-radius: 12px; cursor: pointer; display: grid; place-items: center; color: #fff; transition: filter .12s, transform .12s; }'
    + '.vl-ligacao-botoes button:hover { filter: brightness(1.12); transform: translateY(-1px); }'
    + '.vl-ligacao-botoes .recusar { background: #d83c47; } .vl-ligacao-botoes .atender { background: #3ba55c; } .vl-ligacao-botoes .ok { background: #2c3647; width: 120px; font: 600 13px/1 system-ui, sans-serif; }'
    + '.vl-ligacao-botoes svg { width: 22px; height: 22px; }';

  // Ícones simples em SVG (sem HTML montado a partir de texto).
  const NS = 'http://www.w3.org/2000/svg';
  function icone(tracos) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    for (const [tag, attrs] of tracos) {
      const n = document.createElementNS(NS, tag);
      for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k]);
      s.appendChild(n);
    }
    return s;
  }
  const ICONES = {
    imagem: () => icone([['rect', { x: 3, y: 4, width: 18, height: 16, rx: 3 }], ['circle', { cx: 9, cy: 10, r: 1.8 }], ['path', { d: 'M21 16l-5-5-8 9' }]]),
    microfone: () => icone([['rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }], ['path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3' }]]),
    fone: () => icone([['path', { d: 'M4 15v-3a8 8 0 0 1 16 0v3' }], ['rect', { x: 3, y: 14, width: 5, height: 7, rx: 2 }], ['rect', { x: 16, y: 14, width: 5, height: 7, rx: 2 }]]),
    xis: () => icone([['path', { d: 'M6 6l12 12M18 6L6 18' }]]),
    telefone: () => icone([['path', { d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z' }]]),
    microfoneMudo: () => icone([['rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }], ['path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16' }]]),
    tela: () => icone([['rect', { x: 3, y: 4, width: 18, height: 12, rx: 2 }], ['path', { d: 'M8 20h8M12 16v4' }]]),
    desligar: () => icone([['path', { d: 'M3 14c5-5 13-5 18 0l-2.5 2.5-3-1.5V13a10 10 0 0 0-5 0v2l-3 1.5z' }]]),
    grupo: () => icone([['circle', { cx: 9, cy: 8, r: 3 }], ['path', { d: 'M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2' }]]),
  };

  function sala(tipo, dado) {
    return chrome.runtime.sendMessage(Object.assign({ tipo: 'sala:' + tipo }, dado || {})).then(function (r) {
      if (r && r.erro) throw new Error(r.erro);
      return r;
    });
  }
  const ERROS = {
    'sem-servidor': 'O servidor do Vagalume ainda não foi configurado nesta versão.',
    microfone: 'Sem acesso ao microfone.',
    devagar: 'Calma: muitos envios seguidos. Tente de novo em um minuto.',
    tamanho: 'Arquivo grande demais (imagens até 4 MB, GIFs até 6 MB).',
    tipo: 'Tipo de arquivo não aceito (PNG, JPG, GIF ou WEBP).',
    conteudo: 'O arquivo não parece ser uma imagem de verdade.',
    'sem-gifs': 'A busca de GIFs ainda não foi ligada no servidor. Dá para mandar GIFs do computador pelo botão de imagem.',
    curto: 'Áudio curto demais.',
    cheia: 'A chamada deste quarto está cheia (12 pessoas).',
    conexao: 'Não consegui falar com o servidor do Vagalume.',
    'nao-existe': 'Essa mídia não existe mais (as mídias duram 7 dias).',
    impropria: 'Essa imagem não passou no filtro do Vagalume (parece ter nudez ou violência). Ela não foi enviada.',
  };
  function mensagemDeErro(e) { const c = String(e && e.message || e); return ERROS[c] || 'Falhou (' + c + ').'; }

  function paraBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // Imagens grandes ficam com até 1280 px no lado maior (WEBP); GIFs vão como estão.
  // Miniatura JPEG (até 224 px) que o servidor confere no filtro de imagens; no GIF, o primeiro quadro.
  async function miniaturaDe(bitmap) {
    const k = Math.min(1, 224 / Math.max(bitmap.width, bitmap.height));
    const c = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * k)), Math.max(1, Math.round(bitmap.height * k)));
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bitmap, 0, 0, c.width, c.height);
    return new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 })).arrayBuffer());
  }
  async function prepararImagem(arquivo) {
    const tipo = String(arquivo.type || '').toLowerCase();
    if (!/^image\/(png|jpeg|gif|webp)$/.test(tipo)) throw new Error('tipo');
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const bitmap = await createImageBitmap(new Blob([bytes], { type: tipo }));
    const miniatura = await miniaturaDe(bitmap);
    if (tipo === 'image/gif') { bitmap.close(); if (bytes.length > 6e6) throw new Error('tamanho'); return { bytes, mime: tipo, gif: true, miniatura }; }
    const lado = Math.max(bitmap.width, bitmap.height);
    if (lado <= 1280 && bytes.length <= 1.5e6) { bitmap.close(); return { bytes, mime: tipo, gif: false, miniatura }; }
    const k = Math.min(1, 1280 / lado);
    const c = new OffscreenCanvas(Math.round(bitmap.width * k), Math.round(bitmap.height * k));
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.85 });
    const novo = new Uint8Array(await blob.arrayBuffer());
    if (novo.length > 4e6) throw new Error('tamanho');
    return { bytes: novo, mime: 'image/webp', gif: false, miniatura };
  }

  function rostoDe(nome, visualReserva) {
    const v = VL.pessoas && VL.pessoas.visualDe ? VL.pessoas.visualDe(nome) : null;
    const visual = (v && (v.visual || (typeof v === 'string' ? v : ''))) || visualReserva;
    return visual ? 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(visual) + '&headonly=1&direction=2&head_direction=3' : '';
  }

  nucleo.definirModulo({
    id: 'midia',
    iniciar(ctx) {
      ctx.aoParar(camada.estiloPagina('midia', CSS_PAGINA));
      const estiloCamada = el('style', { texto: CSS_CAMADA });
      camada.area().appendChild(estiloCamada);
      ctx.aoParar(function () { estiloCamada.remove(); });

      const eu = () => (VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null);
      const meuId = () => (VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null);
      const quartoAtual = () => (VL.pessoas && VL.pessoas.quartoAtual ? VL.pessoas.quartoAtual() : null);
      function pronto() {
        if (!servidor.configurado()) { camada.aviso(ERROS['sem-servidor'], { tipo: 'erro' }); return false; }
        return true;
      }
      // encaixar() chama posicionarPainel() durante a montagem dos botões.
      // O estado precisa existir antes dessa primeira chamada.
      let painel = null;
      let emVoz = false;
      let estadoVoz = null;
      let presentes = [];
      const compartilhando = new Map(); // id -> nome de quem está compartilhando a tela nesta chamada
      let relogioPresentes = null;
      let quartoDaVoz = null;
      let privado = null;
      let grupoDaVoz = null;
      let gruposVoz = null;
      let posicaoPainel = null;
      try { posicaoPainel = JSON.parse(localStorage.getItem('vl.vozPosicao') || 'null'); } catch (e) { posicaoPainel = null; }
      let minimizado = false;
      try { minimizado = localStorage.getItem('vl.vozMinimizado') === '1'; } catch (e) { /* sem armazenamento */ }

      // ---------- mandar a marca na fala ----------
      let modo = 'invisivel';
      try { if (localStorage.getItem('vl.midiaModo2') === 'visivel' || localStorage.getItem('vl.midiaModo3') === 'servidor') modo = 'visivel'; } catch (e) { /* sem armazenamento */ }
      let conferindo = null; // { tipo, id, ate }
      // Sem os caracteres invisíveis (o jogo os tira), o código vai pelo servidor da comunidade e no chat sai
      // só o emoji: quem não usa o Vagalume vê 📷/🎬/🎤 (pedido do usuário em 2026-11-20).
      function avisarMidia(tipo, id) {
        if (VL.comunidade && VL.comunidade.acao) VL.comunidade.acao({ t: 'midia', k: tipo, id });
        esperarMidia({ autor: String(eu() || ''), tipo, id }); // o servidor não devolve o aviso a quem mandou
      }
      let destino = 'quarto'; // 'privado' quando a mídia sai pelos botões do bate-papo privado
      function falar(tipo, id) {
        if (destino === 'privado') { destino = 'quarto'; mandarNoPrivado(tipo, id); return; }
        if (typeof destino === 'function') { const fn = destino; destino = 'quarto'; fn(servidor.marcar(tipo, id)); return; }
        if (modo === 'visivel') {
          avisarMidia(tipo, id);
          setTimeout(function () { if (!jogo.enviarFala(servidor.TIPOS[tipo])) camada.aviso('Não achei o campo de chat do jogo.', { tipo: 'erro' }); }, 120);
          return;
        }
        const texto = servidor.marcar(tipo, id, modo);
        if (!jogo.enviarFala(texto)) { camada.aviso('Não achei o campo de chat do jogo.', { tipo: 'erro' }); return; }
        conferindo = { tipo, id, ate: Date.now() + 6000 };
      }

      async function mandarArquivo(arquivo, onde) {
        if (!pronto()) return;
        const paraPrivado = onde && onde !== 'quarto';
        try {
          const p = await prepararImagem(arquivo);
          camada.aviso('Enviando ' + (p.gif ? 'GIF' : 'imagem') + '…', { duracaoMs: 2500 });
          const r = await sala('midia:enviar', { base64: paraBase64(p.bytes), mime: p.mime, autor: meuId(), miniatura: paraBase64(p.miniatura) });
          if (paraPrivado) destino = onde;
          falar(p.gif ? 'g' : 'i', r.id);
        } catch (e) { camada.aviso(mensagemDeErro(e), { tipo: 'erro' }); }
      }
      async function confirmarImagem(arquivo, onde) {
        const url = URL.createObjectURL(arquivo);
        const privada = !!onde && onde !== 'quarto';
        const ok = await camada.dialogo({
          titulo: 'Enviar esta imagem?',
          texto: privada ? 'Se o seu amigo usa o Vagalume, ele vê a imagem na conversa; se não usa, vê só um emoji. Fica guardada por 7 dias.'
            : 'Quem usa o Vagalume no quarto vê a imagem; quem não usa vê só um emoji. Fica guardada por 7 dias.',
          conteudo: el('img', { class: 'vl-midia-grande', src: url, alt: '' }),
          botoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Enviar', valor: true, destaque: true, foco: true }],
        });
        URL.revokeObjectURL(url);
        if (ok) mandarArquivo(arquivo, onde);
      }

      // ---------- botões dentro do campo de chat ----------
      const seletor = document.createElement('input');
      seletor.type = 'file';
      seletor.accept = 'image/png,image/jpeg,image/gif,image/webp';
      let destinoSeletor = 'quarto';
      seletor.addEventListener('change', function () { const f = seletor.files && seletor.files[0]; seletor.value = ''; if (f) confirmarImagem(f, destinoSeletor); });
      function botao(titulo, conteudo, acao) {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = titulo;
        b.setAttribute('aria-label', titulo);
        b.appendChild(conteudo);
        // mousedown sem efeito padrão: o campo de chat não perde o foco nem o jogo trata o clique.
        b.addEventListener('mousedown', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
        b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); acao(); });
        return b;
      }
      const textoGif = document.createElement('span');
      textoGif.className = 'vl-gif-txt';
      textoGif.textContent = 'GIF';
      const bImagem = botao('Mandar imagem ou GIF do computador', ICONES.imagem(), function () { if (pronto()) { destinoSeletor = 'quarto'; seletor.click(); } });
      const bGif = botao('Procurar GIF', textoGif, function () { if (pronto()) buscarGifs('quarto'); });
      const bAudio = botao('Gravar áudio (até 60 s)', ICONES.microfone(), function () { alternarGravacao(bAudio, false); });
      const bAudioQuarto = bAudio;
      const bVoz = botao('Chamada de voz do quarto', ICONES.fone(), function () { alternarPainel(); });
      const grupo = document.createElement('span');
      grupo.className = 'vl-chat-botoes';
      grupo.append(bImagem, bGif, bAudio, bVoz);
      // O React do jogo redesenha o campo de chat: um observador põe os botões de volta.
      function encaixar() {
        const caixa = document.querySelector('.nitro-room-chatinput-component .chatinput-container');
        if (!caixa) return;
        if (!caixa.hasAttribute('data-vl-midia')) caixa.setAttribute('data-vl-midia', '');
        if (grupo.parentElement !== caixa || caixa.lastElementChild !== grupo) caixa.appendChild(grupo);
        posicionarPainel();
      }
      let relogioEncaixe = null;
      const observador = new MutationObserver(function () { if (!relogioEncaixe) relogioEncaixe = setTimeout(function () { relogioEncaixe = null; encaixar(); }, 120); });
      if (document.body) observador.observe(document.body, { childList: true, subtree: true });
      encaixar();
      ctx.aoParar(function () {
        observador.disconnect();
        clearTimeout(relogioEncaixe);
        grupo.remove();
        document.querySelectorAll('[data-vl-midia]').forEach((n) => n.removeAttribute('data-vl-midia'));
      });

      // Colar imagem no campo de chat.
      ctx.escutar(window, 'paste', function (ev) {
        const noPrivado = !!(ev.target && ev.target.closest && ev.target.closest('.nitro-friends-messenger:not(.vl-console-grupos)') && !ev.target.closest('.vl-grupos-compor'));
        if ((!noPrivado && !jogo.ehEntradaChat(ev.target)) || !ev.clipboardData) return;
        const f = [...ev.clipboardData.files].find((x) => /^image\//.test(x.type));
        if (!f) return;
        ev.preventDefault();
        if (pronto()) confirmarImagem(f, noPrivado ? 'privado' : 'quarto');
      }, true);

      // ---------- GIFs ----------
      async function buscarGifs(onde) {
        const campo = el('input', { type: 'search', class: 'vl-campo', placeholder: 'Procurar GIF… (vazio: os do momento)', 'aria-label': 'Procurar GIF' });
        const grade = el('div', { class: 'vl-gifs' });
        const nota = el('p', { class: 'vl-nota', texto: 'Carregando…' });
        const fonte = el('p', { class: 'vl-fonte-gif' });
        const mais = el('button', { type: 'button', class: 'vl-botao vl-gifs-mais', texto: 'Mais GIFs', hidden: true });
        let escolhido = null;
        let fecharDialogo = null;
        let proximo = '';
        let busca = '';
        let pedido = 0;
        async function carregar(q, continuar) {
          const meu = ++pedido;
          if (!continuar) { busca = q; proximo = ''; grade.replaceChildren(); }
          nota.textContent = 'Carregando…';
          mais.hidden = true;
          try {
            const r = await sala('gifs:buscar', { q: busca, pos: continuar ? proximo : '' });
            if (meu !== pedido) return;
            grade.append(...r.lista.map(function (g) {
              return el('button', { type: 'button', title: 'Mandar este GIF', onclick() { escolhido = g.id; if (fecharDialogo) fecharDialogo(); } }, [el('img', { src: g.previa, alt: '' })]);
            }));
            proximo = r.proximo || '';
            mais.hidden = !proximo;
            fonte.textContent = r.fonte ? 'Via ' + r.fonte : '';
            nota.textContent = grade.childElementCount ? '' : 'Nada encontrado.';
          } catch (e) { if (meu === pedido) nota.textContent = mensagemDeErro(e); }
        }
        mais.addEventListener('click', function () { carregar(busca, true); });
        let espera = null;
        campo.addEventListener('input', function () { clearTimeout(espera); espera = setTimeout(function () { carregar(campo.value.trim(), false); }, 400); });
        campo.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
        const conteudo = el('div', {}, [campo, nota, grade, mais, fonte]);
        const aberto = camada.dialogo({ titulo: 'GIFs', conteudo, largo: true, botoes: [{ rotulo: 'Fechar', valor: null }] });
        // Fecha o diálogo ao escolher: o diálogo da camada fecha com o Esc.
        fecharDialogo = function () { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); };
        setTimeout(function () { campo.focus(); }, 50);
        carregar('', false);
        await aberto;
        if (!escolhido) return;
        try {
          camada.aviso('Enviando GIF…', { duracaoMs: 2000 });
          const r = await sala('gifs:salvar', { id: escolhido, autor: meuId() });
          if (onde && onde !== 'quarto') destino = onde;
          falar('g', r.id);
        } catch (e) { camada.aviso(mensagemDeErro(e), { tipo: 'erro' }); }
      }

      // ---------- áudio ----------
      let gravando = null; // { relogio }
      async function pedirMicrofone() {
        const ok = await camada.confirmar('O Vagalume precisa do microfone. Abrir a janelinha para permitir?', { titulo: 'Microfone', sim: 'Abrir' });
        if (ok) chrome.runtime.sendMessage({ tipo: 'microfone:permitir' }).catch(function () {});
      }
      async function alternarGravacao(botaoGravacao, paraPrivado) {
        if (!pronto()) return;
        if (gravando) { terminarGravacao(true); return; }
        const bAudio = botaoGravacao || bAudioQuarto;
        try { await sala('audio:gravar'); } catch (e) {
          if (String(e.message) === 'microfone') pedirMicrofone(); else camada.aviso(mensagemDeErro(e), { tipo: 'erro' });
          return;
        }
        const inicio = Date.now();
        bAudio.classList.add('gravando');
        const atualizar = () => { const s = Math.floor((Date.now() - inicio) / 1000); bAudio.textContent = '● ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' enviar'; };
        atualizar();
        gravando = { relogio: setInterval(atualizar, 250), botao: bAudio, onde: paraPrivado || null };
        bAudio.title = 'Clique para enviar · Esc cancela';
      }
      async function terminarGravacao(enviar) {
        if (!gravando) return;
        clearInterval(gravando.relogio);
        const bAudio = gravando.botao, paraPrivado = gravando.onde;
        gravando = null;
        bAudio.classList.remove('gravando');
        bAudio.replaceChildren(ICONES.microfone());
        bAudio.title = 'Gravar áudio (até 60 s)';
        try {
          const r = await sala('audio:parar', { enviar, autor: meuId() });
          if (enviar && r.id) { if (paraPrivado) destino = paraPrivado === true ? 'privado' : paraPrivado; falar('a', r.id); }
        } catch (e) { if (enviar) camada.aviso(mensagemDeErro(e), { tipo: 'erro' }); }
      }
      ctx.escutar(window, 'keydown', function (ev) {
        if (gravando && ev.key === 'Escape') { ev.preventDefault(); terminarGravacao(false); }
      }, true);
      ctx.aoParar(function () { if (gravando) terminarGravacao(false); });

      // ---------- bate-papo privado: mandar e mostrar mídia ----------
      // A marca (emoji + caracteres invisíveis com o código) vai como mensagem da conversa, digitada no campo do
      // jogo (assim ela aparece também na sua tela). Quem não usa o Vagalume vê só o emoji.
      const SEL_PRIVADO = '.nitro-friends-messenger:not(.vl-console-grupos)';
      function mandarNoPrivado(tipo, id) {
        const texto = servidor.marcar(tipo, id);
        const campo = document.querySelector(SEL_PRIVADO + ' input.chat-input-form');
        if (campo && jogo.definirValor && jogo.apertarEnter) {
          const rascunho = campo.value;
          jogo.definirValor(campo, texto);
          jogo.apertarEnter(campo);
          if (rascunho) jogo.definirValor(campo, rascunho);
          return;
        }
        const a = amigoDoBatePapo();
        if (!a) { camada.aviso('Abra a conversa com o amigo para mandar a mídia.', { tipo: 'erro' }); return; }
        VL.conexao.enviar(VL.codigos.SAIDA.MENSAGEM_PRIVADA, [['i', a.id], ['s', texto]]);
      }
      function botoesMidia(onde) {
        const img = botao('Mandar imagem ou GIF do computador', ICONES.imagem(), function () { if (pronto()) { destinoSeletor = onde; seletor.click(); } });
        const txt = document.createElement('span');
        txt.className = 'vl-gif-txt';
        txt.textContent = 'GIF';
        const gif = botao('Procurar GIF', txt, function () { if (pronto()) buscarGifs(onde); });
        const audio = botao('Gravar áudio (até 60 s)', ICONES.microfone(), function () { alternarGravacao(audio, onde === 'privado' ? true : onde); });
        const g = document.createElement('span');
        g.className = 'vl-chat-botoes vl-pm-botoes';
        g.append(img, gif, audio);
        return g;
      }
      const grupoPrivado = botoesMidia('privado');
      function encaixarPrivado() {
        // O campo da conversa privada do jogo (não o campo das conversas em grupo do Vagalume encaixadas no console).
        const campo = [...document.querySelectorAll(SEL_PRIVADO + ' input.chat-input-form')].find((c) => !c.closest('.vl-grupos-compor'));
        if (!campo) { grupoPrivado.remove(); return; }
        if (grupoPrivado.previousElementSibling !== campo) campo.after(grupoPrivado);
      }
      const imagensBaixadas = new Map(); // id -> Promise({ dataUrl }): a conversa em grupo redesenha as falas a cada mensagem
      function midiaNoConsole() {
        document.querySelectorAll('.message-bubble .text-break:not([data-vl-pm])').forEach(function (linha) {
          linha.setAttribute('data-vl-pm', '');
          const marca = servidor.ler(linha.textContent);
          if (!marca || !/^[iga]$/.test(marca.tipo) || !servidor.configurado()) return;
          linha.classList.add('vl-pm-oculta');
          const caixa = document.createElement('span');
          caixa.className = 'vl-midia vl-midia-pm';
          caixa.textContent = '…';
          caixa.addEventListener('mousedown', function (ev) { ev.stopPropagation(); }, true);
          linha.after(caixa);
          if (marca.tipo === 'a') { caixa.replaceChildren(montarPlayer(marca.id)); return; }
          (imagensBaixadas.get(marca.id) || sala('midia:baixar', { id: marca.id })).then(function (m) {
            if (!/^data:image\//.test(m.dataUrl)) { caixa.textContent = '(mídia indisponível)'; return; }
            imagensBaixadas.set(marca.id, Promise.resolve(m));
            if (imagensBaixadas.size > 60) imagensBaixadas.delete(imagensBaixadas.keys().next().value);
            const img = document.createElement('img');
            img.alt = '';
            img.src = m.dataUrl;
            img.addEventListener('click', function (ev) { ev.stopPropagation(); ampliar(m.dataUrl, marca.id, null); });
            caixa.replaceChildren(img);
          }, function () { caixa.textContent = '(mídia indisponível)'; });
        });
      }
      let relogioPrivado = null;
      const observadorPrivado = new MutationObserver(function () {
        if (relogioPrivado) return;
        relogioPrivado = setTimeout(function () { relogioPrivado = null; encaixarPrivado(); midiaNoConsole(); }, 150);
      });
      if (document.body) observadorPrivado.observe(document.body, { childList: true, subtree: true });
      ctx.aoParar(function () {
        observadorPrivado.disconnect(); clearTimeout(relogioPrivado); grupoPrivado.remove();
        document.querySelectorAll('.vl-midia-pm').forEach((n) => n.remove());
        document.querySelectorAll('[data-vl-pm]').forEach((n) => { n.removeAttribute('data-vl-pm'); n.classList.remove('vl-pm-oculta'); });
      });

      // ---------- receber: mídia nos balões ----------
      const bloqueados = () => (ctx.secao().bloqueados || []).map((n) => String(n).toLowerCase());
      function podeVer(autor) {
        const a = String(autor || '').toLowerCase();
        return !bloqueados().includes(a);
      }
      const botoesAudio = new Map(); // id -> Set<button>
      const esperandoMidia = []; // avisos de mídia do servidor ainda sem balão
      const baloesEmoji = []; // balões só de emoji ainda sem aviso
      function aoFalar(fala) {
        const minha = fala.autor && eu() && fala.autor.toLowerCase() === String(eu()).toLowerCase();
        if (conferindo && minha && Date.now() < conferindo.ate && servidor.perdeuMarca(fala.texto)) {
          // A própria fala voltou sem os caracteres invisíveis: o jogo os tirou. Daqui em diante o código vai
          // pelo servidor da comunidade; esta fala (que ficou só com o emoji) recebe a mídia agora.
          const c = conferindo;
          conferindo = null;
          modo = 'visivel';
          try { localStorage.setItem('vl.midiaModo3', 'servidor'); } catch (e) { /* sem armazenamento */ }
          if (VL.comunidade && VL.comunidade.acao) VL.comunidade.acao({ t: 'midia', k: c.tipo, id: c.id });
          if (servidor.soEmoji(fala.texto)) mostrarMidia(fala, c, servidor.soEmoji);
          return;
        }
        const marca = servidor.ler(fala.texto);
        if (!marca) { guardarEmoji(fala); return; }
        if (minha && conferindo && conferindo.id === marca.id) conferindo = null;
        if (marca.tipo === 'c') return;
        mostrarMidia(fala, marca, servidor.ler);
      }
      // Mostra a mídia no balão; acharTrecho(texto) devolve o trecho a esconder (emoji e marca).
      function mostrarMidia(fala, marca, acharTrecho) {
        if (!servidor.configurado() || !podeVer(fala.autor) || fala.el.querySelector('.vl-midia')) return;
        // Esconde o emoji e a marca: quem usa o Vagalume vê só a mídia.
        jogo.marcarTrechos(fala.el, function (s) { const m = acharTrecho(s); return m ? [{ inicio: m.inicio, fim: m.fim }] : []; }, function (trecho, visivel) {
          const s = document.createElement('span');
          s.setAttribute('data-vl-marca-oculta', '');
          s.textContent = visivel;
          return s;
        });
        const corpo = fala.el.querySelector('.message') || fala.el;
        const caixa = document.createElement('span');
        caixa.className = 'vl-midia';
        const carregando = document.createElement('span');
        carregando.className = 'vl-midia-carregando';
        carregando.textContent = '…';
        caixa.appendChild(carregando);
        corpo.appendChild(caixa);
        caixa.addEventListener('mousedown', function (ev) { ev.stopPropagation(); }, true);
        if (marca.tipo === 'a') {
          caixa.replaceChildren(montarPlayer(marca.id));
          return;
        }
        sala('midia:baixar', { id: marca.id }).then(function (m) {
          if (!/^data:image\//.test(m.dataUrl)) { caixa.remove(); return; }
          const img = document.createElement('img');
          img.alt = '';
          img.src = m.dataUrl;
          img.addEventListener('click', function (ev) { ev.stopPropagation(); ampliar(m.dataUrl, marca.id, fala.autor); });
          caixa.replaceChildren(img);
        }, function () { carregando.textContent = '(mídia indisponível)'; });
      }
      ctx.aoParar(jogo.observarFalas(aoFalar));
      // Mídia avisada pelo servidor da comunidade: casa o aviso { t: 'midia', k, id } com o balão só de
      // emoji da mesma pessoa, chegue um antes do outro (até 20 s).
      function limparMidia() {
        const limite = Date.now() - 20000;
        for (const l of [esperandoMidia, baloesEmoji]) while (l.length && l[0].quando < limite) l.shift();
      }
      const mesmoAutor = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
      function esperarMidia(m) {
        limparMidia();
        const i = baloesEmoji.findIndex((b) => b.fala.el.isConnected && mesmoAutor(b.fala.autor, m.autor) && b.tipo === m.tipo);
        if (i >= 0) { const b = baloesEmoji.splice(i, 1)[0]; mostrarMidia(b.fala, m, servidor.soEmoji); return; }
        esperandoMidia.push(Object.assign({ quando: Date.now() }, m));
      }
      function guardarEmoji(fala) {
        const e = servidor.soEmoji(fala.texto);
        if (!e || !fala.autor) return;
        limparMidia();
        const i = esperandoMidia.findIndex((m) => mesmoAutor(m.autor, fala.autor) && m.tipo === e.tipo);
        if (i >= 0) { mostrarMidia(fala, esperandoMidia.splice(i, 1)[0], servidor.soEmoji); return; }
        baloesEmoji.push({ fala, tipo: e.tipo, quando: Date.now() });
        if (baloesEmoji.length > 40) baloesEmoji.shift();
      }
      function aoAvisoMidia(m) {
        const d = m && m.dado;
        if (!d || d.t !== 'midia' || !m.nome || !['i', 'g', 'a'].includes(d.k) || !servidor.idValido(d.id)) return;
        esperarMidia({ autor: String(m.nome), tipo: d.k, id: d.id });
      }
      function ligarAvisosMidia() {
        if (VL.comunidade && VL.comunidade.aoAcao) { ctx.aoParar(VL.comunidade.aoAcao(aoAvisoMidia)); return true; }
        return false;
      }
      if (!ligarAvisosMidia()) {
        const espera = setInterval(function () { if (ligarAvisosMidia()) clearInterval(espera); }, 1000);
        ctx.aoParar(function () { clearInterval(espera); });
      }
      ctx.aoParar(function () {
        document.querySelectorAll('.vl-midia').forEach((n) => n.remove());
        document.querySelectorAll('[data-vl-marca-oculta]').forEach((n) => n.removeAttribute('data-vl-marca-oculta'));
      });

      // Player do áudio no balão: tocar/pausar, barra de posição e tempo. O som toca na sala, que avisa
      // a posição (audio:progresso); todos os players do mesmo áudio mostram o mesmo estado.
      const estadoAudio = new Map(); // id -> { t, d, tocando }
      const tempo = (s) => { const x = Math.max(0, Math.floor(s || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
      function montarPlayer(id) {
        const p = document.createElement('span');
        p.className = 'vl-audio';
        const b = document.createElement('button');
        b.type = 'button';
        const barra = document.createElement('input');
        barra.type = 'range';
        barra.min = '0';
        barra.step = '0.1';
        barra.setAttribute('aria-label', 'Posição do áudio');
        const rotulo = document.createElement('span');
        p.append(b, barra, rotulo);
        let arrastando = false;
        p.vlAtualizar = function () {
          const e = estadoAudio.get(id) || { t: 0, d: 0, tocando: false };
          b.textContent = e.tocando ? '❚❚' : '▶';
          b.title = e.tocando ? 'Pausar' : 'Tocar';
          b.setAttribute('aria-label', b.title);
          barra.max = String(e.d || 1);
          if (!arrastando) barra.value = String(e.t || 0);
          rotulo.textContent = tempo(e.t) + ' / ' + (e.d ? tempo(e.d) : '--:--');
        };
        p.vlAtualizar();
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          const e = estadoAudio.get(id);
          if (e && e.tocando) sala('audio:pausar', { id }).catch(function () {});
          else sala('audio:tocar', { id, volume: ctx.secao().volume / 100 }).catch(function (erro) { camada.aviso(mensagemDeErro(erro), { tipo: 'erro' }); });
        });
        barra.addEventListener('input', function () { arrastando = true; rotulo.textContent = tempo(Number(barra.value)) + ' / ' + tempo(Number(barra.max)); });
        barra.addEventListener('change', function () {
          arrastando = false;
          sala('audio:ir', { id, t: Number(barra.value), volume: ctx.secao().volume / 100 }).catch(function () {});
        });
        for (const tipo of ['mousedown', 'click', 'pointerdown']) barra.addEventListener(tipo, function (ev) { ev.stopPropagation(); });
        if (!botoesAudio.has(id)) botoesAudio.set(id, new Set());
        botoesAudio.get(id).add(p);
        return p;
      }
      function atualizarPlayers(id) {
        for (const p of botoesAudio.get(id) || []) { if (p.isConnected) p.vlAtualizar(); else botoesAudio.get(id).delete(p); }
      }

      async function ampliar(dataUrl, id, autor) {
        const r = await camada.dialogo({
          titulo: 'Mídia de ' + (autor || 'alguém'),
          conteudo: el('img', { class: 'vl-midia-grande', src: dataUrl, alt: '' }),
          largo: true,
          botoes: [{ rotulo: 'Fechar', valor: null, foco: true }, { rotulo: 'Não ver mais de ' + (autor || 'quem mandou'), valor: 'bloquear' }],
        });
        if (r === 'bloquear' && autor) {
          if (!bloqueados().includes(autor.toLowerCase())) await ctx.alterar('midia', { bloqueados: (ctx.secao().bloqueados || []).concat(autor) });
          camada.aviso('Você não vai mais ver imagens, GIFs e áudios de ' + autor + '.', { tipo: 'ok' });
        }
      }

      // ---------- voz: painel da chamada ----------
      // O fone abre o painel com quem está na chamada (sem entrar). "Entrar" liga o microfone.
      function posicionarPainel() {
        if (!painel) return;
        if (posicaoPainel && typeof posicaoPainel.x === 'number') {
          const x = Math.max(0, Math.min(window.innerWidth - 120, posicaoPainel.x));
          const y = Math.max(0, Math.min(window.innerHeight - 40, posicaoPainel.y));
          painel.style.left = x + 'px';
          painel.style.top = y + 'px';
          painel.style.bottom = 'auto';
          return;
        }
        const caixa = document.querySelector('.nitro-room-chatinput-component') || jogo.entradaChat();
        const r = caixa && caixa.getBoundingClientRect();
        if (!r || r.width < 20) return;
        painel.style.left = Math.max(8, Math.round(r.right - 270)) + 'px';
        painel.style.bottom = Math.round(window.innerHeight - r.top + 10) + 'px';
      }
      function alternarPainel() {
        if (!pronto()) return;
        if (painel) { fecharPainel(); return; }
        abrirPainel();
      }
      function abrirPainel() {
        if (painel) return;
        painel = el('div', { class: 'vl-voz' + (minimizado ? ' minimizado' : ''), role: 'region', 'aria-label': 'Chamada do quarto' });
        camada.area().appendChild(painel);
        // Arrastar pela barra do título; a posição fica guardada neste navegador.
        painel.addEventListener('pointerdown', function (ev) {
          const topo = ev.target.closest && ev.target.closest('.vl-voz-topo');
          if (!topo || (ev.target.closest && ev.target.closest('button')) || ev.button !== 0) return;
          ev.preventDefault();
          const r = painel.getBoundingClientRect();
          const dx = ev.clientX - r.left;
          const dy = ev.clientY - r.top;
          function mover(e) {
            posicaoPainel = { x: e.clientX - dx, y: e.clientY - dy };
            posicionarPainel();
          }
          function soltar() {
            window.removeEventListener('pointermove', mover, true);
            window.removeEventListener('pointerup', soltar, true);
            try { localStorage.setItem('vl.vozPosicao', JSON.stringify(posicaoPainel)); } catch (e) { /* sem armazenamento */ }
          }
          window.addEventListener('pointermove', mover, true);
          window.addEventListener('pointerup', soltar, true);
        });
        bVoz.classList.add('ativo');
        desenhar();
        posicionarPainel();
        if (!emVoz) { atualizarPresentes(); relogioPresentes = setInterval(atualizarPresentes, 3000); }
      }
      function fecharPainel() {
        clearInterval(relogioPresentes);
        relogioPresentes = null;
        if (painel) { painel.remove(); painel = null; }
        bVoz.classList.toggle('ativo', emVoz);
      }
      async function atualizarPresentes() {
        const q = quartoAtual();
        if (!q || emVoz) return;
        try { const r = await sala('voz:quem', { quarto: q }); presentes = r.pessoas || []; } catch (e) { presentes = []; }
        desenhar();
      }
      async function entrar() {
        const q = quartoAtual();
        if (!q || !meuId() || !eu()) { camada.aviso('Entre num quarto (com a Conexão do jogo ligada) para usar a chamada.', { tipo: 'erro' }); return; }
        try {
          await sala('voz:entrar', { quarto: q, id: meuId(), nome: eu(), apertarParaFalar: false });
          emVoz = true;
          privado = null;
          grupoDaVoz = null;
          quartoDaVoz = q;
          clearInterval(relogioPresentes);
          relogioPresentes = null;
          bVoz.classList.add('ativo');
          desenhar();
        } catch (e) {
          if (String(e.message) === 'microfone') pedirMicrofone(); else camada.aviso(mensagemDeErro(e), { tipo: 'erro' });
        }
      }
      function sair() {
        if (VL.telaJanela) VL.telaJanela.fecharTodas();
        compartilhando.clear();
        emVoz = false;
        estadoVoz = null;
        quartoDaVoz = null;
        privado = null;
        grupoDaVoz = null;
        sala('voz:sair').catch(function () {});
        if (painel) { atualizarPresentes(); relogioPresentes = setInterval(atualizarPresentes, 3000); }
        bVoz.classList.toggle('ativo', !!painel);
        desenhar();
      }
      function assistir(p) {
        if (!VL.telaJanela) return;
        VL.telaJanela.abrir({ modo: 'ver', de: p.id, nome: p.nome, sala });
        desenhar();
      }
      function rostoDaPessoa(p, tag) {
        const rosto = el(tag || 'span', { class: 'vl-voz-rosto' + (p.falando ? ' falando' : '') + (p.mudo ? ' mudo' : '') });
        const membro = grupoDaVoz && grupoDaVoz.membros && grupoDaVoz.membros.find((m) => String(m.id) === String(p.id));
        const url = rostoDe(p.nome, p.visual || (membro && membro.visual));
        const inicial = String(p.nome || '?').slice(0, 1).toUpperCase();
        if (url) rosto.appendChild(el('img', { src: url, alt: '', onerror() { rosto.textContent = inicial; } }));
        else rosto.textContent = inicial;
        return rosto;
      }
      function botaoTela(p) {
        if (!compartilhando.has(String(p.id))) return null;
        const vendo = VL.telaJanela && VL.telaJanela.aberta('ver', p.id);
        return el('button', { type: 'button', class: 'vl-voz-tela' + (vendo ? ' vendo' : ''), texto: vendo ? 'VENDO' : 'AO VIVO', title: (vendo ? 'Trazer a tela de ' : 'Assistir à tela de ') + p.nome, 'aria-label': (vendo ? 'Trazer a tela de ' : 'Assistir à tela de ') + p.nome, onclick() { assistir(p); } });
      }
      function linhaPessoa(p, opcoes) {
        const rosto = el('span', { class: 'vl-voz-rosto' + (p.falando ? ' falando' : '') });
        const membro = grupoDaVoz && grupoDaVoz.membros && grupoDaVoz.membros.find((m) => String(m.id) === String(p.id));
        const url = rostoDe(p.nome, p.visual || (membro && membro.visual));
        const inicial = String(p.nome || '?').slice(0, 1).toUpperCase();
        if (url) rosto.appendChild(el('img', { src: url, alt: p.nome || '', onerror() { rosto.textContent = inicial; } }));
        else rosto.textContent = inicial;
        return el('div', { class: 'vl-voz-pessoa' }, [
          rosto,
          el('span', { class: 'vl-voz-info' }, [
            el('span', { class: 'vl-voz-nomelinha' }, [el('span', { class: 'vl-voz-nome', texto: p.nome + (opcoes.eu ? ' (você)' : '') }), opcoes.controles ? botaoTela(p) : null]),
            el('span', { class: 'vl-voz-mic' + (p.mudo ? ' mudo' : ''), texto: p.mudo ? '🔇 Mutado' : (p.falando ? '🔊 Falando' : '🎙 Microfone aberto') }),
          ]),
          opcoes.controles ? el('input', { type: 'range', min: '0', max: '100', value: String(Math.round((p.volume == null ? 1 : p.volume) * 100)), title: 'Volume de ' + p.nome, 'aria-label': 'Volume de ' + p.nome, oninput(ev) { sala('voz:volume', { id: p.id, volume: Number(ev.target.value) / 100 }).catch(function () {}); } }) : null,
          opcoes.controles ? el('button', { type: 'button', title: p.calado ? 'Voltar a ouvir ' + p.nome : 'Não ouvir ' + p.nome, texto: p.calado ? '🔈' : '🔊', onclick() { sala('voz:volume', { id: p.id, calado: !p.calado }).catch(function () {}); } }) : null,
        ]);
      }
      function acao(iconeFn, rotulo, classe, fazer, titulo) {
        const b = el('button', { type: 'button', class: classe || '', title: titulo || rotulo, 'aria-label': titulo || rotulo, onclick() { fazer(); } });
        b.appendChild(iconeFn());
        b.appendChild(el('span', { texto: rotulo }));
        return b;
      }
      function desenhar() {
        if (!painel) return;
        let pessoas;
        let acoes;
        if (emVoz) {
          const e = estadoVoz || { eu: { mudo: false, falando: false }, pessoas: [] };
          pessoas = [linhaPessoa({ id: meuId(), nome: eu() || 'Você', mudo: e.eu.mudo, falando: e.eu.falando }, { eu: true })]
            .concat(e.pessoas.map((p) => linhaPessoa(p, { controles: true })));
          if (privado && !e.pessoas.length) pessoas.push(el('p', { class: 'vl-voz-vazio', texto: 'Chamando ' + privado.nome + '…' }));
          acoes = [
            acao(e.eu.mudo ? ICONES.microfoneMudo : ICONES.microfone, e.eu.mudo ? 'Desmutar' : 'Mutar', e.eu.mudo ? 'mudo' : '', function () { sala('voz:mudo', { mudo: !e.eu.mudo }).catch(function () {}); }, e.eu.mudo ? 'Ligar o microfone' : 'Desligar o microfone'),
            acao(ICONES.desligar, 'Sair', 'sair', function () { sair(); }, 'Sair da chamada'),
          ];
          // Tela compartilhada: só na chamada privada e nos grupos (src/conteudo/tela-janela.js e src/tela).
          if ((privado || grupoDaVoz) && VL.telaJanela) {
            const minha = VL.telaJanela.aberta('enviar');
            acoes.splice(1, 0, acao(ICONES.tela, minha ? 'Sua tela' : 'Tela', minha ? 'ativo' : '', function () { VL.telaJanela.abrir({ modo: 'enviar', sala }); desenhar(); }, minha ? 'Mostrar a janela da sua tela' : 'Compartilhar uma aba, uma janela ou a tela inteira com quem está nesta chamada'));
          }
        } else {
          pessoas = presentes.length ? presentes.map((p) => linhaPessoa(p, {})) : [el('p', { class: 'vl-voz-vazio', texto: 'Ninguém na chamada deste quarto ainda. Quem usa o Vagalume aqui pode entrar.' })];
          acoes = [acao(ICONES.fone, 'Entrar na chamada', 'entrar', function () { entrar(); })];
        }
        if (gruposVoz) acoes.push(acao(ICONES.grupo, 'Grupos', '', function () { gruposVoz.abrir(); }, 'Grupos de voz'));
        // Minimizado: os rostos de quem está na chamada, com o anel verde em quem fala.
        let mini = null;
        if (emVoz && minimizado) {
          const e = estadoVoz || { eu: { mudo: false, falando: false }, pessoas: [] };
          const todos = [{ id: meuId(), nome: eu() || 'Você', mudo: e.eu.mudo, falando: e.eu.falando, eu: true }].concat(e.pessoas);
          mini = el('div', { class: 'vl-voz-mini' }, todos.map(function (p) {
            const tela = !p.eu && compartilhando.has(String(p.id));
            const titulo = p.nome + (p.eu ? ' (você)' : '') + (p.mudo ? ', mutado' : p.falando ? ', falando' : '') + (tela ? '. Compartilhando a tela: clique para assistir' : '');
            if (tela) {
              const r = rostoDaPessoa(p, 'button');
              r.type = 'button';
              r.title = titulo;
              r.setAttribute('aria-label', titulo);
              r.addEventListener('click', function () { assistir(p); });
              return r;
            }
            const r = rostoDaPessoa(p);
            r.title = titulo;
            return r;
          }));
        }
        const total = emVoz ? (estadoVoz ? estadoVoz.pessoas.length : 0) + 1 : presentes.length;
        camada.trocar(painel, [
          el('div', { class: 'vl-voz-topo' }, [
            el('b', { texto: emVoz && minimizado ? ((estadoVoz && estadoVoz.eu.mudo) ? '🔇 Chamada' : '🎙 Chamada') : grupoDaVoz ? grupoDaVoz.nome : privado ? 'Chamada com ' + privado.nome : 'Chamada do quarto' }),
            el('span', { texto: total + (total === 1 ? ' pessoa' : ' pessoas') }),
            el('button', { type: 'button', title: minimizado ? 'Abrir o painel' : 'Minimizar', 'aria-label': minimizado ? 'Abrir o painel' : 'Minimizar', texto: minimizado ? '▢' : '–', onclick() {
              minimizado = !minimizado;
              try { localStorage.setItem('vl.vozMinimizado', minimizado ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
              painel.classList.toggle('minimizado', minimizado);
              desenhar();
            } }),
            el('button', { type: 'button', title: 'Fechar o painel (a chamada continua)', 'aria-label': 'Fechar', texto: '×', onclick() { fecharPainel(); } }),
          ]),
          ...(mini ? [mini] : []),
          el('div', { class: 'vl-voz-lista' }, pessoas),
          el('div', { class: 'vl-voz-acoes' }, acoes),
        ]);
      }
      // Mudou de quarto: sai da chamada.
      const relogioQuarto = setInterval(function () {
        if (!emVoz || privado || grupoDaVoz) return;
        if (quartoAtual() !== quartoDaVoz) { sair(); camada.aviso('Você saiu da chamada ao trocar de quarto.'); }
      }, 1000);
      ctx.aoParar(function () { clearInterval(relogioQuarto); if (emVoz) sair(); fecharPainel(); });

      // ---------- chamada privada (bate-papo do jogo) ----------
      // Só entre os dois e só se os dois usam o Vagalume: quem chama manda no privado um telefone com a
      // marca escondida; o Vagalume do amigo mostra "Atender". Uma chamada por vez: entrar numa sai da outra.
      const salaPrivada = (outro) => [Number(meuId()), Number(outro)].sort((a, b) => a - b).join('-');
      async function entrarPrivado(amigo, chamar) {
        if (!pronto()) return;
        if (!meuId() || !eu() || !amigo || amigo.id == null) { camada.aviso('Ligue a Conexão do jogo para fazer chamadas.', { tipo: 'erro' }); return; }
        if (String(amigo.id) === String(meuId())) return;
        try {
          await sala('voz:entrar', { quarto: salaPrivada(amigo.id), id: meuId(), nome: eu(), privado: true });
        } catch (e) {
          if (String(e.message) === 'microfone') pedirMicrofone(); else camada.aviso(mensagemDeErro(e), { tipo: 'erro' });
          return;
        }
        emVoz = true;
        privado = { id: amigo.id, nome: amigo.nome };
        grupoDaVoz = null;
        quartoDaVoz = null;
        clearInterval(relogioPresentes);
        relogioPresentes = null;
        bVoz.classList.add('ativo');
        if (chamar && VL.conexao && VL.codigos) {
          const codigo = Array.from(crypto.getRandomValues(new Uint8Array(10)), (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x & 31]).join('');
          VL.conexao.enviar(VL.codigos.SAIDA.MENSAGEM_PRIVADA, [['i', amigo.id], ['s', servidor.marcar('c', codigo)]]);
          const chamada = privado;
          setTimeout(function () {
            if (emVoz && privado === chamada && (!estadoVoz || !estadoVoz.pessoas.length)) {
              sair();
              avisarFimDaChamada(chamada, 'Não atendeu');
            }
          }, 45000);
        }
        abrirPainel();
        desenhar();
      }
      // ---------- cartão de chamada (pedido do usuário em 2026-11-16, com print de exemplo) ----------
      // No meio da tela: foto do amigo com um anel pulsando, nome, texto e botões redondos.
      let cartao = null;
      let pararToque = null;
      function fecharCartao() {
        if (pararToque) { pararToque(); pararToque = null; }
        if (cartao) { cartao.remove(); cartao = null; }
      }
      function mostrarCartao(o) {
        fecharCartao();
        const amigo = VL.amigos && VL.amigos.lista ? VL.amigos.lista().find((a) => String(a.id) === String(o.id)) : null;
        const foto = el('div', { class: 'vl-ligacao-foto' });
        if (amigo && amigo.visual) foto.appendChild(el('img', { alt: '', src: 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(amigo.visual) + '&headonly=1&direction=2&head_direction=3' }));
        else foto.textContent = String(o.nome || '?').charAt(0).toUpperCase();
        const botoes = o.botoes.map(function (b) {
          const bt = el('button', { type: 'button', class: b.classe, title: b.rotulo, 'aria-label': b.rotulo, onclick() { fecharCartao(); b.fazer(); } }, [b.icone ? b.icone() : b.rotulo]);
          return bt;
        });
        cartao = el('div', { class: 'vl-ligacao' + (o.tocando ? ' tocando' : ''), role: 'alertdialog', 'aria-label': o.texto + ': ' + o.nome }, [
          el('div', { class: 'vl-ligacao-anel' }, [foto]),
          el('b', { texto: o.nome }),
          el('span', { class: 'vl-ligacao-sub', texto: o.texto }),
          el('div', { class: 'vl-ligacao-botoes' }, botoes),
        ]);
        camada.area().appendChild(cartao);
        if (o.tocando) pararToque = tocarToque();
        if (o.duracao) { const c = cartao; setTimeout(function () { if (cartao === c) { fecharCartao(); if (o.aoAcabar) o.aoAcabar(); } }, o.duracao); }
      }
      // Toque baixinho enquanto a chamada toca (duas notas a cada 2 s).
      function tocarToque() {
        let contexto = null;
        try { contexto = new AudioContext(); } catch (e) { return function () {}; }
        const nota = function (freq, quando) {
          const o = contexto.createOscillator();
          const g = contexto.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, quando);
          g.gain.exponentialRampToValueAtTime(0.08 * (ctx.secao().volume / 100), quando + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.35);
          o.connect(g).connect(contexto.destination);
          o.start(quando);
          o.stop(quando + 0.4);
        };
        const tocar = function () { const t = contexto.currentTime; nota(784, t); nota(988, t + 0.18); };
        tocar();
        const relogio = setInterval(tocar, 2000);
        return function () { clearInterval(relogio); contexto.close().catch(function () {}); };
      }
      // Chamada recebida: o telefone com a marca chega como mensagem privada de um amigo.
      ctx.ouvir('amigos:mensagem', function (d) {
        if (gruposVoz && gruposVoz.receber(d)) return;
        const m = d && servidor.ler(d.texto);
        if (!m || m.tipo !== 'c' || d.de == null) return;
        if (emVoz && privado && String(privado.id) === String(d.de)) return;
        const nome = d.autor || 'Um amigo';
        mostrarCartao({
          id: d.de, nome, tocando: true,
          texto: emVoz ? 'Chamada recebida… (atender sai da atual)' : 'Chamada recebida…',
          duracao: 40000,
          aoAcabar() { camada.aviso('Chamada perdida de ' + nome + '.'); },
          botoes: [
            { classe: 'recusar', rotulo: 'Recusar', icone: ICONES.xis, fazer() { sala('voz:recusar', { sala: salaPrivada(d.de), id: meuId() }).catch(function () {}); } },
            { classe: 'atender', rotulo: 'Atender', icone: ICONES.telefone, fazer() { entrarPrivado({ id: d.de, nome }, false); } },
          ],
        });
      });
      // Quem ligou: recusada ou não atendida em 45 s -> aviso no meio da tela e sai da chamada.
      function avisarFimDaChamada(amigo, texto) {
        mostrarCartao({ id: amigo.id, nome: amigo.nome, texto, duracao: 5000, botoes: [{ classe: 'ok', rotulo: 'OK', fazer() {} }] });
      }
      ctx.aoParar(fecharCartao);
      // Botão de chamada no bate-papo do jogo, ao lado de seguir e perfil.
      function amigoDoBatePapo() {
        const cab = document.querySelector('.nitro-friends-messenger:not(.vl-console-grupos) .nitro-messenger-header-text');
        const texto = cab ? cab.textContent.toLowerCase() : '';
        if (!texto || !VL.amigos || !VL.amigos.lista) return null;
        let melhor = null;
        for (const a of VL.amigos.lista()) {
          const n = String(a.nome || '').toLowerCase();
          if (n && texto.includes(n) && (!melhor || n.length > String(melhor.nome).length)) melhor = a;
        }
        return melhor;
      }
      function botaoNoBatePapo() {
        if (gruposVoz) { gruposVoz.sincronizarAmigos(); gruposVoz.sincronizarAbas(); }
        const perfil = document.querySelector('.nitro-friends-messenger:not(.vl-console-grupos) button.profile');
        if (!perfil) return;
        if (gruposVoz && !perfil.parentElement.querySelector('.vl-grupos-console')) {
          const bg = document.createElement('button');
          bg.type = 'button';
          bg.className = 'messenger-button vl-msg-botao vl-grupos-console';
          bg.title = 'Conversas em grupo do Vagalume';
          bg.setAttribute('aria-label', bg.title);
          bg.appendChild(ICONES.grupo());
          bg.addEventListener('click', function (ev) { ev.stopPropagation(); gruposVoz.abrir(perfil.closest('.nitro-friends-messenger:not(.vl-console-grupos)')); });
          perfil.after(bg);
        }
        if (perfil.parentElement.querySelector('.vl-ligar')) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'messenger-button vl-msg-botao vl-ligar';
        b.title = 'Chamada de voz (só se o amigo também usa o Vagalume)';
        b.setAttribute('aria-label', 'Chamada de voz');
        b.appendChild(ICONES.fone());
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          const a = amigoDoBatePapo();
          if (!a) { camada.aviso('Não reconheci o amigo desta conversa.', { tipo: 'erro' }); return; }
          entrarPrivado({ id: a.id, nome: a.nome }, true);
        });
        perfil.after(b);
      }
      let relogioBatePapo = null;
      const observadorBatePapo = new MutationObserver(function () { if (!relogioBatePapo) relogioBatePapo = setTimeout(function () { relogioBatePapo = null; botaoNoBatePapo(); }, 200); });
      if (document.body) observadorBatePapo.observe(document.body, { childList: true, subtree: true });
      ctx.aoParar(function () { observadorBatePapo.disconnect(); clearTimeout(relogioBatePapo); document.querySelectorAll('.vl-ligar, .vl-grupos-console').forEach((n) => n.remove()); });

      if (VL.gruposVoz) gruposVoz = VL.gruposVoz.criar({
        ctx, sala, emChamada: () => emVoz, grupoAtual: () => grupoDaVoz && grupoDaVoz.grupo,
        icones: { fone: ICONES.fone, grupo: ICONES.grupo },
        botoesMidia: (enviarMarca) => botoesMidia(enviarMarca),
        mostrarChamada() { abrirPainel(); desenhar(); },
        atualizarMembros(grupo, membros) {
          if (grupoDaVoz && grupoDaVoz.grupo === grupo) grupoDaVoz.membros = membros;
        },
        async entrar(g) {
          try { await sala('voz:entrar', { quarto: g.grupo, grupo: g.grupo, id: meuId(), nome: eu(), apertarParaFalar: false }); }
          catch (e) { if (e.message === 'microfone') pedirMicrofone(); throw e; }
          emVoz = true;
          privado = null;
          grupoDaVoz = { grupo: g.grupo, nome: g.nome, membros: g.membros || [] };
          quartoDaVoz = null;
          clearInterval(relogioPresentes);
          relogioPresentes = null;
          bVoz.classList.add('ativo');
          abrirPainel();
          desenhar();
        },
      });
      botaoNoBatePapo();

      // ---------- avisos da sala ----------
      function aoAviso(m) {
        if (!m || m.de !== 'sala') return;
        if (m.tipo === 'voz:estado') {
          if (m.quarto) estadoVoz = m;
          else { emVoz = false; estadoVoz = null; privado = null; grupoDaVoz = null; bVoz.classList.toggle('ativo', !!painel); if (VL.telaJanela) VL.telaJanela.fecharTodas(); }
          desenhar();
        } else if (m.tipo === 'voz:entrou') camada.aviso(m.nome + ' entrou na chamada.', { duracaoMs: 2500 });
        else if (m.tipo === 'voz:saiu') { camada.aviso(m.nome + ' saiu da chamada.', { duracaoMs: 2500 }); if (m.id && compartilhando.delete(String(m.id))) desenhar(); }
        else if (m.tipo === 'voz:recusou') {
          if (emVoz && privado && String(m.id) === String(privado.id)) { const amigo = privado; sair(); avisarFimDaChamada(amigo, 'Recusou a chamada'); }
        }
        else if (m.tipo === 'voz:grupo-nome') { if (grupoDaVoz && grupoDaVoz.grupo === m.grupo) { grupoDaVoz.nome = m.nome; desenhar(); } }
        else if (m.tipo === 'voz:caiu') camada.aviso(m.motivo === 'substituido' ? 'Você entrou na chamada em outra aba.' : m.motivo === 'grupo-excluido' ? 'O grupo foi excluído.' : m.motivo === 'grupo-removido' ? 'Você saiu ou foi removido do grupo.' : 'A chamada caiu.', { tipo: 'erro' });
        else if (m.tipo === 'audio:progresso') { estadoAudio.set(m.id, { t: m.t, d: m.d, tocando: m.tocando }); atualizarPlayers(m.id); }
        else if (m.tipo === 'audio:fim') { const e = estadoAudio.get(m.id); estadoAudio.set(m.id, { t: 0, d: e ? e.d : 0, tocando: false }); atualizarPlayers(m.id); }
        else if (m.tipo === 'audio:limite') terminarGravacao(true);
        else if (m.tipo === 'tela:sinal' && VL.telaJanela && m.dado && m.dado.papel === 'enviar') {
          // Alguém da chamada começou ou parou de compartilhar a tela.
          const nome = m.nome || (privado && String(privado.id) === String(m.autorId) ? privado.nome : '');
          if (m.dado.t === 'inicio' && emVoz && (privado || grupoDaVoz)) {
            const nova = !compartilhando.has(String(m.autorId));
            compartilhando.set(String(m.autorId), nome);
            if (nova) VL.telaJanela.convite({ de: m.autorId, nome, sala });
            desenhar();
          } else if (m.dado.t === 'fim') { compartilhando.delete(String(m.autorId)); VL.telaJanela.tirarConvite(m.autorId); desenhar(); }
        }
      }
      chrome.runtime.onMessage.addListener(aoAviso);
      ctx.aoParar(function () { chrome.runtime.onMessage.removeListener(aoAviso); });
      if (VL.telaJanela && VL.telaJanela.aoMudar) ctx.aoParar(VL.telaJanela.aoMudar(function () { desenhar(); }));
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
