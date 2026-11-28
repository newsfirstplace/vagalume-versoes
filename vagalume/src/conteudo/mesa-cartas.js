// Vagalume — ZERA! na mesa de jogos (regras em core/cartas.js, desenhos em conteudo/cartas-arte.js).
// A tela é a visão de quem está sentado: um quarto em pixel art com a mesa de feltro, as cadeiras e os avatares
// de quem joga (do servidor de imagens do hotel, sentados e com caras de bravo, triste, feliz, surpreso, falando);
// a sua mão fica embaixo, na frente. Cada lance entra numa fila de animações: cartas voando, compras uma a uma,
// placa de "pulou", setas girando no inverter, onda da cor no coringa, balões de fala e reações.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.cartas || !VL.camada || !VL.cartasArte) return;
  const K = VL.cartas, A = VL.cartasArte, el = VL.camada.el;
  const ESC = 2, H = 220, OY = 120; // 1 pixel de arte = 2 pixels de tela
  const NOME_COR = { vermelho: 'Vermelho', amarelo: 'Amarelo', verde: 'Verde', azul: 'Azul' };
  const ORDEM_VALOR = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'pular', 'inverter', '+2', 'coringa', '+4'];
  // Lugares nos dois lados de trás da mesa (lado, x e y do ladrilho); a câmera fica na frente, onde a mesa não tem cadeira.
  const LUGAR = { L2: ['L', -1, 2], L1: ['L', -1, 1], L0: ['L', -1, 0], R0: ['R', 0, -1], R1: ['R', 1, -1], R2: ['R', 2, -1] };
  // Você fica sempre na cadeira L2 (a da esquerda mais perto); os outros sentam depois de você, no sentido do jogo.
  const MEU = 'L2';
  const POR_QTD = { 1: ['R2'], 2: ['L0', 'R1'], 3: ['L0', 'R0', 'R2'], 4: ['L1', 'L0', 'R1', 'R2'], 5: ['L1', 'L0', 'R0', 'R1', 'R2'] };
  const MONTE = [1.05, 1.95], DESCARTE = [1.95, 1.05];
  const IMAGER = 'https://imaging.habblet.city/avatarimage?figure=';
  const VISUAL_PADRAO = 'hd-180-1.ch-210-66.lg-270-82.sh-290-80.hr-100-61';
  const VISUAIS_BOT = [
    'hd-180-1.hr-828-61.ch-3030-110.lg-275-110.sh-290-62', 'hd-600-1.hr-515-33.ch-635-70.lg-716-66.sh-735-68',
    'hd-190-2.hr-115-42.ch-215-82.lg-285-82.sh-305-62', 'hd-180-7.hr-893-45.ch-3030-64.lg-275-64.sh-290-110',
    'hd-600-2.hr-890-40.ch-660-73.lg-700-62.sh-725-62', 'hd-205-1.hr-165-45.ch-210-66.lg-270-82.sh-290-80',
    'hd-600-1.hr-515-61.ch-635-82.lg-716-62.sh-735-62', VISUAL_PADRAO,
  ];
  const NOMES_BOT = ['Bot Zeca', 'Bot Lulu', 'Bot Tonho', 'Bot Mel', 'Bot Dudu', 'Bot Bia', 'Bot Caio'];
  const FONTE = "Goldfish, Volter, 'Ubuntu', system-ui, sans-serif";
  const CONTORNO = '2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000, 2px 2px #000, -2px -2px #000, 2px -2px #000, -2px 2px #000';
  const CSS = `
  .vl-zr { position: relative; display: flex; flex-direction: column; font-family: ${FONTE}; user-select: none; }
  .vl-zr-cena { position: relative; height: ${H * ESC}px; overflow: hidden; border-radius: 6px; background: #07080c; box-shadow: 0 0 0 2px #000, 0 0 0 4px #2f4356; }
  .vl-zr-cena canvas { position: absolute; left: 0; top: 0; image-rendering: pixelated; }
  .vl-zr-cena.treme { animation: vl-zr-treme .32s linear; }
  .vl-zr-sobre { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
  .vl-zr-tag { position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: 7px; padding: 2px 7px 3px; border-radius: 4px; background: rgba(0,0,0,.68);
    color: #fff; font: 18px/1 ${FONTE}; white-space: nowrap; box-shadow: 0 2px 0 rgba(0,0,0,.45); }
  .vl-zr-tag .n { display: inline-flex; align-items: center; gap: 4px; color: #ffe27a; }
  .vl-zr-tag .n::before { content: ''; width: 7px; height: 10px; background: #2e2152; box-shadow: 0 0 0 2px #121212, inset 0 3px 0 #d8342a; }
  .vl-zr-tag .um { padding: 0 4px; border-radius: 3px; background: #ffcc00; color: #2b1d00; animation: vl-zr-pisca .9s steps(2) infinite; }
  .vl-zr-tag.vez { background: #ffcc00; color: #231a00; }
  .vl-zr-tag.vez .n { color: #5a3d00; }
  .vl-zr-tag.vez::after { content: ''; position: absolute; left: 50%; top: -12px; margin-left: -6px; border: 6px solid transparent; border-top-color: #ffcc00; filter: drop-shadow(0 2px 0 #000); animation: vl-zr-seta .7s ease-in-out infinite alternate; }
  .vl-zr-tag.l, .vl-zr-balao.l { transform: translate(calc(-100% + 26px), -100%); } .vl-zr-tag.r, .vl-zr-balao.r { transform: translate(-26px, -100%); }
  .vl-zr-tag.l.vez::after, .vl-zr-balao.l::after { left: auto; right: 13px; margin-left: 0; } .vl-zr-balao.l::before { left: auto; right: 15px; margin-left: 0; }
  .vl-zr-tag.r.vez::after, .vl-zr-balao.r::after { left: 13px; margin-left: 0; } .vl-zr-balao.r::before { left: 15px; margin-left: 0; }
  .vl-zr-tempo { position: absolute; left: 6px; right: 6px; bottom: -7px; height: 4px; background: rgba(0,0,0,.6); }
  .vl-zr-tempo i { display: block; height: 100%; background: #7cfc4a; }
  .vl-zr-tempo.fim i { background: #ff4b3a; }
  .vl-zr-balao { position: absolute; transform: translate(-50%, -100%); padding: 4px 9px 5px; border-radius: 8px; background: #fff; color: #111; border: 2px solid #111; font: 700 18px/1 ${FONTE};
    white-space: nowrap; box-shadow: 0 3px 0 rgba(0,0,0,.4); animation: vl-zr-balao .22s cubic-bezier(.2,1.6,.4,1); z-index: 3; }
  .vl-zr-balao::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -6px; border: 6px solid transparent; border-top-color: #111; border-bottom: 0; }
  .vl-zr-balao::before { content: ''; position: absolute; left: 50%; bottom: -5px; margin-left: -4px; border: 4px solid transparent; border-top-color: #fff; border-bottom: 0; z-index: 1; }
  .vl-zr-balao.forte { background: #ffcc00; font-size: 22px; } .vl-zr-balao.forte::before { border-top-color: #ffcc00; }
  .vl-zr-balao.bravo { background: #ffd9d4; } .vl-zr-balao.bravo::before { border-top-color: #ffd9d4; }
  .vl-zr-balao.sai { animation: vl-zr-some .25s forwards; }
  .vl-zr-anuncio { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); z-index: 4; font: 700 54px/1 ${FONTE}; color: #fff; white-space: nowrap; text-align: center;
    text-shadow: ${CONTORNO}, 0 7px 0 rgba(0,0,0,.45); animation: vl-zr-anuncio 1.35s cubic-bezier(.2,1.4,.4,1) forwards; }
  .vl-zr-anuncio small { display: block; margin-top: 8px; font-size: 20px; }
  .vl-zr-monte { position: absolute; transform: translate(-50%, 0); font: 18px/1 ${FONTE}; color: #fff; text-shadow: ${CONTORNO}; }
  .vl-zr-acumulo { position: absolute; transform: translate(-50%, -50%); font: 700 38px/1 ${FONTE}; color: #ff4b3a; text-shadow: ${CONTORNO}, 0 5px 0 rgba(0,0,0,.4); animation: vl-zr-pulsa .6s ease-in-out infinite alternate; }
  .vl-zr-mao { position: absolute; left: 0; right: 0; bottom: -30px; height: 150px; display: flex; justify-content: center; align-items: flex-end; pointer-events: none; z-index: 3; }
  .vl-zr-c { all: unset; pointer-events: auto; position: relative; flex: none; width: 78px; height: 108px; transition: transform .14s ease-out; cursor: default; border-radius: 8px; }
  .vl-zr-c img { display: block; width: 78px; height: 108px; image-rendering: pixelated; filter: drop-shadow(0 5px 0 rgba(0,0,0,.45)); }
  .vl-zr-c.pode { cursor: pointer; transform: translateY(-16px); }
  .vl-zr-c.pode img { filter: drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 5px 0 rgba(0,0,0,.45)); }
  .vl-zr-c.pode:hover, .vl-zr-c.pode:focus-visible { transform: translateY(-36px); z-index: 60 !important; }
  .vl-zr-c.nao img { filter: brightness(.55) drop-shadow(0 5px 0 rgba(0,0,0,.45)); }
  .vl-zr-c.nova img { animation: vl-zr-nova .32s ease-out; }
  .vl-zr-c:focus-visible { outline: none; }
  .vl-zr-voo { position: absolute; left: 0; top: 0; z-index: 5; width: 78px; height: 108px; image-rendering: pixelated; pointer-events: none; transform-origin: 50% 50%; }
  .vl-zr-barra { display: flex; align-items: center; gap: 12px; padding: 12px 2px 0; min-height: 60px; }
  .vl-zr-eu { position: relative; display: flex; align-items: center; gap: 9px; min-width: 190px; }
  .vl-zr-retrato { position: relative; flex: none; width: 60px; height: 60px; border-radius: 6px; overflow: hidden; background: linear-gradient(#3c5a76, #22384d); box-shadow: 0 0 0 2px #000, inset 0 0 0 2px rgba(255,255,255,.14); }
  .vl-zr-retrato img { position: absolute; left: -15px; top: -18px; width: 90px; height: 130px; image-rendering: pixelated; }
  .vl-zr-eu.vez .vl-zr-retrato { box-shadow: 0 0 0 2px #000, 0 0 0 5px #ffcc00, 0 0 16px rgba(255,204,0,.6); }
  .vl-zr-eu b { display: block; font: 700 18px/1.1 ${FONTE}; color: #fff; }
  .vl-zr-eu small { display: block; margin-top: 3px; font: 18px/1 ${FONTE}; color: #ffe27a; }
  .vl-zr-eu .vl-zr-balao { left: 30px; top: -8px; }
  .vl-zr-status { flex: 1; min-width: 0; text-align: center; font: 18px/1.25 ${FONTE}; color: #eef3f8; }
  .vl-zr-status b { color: #ffcc00; font-weight: 700; }
  .vl-zr-status i { display: inline-block; width: 12px; height: 12px; margin: 0 6px 0 2px; vertical-align: -1px; box-shadow: 0 0 0 2px #000; }
  .vl-zr-botoes { display: flex; gap: 8px; min-width: 190px; justify-content: flex-end; }
  .vl-zr-b { font: 700 18px/1 ${FONTE}; padding: 8px 14px 9px; border: 2px solid #000; border-radius: 6px; background: linear-gradient(#ffffff, #c9cdd2); color: #111; cursor: pointer;
    box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), 0 3px 0 #000; white-space: nowrap; }
  .vl-zr-b:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .vl-zr-b:active:not(:disabled) { transform: translateY(2px); box-shadow: inset 0 -1px 0 rgba(0,0,0,.18), 0 1px 0 #000; }
  .vl-zr-b:disabled { opacity: .45; cursor: default; }
  .vl-zr-b.ultima { background: linear-gradient(#fff07a, #f5b81c); animation: vl-zr-pulsa .5s ease-in-out infinite alternate; }
  .vl-zr-b.pegar { background: linear-gradient(#ff9a86, #e1372a); color: #fff; text-shadow: 0 2px 0 #7a1009; animation: vl-zr-pulsa .4s ease-in-out infinite alternate; }
  .vl-zr-b.grande { font-size: 26px; padding: 12px 24px 13px; }
  .vl-zr-painel { position: absolute; left: 50%; top: 44%; transform: translate(-50%, -50%); z-index: 6; pointer-events: auto; min-width: 290px; background: #e9e9e1; color: #111;
    border: 2px solid #000; border-radius: 8px; box-shadow: 0 6px 0 rgba(0,0,0,.45); padding-bottom: 14px; text-align: center; font: 18px/1.2 ${FONTE}; animation: vl-zr-balao .2s ease-out; }
  .vl-zr-painel h4 { margin: 0 0 12px; padding: 7px 12px 8px; border-radius: 6px 6px 0 0; border-bottom: 2px solid #000; background: linear-gradient(#4a93c4, #2a6690); color: #fff; font: 700 18px/1 ${FONTE}; text-shadow: 0 2px 0 rgba(0,0,0,.4); }
  .vl-zr-painel p { margin: 0 14px 12px; }
  .vl-zr-cores { display: flex; gap: 10px; justify-content: center; padding: 0 14px; }
  .vl-zr-cores button { all: unset; cursor: pointer; width: 80px; height: 64px; border: 2px solid #000; border-radius: 6px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; box-sizing: border-box;
    font: 700 14px/1 ${FONTE}; color: #fff; text-shadow: ${CONTORNO}; box-shadow: inset 0 4px 0 rgba(255,255,255,.35), inset 0 -6px 0 rgba(0,0,0,.25), 0 3px 0 #000; transition: transform .1s; }
  .vl-zr-cores button:hover, .vl-zr-cores button:focus-visible { transform: translateY(-4px); outline: none; }
  .vl-zr-painel .cancelar { margin-top: 12px; }
  .vl-zr-contagem { height: 8px; margin: 12px 18px 0; background: #b7b7ad; border: 2px solid #000; }
  .vl-zr-contagem i { display: block; height: 100%; background: #e1372a; }
  .vl-zr-fim { position: absolute; inset: 0; z-index: 30; display: grid; place-items: center; overflow: auto; background: rgba(6,10,18,.5); animation: vl-zr-surge .35s ease-out; }
  .vl-zr-fim-caixa { position: relative; width: min(680px, calc(100% - 28px)); background: #e9e9e1; color: #111; border: 2px solid #000; border-radius: 8px; box-shadow: 0 8px 0 rgba(0,0,0,.45);
    text-align: center; font: 18px/1.2 ${FONTE}; animation: vl-zr-balao .35s cubic-bezier(.2,1.4,.4,1); }
  .vl-zr-fim-caixa > h4 { display: flex; align-items: center; gap: 8px; margin: 0; padding: 6px 12px 7px; border-radius: 6px 6px 0 0; border-bottom: 2px solid #000; background: linear-gradient(#4a93c4, #2a6690);
    color: #fff; font: 700 18px/1 ${FONTE}; text-shadow: 0 2px 0 rgba(0,0,0,.4); text-align: left; }
  .vl-zr-fim-caixa > h4 img { width: 32px; height: 24px; object-fit: contain; image-rendering: pixelated; }
  .vl-zr-fim h2 { margin: 10px 14px 0; font: 700 32px/1.05 ${FONTE}; color: #ffcc00; text-shadow: ${CONTORNO}, 0 5px 0 rgba(0,0,0,.35); }
  .vl-zr-fim .sub { margin: 4px 16px 6px; color: #4a5563; font-size: 15px; }
  .vl-zr-podio { display: flex; align-items: flex-end; justify-content: center; gap: 8px; padding: 0 12px; }
  .vl-zr-degrau { position: relative; width: 150px; display: flex; flex-direction: column; align-items: center; }
  .vl-zr-degrau .av { position: relative; width: 96px; height: 162px; overflow: hidden; }
  .vl-zr-degrau .av img { position: absolute; left: -46px; top: -66px; width: 180px; height: 260px; image-rendering: pixelated; }
  .vl-zr-degrau .coroa { position: absolute; top: -4px; left: 50%; width: 34px; height: 20px; margin-left: -19px; image-rendering: pixelated; z-index: 1; animation: vl-zr-seta .8s ease-in-out infinite alternate; }
  .vl-zr-degrau b { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 17px/1.1 ${FONTE}; margin-top: 2px; }
  .vl-zr-degrau small { display: block; max-width: 100%; white-space: nowrap; font: 14px/1.2 ${FONTE}; color: #4a5563; margin: 1px 0 5px; }
  .vl-zr-degrau.p1 small { color: #8a5d00; font-weight: 700; }
  .vl-zr-degrau .bloco { width: 100%; display: grid; place-items: center; border: 2px solid #000; border-bottom: 0; border-radius: 5px 5px 0 0; font: 700 26px/1 ${FONTE}; color: #fff; text-shadow: ${CONTORNO};
    box-shadow: inset 0 4px 0 rgba(255,255,255,.45), inset 0 -8px 0 rgba(0,0,0,.18); }
  .vl-zr-degrau.p1 .bloco { height: 56px; background: #f2c12e; } .vl-zr-degrau.p2 .bloco { height: 40px; background: #c3ccd8; } .vl-zr-degrau.p3 .bloco { height: 28px; background: #cf8a4f; }
  .vl-zr-chao { height: 8px; margin: 0 12px; background: #8c5a30; border: 2px solid #000; border-radius: 0 0 4px 4px; box-shadow: inset 0 2px 0 #b4773f; }
  .vl-zr-resto { display: flex; flex-wrap: nowrap; justify-content: center; gap: 6px; margin: 10px 12px 0; }
  .vl-zr-resto > span { display: flex; align-items: center; gap: 5px; min-width: 0; padding: 2px 8px 2px 2px; border: 2px solid #000; border-radius: 6px; background: #fff; font: 14px/1 ${FONTE}; white-space: nowrap; }
  .vl-zr-resto em { font-style: normal; max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
  .vl-zr-resto i { position: relative; flex: none; width: 26px; height: 26px; overflow: hidden; border-radius: 4px; background: #c9d6e2; }
  .vl-zr-resto i img { position: absolute; left: -32px; top: -38px; width: 90px; height: 130px; image-rendering: pixelated; }
  .vl-zr-fim-botoes { display: flex; gap: 10px; justify-content: center; align-items: center; margin: 12px 0; }
  .vl-zr-ord { font-family: system-ui, 'Segoe UI', sans-serif; font-weight: 800; }
  .vl-zr-b.ouro { background: linear-gradient(#fff07a, #f5b81c); }
  @keyframes vl-zr-surge { from { opacity: 0; } }
  @keyframes vl-zr-pisca { 50% { opacity: .35; } }
  @keyframes vl-zr-seta { to { transform: translateY(4px); } }
  @keyframes vl-zr-balao { from { opacity: 0; scale: .4; } }
  @keyframes vl-zr-some { to { opacity: 0; translate: 0 -14px; } }
  @keyframes vl-zr-anuncio { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 18% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); } 30% { transform: translate(-50%, -50%) scale(1); } 78% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -75%); } }
  @keyframes vl-zr-pulsa { to { transform: scale(1.07); } }
  @keyframes vl-zr-nova { 0% { transform: translateY(-30px) scaleX(0); } 55% { transform: translateY(-14px) scaleX(1.05); } 100% { transform: none; } }
  @keyframes vl-zr-treme { 25% { transform: translate(3px, -2px); } 50% { transform: translate(-3px, 2px); } 75% { transform: translate(2px, 1px); } }
  @media (prefers-reduced-motion: reduce) { .vl-zr-b.ultima, .vl-zr-b.pegar, .vl-zr-acumulo, .vl-zr-tag .um, .vl-zr-tag.vez::after { animation: none; } }
  `;
  const rotulo = (c) => (c.cor ? NOME_COR[c.cor] + ' ' : '') + ({ pular: 'Pular', inverter: 'Inverter', '+2': 'Mais dois', coringa: 'Coringa', '+4': 'Coringa mais quatro' }[c.valor] || c.valor);
  const ordenar = (mao) => mao.slice().sort((a, b) => (a.cor ? A.ORDEM_CORES.indexOf(a.cor) : 9) - (b.cor ? A.ORDEM_CORES.indexOf(b.cor) : 9) || ORDEM_VALOR.indexOf(a.valor) - ORDEM_VALOR.indexOf(b.valor));
  const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];
  const hashNome = (s) => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const urlAvatar = (fig, dir, cab, gesto, acao) => IMAGER + encodeURIComponent(fig) + '&direction=' + dir + '&head_direction=' + cab + '&action=' + (acao || 'sit') + '&gesture=' + (gesto || 'std') + '&size=m';
  const textoVisual = (x) => (typeof x === 'string' ? x : x && typeof x.visual === 'string' ? x.visual : '') || null;
  const visualLocal = (nome) => textoVisual(VL.pessoas && VL.pessoas.visualDe ? VL.pessoas.visualDe(nome) : null);
  const urlCabeca = (fig, gesto) => IMAGER + encodeURIComponent(fig) + '&headonly=1&direction=3&head_direction=3&gesture=' + (gesto || 'std') + '&size=m';

  // Imagens do servidor de imagens do hotel: poucas de cada vez (ele recusa muitas juntas) e uma nova tentativa.
  const imagens = new Map(), fila = [];
  let baixando = 0;
  function imagem(url) {
    let r = imagens.get(url);
    if (r) return r;
    r = { url, img: new Image(), ok: false };
    imagens.set(url, r);
    fila.push(r);
    andarFila();
    return r;
  }
  function andarFila() {
    while (baixando < 4 && fila.length) {
      const r = fila.shift();
      baixando++;
      r.img.onload = () => { r.ok = true; baixando--; andarFila(); };
      r.img.onerror = () => { baixando--; if (!r.tentou) { r.tentou = true; setTimeout(() => { fila.push(r); andarFila(); }, 900); } andarFila(); };
      r.img.src = r.url;
    }
  }

  function montar(api) {
    const eu = api.eu;
    const canvas = el('canvas', { width: '440', height: String(H), 'aria-hidden': 'true' });
    const ctx = canvas.getContext('2d');
    const sobre = el('div', { class: 'vl-zr-sobre' });
    const mao = el('div', { class: 'vl-zr-mao', role: 'group', 'aria-label': 'Suas cartas' });
    const cena = el('div', { class: 'vl-zr-cena', role: 'img', 'aria-label': 'Mesa de ZERA!' }, [canvas, sobre, mao]);
    const retratoImg = el('img', { alt: '', draggable: 'false' });
    const euNome = el('b', { texto: 'Você' }), euQtd = el('small');
    const euBox = el('div', { class: 'vl-zr-eu' }, [el('div', { class: 'vl-zr-retrato' }, [retratoImg]), el('div', null, [euNome, euQtd])]);
    const status = el('div', { class: 'vl-zr-status', role: 'status', 'aria-live': 'polite' });
    const botoes = el('div', { class: 'vl-zr-botoes' });
    const raizEl = el('div', { class: 'vl-zr' }, [el('style', { texto: CSS }), cena, el('div', { class: 'vl-zr-barra' }, [euBox, status, botoes])]);

    // ---------- tamanho da cena ----------
    let W = 0, OX = 0, I = null, fundo = null, tampo = null;
    const cadeiras = { L: A.cadeira('L'), R: A.cadeira('R') };
    function medir() {
      const largura = Math.max(560, Math.min(1000, cena.clientWidth || 880));
      const w = Math.floor(largura / ESC);
      if (w === W) return;
      W = w; OX = Math.round(W / 2); I = A.isoDe(OX, OY);
      canvas.width = W; canvas.height = H;
      canvas.style.width = W * ESC + 'px'; canvas.style.height = H * ESC + 'px';
      fundo = A.sala(W, H, OX, OY); tampo = A.mesa(W, H, OX, OY);
      desenharSobre();
    }

    // ---------- quem senta onde ----------
    let v = null, D = null;
    let lugares = new Map(); // nome -> { id, lado, sx, sy, dir }
    function sentar() {
      lugares = new Map();
      const nomes = v.jogadores.map((p) => p.nome);
      const i = Math.max(0, nomes.indexOf(eu));
      const ids = POR_QTD[nomes.length - 1] || [];
      for (let k = 1; k < nomes.length; k++) {
        const id = ids[k - 1];
        if (!id) continue;
        const [lado, sx, sy] = LUGAR[id];
        lugares.set(nomes[(i + k) % nomes.length], { id, lado, sx, sy, dir: lado === 'L' ? 2 : 4 });
      }
      if (nomes.includes(eu)) { const [lado, sx, sy] = LUGAR[MEU]; lugares.set(eu, { id: MEU, lado, sx, sy, dir: 2 }); }
    }
    const figura = (nome) => textoVisual(v && v.visuais && v.visuais[nome]) || visualLocal(nome) || VISUAL_PADRAO;
    // Pede as imagens de cada avatar (a de sempre primeiro, depois as caras); o visual pode chegar só depois.
    const preparados = new Set();
    let retratoDe = '';
    function preparar() {
      const pendentes = [...lugares].filter(([n, l]) => !preparados.has(figura(n) + '|' + l.dir));
      for (const [n, l] of pendentes) imagem(urlAvatar(figura(n), l.dir, l.dir, 'std'));
      for (const [n, l] of pendentes) {
        const f = figura(n);
        preparados.add(f + '|' + l.dir);
        [3, l.lado === 'L' ? 1 : 5].forEach((cab) => imagem(urlAvatar(f, l.dir, cab, 'std')));
        ['eyb', 'agr', 'sad', 'sml', 'srp', 'spk'].forEach((g) => imagem(urlAvatar(f, l.dir, l.dir, g)));
        imagem(urlAvatar(f, l.dir, l.dir, 'sml', 'sit,wav'));
      }
      const meu = figura(eu);
      if (meu !== retratoDe) {
        retratoDe = meu;
        ['std', 'agr', 'sad', 'sml', 'srp', 'spk', 'eyb'].forEach((g) => imagem(urlCabeca(meu, g)));
        retratoImg.src = urlCabeca(meu, 'std');
      }
    }
    // Pontos da cena (pixels de arte).
    function pontos(l) {
      const [ax, ay] = I(l.sx + 0.5, l.sy + 0.5, 17);
      const [fx, fy] = I(l.sx + 0.5 + (l.lado === 'L' ? 0.42 : 0), l.sy + 0.5 + (l.lado === 'R' ? 0.42 : 0), 42);
      return { ax, ay, fx, fy };
    }
    const alturaMonte = () => Math.max(1, Math.min(10, Math.ceil((D ? D.pilha : 60) / 9)));
    const ptMonte = () => I(MONTE[0], MONTE[1], A.ALTURA_MESA + alturaMonte() + 2);
    const ptDescarte = () => { const [x, y] = I(DESCARTE[0], DESCARTE[1], A.ALTURA_MESA); return [x, y - 6 - A.CH / 2]; };
    const ptMao = () => [W / 2, H - 22];
    const ptDe = (nome) => { if (nome === eu) return ptMao(); const l = lugares.get(nome); if (!l) return ptMonte(); const p = pontos(l); return [p.fx, p.fy]; };

    // ---------- estado mostrado (anda junto com as animações) ----------
    function sincronizar() {
      if (!v) return;
      D = {
        topo: v.topo, cor: v.cor, descarte: v.descarte.slice(), pilha: v.pilha, sentido: v.sentido, acumulado: v.acumulado,
        qtd: Object.fromEntries(v.jogadores.map((p) => [p.nome, p.cartas])), ultima: Object.fromEntries(v.jogadores.map((p) => [p.nome, p.ultima])), mao: v.mao.slice(),
      };
    }
    const servir = (c) => !!v && K.pode({ acumulado: v.acumulado, ultimoMais: v.ultimoMais, cor: v.cor, descarte: [v.topo] }, c) && (v.comprada == null || c.id === v.comprada);
    let fila2 = [], visto = null, animando = false, esperando = 0, escolhendo = null, eraMinha = false, giroAte = 0;
    const ocupado = () => animando || fila2.length > 0;
    const minhaVez = () => !!v && !v.fim && !v.esquecido && v.vez === eu;
    const podeAgir = () => minhaVez() && !ocupado() && performance.now() > esperando;

    function atualizar(nova) {
      if (!nova) return;
      const antes = v;
      const novaGente = !antes || antes.jogadores.map((p) => p.nome).join('|') !== nova.jogadores.map((p) => p.nome).join('|');
      v = Object.assign({}, nova, { recebido: performance.now() });
      if (antes && nova.n !== antes.n) esperando = 0;
      if (!I) medir();
      if (novaGente) sentar();
      preparar();
      const evs = (v.eventos || []).filter((e) => visto == null || e.n > visto);
      if (visto == null) {
        visto = v.n;
        const i = evs.findIndex((e) => e.t === 'inicio');
        sincronizar();
        if (i >= 0 && v.livreEm > 300) { // a partida acabou de começar: anima a distribuição
          D.qtd = Object.fromEntries(v.jogadores.map((p) => [p.nome, 0])); D.mao = []; D.topo = null; D.descarte = []; D.pilha = 108;
          fila2.push(...evs.slice(i));
        }
      } else {
        const faltou = evs.length && evs[0].n > visto + 1;
        visto = Math.max(visto, v.n);
        if (faltou || document.hidden) { fila2 = []; if (!animando) sincronizar(); } else fila2.push(...evs);
      }
      if (fila2.length > 10) { fila2 = []; if (!animando) sincronizar(); } // muito atrasado: pula para o agora
      if (!minhaVez()) escolhendo = null;
      if (!animando) rodar();
      desenharDom();
    }
    function rodar() {
      if (animando) return;
      const ev = fila2.shift();
      if (!ev) { sincronizar(); desenharDom(); avisarVez(); return; }
      animando = true;
      let ms = 0;
      try { ms = document.hidden || !cena.isConnected ? 0 : animar(ev); } catch (erro) { console.error('[Vagalume] ZERA!:', erro); ms = 0; }
      desenharDom();
      setTimeout(() => { animando = false; rodar(); }, ms);
    }
    function avisarVez() {
      const minha = minhaVez();
      if (minha && !eraMinha) { api.som('vez'); anunciar('SUA VEZ!', '#ffcc00'); }
      eraMinha = minha;
    }

    // ---------- efeitos ----------
    const voos = [], particulas = [], ondas = [], placas = [], reacoes = {}, pisca = {};
    // Carta (ou verso) voando no canvas de um ponto a outro, com arco, escala e virada no meio.
    function voar(img, de, para, ms, op) {
      voos.push({ img, de, para, ms, t0: performance.now() + (op.atraso || 0), arco: op.arco == null ? 22 : op.arco, s0: op.s0 == null ? 0.6 : op.s0, s1: op.s1 == null ? 1 : op.s1, verso: op.verso, fim: op.fim });
    }
    // Carta da minha mão voando por cima de tudo (DOM), da mão até o descarte.
    function voarDaMao(c, cor, de, ms, fim) {
      const para = ptDescarte();
      const img = el('img', { class: 'vl-zr-voo', alt: '', src: A.url(c, cor) });
      cena.appendChild(img);
      const x0 = de ? de.x : ptMao()[0] * ESC - 39, y0 = de ? de.y : ptMao()[1] * ESC - 54;
      const x1 = para[0] * ESC - 39, y1 = para[1] * ESC - 54, s1 = (A.CW * ESC) / 78;
      const giro = ((c.id * 37) % 21) - 10;
      const terminar = () => { if (img.isConnected) { img.remove(); fim(); } };
      if (img.animate) {
        img.animate([
          { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1) rotate(0deg)' },
          { transform: 'translate(' + (x0 + x1) / 2 + 'px,' + (Math.min(y0, y1) - 40) + 'px) scale(' + (1 + s1) / 2 * 1.1 + ') rotate(' + giro + 'deg)', offset: 0.55 },
          { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(' + s1 + ') rotate(0deg)' },
        ], { duration: ms, easing: 'cubic-bezier(.3,.7,.35,1)', fill: 'both' }).onfinish = terminar;
      }
      setTimeout(terminar, ms + 300);
    }
    // Carta comprada voando do monte até a minha mão (vira no caminho).
    function voarParaMao(c, atraso, fim) {
      setTimeout(() => {
        const de = ptMonte();
        const img = el('img', { class: 'vl-zr-voo', alt: '', src: A.url(null) });
        cena.appendChild(img);
        const x0 = de[0] * ESC - 39, y0 = de[1] * ESC - 54, x1 = (W / 2) * ESC - 39 + (Math.random() * 120 - 60), y1 = H * ESC - 110;
        const terminar = () => { if (img.isConnected) { img.remove(); fim(); } };
        setTimeout(() => { if (img.isConnected && c) img.src = A.url(c); }, 170);
        if (img.animate) {
          img.animate([
            { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(.66, .66)' },
            { transform: 'translate(' + (x0 + x1) / 2 + 'px,' + (y0 - 30) + 'px) scale(0, .9)', offset: 0.5 },
            { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(1, 1)' },
          ], { duration: 340, easing: 'cubic-bezier(.3,.7,.35,1)', fill: 'both' }).onfinish = terminar;
        }
        setTimeout(terminar, 640);
      }, atraso);
    }
    function reagir(nome, gesto, ms, acao) {
      if (!nome) return;
      reacoes[nome] = { gesto, acao, ate: performance.now() + ms };
      if (nome === eu) {
        retratoImg.src = urlCabeca(figura(eu), gesto);
        clearTimeout(reagir.volta);
        reagir.volta = setTimeout(() => { retratoImg.src = urlCabeca(figura(eu), 'std'); }, ms);
      }
    }
    const baloes = {};
    function falar(nome, texto, tipo) {
      if (!nome) return;
      const velho = baloes[nome];
      if (velho) velho.remove();
      const lado = lugares.get(nome) ? (lugares.get(nome).lado === 'L' ? ' l' : ' r') : '';
      const b = el('div', { class: 'vl-zr-balao' + lado + (tipo ? ' ' + tipo : ''), texto });
      if (nome === eu && !lugares.has(eu)) euBox.appendChild(b);
      else {
        const l = lugares.get(nome);
        if (!l || !I) return;
        const p = pontos(l);
        b.style.left = p.ax * ESC + 'px'; b.style.top = (p.ay - 72) * ESC - 30 + 'px';
        sobre.appendChild(b);
      }
      baloes[nome] = b;
      setTimeout(() => { b.classList.add('sai'); setTimeout(() => { b.remove(); if (baloes[nome] === b) delete baloes[nome]; }, 260); }, 1900);
    }
    function anunciar(texto, cor, sub) {
      const velho = sobre.querySelector('.vl-zr-anuncio');
      if (velho) velho.remove();
      const a = el('div', { class: 'vl-zr-anuncio', style: 'color:' + (cor || '#fff') }, [texto, sub ? el('small', { texto: sub }) : null]);
      sobre.appendChild(a);
      setTimeout(() => a.remove(), 1400);
    }
    function tremer() { cena.classList.remove('treme'); void cena.offsetWidth; cena.classList.add('treme'); }
    function faiscas(x, y, cor, n) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 70;
        particulas.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, g: 160, vida: 0.4 + Math.random() * 0.4, t: 0, cor: cor || '#fff', tam: Math.random() < 0.3 ? 2 : 1 });
      }
    }
    function confete() {
      const cores = [A.COR.vermelho.base, A.COR.amarelo.base, A.COR.verde.base, A.COR.azul.base, '#ffffff'];
      for (let k = 0; k < 140; k++) particulas.push({ x: Math.random() * W, y: -10 - Math.random() * 120, vx: Math.random() * 30 - 15, vy: 30 + Math.random() * 40, g: 25, vida: 4 + Math.random() * 2, t: 0, cor: cores[k % 5], tam: 2, gira: true });
    }

    // ---------- cada lance ----------
    function animar(ev) {
      const agora = performance.now();
      switch (ev.t) {
        case 'inicio': {
          const nomes = v.jogadores.map((p) => p.nome), inicial = v.mao.slice(0, 7);
          let k = 0;
          for (let r = 0; r < 7; r++) {
            for (const n of nomes) {
              const atraso = k++ * 55;
              if (n === eu) voarParaMao(inicial[r], atraso, () => { D.pilha--; if (inicial[r]) D.mao.push(inicial[r]); desenharMao(inicial[r] && inicial[r].id); });
              else voar(A.carta(null), ptMonte(), ptDe(n), 300, { atraso, s0: 0.7, s1: 0.45, arco: 14, fim() { D.pilha--; D.qtd[n] = (D.qtd[n] || 0) + 1; desenharSobre(); } });
              if (k % 3 === 0) setTimeout(() => api.som('compra'), atraso);
            }
          }
          const total = k * 55 + 340;
          setTimeout(() => voar(A.carta(ev.topo), ptMonte(), ptDescarte(), 420, { s0: 0.7, s1: 1, arco: 30, verso: A.carta(null), fim() { D.topo = ev.topo; D.cor = ev.topo.cor; D.descarte = [ev.topo]; api.som('carta'); const p = ptDescarte(); faiscas(p[0], p[1] + 16, '#fff', 10); } }), total);
          return total + 520;
        }
        case 'jogou': {
          const c = ev.carta, cor = ev.cor;
          const pousar = () => {
            D.topo = c; D.cor = cor; D.descarte = D.descarte.concat([c]).slice(-6);
            api.som('carta');
            const p = ptDescarte();
            faiscas(p[0], p[1] + 16, A.COR[cor] ? A.COR[cor].claro : '#fff', 8);
          };
          if (ev.quem === eu) {
            const botao = mao.querySelector('[data-id="' + c.id + '"]');
            const r = botao ? botao.getBoundingClientRect() : null, base = cena.getBoundingClientRect();
            const de = r ? { x: r.left - base.left, y: r.top - base.top } : null;
            D.mao = D.mao.filter((x) => x.id !== c.id);
            desenharMao();
            voarDaMao(c, cor, de, 430, pousar);
          } else {
            D.qtd[ev.quem] = Math.max(0, (D.qtd[ev.quem] || 1) - 1);
            desenharSobre();
            voar(A.carta(c, cor), ptDe(ev.quem), ptDescarte(), 460, { s0: 0.45, s1: 1, arco: 28, verso: A.carta(null), fim: pousar });
          }
          let ms = 540;
          if (!c.cor) {
            setTimeout(() => { ondas.push({ t0: performance.now(), cor: A.COR[cor].base }); falar(ev.quem, NOME_COR[cor] + '!', 'forte'); reagir(ev.quem, 'sml', 1300); api.som('coringa'); }, 470);
            ms += 520;
          } else if (c.valor === '+2' || c.valor === 'pular') reagir(ev.quem, 'sml', 1300);
          return ms;
        }
        case 'acumulou': {
          D.acumulado = ev.total;
          anunciar('+' + ev.total, ev.total >= 8 ? '#ff4b3a' : '#ffcc00', ev.alvo === eu ? 'Vem pra você!' : 'Vem pra ' + ev.alvo + '!');
          reagir(ev.alvo, 'srp', 1000);
          api.som('acumulo');
          tremer();
          return 400;
        }
        case 'pulou': {
          placas.push({ nome: ev.quem, t0: agora });
          reagir(ev.quem, 'agr', 1900);
          falar(ev.quem, sorteia(['Ei!!', 'Sério?!', 'Me pulou!', 'Aff!', 'Pô!']), 'bravo');
          if (ev.quem === eu) anunciar('PULOU VOCÊ!', '#ff6a55');
          api.som('pular');
          return 780;
        }
        case 'inverteu': {
          D.sentido = ev.sentido;
          giroAte = agora + 900;
          anunciar('INVERTEU!', '#8fd0ff', ev.sentido > 0 ? '↻' : '↺');
          for (const n of lugares.keys()) if (n !== ev.quem) reagir(n, 'srp', 900);
          api.som('inverter');
          return 840;
        }
        case 'comprou': {
          const q = ev.qtd || 0;
          const novas = ev.quem === eu ? v.mao.filter((c) => !D.mao.some((m) => m.id === c.id)).slice(0, q) : [];
          for (let k = 0; k < q; k++) {
            const atraso = k * 150;
            if (ev.quem === eu) voarParaMao(novas[k], atraso, () => { D.pilha = Math.max(0, D.pilha - 1); if (novas[k] && !D.mao.some((m) => m.id === novas[k].id)) D.mao.push(novas[k]); desenharMao(novas[k] && novas[k].id); });
            else voar(A.carta(null), ptMonte(), ptDe(ev.quem), 300, { atraso, s0: 0.7, s1: 0.45, arco: 16, fim() { D.pilha = Math.max(0, D.pilha - 1); D.qtd[ev.quem] = (D.qtd[ev.quem] || 0) + 1; desenharSobre(); } });
            setTimeout(() => api.som('compra'), atraso);
          }
          if (ev.acumulo) {
            D.acumulado = 0;
            reagir(ev.quem, ev.acumulo >= 6 ? 'agr' : 'sad', 1900);
            falar(ev.quem, ev.acumulo >= 6 ? '+' + ev.acumulo + '?!' : 'Aff... +' + ev.acumulo, 'bravo');
          } else if (ev.castigo) reagir(ev.quem, 'sad', 1600);
          return 280 + q * 150;
        }
        case 'passou': falar(ev.quem, 'Passo.'); return 320;
        case 'ultima': case 'salvou': {
          D.ultima[ev.quem] = true;
          falar(ev.quem, 'ÚLTIMA!', 'forte');
          reagir(ev.quem, 'spk', 1100);
          for (const n of lugares.keys()) if (n !== ev.quem) reagir(n, 'srp', 800);
          api.som('ultima');
          return ev.t === 'ultima' ? 620 : 460;
        }
        case 'esqueceu': return 0;
        case 'pego': {
          falar(ev.por, 'PEGUEI!', 'forte'); reagir(ev.por, 'sml', 1500);
          setTimeout(() => { falar(ev.quem, 'Ops...', 'bravo'); reagir(ev.quem, 'sad', 1800); }, 250);
          api.som('pegou');
          return 460;
        }
        case 'escapou': reagir(ev.quem, 'sml', 1000); return 0;
        case 'tempo': falar(ev.quem, 'zZz...'); reagir(ev.quem, 'eyb', 1600); return 320;
        case 'embaralhou': {
          const [dx, dy] = ptDescarte();
          for (let k = 0; k < 6; k++) voar(A.carta(null), [dx, dy + 10], ptMonte(), 280, { atraso: k * 70, s0: 0.8, s1: 0.6, arco: 18 });
          D.descarte = D.topo ? [D.topo] : []; D.pilha = ev.qtd;
          anunciar('EMBARALHANDO', '#d7b8ff');
          api.som('embaralhar');
          return 820;
        }
        case 'venceu': {
          reagir(ev.quem, 'sml', 7000, 'sit,wav');
          for (const n of lugares.keys()) if (n !== ev.quem) reagir(n, 'sad', 3500);
          if (ev.quem !== eu) reagir(eu, 'sad', 3500);
          confete();
          anunciar('ZEROU!', '#ffcc00', ev.quem === eu ? 'Você venceu!' : ev.quem + ' venceu!');
          fimLiberado = performance.now() + 1800;
          setTimeout(mostrarFim, 1850);
          return 0;
        }
        default: return 0;
      }
    }

    // ---------- desenho da cena (a cada quadro) ----------
    let ultimoT = performance.now(), fase = 0, conectou = false;
    const leques = new Map();
    const leque = (n) => { if (!leques.has(n)) leques.set(n, A.leque(n)); return leques.get(n); };
    const placaImg = A.iconePular();
    function imagemDoAvatar(nome, l, t) {
      const f = figura(nome), r = reacoes[nome];
      let gesto = 'std', acao = 'sit', cab = l.dir;
      if (r && r.ate > t) { gesto = r.gesto || 'std'; acao = r.acao || 'sit'; }
      else {
        cab = olhar(nome, l);
        const p = pisca[nome] || (pisca[nome] = t + 1500 + Math.random() * 4000);
        if (t > p) { if (t < p + 150) gesto = 'eyb'; else pisca[nome] = t + 2500 + Math.random() * 4500; }
      }
      const a = imagens.get(urlAvatar(f, l.dir, gesto === 'std' ? cab : l.dir, gesto, acao));
      if (a && a.ok) return a.img;
      if (gesto === 'std' && cab !== l.dir) imagem(urlAvatar(f, l.dir, cab, 'std'));
      const b = imagem(urlAvatar(f, l.dir, l.dir, 'std'));
      return b.ok ? b.img : null;
    }
    // Para onde cada um olha: para quem está jogando (para você, na sua vez).
    function olhar(nome, l) {
      if (!v || v.fim) return l.dir;
      const alvo = v.esquecido ? v.esquecido.nome : v.vez;
      if (alvo === nome) return l.dir;
      const o = lugares.get(alvo);
      return o && o.lado !== l.lado ? (l.lado === 'L' ? 1 : 5) : l.dir;
    }
    function quadro(t) {
      if (raizEl.isConnected) conectou = true;
      else if (conectou) return; // a tela saiu: para de desenhar
      raiz.requestAnimationFrame(quadro);
      if (!conectou || !cena.offsetParent) { ultimoT = t; return; }
      medir();
      const dt = Math.min(0.1, (t - ultimoT) / 1000);
      ultimoT = t;
      fase += dt * (giroAte > t ? 7 : 0.8) * (D && D.sentido < 0 ? -1 : 1);
      try { desenharCena(t, dt); } catch (erro) { console.error('[Vagalume] ZERA!:', erro); }
      atualizarRelogios(t);
    }
    raiz.requestAnimationFrame(quadro);
    function destaque(l, t) {
      const a = 0.5 + 0.5 * Math.sin(t / 180);
      ctx.globalAlpha = 0.55 + 0.45 * a;
      const c = '#ffd23a', m = 0.04;
      A.linha(ctx, I(l.sx + m, l.sy + m, 0), I(l.sx + 1 - m, l.sy + m, 0), c); A.linha(ctx, I(l.sx + 1 - m, l.sy + m, 0), I(l.sx + 1 - m, l.sy + 1 - m, 0), c);
      A.linha(ctx, I(l.sx + 1 - m, l.sy + 1 - m, 0), I(l.sx + m, l.sy + 1 - m, 0), c); A.linha(ctx, I(l.sx + m, l.sy + 1 - m, 0), I(l.sx + m, l.sy + m, 0), c);
      ctx.globalAlpha = 1;
    }
    function desenharCena(t, dt) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fundo, 0, 0);
      const ocupante = new Map([...lugares].map(([n, l]) => [l.id, n]));
      if (v && !v.fim) { const l = lugares.get(v.esquecido ? v.esquecido.nome : v.vez); if (l) destaque(l, t); }
      // Cadeiras e avatares, de trás para a frente.
      const ordem = Object.keys(LUGAR).sort((a, b) => (LUGAR[a][1] + LUGAR[a][2]) - (LUGAR[b][1] + LUGAR[b][2]));
      for (const id of ordem) {
        const [lado, sx, sy] = LUGAR[id];
        const ch = cadeiras[lado], [cx, cy] = I(sx + 0.5, sy + 0.5, 0);
        ctx.drawImage(ch.canvas, Math.round(cx - ch.ox), Math.round(cy - ch.oy));
        const nome = ocupante.get(id);
        if (!nome) continue;
        const l = lugares.get(nome), img = imagemDoAvatar(nome, l, t), p = pontos(l);
        if (img) ctx.drawImage(img, Math.round(p.ax - 45), Math.round(p.ay - 104));
      }
      ctx.drawImage(tampo, 0, 0);
      if (!D) return;
      const z = A.ALTURA_MESA;
      // Anel na cor da vez, com as setas do sentido do jogo correndo em volta.
      const cor = A.COR[D.cor] || A.COR.coringa;
      for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2, [px, py] = I(1.5 + Math.cos(a) * 1.08, 1.5 + Math.sin(a) * 1.08, z); ctx.fillStyle = k % 2 ? cor.escuro : cor.base; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); }
      for (let k = 0; k < 4; k++) {
        for (let j = 5; j >= 0; j--) {
          const a = fase + k * Math.PI / 2 - j * 0.07, [px, py] = I(1.5 + Math.cos(a) * 1.08, 1.5 + Math.sin(a) * 1.08, z);
          ctx.fillStyle = j === 0 ? '#ffffff' : cor.claro; ctx.globalAlpha = 1 - j / 7;
          ctx.fillRect(Math.round(px) - (j === 0 ? 1 : 0), Math.round(py) - (j === 0 ? 1 : 0), j === 0 ? 3 : 2, j === 0 ? 2 : 1);
        }
      }
      ctx.globalAlpha = 1;
      // Monte (pilha deitada; brilha quando dá para comprar).
      const camadas = alturaMonte();
      for (let k = 0; k < camadas; k++) A.deitada(ctx, I, MONTE[0], MONTE[1], z + k + 1, k === camadas - 1 ? '#2e2152' : '#211738', k === camadas - 1 ? '#6650aa' : null);
      if (D.pilha > 0) { const [mx, my] = I(MONTE[0], MONTE[1], z + camadas + 1); ctx.fillStyle = '#d8342a'; ctx.fillRect(Math.round(mx) - 4, Math.round(my) - 1, 8, 2); }
      if (podeAgir() && v.comprada == null) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t / 150);
        const w = 0.27, h = 0.37, zz = z + camadas + 1;
        A.linha(ctx, I(MONTE[0] - w, MONTE[1] - h, zz), I(MONTE[0] + w, MONTE[1] - h, zz), '#ffe25a'); A.linha(ctx, I(MONTE[0] + w, MONTE[1] - h, zz), I(MONTE[0] + w, MONTE[1] + h, zz), '#ffe25a');
        A.linha(ctx, I(MONTE[0] + w, MONTE[1] + h, zz), I(MONTE[0] - w, MONTE[1] + h, zz), '#ffe25a'); A.linha(ctx, I(MONTE[0] - w, MONTE[1] + h, zz), I(MONTE[0] - w, MONTE[1] - h, zz), '#ffe25a');
        ctx.globalAlpha = 1;
      }
      // Descarte: as de baixo deitadas e a de cima de pé, flutuando, com o brilho da cor.
      const desc = D.descarte.slice(0, -1);
      desc.forEach((c, i) => A.deitada(ctx, I, DESCARTE[0] + (((c.id * 13) % 9) - 4) * 0.025, DESCARTE[1] + (((c.id * 7) % 9) - 4) * 0.025, z + 1 + i, (A.COR[c.cor] || A.COR.coringa).base));
      if (D.topo) {
        const [x0, y0] = I(DESCARTE[0], DESCARTE[1], z + 1 + desc.length);
        ctx.globalAlpha = 0.35; ctx.fillStyle = cor.base; ctx.beginPath(); ctx.ellipse(x0, y0, 22 + Math.sin(t / 300) * 2, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(Math.round(x0) - 10, Math.round(y0) - 1, 20, 3);
        const bob = Math.round(Math.sin(t / 420) * 1.5);
        ctx.drawImage(A.carta(D.topo, D.topo.cor ? null : D.cor), Math.round(x0 - A.CW / 2), Math.round(y0 - A.CH - 6 + bob));
      }
      // Leques nas mãos de quem está na mesa.
      for (const [nome, l] of lugares) { const n = D.qtd[nome] || 0; if (!n) continue; const p = pontos(l); ctx.drawImage(leque(n), Math.round(p.fx - 20), Math.round(p.fy - 8)); }
      // Onda da cor escolhida no coringa.
      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i], p = (t - o.t0) / 900;
        if (p >= 1) { ondas.splice(i, 1); continue; }
        const r = 0.25 + p * 2.3;
        ctx.globalAlpha = 1 - p; ctx.fillStyle = o.cor;
        for (let k = 0; k < 90; k++) { const a = k / 90 * Math.PI * 2, [px, py] = I(DESCARTE[0] + Math.cos(a) * r, DESCARTE[1] + Math.sin(a) * r, z); ctx.fillRect(Math.round(px), Math.round(py), 2, 2); }
        ctx.globalAlpha = 1;
      }
      // Cartas voando.
      for (let i = voos.length - 1; i >= 0; i--) {
        const f = voos[i], p = (t - f.t0) / f.ms;
        if (p < 0) continue;
        if (p >= 1) { voos.splice(i, 1); if (f.fim) f.fim(); continue; }
        const e = 1 - Math.pow(1 - p, 3);
        const x = f.de[0] + (f.para[0] - f.de[0]) * e, y = f.de[1] + (f.para[1] - f.de[1]) * e - f.arco * 4 * p * (1 - p);
        const s = f.s0 + (f.s1 - f.s0) * e, vira = f.verso ? Math.abs(Math.cos(Math.PI * p)) : 1;
        const img = f.verso && p < 0.5 ? f.verso : f.img;
        ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(Math.max(0.05, vira) * s, s);
        ctx.drawImage(img, -A.CW / 2, -A.CH / 2); ctx.restore();
      }
      // Placa de "pulou" pulando em cima da cabeça.
      for (let i = placas.length - 1; i >= 0; i--) {
        const q = placas[i], p = (t - q.t0) / 1100, l = lugares.get(q.nome);
        if (p >= 1 || !l) { placas.splice(i, 1); continue; }
        const pt = pontos(l), sobe = Math.abs(Math.sin(p * Math.PI * 3)) * 6 * (1 - p);
        ctx.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
        ctx.drawImage(placaImg, Math.round(pt.ax - 9), Math.round(pt.ay - 100 - sobe));
        ctx.globalAlpha = 1;
      }
      // Faíscas e confete.
      for (let i = particulas.length - 1; i >= 0; i--) {
        const q = particulas[i];
        q.t += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.t > q.vida || q.y > H + 10) { particulas.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, (q.vida - q.t) * 3);
        ctx.fillStyle = q.cor;
        ctx.fillRect(Math.round(q.x), Math.round(q.y), q.gira && Math.sin(q.t * 9 + q.x) > 0 ? 1 : q.tam, q.tam);
      }
      ctx.globalAlpha = 1;
    }

    // ---------- DOM: nomes, mão, barra e painéis ----------
    const tags = new Map();
    let monteNum = null, acumuloEl = null;
    function desenharSobre() {
      if (!I || !D) return;
      for (const [nome, tag] of tags) if (!lugares.has(nome)) { tag.remove(); tags.delete(nome); }
      for (const [nome, l] of lugares) {
        let tag = tags.get(nome);
        if (!tag) { tag = el('div', { class: 'vl-zr-tag' }); tags.set(nome, tag); sobre.appendChild(tag); }
        const p = pontos(l), n = D.qtd[nome] || 0, vez = !!v && !v.fim && (v.esquecido ? v.esquecido.nome : v.vez) === nome;
        tag.className = 'vl-zr-tag' + (l.lado === 'L' ? ' l' : l.lado === 'R' ? ' r' : ' eu') + (vez ? ' vez' : '');
        tag.style.left = p.ax * ESC + 'px'; tag.style.top = (p.ay - 72) * ESC + 'px';
        tag.replaceChildren(...[el('span', { texto: nome === eu ? 'Você' : nome }), el('span', { class: 'n', texto: n, title: n + ' cartas' }), D.ultima[nome] && n === 1 ? el('span', { class: 'um', texto: '1!' }) : null,
          vez && v.tempo ? el('span', { class: 'vl-zr-tempo', 'data-relogio': '1' }, [el('i')]) : null].filter(Boolean));
      }
      if (!monteNum) { monteNum = el('div', { class: 'vl-zr-monte' }); sobre.appendChild(monteNum); }
      const [mx, my] = I(MONTE[0], MONTE[1], A.ALTURA_MESA + alturaMonte() + 2); // em cima do monte
      monteNum.style.left = mx * ESC + 'px'; monteNum.style.top = my * ESC - 10 + 'px';
      monteNum.textContent = D.pilha;
      if (D.acumulado > 0) {
        if (!acumuloEl) { acumuloEl = el('div', { class: 'vl-zr-acumulo' }); sobre.appendChild(acumuloEl); }
        const [ax, ay] = I(DESCARTE[0] + 0.55, DESCARTE[1] - 0.2, A.ALTURA_MESA + 30);
        acumuloEl.style.left = ax * ESC + 'px'; acumuloEl.style.top = ay * ESC + 'px';
        acumuloEl.textContent = '+' + D.acumulado;
      } else if (acumuloEl) { acumuloEl.remove(); acumuloEl = null; }
    }
    let maoSig = '';
    function desenharMao(novaId) {
      if (!D) return;
      const cartas = ordenar(D.mao), pode = podeAgir();
      const n = cartas.length, larg = Math.max(400, (cena.clientWidth || 880) - 60), w = 78;
      // Só refaz a mão quando algo mudou (refazer à toa tira o "passar o mouse" da carta).
      const sig = cartas.map((c) => c.id + (pode && servir(c) ? 's' : pode ? 'n' : '')).join(',') + '|' + larg;
      if (sig === maoSig && novaId == null) return;
      maoSig = sig;
      const passo = n > 1 ? Math.min(w + 6, (larg - w) / (n - 1)) : 0;
      mao.replaceChildren(...cartas.map((c, i) => {
        const serve = pode && servir(c);
        return el('button', {
          type: 'button', class: 'vl-zr-c' + (serve ? ' pode' : pode ? ' nao' : '') + (c.id === novaId ? ' nova' : ''), 'data-id': String(c.id),
          'aria-label': rotulo(c) + (serve ? '' : pode ? ' (não serve agora)' : ''), style: 'margin-left:' + (i ? Math.round(passo - w) : 0) + 'px;z-index:' + (i + 1),
          onclick() { jogar(c); },
        }, [el('img', { alt: '', src: A.url(c), draggable: 'false' })]);
      }));
    }
    function jogar(c) {
      if (!podeAgir() || !servir(c)) { if (minhaVez()) api.som('erro'); return; }
      if (!c.cor) { escolhendo = c.id; desenharDom(); return; }
      agir({ tipo: 'jogar', id: c.id });
    }
    function agir(a) { esperando = performance.now() + 2500; api.agir(a); desenharDom(); }
    function desenharBarra() {
      const minha = minhaVez(), pode = podeAgir(), meus = D ? D.mao.length : 0;
      euBox.classList.toggle('vez', minha);
      euQtd.textContent = meus + (meus === 1 ? ' carta' : ' cartas') + (D && D.ultima[eu] && meus === 1 ? ' · ÚLTIMA!' : '');
      const euNaMesa = v && v.jogadores.find((p) => p.nome === eu);
      const gritar = !!euNaMesa && minha && v.mao.length === 2 && !euNaMesa.ultima && v.mao.some(servir);
      const corEl = v && v.cor ? [' · Cor: ', el('i', { style: 'background:' + A.COR[v.cor].base }), NOME_COR[v.cor]] : [];
      let partes;
      if (!v || v.fim) partes = [v && v.fim ? (v.fim.vencedor === eu ? 'Você zerou a mão!' : v.fim.vencedor + ' zerou a mão!') : 'Preparando a mesa…'];
      else if (v.esquecido) partes = v.esquecido.nome === eu ? [el('b', { texto: 'Você esqueceu de gritar ÚLTIMA!' }), ' Rápido!'] : [el('b', { texto: v.esquecido.nome }), ' esqueceu de gritar ÚLTIMA! Pegue!'];
      else if (minha) partes = v.acumulado ? [el('b', { texto: '+' + v.acumulado + ' na mesa: ' }), v.ultimoMais === '+4' ? 'jogue um +4 ou compre.' : 'jogue +2 ou +4, ou compre.']
        : gritar ? [el('b', { texto: 'Sua vez!' }), ' Grite ÚLTIMA! e jogue a penúltima.'] : v.comprada != null ? [el('b', { texto: 'A comprada serve! ' }), 'Jogue ou passe.']
        : v.mao.some(servir) ? [el('b', { texto: 'Sua vez!' }), ' Jogue uma carta que brilha.'].concat(corEl) : [el('b', { texto: 'Sua vez!' }), ' Nenhuma serve: compre do monte.'].concat(corEl);
      else partes = ['Vez de ', el('b', { texto: v.vez }), v.acumulado ? ' · +' + v.acumulado + ' acumulado' : ''].concat(corEl);
      status.replaceChildren(...partes);
      const lista = [];
      if (gritar) {
        lista.push(el('button', { type: 'button', class: 'vl-zr-b ultima', texto: 'ÚLTIMA!', title: 'Grite antes de ficar com uma carta', onclick() { agir({ tipo: 'ultima' }); } }));
      }
      if (minha && v.comprada != null) lista.push(el('button', { type: 'button', class: 'vl-zr-b', texto: 'Passar', disabled: !pode, onclick() { if (podeAgir()) agir({ tipo: 'passar' }); } }));
      else if (v && !v.fim) lista.push(el('button', { type: 'button', class: 'vl-zr-b', texto: v.acumulado && minha ? 'Comprar ' + v.acumulado : 'Comprar', disabled: !pode, title: 'Ou clique no monte', onclick() { if (podeAgir()) agir({ tipo: 'comprar' }); } }));
      botoes.replaceChildren(...lista);
    }
    let painel = null;
    function desenharPaineis() {
      if (painel) { painel.remove(); painel = null; }
      if (!v || v.fim) return;
      if (v.esquecido) {
        const souEu = v.esquecido.nome === eu;
        painel = el('div', { class: 'vl-zr-painel', role: 'dialog', 'aria-label': 'Última carta' }, [
          el('h4', { texto: souEu ? 'Você esqueceu!' : v.esquecido.nome + ' esqueceu!' }),
          el('p', { texto: souEu ? 'Grite antes que alguém pegue você.' : 'Ficou com uma carta sem gritar. Pegue antes que ' + v.esquecido.nome + ' grite!' }),
          el('button', { type: 'button', class: 'vl-zr-b grande ' + (souEu ? 'ultima' : 'pegar'), texto: souEu ? 'ÚLTIMA!' : 'PEGAR!', onclick() { agir(souEu ? { tipo: 'ultima' } : { tipo: 'pegar' }); } }),
          el('div', { class: 'vl-zr-contagem', 'data-janela': '1' }, [el('i')]),
        ]);
      } else if (escolhendo != null && minhaVez()) {
        painel = el('div', { class: 'vl-zr-painel', role: 'dialog', 'aria-label': 'Escolha a cor' }, [
          el('h4', { texto: 'Escolha a cor' }),
          el('div', { class: 'vl-zr-cores' }, A.ORDEM_CORES.map((cor) => el('button', { type: 'button', style: 'background:' + A.COR[cor].base, 'aria-label': NOME_COR[cor], texto: NOME_COR[cor], onclick() {
            const id = escolhendo;
            escolhendo = null;
            if (podeAgir()) agir({ tipo: 'jogar', id, cor }); else desenharDom();
          } }))),
          el('button', { type: 'button', class: 'vl-zr-b cancelar', texto: 'Cancelar', onclick() { escolhendo = null; desenharDom(); } }),
        ]);
      }
      if (painel) { cena.appendChild(painel); const b = painel.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
    }
    // ---------- fim da partida: pódio com os avatares em pé ----------
    let fimEl = null, fimLiberado = 0;
    const avatarEmPe = (nome, gesto, acenar) => IMAGER + encodeURIComponent(figura(nome)) + '&direction=2&head_direction=3&gesture=' + gesto + (acenar ? '&action=wav' : '') + '&size=m';
    function mostrarFim() {
      if (fimEl || !v || !v.fim || !raizEl.isConnected) return;
      const f = v.fim, ordem = f.ordem && f.ordem.length ? f.ordem : [f.vencedor];
      const nomeDe = (n) => (n === eu ? 'Você' : n);
      const detalhe = (n, i) => (i === 0 ? (f.pontos ? '+' + f.pontos + ' pontos' : 'Zerou a mão')
        : f.qtd && f.qtd[n] != null ? f.qtd[n] + (f.qtd[n] === 1 ? ' carta · ' : ' cartas · ') + ((f.pts && f.pts[n]) || 0) + ' pts' : '');
      const degrau = (i) => {
        const n = ordem[i];
        if (!n) return el('div', { class: 'vl-zr-degrau vazio' });
        return el('div', { class: 'vl-zr-degrau p' + (i + 1) }, [
          i === 0 ? el('img', { class: 'coroa', alt: '', src: A.coroa() }) : null,
          el('div', { class: 'av' }, [el('img', { alt: '', draggable: 'false', src: avatarEmPe(n, i === 0 ? 'sml' : i === 1 ? 'std' : 'sad', i === 0) })]),
          el('b', { texto: nomeDe(n) }), el('small', { texto: detalhe(n, i) }),
          el('div', { class: 'bloco' }, [el('span', { texto: String(i + 1) })]),
        ]);
      };
      const venci = f.vencedor === eu;
      fimEl = el('div', { class: 'vl-zr-fim', role: 'dialog', 'aria-label': 'Fim de partida' }, [el('div', { class: 'vl-zr-fim-caixa' }, [
        el('h4', null, [el('img', { alt: '', src: A.icone() }), 'Fim de partida']),
        el('h2', { texto: venci ? 'Você zerou!' : nomeDe(f.vencedor) + ' zerou!' }),
        el('p', { class: 'sub', texto: venci ? 'As cartas que sobraram com os outros viraram seus pontos.' : 'Quem zera primeiro leva os pontos das cartas dos outros.' }),
        el('div', { class: 'vl-zr-podio' }, [degrau(1), degrau(0), degrau(2)]),
        el('div', { class: 'vl-zr-chao' }),
        ordem.length > 3 ? el('div', { class: 'vl-zr-resto' }, ordem.slice(3).map((n, k) => el('span', null, [
          el('i', null, [el('img', { alt: '', src: IMAGER + encodeURIComponent(figura(n)) + '&headonly=1&direction=2&head_direction=3&size=m' })]),
          el('b', { class: 'vl-zr-ord', texto: (k + 4) + 'º' }), el('em', { texto: nomeDe(n) }), ' · ' + ((f.pts && f.pts[n]) || 0) + ' pts']))) : null,
        el('div', { class: 'vl-zr-fim-botoes' }, [
          api.anfitriao() ? el('button', { type: 'button', class: 'vl-zr-b ouro', texto: 'Jogar de novo', onclick() { if (api.deNovo) api.deNovo(); } })
            : el('span', { texto: 'Esperando ' + ((api.nomeAnfitriao && api.nomeAnfitriao()) || 'quem abriu a mesa') + '…' }),
          el('button', { type: 'button', class: 'vl-zr-b', texto: 'Sair', onclick() { if (api.sair) api.sair(); } }),
        ]),
      ])]);
      raizEl.appendChild(fimEl);
    }
    let painelChave = '';
    function desenharDom() {
      desenharSobre();
      desenharMao();
      desenharBarra();
      const chave = v ? (v.esquecido ? 'j' + v.esquecido.nome + v.n : '') + '|' + (escolhendo == null ? '' : 'c' + escolhendo) + (v.fim ? 'f' : '') : '';
      if (chave !== painelChave) { painelChave = chave; desenharPaineis(); }
      if (v && v.fim && !fimEl && !ocupado() && performance.now() >= fimLiberado) mostrarFim();
    }
    // Relógios (vez e janela do "Última!") andam a cada quadro.
    function atualizarRelogios(t) {
      if (!v) return;
      if (v.tempo) {
        const resta = v.tempo.resta - (t - v.recebido), frac = Math.max(0, Math.min(1, resta / v.tempo.limite));
        for (const r of sobre.querySelectorAll('[data-relogio] i')) { r.style.width = frac * 100 + '%'; r.parentNode.classList.toggle('fim', resta < 5000); }
        if (minhaVez() && resta < 5000 && resta > 0 && Math.floor(resta / 1000) !== atualizarRelogios.ultimo) { atualizarRelogios.ultimo = Math.floor(resta / 1000); api.som('tique'); }
      }
      if (v.esquecido && painel) {
        const r = painel.querySelector('[data-janela] i');
        if (r) r.style.width = Math.max(0, Math.min(1, (v.esquecido.resta - (t - v.recebido)) / (K.JANELA + 700))) * 100 + '%';
      }
    }

    // Clique no monte do canvas para comprar.
    function noMonte(ev) {
      if (!I) return false;
      const r = canvas.getBoundingClientRect(), x = (ev.clientX - r.left) / ESC, y = (ev.clientY - r.top) / ESC;
      const [mx, my] = I(MONTE[0], MONTE[1], A.ALTURA_MESA + alturaMonte());
      return Math.abs(x - mx) < 18 && Math.abs(y - my) < 13;
    }
    canvas.addEventListener('pointermove', (ev) => { canvas.style.cursor = noMonte(ev) && podeAgir() && v.comprada == null ? 'pointer' : ''; });
    canvas.addEventListener('click', (ev) => { if (noMonte(ev) && podeAgir() && v.comprada == null) agir({ tipo: 'comprar' }); });
    new ResizeObserver(() => { if (cena.isConnected) { medir(); desenharDom(); } }).observe(cena);

    return { el: raizEl, atualizar };
  }

  VL.mesa.registrar('cartas', {
    nome: 'ZERA!', glifo: '🃏', min: 2, max: 6, nomesBot: NOMES_BOT, resultadoProprio: true,
    texto: 'Jogue a mesma cor ou o mesmo número da carta de cima. +2 e +4 acumulam para o próximo. Grite "ÚLTIMA!" quando ficar com uma carta, senão alguém pega você. Zere a mão para vencer!',
    fatos: ['De 2 a 6 jogadores', 'Bots em 3 níveis', '+2 e +4 acumulam'],
    bots: [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']],
    opcoes: [{ id: 'tempo', rotulo: 'Tempo por vez', valores: [['20', '20 s'], ['30', '30 s'], ['0', 'Sem limite']], padrao: '30' }],
    nova(jogadores, op) {
      const e = K.nova(jogadores, op);
      e.visuais = {};
      const usados = new Set();
      for (const p of jogadores) {
        if (!p.bot) continue;
        let i = hashNome(p.nome) % VISUAIS_BOT.length;
        while (usados.has(i) && usados.size < VISUAIS_BOT.length) i = (i + 1) % VISUAIS_BOT.length;
        usados.add(i);
        e.visuais[p.nome] = VISUAIS_BOT[i];
      }
      return e;
    },
    aplicar: (e, nome, a) => K.aplicar(e, nome, a),
    tick: (e) => K.tick(e),
    sair: (e, nome) => K.sair(e, nome),
    fim: (e) => K.resultado(e),
    visao(e, nome) {
      const v = K.visao(e, nome);
      v.visuais = {};
      for (const n of e.ordem) v.visuais[n] = e.visuais[n] || visualLocal(n);
      return v;
    },
    montar,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
