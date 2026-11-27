// Vagalume — módulo "jogos": xadrez, damas e ping-pong (pedido do usuário em 2026-11-22; ping-pong em 2026-11-23).
// Abrem pela aba Jogos do painel, por /jogos ou com dois cliques num tabuleiro do quarto (o jogo manda "usar" o
// mobi): contra o bot, contra quem usa o Vagalume no mesmo quarto ou chamando um amigo de outro quarto. No mesmo
// quarto a partida vai pelo canal direto da comunidade; com um amigo, o convite vai no console (mensagem privada
// com um código) e a partida por uma sala só dos dois no servidor do Vagalume. Cada lance leva o número da jogada
// e é confirmado; se algo se perder, quem está atrás pede a posição. Os lances são animados (velocidade nos
// ajustes). Regras em core/xadrez.js e core/damas.js.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.conexao || !VL.codigos || !VL.xadrez || !VL.damas) return;
  const { nucleo, camada, conexao, codigos } = VL;
  const X = VL.xadrez, D = VL.damas;
  const { SAIDA, ENTRADA } = codigos;
  const el = camada.el;

  // Tabuleiros do Habblet que abrem o jogo (ids do arquivo de mobis, 2026-11-22): Tabuleiro de Xadrez, Xadrez
  // Bruxo (dois), Xadrez Clássico, Mesa de Xadrez, Tabuleiro das Mil Estratégias, Xadrez dos Bruxos, Jogos de
  // Tabuleiros e Jogos de Mesa.
  const TABULEIROS = new Set([1356475873, 1356469514, 2100000708, 886652737, 886652738, 886647434, 886634006, 886655528, 1356476911]);

  const NOMES = { xadrez: 'Xadrez', damas: 'Damas', pingpong: 'Ping-pong' };
  const NIVEIS = [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']];
  const GLIFO = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const NOME_PECA = { k: 'rei', q: 'dama', r: 'torre', b: 'bispo', n: 'cavalo', p: 'peão' };
  const COR_NOME = { w: 'brancas', b: 'pretas' };
  const TORRES = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] }; // roque: de onde para onde a torre anda
  // Jogos da janela e da aba Jogos (os próximos entram aqui).
  const JOGOS = [
    { id: 'xadrez', glifo: '♞', texto: 'Regras completas: roque, en passant, promoção, xeque-mate e empates.' },
    { id: 'damas', glifo: '⛂', texto: 'Regra brasileira: captura obrigatória pela maioria e dama voadora.' },
    { id: 'pingpong', glifo: '🏓', emoji: true, texto: 'Em 3D: a bola quica na mesa e você rebate com a raquete no mouse. Até 11 pontos.' },
  ];
  // Convite de amigo no console: jogo (x/d/p), cor de quem convida (w/b) e a sala da partida ("9" + 11 dígitos).
  const LETRA_JOGO = { xadrez: 'x', damas: 'd', pingpong: 'p' }, JOGO_DA_LETRA = { x: 'xadrez', d: 'damas', p: 'pingpong' };
  const CODIGO_CONVITE = /vl-jogo-([xdp])([wb])(9\d{11})(?:-([lubr]))?/;
  // Ritmos do xadrez: [segundos de cada um, acréscimo por lance]. "livre" não tem relógio.
  const RITMOS = [['livre', 'Sem relógio'], ['bullet', 'Bullet 1 min'], ['blitz', 'Blitz 3+2'], ['rapida', 'Rápida 10 min']];
  const TEMPO = { bullet: [60, 0], blitz: [180, 2], rapida: [600, 0] };
  const LETRA_RITMO = { livre: 'l', bullet: 'u', blitz: 'z', rapida: 'r' }, RITMO_DA_LETRA = { l: 'livre', u: 'bullet', z: 'blitz', r: 'rapida' };
  const ritmoValido = (r) => (TEMPO[r] ? r : 'livre');
  const relogioTexto = (ms) => { const x = Math.max(0, ms); const seg = Math.floor(x / 1000); return x < 10000 ? (x / 1000).toFixed(1) : Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0'); };
  const VS = '︎'; // mostra o símbolo como texto, não como emoji

  const CSS = `
  .vl-jg { pointer-events: auto; position: fixed; z-index: 30; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(820px, calc(100vw - 24px));
    max-height: calc(100vh - 24px); display: flex; flex-direction: column; color: #e9eef7; font: 13px/1.4 system-ui, 'Segoe UI', sans-serif;
    background: linear-gradient(180deg, #1a1f2b, #10131b); border: 1px solid rgba(214,242,74,.35);
    border-radius: 16px; box-shadow: 0 18px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06); overflow: hidden; outline: none; }
  .vl-jg-cab { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: grab; user-select: none;
    background: linear-gradient(90deg, rgba(214,242,74,.16), rgba(214,242,74,0)); border-bottom: 1px solid rgba(214,242,74,.18); }
  .vl-jg-cab b { font-size: 15px; letter-spacing: .2px; }
  .vl-jg-cab .vl-jg-ic { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; font-size: 18px;
    background: radial-gradient(circle at 35% 30%, #f3ffb0, #d6f24a 55%, #8fae1c); color: #1b2207; box-shadow: 0 0 14px rgba(214,242,74,.45); }
  .vl-jg-cab .vl-jg-esp { flex: 1; }
  .vl-jg-cab button { background: rgba(255,255,255,.06); color: #dfe6f2; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; width: 28px; height: 26px; cursor: pointer; font-size: 15px; }
  .vl-jg-cab button:hover { background: rgba(214,242,74,.2); color: #fff; }
  .vl-jg.minimizada .vl-jg-corpo { display: none; }
  .vl-jg-corpo { padding: 16px; overflow: auto; }
  .vl-jg h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: .6px; text-transform: uppercase; color: #b7c3d6; }
  .vl-jg-cartao { display: flex; gap: 12px; align-items: center; padding: 14px; border-radius: 14px; cursor: pointer; text-align: left; color: inherit;
    border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); transition: transform .12s, border-color .12s, background .12s; }
  .vl-jg-cartao:hover { transform: translateY(-1px); border-color: rgba(214,242,74,.5); }
  .vl-jg-cartao .vl-jg-mini { width: 54px; height: 54px; border-radius: 10px; display: grid; place-items: center; font-size: 34px;
    background: conic-gradient(#e8edd0 0 25%, #74954e 0 50%, #e8edd0 0 75%, #74954e 0) 0 0 / 27px 27px; color: #fff;
    -webkit-text-stroke: 1.2px #1d2330; text-shadow: 0 2px 3px rgba(0,0,0,.4); }
  .vl-jg-cartao b { display: block; font-size: 16px; margin-bottom: 2px; }
  .vl-jg-dama { display: inline-block; width: .78em; height: .78em; border-radius: 50%; vertical-align: -.08em;
    background: radial-gradient(circle, #d65441 0 30%, #8e2a1e 31% 38%, #d65441 39% 56%, #9c2f20 57% 100%);
    box-shadow: 0 .07em 0 #4a120b, 0 .12em .16em rgba(0,0,0,.45), inset 0 .05em 0 rgba(255,255,255,.4); -webkit-text-stroke: 0; }
  .vl-jg-hub { display: flex; flex-direction: column; gap: 10px; }
  .vl-jg-hub .vl-jg-cartao { width: 100%; }
  .vl-jg-hub h3 { margin: 6px 0 0; }
  .vl-jg-cartao small { color: #aab5c7; }
  .vl-jg-botao { padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(214,242,74,.5); background: rgba(214,242,74,.14); color: #f2ffc0; cursor: pointer; font: 600 13px system-ui, sans-serif; }
  .vl-jg-botao:hover:not(:disabled) { background: rgba(214,242,74,.26); }
  .vl-jg-botao.forte { background: #d6f24a; color: #1a2108; border-color: #d6f24a; }
  .vl-jg-botao.forte:hover:not(:disabled) { background: #e4ff66; }
  .vl-jg-botao.discreto { border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.05); color: #dfe6f2; font-weight: 500; }
  .vl-jg-botao:disabled { opacity: .45; cursor: default; }
  .vl-jg-cabeca { position: relative; width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex: none; background: rgba(214,242,74,.15); display: grid; place-items: center; font-weight: 700; color: #d6f24a; }
  .vl-jg-cabeca img { position: absolute; width: 90px; height: 130px; left: 50%; top: 50%; transform: translate(-50%, -53%) scale(.8); image-rendering: pixelated; }
  .vl-jg-nota { color: #9aa6b8; margin: 8px 0 0; }
  .vl-jg-aviso { margin-top: 10px; color: #f2ffc0; min-height: 18px; }
  .vl-jg-partida { display: flex; gap: 16px; align-items: flex-start; }
  .vl-jg-tab { position: relative; flex: none; width: var(--lado); height: var(--lado); display: grid; grid-template: repeat(8, 1fr) / repeat(8, 1fr);
    border-radius: 10px; overflow: hidden; box-shadow: 0 0 0 3px #2b3a1c, 0 0 0 5px rgba(214,242,74,.4), 0 14px 34px rgba(0,0,0,.5); user-select: none; }
  .vl-jg-casa { position: relative; display: grid; place-items: center; cursor: pointer; }
  .vl-jg-casa.clara { background: #e8edd0; } .vl-jg-casa.escura { background: #74954e; }
  .vl-jg.damas .vl-jg-casa.clara { background: #efe6cf; } .vl-jg.damas .vl-jg-casa.escura { background: #7b5a3d; }
  .vl-jg-casa.ultimo::before { content: ''; position: absolute; inset: 0; background: rgba(214,242,74,.42); }
  .vl-jg-casa.selecionada::before { content: ''; position: absolute; inset: 0; background: rgba(214,242,74,.6); box-shadow: inset 0 0 0 3px #f5ffc2; }
  .vl-jg-casa.xeque::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle, rgba(255,60,60,.95) 0, rgba(255,60,60,.5) 45%, transparent 75%); }
  .vl-jg-casa.alvo::after { content: ''; position: absolute; width: 30%; height: 30%; border-radius: 50%; background: rgba(28,40,10,.35); pointer-events: none; }
  .vl-jg-casa.alvo.come::after { width: 86%; height: 86%; background: none; border: 5px solid rgba(28,40,10,.38); box-sizing: border-box; }
  .vl-jg-casa.passo::after { content: ''; position: absolute; width: 40%; height: 40%; border-radius: 50%; background: rgba(214,242,74,.85); box-shadow: 0 0 10px rgba(214,242,74,.9); pointer-events: none; }
  .vl-jg-coord { position: absolute; font: 700 10px system-ui, sans-serif; opacity: .75; pointer-events: none; }
  .vl-jg-coord.l { left: 3px; top: 2px; } .vl-jg-coord.c { right: 3px; bottom: 1px; }
  .vl-jg-casa.clara .vl-jg-coord { color: #4f6a31; } .vl-jg-casa.escura .vl-jg-coord { color: #eef3da; }
  .vl-jg.damas .vl-jg-casa.clara .vl-jg-coord { color: #7b5a3d; } .vl-jg.damas .vl-jg-casa.escura .vl-jg-coord { color: #f3e8cf; }
  .vl-jg-peca { position: relative; z-index: 1; font-size: calc(var(--lado) / 8 * .78); line-height: 1; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'DejaVu Sans', serif; pointer-events: none; }
  .vl-jg-peca.w { color: #fffdf4; -webkit-text-stroke: 1.5px #1d2330; text-shadow: 0 3px 3px rgba(0,0,0,.35); }
  .vl-jg-peca.b { color: #22262f; -webkit-text-stroke: 1px #05070a; text-shadow: 0 1px 0 rgba(255,255,255,.22), 0 3px 4px rgba(0,0,0,.45); }
  .vl-jg-peca.nova { animation: vl-jg-pop .22s ease-out; }
  @keyframes vl-jg-pop { from { transform: scale(.72); opacity: .4; } to { transform: scale(1); opacity: 1; } }
  .vl-jg-disco { position: relative; z-index: 1; width: 78%; height: 78%; border-radius: 50%; pointer-events: none; display: grid; place-items: center; }
  .vl-jg-disco.w { background: radial-gradient(circle at 35% 30%, #fffef6, #ece5cf 55%, #c1b79b); box-shadow: inset 0 -3px 0 rgba(0,0,0,.18), inset 0 0 0 4px rgba(150,138,104,.35), 0 3px 5px rgba(0,0,0,.45); }
  .vl-jg-disco.b { background: radial-gradient(circle at 35% 30%, #6a3b2a, #3b1d14 55%, #1d0d08); box-shadow: inset 0 -3px 0 rgba(0,0,0,.35), inset 0 0 0 4px rgba(255,190,150,.12), 0 3px 5px rgba(0,0,0,.5); }
  .vl-jg-disco .coroa { font-size: calc(var(--lado) / 8 * .42); color: #f6cd4c; -webkit-text-stroke: .8px #6b4a00; text-shadow: 0 0 6px rgba(246,205,76,.7); font-family: 'Segoe UI Symbol', 'DejaVu Sans', serif; }
  .vl-jg-disco.nova { animation: vl-jg-pop .22s ease-out; }
  .vl-jg-lado { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 10px; }
  .vl-jg-jogador { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); }
  .vl-jg-jogador.vez { border-color: #d6f24a; background: rgba(214,242,74,.1); box-shadow: 0 0 16px rgba(214,242,74,.18); }
  .vl-jg-jogador .nome { flex: 1; min-width: 0; }
  .vl-jg-jogador .nome b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vl-jg-jogador .nome small { color: #9aa6b8; }
  .vl-jg-cor { width: 14px; height: 14px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px rgba(0,0,0,.35); }
  .vl-jg-relogio { margin-left: auto; min-width: 62px; text-align: center; padding: 4px 8px; border-radius: 8px; background: #0f141c; border: 1px solid #2c3a4f; font: 700 17px ui-monospace, Consolas, monospace; color: #c9d3e2; font-variant-numeric: tabular-nums; }
  .vl-jg-relogio.ativo { background: #d6f24a; border-color: #d6f24a; color: #141a10; }
  .vl-jg-relogio.pouco { background: #e5484d; border-color: #e5484d; color: #fff; }
  .vl-jg-ritmo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .vl-jg-cor.w { background: #fffdf4; } .vl-jg-cor.b { background: #22262f; box-shadow: 0 0 0 2px rgba(255,255,255,.3); }
  .vl-jg-tomadas { font-size: 17px; letter-spacing: -1px; min-height: 20px; font-family: 'Segoe UI Symbol', 'DejaVu Sans', serif; }
  .vl-jg-tomadas.pretas { color: #22262f; -webkit-text-stroke: .7px #cfd7e4; } .vl-jg-tomadas.brancas { color: #fffdf4; -webkit-text-stroke: .7px #1d2330; }
  .vl-jg.damas .vl-jg-tomadas.pretas { color: #5a2c1d; -webkit-text-stroke: 0; } .vl-jg.damas .vl-jg-tomadas.brancas { color: #ece5cf; -webkit-text-stroke: 0; }
  .vl-jg-estado { padding: 10px 12px; border-radius: 12px; background: rgba(0,0,0,.25); font-weight: 600; color: #f2ffc0; min-height: 20px; }
  .vl-jg-estado.fim { background: rgba(214,242,74,.18); color: #fff; font-size: 14px; }
  .vl-jg-lances { flex: 1; min-height: 120px; max-height: 210px; overflow: auto; border-radius: 12px; background: rgba(0,0,0,.2); padding: 6px; display: grid; grid-template-columns: 30px 1fr 1fr; gap: 2px 6px; align-content: start; font: 12px ui-monospace, Consolas, monospace; }
  .vl-jg-lances .n { color: #7f8aa0; } .vl-jg-lances .ult { color: #d6f24a; font-weight: 700; }
  .vl-jg-acoes { display: flex; flex-wrap: wrap; gap: 6px; }
  .vl-jg-promo { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: rgba(10,12,18,.6); }
  .vl-jg-promo div { display: flex; gap: 8px; padding: 10px; border-radius: 14px; background: #1b2130; border: 1px solid #d6f24a; }
  .vl-jg-promo button { width: 58px; height: 58px; border-radius: 10px; border: 1px solid rgba(255,255,255,.15); background: #e8edd0; cursor: pointer; display: grid; place-items: center; }
  .vl-jg-promo button:hover { background: #d6f24a; }
  .vl-jg-vel { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 12px; color: #9aa6b8; font-size: 12px; }
  .vl-jg-lado .vl-jg-vel { margin-top: 0; }
  .vl-jg-anim { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
  .vl-jg-fantasma { position: absolute; width: 12.5%; height: 12.5%; display: grid; place-items: center; will-change: transform, opacity; }
  .vl-jg-fantasma.voando { z-index: 1; filter: drop-shadow(0 7px 6px rgba(0,0,0,.35)); }
  .vl-jg-casa .escondida { visibility: hidden; }
  .vl-jg-chamada { pointer-events: auto; position: fixed; z-index: 32; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 264px; padding: 24px 18px 18px; border-radius: 16px; text-align: center;
    color: #e9eef7; font: 13px/1.4 system-ui, 'Segoe UI', sans-serif; background: linear-gradient(180deg, #1a1f2b, #10131b); border: 1px solid rgba(214,242,74,.4);
    box-shadow: 0 24px 60px rgba(0,0,0,.65), 0 0 30px rgba(214,242,74,.12); animation: vl-jg-entra .22s ease-out; }
  @keyframes vl-jg-entra { from { opacity: 0; transform: translate(-50%, -46%); } to { opacity: 1; transform: translate(-50%, -50%); } }
  .vl-jg-chamada-anel { position: relative; width: 96px; height: 96px; margin: 0 auto 14px; }
  .vl-jg-chamada-anel::before, .vl-jg-chamada-anel::after { content: ''; position: absolute; inset: 0; border-radius: 50%; border: 2px solid #d6f24a; animation: vl-jg-onda 1.6s ease-out infinite; }
  .vl-jg-chamada-anel::after { animation-delay: .8s; }
  @keyframes vl-jg-onda { from { transform: scale(1); opacity: .85; } to { transform: scale(1.6); opacity: 0; } }
  .vl-jg-chamada-foto { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #2d3a52, #171d29);
    box-shadow: 0 0 0 4px #1c2331; color: #d6f24a; font: 700 34px/1 system-ui, sans-serif; }
  .vl-jg-chamada-foto img { position: absolute; width: 90px; height: 130px; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(2); image-rendering: pixelated; }
  .vl-jg-chamada-jogo { position: absolute; z-index: 1; right: -6px; bottom: -6px; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 22px;
    background: radial-gradient(circle at 35% 30%, #f3ffb0, #d6f24a 55%, #8fae1c); color: #1b2207; box-shadow: 0 0 0 3px #10131b, 0 0 14px rgba(214,242,74,.5); }
  .vl-jg-chamada b { display: block; font-size: 17px; margin-bottom: 4px; }
  .vl-jg-chamada p { margin: 0; color: #aab5c7; }
  .vl-jg-chamada .vl-jg-acoes { justify-content: center; gap: 12px; margin-top: 18px; }
  .vl-jg-chamada .vl-jg-botao { min-width: 96px; }
  .vl-jg-botao.recusar { background: #d83c47; border-color: #d83c47; color: #fff; }
  .vl-jg-botao.aceitar { background: #3ba55c; border-color: #3ba55c; color: #fff; }
  .vl-jg-botao.recusar:hover, .vl-jg-botao.aceitar:hover { filter: brightness(1.1); }
  .vl-jg-pagina { display: flex; flex-direction: column; gap: 12px; }
  .vl-jg-lista { display: flex; flex-direction: column; gap: 10px; }
  .vl-jg-lista .vl-jg-cartao { width: 100%; }
  .vl-jg-cartao .vl-jg-jogar { margin-left: auto; flex: none; }
  .vl-jg-cartao.embreve { cursor: default; border-style: dashed; opacity: .78; }
  .vl-jg-cartao.embreve:hover { transform: none; border-color: rgba(255,255,255,.1); }
  .vl-jg-mais { width: 54px; height: 54px; flex: none; border-radius: 10px; display: grid; place-items: center; font-size: 30px; color: #d6f24a; border: 1px dashed rgba(214,242,74,.5); }
  .vl-jg-mini.pingpong { background: linear-gradient(90deg, transparent 47%, #eef2f6 47% 53%, transparent 53%), linear-gradient(180deg, #2d74bd, #1a4c82); -webkit-text-stroke: 0; text-shadow: 0 2px 3px rgba(0,0,0,.35); font-size: 28px; }
  .vl-pp { display: flex; flex-direction: column; gap: 10px; outline: none; }
  .vl-pp-placar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
  .vl-pp-jogador { display: flex; align-items: center; gap: 9px; padding: 8px 12px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); min-width: 0; }
  .vl-pp-jogador.eu { border-color: rgba(214,242,74,.45); background: rgba(214,242,74,.08); }
  .vl-pp-jogador .nome { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .vl-pp-jogador.ele .nome { text-align: right; }
  .vl-pp-pontos { font: 800 28px/1 system-ui, 'Segoe UI', sans-serif; color: #f2ffc0; min-width: 34px; text-align: center; font-variant-numeric: tabular-nums; }
  .vl-pp-saque { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .vl-pp-saque.ativo { background: radial-gradient(circle at 35% 35%, #fff, #ff9b3d); box-shadow: 0 0 8px rgba(255,155,61,.8); }
  .vl-pp-meio { color: #9aa6b8; font-size: 12px; text-transform: uppercase; letter-spacing: .6px; }
  .vl-pp-mesa { width: min(100%, calc((100vh - 330px) * 1.6)); margin: 0 auto; border-radius: 14px; background: radial-gradient(ellipse at 50% 40%, #232a3a, #121620 70%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
  .vl-pp-canvas { display: block; width: 100%; aspect-ratio: 16 / 10; cursor: none; touch-action: none; }
  .vl-pp-estado { padding: 9px 12px; border-radius: 12px; background: rgba(0,0,0,.25); font-weight: 600; color: #f2ffc0; text-align: center; min-height: 18px; }
  .vl-pp-dica { margin: 0; color: #8a96a8; font-size: 12px; text-align: center; }
  .vl-pp:focus-visible .vl-pp-mesa { box-shadow: 0 0 0 2px rgba(214,242,74,.6); }
  .vl-pp-acoes { justify-content: center; }
  .vl-jg-cab .vl-jg-voltar { font-size: 20px; line-height: 1; }
  .vl-jg-sala { display: flex; flex-direction: column; gap: 14px; }
  .vl-jg-heroi { position: relative; display: flex; gap: 18px; align-items: center; padding: 18px 20px; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); background: linear-gradient(120deg, rgba(214,242,74,.16), rgba(214,242,74,0) 60%), #151a25; }
  .vl-jg-heroi.xadrez { background: linear-gradient(120deg, rgba(116,149,78,.42), rgba(116,149,78,0) 62%), #151a25; }
  .vl-jg-heroi.damas { background: linear-gradient(120deg, rgba(150,104,62,.45), rgba(150,104,62,0) 62%), #151a25; }
  .vl-jg-heroi.pingpong { background: linear-gradient(120deg, rgba(45,116,189,.5), rgba(45,116,189,0) 62%), #151a25; }
  .vl-jg-heroi::after { content: ''; position: absolute; right: -60px; top: -70px; width: 240px; height: 240px; border-radius: 50%; background: radial-gradient(circle, rgba(214,242,74,.16), transparent 66%); pointer-events: none; }
  .vl-jg-arte { position: relative; z-index: 1; width: 86px; height: 86px; flex: none; border-radius: 20px; display: grid; place-items: center; font-size: 54px; color: #fff; -webkit-text-stroke: 1.6px #1d2330; text-shadow: 0 3px 4px rgba(0,0,0,.4);
    background: conic-gradient(#e8edd0 0 25%, #74954e 0 50%, #e8edd0 0 75%, #74954e 0) 0 0 / 43px 43px; box-shadow: 0 12px 26px rgba(0,0,0,.45), 0 0 0 3px rgba(255,255,255,.08); }
  .vl-jg-arte.damas { background: conic-gradient(#efe6cf 0 25%, #7b5a3d 0 50%, #efe6cf 0 75%, #7b5a3d 0) 0 0 / 43px 43px; }
  .vl-jg-arte.pingpong { background: linear-gradient(90deg, transparent 47%, #eef2f6 47% 53%, transparent 53%), linear-gradient(180deg, #2d74bd, #1a4c82); -webkit-text-stroke: 0; font-size: 46px; }
  .vl-jg-heroi-texto { position: relative; z-index: 1; min-width: 0; }
  .vl-jg-heroi h2 { margin: 0 0 4px; font-size: 24px; letter-spacing: .2px; color: #fff; }
  .vl-jg-heroi p { margin: 0 0 10px; color: #b9c4d6; max-width: 48ch; }
  .vl-jg-fatos { display: flex; flex-wrap: wrap; gap: 6px; }
  .vl-jg-fato { font-size: 11.5px; padding: 3px 10px; border-radius: 999px; background: rgba(255,255,255,.07); color: #e3e9f3; border: 1px solid rgba(255,255,255,.08); white-space: nowrap; }
  .vl-jg-fato::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #d6f24a; margin-right: 6px; vertical-align: 1px; box-shadow: 0 0 6px rgba(214,242,74,.8); }
  .vl-jg-trocar { position: absolute; z-index: 1; right: 14px; top: 12px; border: 0; background: none; color: #d6f24a; cursor: pointer; font: 600 12px system-ui, sans-serif; opacity: .85; }
  .vl-jg-trocar:hover { opacity: 1; text-decoration: underline; }
  .vl-jg-colunas { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 14px; align-items: stretch; }
  .vl-jg-bloco { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08); min-width: 0; }
  .vl-jg-bloco-cab { display: flex; align-items: center; gap: 10px; }
  .vl-jg-bloco-cab .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; font-size: 17px; background: rgba(214,242,74,.14); box-shadow: inset 0 0 0 1px rgba(214,242,74,.25); }
  .vl-jg-bloco-cab h3 { margin: 0; font-size: 15px; letter-spacing: 0; text-transform: none; color: #eef3fa; }
  .vl-jg-rotulo { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #8f9bb0; margin-bottom: -4px; }
  .vl-jg-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3px; padding: 3px; border-radius: 12px; background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.06); }
  .vl-jg-seg button { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 6px; border: 0; border-radius: 9px; background: transparent; color: #c6d0e0; font: 600 12.5px system-ui, sans-serif; cursor: pointer; white-space: nowrap; min-width: 0; }
  .vl-jg-seg button:hover { background: rgba(255,255,255,.06); color: #fff; }
  .vl-jg-seg button[aria-pressed="true"] { background: #d6f24a; color: #1a2108; box-shadow: 0 2px 10px rgba(214,242,74,.3); }
  .vl-jg-peao { width: 10px; height: 10px; border-radius: 50%; flex: none; box-shadow: 0 0 0 1.5px rgba(0,0,0,.45); }
  .vl-jg-peao.w { background: #fffdf4; } .vl-jg-peao.b { background: #22262f; box-shadow: 0 0 0 1.5px rgba(255,255,255,.35); } .vl-jg-peao.s { background: linear-gradient(90deg, #fffdf4 50%, #22262f 50%); }
  .vl-jg-botao.grande { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 14px; border-radius: 12px; font-size: 14px; margin-top: auto; }
  .vl-jg-gente { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow: auto; padding-right: 2px; }
  .vl-jg-linha-pessoa { display: flex; align-items: center; gap: 10px; padding: 7px 8px 7px 10px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid transparent; transition: border-color .12s, background .12s; }
  .vl-jg-linha-pessoa:hover { border-color: rgba(214,242,74,.25); background: rgba(214,242,74,.05); }
  .vl-jg-linha-pessoa .quem { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .vl-jg-linha-pessoa .quem b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .vl-jg-linha-pessoa .quem small { color: #8f9bb0; font-size: 11px; display: flex; align-items: center; gap: 5px; }
  .vl-jg-linha-pessoa .quem small::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #3ba55c; }
  .vl-jg-linha-pessoa .vl-jg-botao { padding: 6px 12px; font-size: 12px; }
  .vl-jg-vazio { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 20px 12px; color: #8f9bb0; text-align: center; border-radius: 12px; border: 1px dashed rgba(255,255,255,.12); }
  .vl-jg-vazio b { color: #d3dbe8; font-size: 13px; }
  .vl-jg-bloco .vl-jg-nota { margin: 0; font-size: 11.5px; }
  .vl-jg-rodape { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: 14px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); color: #9aa6b8; font-size: 12px; }
  .vl-jg-rodape .vl-jg-seg { flex: 0 1 300px; }
  .vl-jg-vel .vl-jg-seg { flex: 1; }
  @media (max-width: 720px) { .vl-jg-partida { flex-direction: column; align-items: center; } .vl-jg-colunas { grid-template-columns: 1fr; } .vl-jg-trocar { position: static; } .vl-jg-heroi { flex-wrap: wrap; } }
  .vl-jg-casa.pre::before { content: ''; position: absolute; inset: 0; background: rgba(90,160,255,.45); box-shadow: inset 0 0 0 3px rgba(160,205,255,.9); }
  .vl-jg-casa.presel::before { content: ''; position: absolute; inset: 0; background: rgba(90,160,255,.6); }
  .vl-jg-setas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; overflow: visible; }
  .vl-jg-revisao { display: flex; gap: 4px; align-items: center; }
  .vl-jg-revisao button { flex: 1; min-width: 0; padding: 5px 0; border-radius: 8px; border: 1px solid rgba(214,242,74,.25); background: rgba(0,0,0,.25); color: #e9eef7; font: 600 14px system-ui, sans-serif; cursor: pointer; }
  .vl-jg-revisao button:hover:not(:disabled) { border-color: #d6f24a; color: #d6f24a; }
  .vl-jg-revisao button:disabled { opacity: .35; cursor: default; }
  .vl-jg-revendo { font: 600 12px system-ui, sans-serif; color: #9fc4ff; text-align: center; }
  .vl-jg-lances span[data-ply] { cursor: pointer; border-radius: 4px; padding: 0 3px; } .vl-jg-lances span[data-ply]:hover { background: rgba(214,242,74,.15); }
  .vl-jg-lances .vendo { background: rgba(90,160,255,.35); color: #fff; }
  .vl-jg-festa { position: absolute; inset: 0; z-index: 40; pointer-events: none; overflow: hidden; border-radius: inherit; }
  .vl-jg-festa canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .vl-jg-festa-faixa { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); text-align: center; animation: vl-jg-faixa 3.6s cubic-bezier(.2,1.4,.4,1) forwards; }
  .vl-jg-festa-faixa b { display: block; font: 900 56px system-ui, sans-serif; letter-spacing: 2px; color: #d6f24a; text-shadow: 0 0 18px rgba(214,242,74,.9), 0 0 42px rgba(214,242,74,.5), 0 4px 0 #2c3a06; }
  .vl-jg-festa-faixa small { display: block; margin-top: 6px; font: 700 15px system-ui, sans-serif; color: #fff; text-shadow: 0 2px 6px #000; }
  .vl-jg-festa.perdeu .vl-jg-festa-faixa b { color: #c9d1e0; text-shadow: 0 0 14px rgba(120,140,170,.6), 0 4px 0 #1a2030; }
  .vl-jg-festa.empate .vl-jg-festa-faixa b { color: #ffe27a; text-shadow: 0 0 14px rgba(255,220,100,.6), 0 4px 0 #3a3006; }
  @keyframes vl-jg-faixa { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 12% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); } 20% { transform: translate(-50%, -50%) scale(1); } 82% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%) scale(1); } }
  @media (prefers-reduced-motion: reduce) { .vl-jg-festa-faixa { animation: none; } }
  @media (prefers-reduced-motion: reduce) { .vl-jg-peca.nova, .vl-jg-disco.nova, .vl-jg-chamada, .vl-jg-chamada-anel::before, .vl-jg-chamada-anel::after { animation: none; } }
  `;

  // Som curto de lance (Web Audio, bem baixo).
  let audio = null;
  function tocar(captura) {
    try {
      audio = audio || new (raiz.AudioContext || raiz.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = captura ? 220 : 520;
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(captura ? 0.12 : 0.08, audio.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (captura ? 0.18 : 0.09));
      o.connect(g).connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.2);
    } catch (e) { /* sem som */ }
  }
  // Notas curtas em sequência (ping-pong): [[frequência, duração], …].
  function bipes(notas, volume) {
    try {
      audio = audio || new (raiz.AudioContext || raiz.webkitAudioContext)();
      let t = audio.currentTime;
      for (const [f, d] of notas) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(volume || 0.08, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(audio.destination);
        o.start(t); o.stop(t + d + 0.02);
        t += d * 0.9;
      }
    } catch (e) { /* sem som */ }
  }
  // Fanfarra do fim da partida: vitória sobe num acorde brilhante com eco; derrota desce; empate fica no meio.
  function fanfarra(resultado) {
    try {
      audio = audio || new (raiz.AudioContext || raiz.webkitAudioContext)();
      const a = audio, t0 = a.currentTime + 0.02;
      const saida = a.createGain(); saida.gain.value = 0.9;
      const eco = a.createDelay(); eco.delayTime.value = 0.18;
      const volta = a.createGain(); volta.gain.value = 0.28;
      saida.connect(a.destination); saida.connect(eco); eco.connect(volta); volta.connect(eco); volta.connect(a.destination);
      const nota = (f, ini, dur, vol, tipo) => {
        for (const [mult, v, tp] of [[1, 1, tipo || 'triangle'], [2, 0.25, 'sine'], [1.003, 0.4, 'sawtooth']]) {
          const o = a.createOscillator(), g = a.createGain();
          o.type = tp; o.frequency.value = f * mult;
          const pico = vol * v * (tp === 'sawtooth' ? 0.18 : 1);
          g.gain.setValueAtTime(0.0001, t0 + ini);
          g.gain.exponentialRampToValueAtTime(pico, t0 + ini + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + dur);
          o.connect(g).connect(saida);
          o.start(t0 + ini); o.stop(t0 + ini + dur + 0.05);
        }
      };
      if (resultado === 'venceu') {
        [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.33]].forEach(([f, i]) => nota(f, i, 0.22, 0.07));
        [1047, 1319, 1568, 2093].forEach((f, k) => nota(f, 0.5 + k * 0.012, 1.3, 0.05));
        [2637, 3136, 3520, 2637, 3951].forEach((f, k) => nota(f, 0.62 + k * 0.09, 0.12, 0.02, 'sine')); // brilhinhos
      } else if (resultado === 'perdeu') {
        [[392, 0], [330, 0.2], [262, 0.4]].forEach(([f, i]) => nota(f, i, 0.35, 0.05, 'sine'));
        nota(196, 0.62, 0.9, 0.045, 'sine');
      } else {
        [[440, 0], [554, 0.16]].forEach(([f, i]) => nota(f, i, 0.3, 0.05));
        nota(659, 0.34, 0.8, 0.045);
      }
    } catch (e) { /* sem som */ }
  }
  // Fogos de vagalumes sobre a janela do jogo (só na vitória); a faixa aparece em qualquer fim.
  function festejarEm(janela, resultado, titulo, sub) {
    const velha = janela.querySelector('.vl-jg-festa');
    if (velha) velha.remove();
    const camadaFesta = el('div', { class: 'vl-jg-festa ' + resultado, 'aria-hidden': 'true' });
    const faixa = el('div', { class: 'vl-jg-festa-faixa' }, [el('b', { texto: titulo }), sub ? el('small', { texto: sub }) : null]);
    let parado = false;
    try { parado = raiz.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sem matchMedia */ }
    if (resultado === 'venceu' && !parado) {
      const tela = el('canvas');
      camadaFesta.appendChild(tela);
      const w = tela.width = janela.clientWidth || 800, h = tela.height = janela.clientHeight || 600;
      const g = tela.getContext('2d');
      const cores = ['#d6f24a', '#f2ffb0', '#ffe27a', '#ffffff', '#9dff7a', '#ffb4e6'];
      const pts = [];
      const explodir = (x, y) => {
        const cor = cores[Math.floor(Math.random() * cores.length)];
        for (let k = 0; k < 46; k++) {
          const ang = (k / 46) * Math.PI * 2 + Math.random() * 0.2, v = 1.6 + Math.random() * 3.4;
          pts.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 1, cor: Math.random() < 0.25 ? '#ffffff' : cor, r: 1.4 + Math.random() * 1.8 });
        }
      };
      const tiros = [];
      for (let k = 0; k < 7; k++) tiros.push({ quando: k * 330 + Math.random() * 120, x: w * (0.15 + Math.random() * 0.7), y: h * (0.15 + Math.random() * 0.35) });
      const inicio = performance.now();
      let ultimo = inicio;
      const quadro = (agora) => {
        if (!camadaFesta.isConnected) return;
        const dt = Math.min(3, (agora - ultimo) / 16.7); ultimo = agora;
        const passou = agora - inicio;
        while (tiros.length && tiros[0].quando <= passou) { const x = tiros.shift(); explodir(x.x, x.y); }
        if (passou < 3000 && Math.random() < 0.35 * dt) pts.push({ x: Math.random() * w, y: h + 4, vx: (Math.random() - 0.5) * 0.6, vy: -1.2 - Math.random() * 1.6, vida: 1, cor: '#d6f24a', r: 1.5 + Math.random() * 1.5, sobe: true });
        g.clearRect(0, 0, w, h);
        g.globalCompositeOperation = 'lighter';
        for (let k = pts.length - 1; k >= 0; k--) {
          const p = pts[k];
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (!p.sobe) { p.vy += 0.06 * dt; p.vx *= 0.985; p.vy *= 0.985; }
          p.vida -= (p.sobe ? 0.006 : 0.012) * dt;
          if (p.vida <= 0) { pts.splice(k, 1); continue; }
          const brilho = p.sobe ? 0.5 + 0.5 * Math.sin(agora / 120 + k) : 1;
          g.globalAlpha = Math.max(0, p.vida) * brilho;
          g.fillStyle = p.cor;
          g.shadowColor = p.cor; g.shadowBlur = 10;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
        }
        if (passou < 4200 || pts.length) raiz.requestAnimationFrame(quadro);
      };
      raiz.requestAnimationFrame(quadro);
    }
    camadaFesta.appendChild(faixa);
    janela.appendChild(camadaFesta);
    setTimeout(() => camadaFesta.remove(), 4300);
  }
  const SONS_PP = { bate: [[1175, 0.05]], mesa: [[700, 0.03]], rede: [[180, 0.09]], saque: [[880, 0.06]], ponto: [[392, 0.12], [294, 0.18]], fim: [[523, 0.11], [659, 0.11], [784, 0.22]] };
  const novaSessao = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const sessaoValida = (s) => /^(?:[a-f0-9]{16}|9\d{11})$/.test(String(s || '')); // partida no quarto ou sala com um amigo
  const novoCanal = () => '9' + Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => String(n % 10000).padStart(4, '0')).join('').slice(0, 11);
  // Pedido à sala da extensão (página de bastidores), que fala com o servidor do Vagalume.
  function sala(tipo, dado) {
    return chrome.runtime.sendMessage(Object.assign({ tipo: 'sala:' + tipo }, dado || {})).then(function (r) {
      if (r && r.erro) throw new Error(r.erro);
      return r;
    });
  }
  const nomeChave = (n) => String(n || '').trim().toLowerCase();

  // Regras de cada jogo atrás da mesma cara.
  const glifoDe = (id) => { const j = JOGOS.find((x) => x.id === id); return j ? j.glifo + (j.emoji ? '' : VS) : ''; };
  // Ícone do jogo: a peça desenhada nas damas, o símbolo nos outros.
  const iconeJogo = (id) => (id === 'damas' ? el('span', { class: 'vl-jg-dama' }) : document.createTextNode(glifoDe(id)));
  const REGRAS = {
    xadrez: {
      novo: X.novo, jogar: X.jogar, lances: X.lances, situacao: X.situacao, melhor: X.melhorLance,
      texto: X.uci, lanceDe: X.lanceDe, posicao: X.paraFen, dePosicao: X.deFen,
      nota: (e, m) => X.notacao(e, m), captura: (m) => !!m.captura,
      ultimo: (m) => (m ? [m.de, m.para] : []),
      motivoFim(st, minhaCor, modo) {
        if (st.vencedor) return (st.vencedor === minhaCor ? 'Você venceu' : modo === 'bot' ? 'O bot venceu' : 'Você perdeu') + ' por ' + st.motivo + '.';
        return 'Empate: ' + st.motivo + '.';
      },
    },
    damas: {
      novo: D.novo, jogar: D.jogar, lances: D.lances, situacao: D.situacao, melhor: D.melhorLance,
      texto: D.texto, lanceDe: D.lanceDe, posicao: D.paraTexto, dePosicao: D.deTexto,
      nota: (e, m) => D.texto(m) + (m.promove ? ' ♛' : ''), captura: (m) => m.capturas.length > 0,
      ultimo: (m) => (m ? m.caminho : []),
      motivoFim(st, minhaCor, modo) {
        if (st.vencedor) return (st.vencedor === minhaCor ? 'Você venceu' : modo === 'bot' ? 'O bot venceu' : 'Você perdeu') + ' (' + st.motivo + ').';
        return 'Empate: ' + st.motivo + '.';
      },
    },
  };

  nucleo.definirModulo({
    id: 'jogos',
    iniciar(ctx) {
      // Mesa de jogos para mais pessoas (Corrida de Digitação e os próximos): conteudo/mesa.js.
      const mesaApi = VL.mesa ? VL.mesa.iniciar(ctx, {
        voltar: () => abrirHub(),
        cabeca: (nome) => cabeca(nome),
        // Fim da partida na mesa: a mesma festa e a mesma fanfarra do xadrez e das damas.
        festa(alvo, resultado, titulo, sub) { if (ctx.secao().som !== false) fanfarra(resultado); festejarEm(alvo, resultado, titulo, sub); },
      }) : null;
      // ---------- tabuleiros no quarto e os dois cliques ----------
      const tabuleiros = new Set(); // ids dos tabuleiros do quarto atual
      const marcar = (m) => { if (m && TABULEIROS.has(m.tipo)) tabuleiros.add(m.id); };
      let abertoEm = 0;
      ctx.aoParar(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { tabuleiros.clear(); }));
      ctx.aoParar(conexao.ouvir('entrada', ENTRADA.MOBIS_DO_QUARTO, function (l) { try { codigos.lerMobisDoQuarto(l).mobis.forEach(marcar); } catch (e) { /* lista em outro formato */ } }));
      ctx.aoParar(conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, function (l) { try { marcar(codigos.lerMobi(l, true)); } catch (e) { /* outro formato */ } }));
      ctx.aoParar(conexao.ouvir('entrada', ENTRADA.MOBI_RETIRADO, function (l) { try { tabuleiros.delete(Number(l.texto())); } catch (e) { /* outro formato */ } }));
      ctx.aoParar(conexao.ouvir('saida', SAIDA.USAR_MOBI, function (l) {
        const id = l.inteiro();
        if (!tabuleiros.has(id) || Date.now() - abertoEm < 800) return;
        abertoEm = Date.now();
        if (escolha.jogo !== 'damas' && (!partida || partida.fim)) escolha.jogo = 'xadrez';
        abrir();
      }));

      // ---------- janela ----------
      let janela = null, corpo = null, minimizada = false;
      let escolha = { jogo: 'xadrez', nivel: 'medio', cor: 'w', ritmo: 'livre' };
      let partida = null;   // a partida em andamento (ver comecar)
      let convidando = null; // convite que eu mandei: { via, nome, id, sessao, jogo, cor, amigo, relogio }
      let chamada = null;    // convite recebido na tela: { sessao, cartao, relogio, pararToque }
      // Um estilo só para a janela, o cartão de convite e a aba Jogos.
      const estilo = el('style', { texto: CSS });
      camada.area().appendChild(estilo);
      ctx.aoParar(() => estilo.remove());
      // Velocidade das animações (pedido do usuário: rápida ou um pouco mais lenta). A escolha feita aqui vale na
      // hora, antes de a gravação voltar do armazenamento.
      let velocidadePedida = null;
      function velocidade() {
        const gravada = ctx.secao().velocidade === 'rapida' ? 'rapida' : 'lenta';
        if (velocidadePedida && velocidadePedida !== gravada) return velocidadePedida;
        velocidadePedida = null;
        return gravada;
      }
      const tempos = () => (velocidade() === 'rapida' ? { casa: 190, pausa: 250 } : { casa: 300, pausa: 600 });
      function escolherVelocidade(v) {
        velocidadePedida = v;
        ctx.alterar('jogos', { velocidade: v }).catch(function () { velocidadePedida = null; camada.aviso('Não consegui gravar a velocidade.', { tipo: 'erro' }); });
        desenhar();
      }
      // Som e velocidade são lidos a cada uso: mudar o ajuste só redesenha (sem reiniciar o módulo e perder a partida).
      ctx.aoConfig(function (secao) { if (secao === 'jogos') desenhar(); });
      const seletorVelocidade = (curto) => segmento('Velocidade das jogadas', [['lenta', curto ? 'Mais lenta' : 'Um pouco mais lenta'], ['rapida', 'Rápida']], velocidade(), escolherVelocidade, 'vel');
      function linhaVelocidade() { return el('div', { class: 'vl-jg-vel' }, [el('span', { texto: 'Animação:' }), seletorVelocidade(true)]); }

      function abrir() {
        if (!janela) montarJanela();
        janela.style.display = '';
        if (minimizada) alternarMinimizada();
        desenhar();
        janela.focus();
      }
      function fechar() {
        if (partida && partida.modo === 'rede' && !partida.fim) enviar({ t: 'jg:fim', m: 'saiu' });
        partida = null;
        if (convidando) cancelarConvite();
        sairDoCanal();
        if (janela) janela.style.display = 'none';
      }
      function alternarMinimizada() {
        minimizada = !minimizada;
        janela.classList.toggle('minimizada', minimizada);
        const b = janela.querySelector('.vl-jg-min');
        b.textContent = minimizada ? '□' : '−';
        b.title = minimizada ? 'Restaurar' : 'Minimizar';
      }
      function montarJanela() {
        const cab = el('div', { class: 'vl-jg-cab' }, [
          el('button', { type: 'button', class: 'vl-jg-voltar', title: 'Todos os jogos', 'aria-label': 'Todos os jogos', texto: '‹', onclick: voltarAosJogos }),
          el('span', { class: 'vl-jg-ic', 'aria-hidden': 'true', texto: '♞' + VS }),
          el('b', { class: 'vl-jg-titulo', texto: 'Jogos' }), el('span', { class: 'vl-jg-esp' }),
          el('button', { type: 'button', class: 'vl-jg-min', title: 'Minimizar', 'aria-label': 'Minimizar', texto: '−', onclick: alternarMinimizada }),
          el('button', { type: 'button', title: 'Fechar', 'aria-label': 'Fechar', texto: '×', onclick: fechar }),
        ]);
        corpo = el('div', { class: 'vl-jg-corpo' });
        janela = el('div', { class: 'vl-jg', role: 'dialog', 'aria-label': 'Jogos do Vagalume', tabindex: '0' }, [cab, corpo]);
        janela.addEventListener('keydown', function (ev) {
          if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && partida && partida.jogo !== 'pingpong' && !/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) {
            ev.preventDefault(); ev.stopPropagation();
            const p = partida, atual = p.ver != null ? p.ver : p.historico.length;
            verLance(atual + (ev.key === 'ArrowLeft' ? -1 : 1));
            return;
          }
          if (ev.key === 'Escape') { ev.stopPropagation(); if (partida && partida.promocao) { partida.promocao = null; desenhar(); } else fechar(); } });
        cab.addEventListener('dblclick', function (ev) { if (!ev.target.closest('button')) alternarMinimizada(); });
        cab.addEventListener('pointerdown', function (ev) {
          if (ev.button !== 0 || ev.target.closest('button')) return;
          const r = janela.getBoundingClientRect();
          const x0 = ev.clientX, y0 = ev.clientY, l0 = r.left, t0 = r.top;
          cab.setPointerCapture(ev.pointerId);
          const mover = (e) => {
            janela.style.transform = 'none';
            janela.style.left = Math.max(0, Math.min(innerWidth - janela.offsetWidth, l0 + e.clientX - x0)) + 'px';
            janela.style.top = Math.max(0, Math.min(innerHeight - 44, t0 + e.clientY - y0)) + 'px';
          };
          const fim = () => { cab.removeEventListener('pointermove', mover); cab.removeEventListener('pointerup', fim); cab.removeEventListener('pointercancel', fim); };
          cab.addEventListener('pointermove', mover); cab.addEventListener('pointerup', fim); cab.addEventListener('pointercancel', fim);
        });
        camada.area().appendChild(janela);
      }
      ctx.aoParar(function () { if (janela) janela.remove(); janela = null; fecharChamada(); });

      function desenhar() {
        if (partida && partida.animando) return; // a tela é refeita quando a peça pousa
        pintar();
      }
      function pintar() {
        if (!janela) return;
        const jogo = partida ? partida.jogo : escolha.jogo;
        janela.classList.toggle('damas', jogo === 'damas');
        janela.querySelector('.vl-jg-titulo').textContent = jogo ? NOMES[jogo] : 'Jogos';
        janela.querySelector('.vl-jg-ic').replaceChildren(jogo ? iconeJogo(jogo) : document.createTextNode('🎮'));
        janela.querySelector('.vl-jg-voltar').hidden = !jogo || !!(partida && !partida.fim);
        camada.trocar(corpo, partida ? (partida.jogo === 'pingpong' ? telaPingPong() : telaPartida()) : jogo ? telaInicio() : telaHub());
        if (partida && partida.fim && !partida.festejado && !partida.animando) { partida.festejado = true; festejar(partida); }
      }
      function festejar(p) {
        const v = p.fim.vencedor;
        const resultado = !v ? 'empate' : v === p.minhaCor ? 'venceu' : 'perdeu';
        if (ctx.secao().som !== false) fanfarra(resultado);
        if (p.jogo === 'pingpong' || minimizada || janela.style.display === 'none') return; // o ping-pong tem a festa dele na mesa
        const titulo = resultado === 'venceu' ? 'Vitória!' : resultado === 'perdeu' ? (p.modo === 'bot' ? 'O bot venceu' : 'Derrota') : 'Empate';
        festejarEm(janela, resultado, titulo, p.jogo === 'pingpong' ? '' : String(p.fim.motivo || ''));
      }

      // ---------- início: escolher o jogo e o adversário ----------
      // Botões agrupados (um escolhido por vez).
      function segmento(rotulo, opcoes, atual, escolher, foco) {
        return el('div', { class: 'vl-jg-seg', role: 'group', 'aria-label': rotulo }, opcoes.map(([id, texto, enfeite]) => el('button', { type: 'button', 'aria-pressed': String(atual === id), 'data-foco': foco + '-' + id, onclick() { escolher(id); } }, [enfeite || null, el('span', { texto })])));
      }
      // Voltar para a lista de todos os jogos (aba Jogos do painel).
      function voltarAosJogos() {
        if (partida && !partida.fim) return;
        if (partida) sairDaPartida();
        escolha.jogo = null;
        abrir();
      }
      // Lista de todos os jogos (o ícone de controle na barra do hotel abre aqui).
      function abrirHub() {
        if (partida && !partida.fim) { abrir(); return; }
        if (partida) sairDaPartida();
        escolha.jogo = null;
        abrir();
      }
      function telaHub() {
        const cartao = (id, nome, texto, icone, fazer) => el('button', { type: 'button', class: 'vl-jg-cartao', 'aria-label': 'Jogar ' + nome, 'data-foco': 'hub-' + id, onclick: fazer }, [
          el('span', { class: 'vl-jg-mini ' + id, 'aria-hidden': 'true' }, [icone]),
          el('span', null, [el('b', { texto: nome }), el('small', { texto })]),
          el('span', { class: 'vl-jg-botao forte vl-jg-jogar', 'aria-hidden': 'true', texto: 'Jogar' }),
        ]);
        const doisJogadores = JOGOS.map((j) => cartao(j.id, NOMES[j.id], j.texto, iconeJogo(j.id), function () { escolha.jogo = j.id; desenhar(); }));
        const emGrupo = mesaApi ? Object.entries(VL.mesa.JOGOS).map(([id, j]) => cartao(id, j.nome, j.texto, VL.mesa.arte(id), function () { fechar(); mesaApi.abrir(id); })) : [];
        return [el('div', { class: 'vl-jg-hub' }, [
          el('p', { class: 'vl-nota', texto: 'Jogue contra o bot, com quem usa o Vagalume no quarto ou chame um amigo de outro quarto.' }),
          el('h3', { texto: 'Um contra um' }), ...doisJogadores,
          emGrupo.length ? el('h3', { texto: 'Em grupo' }) : null, ...emGrupo,
        ])];
      }
      const fotoDe = (visual) => 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(visual) + '&headonly=1&direction=2&head_direction=3';
      // Visual pelo apelido: de quem está no quarto ou da lista de amigos.
      function visualDe(nome) {
        const v = VL.pessoas && VL.pessoas.visualDe ? VL.pessoas.visualDe(nome) : null;
        if (v && v.visual) return v.visual;
        const a = VL.amigos && VL.amigos.lista ? VL.amigos.lista().find((x) => nomeChave(x.nome) === nomeChave(nome)) : null;
        return (a && a.visual) || '';
      }
      function cabeca(nome, visual) {
        const c = el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: String(nome || '?').charAt(0).toUpperCase() });
        const fig = visual || visualDe(nome);
        if (fig) {
          const img = el('img', { alt: '', src: fotoDe(fig) });
          img.addEventListener('load', () => { c.textContent = ''; c.appendChild(img); });
        }
        return c;
      }
      function vagalumesNoQuarto() {
        const lista = VL.pessoas && VL.pessoas.lista ? VL.pessoas.lista() : [];
        return lista.filter((n) => VL.comunidade && VL.comunidade.usaVagalume && VL.comunidade.usaVagalume(n));
      }
      // ---------- sala do jogo (antes de começar): o jogo escolhido, contra o bot ou com alguém ----------
      const FATOS = {
        xadrez: ['Regras completas', 'Bot em 3 níveis', 'Com amigos de outros quartos'],
        damas: ['Regra brasileira', 'Bot em 3 níveis', 'Com amigos de outros quartos'],
        pingpong: ['Em 3D', 'Efeito na bola', 'Até 11 pontos'],
      };
      let abaPessoas = null; // 'quarto' ou 'amigos' (null: a que tiver gente)
      function amigosOnline() {
        const lista = VL.amigos && VL.amigos.lista ? VL.amigos.lista() : [];
        return lista.filter((a) => a && a.online && a.id != null && a.nome).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
      }
      function linhaPessoa(nome, visual, detalhe, foco, convidarAgora, esperando) {
        return el('div', { class: 'vl-jg-linha-pessoa' }, [
          cabeca(nome, visual),
          el('span', { class: 'quem' }, [el('b', { texto: nome }), el('small', { texto: esperando ? 'Esperando aceitar…' : detalhe })]),
          esperando
            ? el('button', { type: 'button', class: 'vl-jg-botao discreto', 'data-foco': 'cancelar-convite', texto: 'Cancelar', onclick: cancelarConvite })
            : el('button', { type: 'button', class: 'vl-jg-botao', 'data-foco': foco, texto: 'Convidar', onclick: convidarAgora }),
        ]);
      }
      const vazio = (titulo, texto) => el('div', { class: 'vl-jg-vazio' }, [el('b', { texto: titulo }), el('span', { texto })]);
      function telaInicio() {
        const jogo = escolha.jogo, j = JOGOS.find((x) => x.id === jogo) || JOGOS[0], pp = jogo === 'pingpong';
        const noQuarto = vagalumesNoQuarto(), amigos = amigosOnline();
        const aba = abaPessoas || (noQuarto.length || !amigos.length ? 'quarto' : 'amigos');
        const cores = pp ? [['w', 'Eu saco'], ['b', 'O outro'], ['?', 'Sorteio']]
          : [['w', 'Brancas', el('span', { class: 'vl-jg-peao w' })], ['b', 'Pretas', el('span', { class: 'vl-jg-peao b' })], ['?', 'Sorteio', el('span', { class: 'vl-jg-peao s' })]];
        const comQual = escolha.cor === 'b' ? 'pretas' : escolha.cor === '?' ? 'brancas ou as pretas, por sorteio' : 'brancas';
        const lista = aba === 'quarto'
          ? (noQuarto.length ? noQuarto.map((n) => linhaPessoa(n, null, 'Neste quarto', 'conv-' + n, () => convidar({ via: 'quarto', nome: n }), !!(convidando && convidando.via === 'quarto' && nomeChave(convidando.nome) === nomeChave(n))))
            : [vazio('Ninguém com o Vagalume neste quarto', 'Quem usa o Vagalume aparece aqui (precisa da Comunidade Vagalume ligada).')])
          : (amigos.length ? amigos.map((a) => linhaPessoa(a.nome, a.visual, 'Online', 'amigo-' + a.id, () => convidarAmigo(a), !!(convidando && convidando.amigo && convidando.id === String(a.id))))
            : [vazio(VL.amigos ? 'Nenhum amigo online' : 'Amigos desligados', VL.amigos ? 'Quando um amigo entrar no hotel, ele aparece aqui.' : 'Ligue "Amigos e console" nos Ajustes.')]);
        const nota = (aba === 'amigos' ? 'O convite chega no console e toca como uma chamada; cada um joga do seu quarto. ' : '')
          + (pp ? 'Primeiro saque: ' + (escolha.cor === 'b' ? 'de quem é convidado' : escolha.cor === '?' ? 'sorteado' : 'de quem convida') : 'Quem convida joga com as ' + comQual) + '. A outra pessoa precisa usar o Vagalume.';
        return [el('div', { class: 'vl-jg-sala' }, [
          el('div', { class: 'vl-jg-heroi ' + jogo }, [
            el('span', { class: 'vl-jg-arte ' + jogo, 'aria-hidden': 'true' }, [iconeJogo(jogo)]),
            el('div', { class: 'vl-jg-heroi-texto' }, [
              el('h2', { texto: NOMES[jogo] }),
              el('p', { texto: j.texto }),
              el('div', { class: 'vl-jg-fatos' }, FATOS[jogo].map((x) => el('span', { class: 'vl-jg-fato', texto: x }))),
            ]),
            pp ? null : el('button', { type: 'button', class: 'vl-jg-trocar', 'data-foco': 'trocar', texto: (jogo === 'xadrez' ? 'Jogar damas' : 'Jogar xadrez') + ' neste tabuleiro ›', onclick() { escolha.jogo = jogo === 'xadrez' ? 'damas' : 'xadrez'; desenhar(); } }),
          ]),
          jogo === 'xadrez' ? el('div', { class: 'vl-jg-ritmo' }, [el('span', { class: 'vl-jg-rotulo', texto: 'Ritmo' }),
            segmento('Ritmo da partida', RITMOS, escolha.ritmo, (id) => { escolha.ritmo = id; desenhar(); }, 'ritmo')]) : null,
          el('div', { class: 'vl-jg-colunas' }, [
            el('section', { class: 'vl-jg-bloco' }, [
              el('div', { class: 'vl-jg-bloco-cab' }, [el('span', { class: 'ic', 'aria-hidden': 'true', texto: '🤖' }), el('h3', { texto: 'Contra o bot' })]),
              el('span', { class: 'vl-jg-rotulo', texto: 'Nível' }),
              segmento('Nível do bot', NIVEIS, escolha.nivel, (id) => { escolha.nivel = id; desenhar(); }, 'nivel'),
              el('span', { class: 'vl-jg-rotulo', texto: pp ? 'Primeiro saque' : 'Suas peças' }),
              segmento(pp ? 'Primeiro saque' : 'Suas peças', cores, escolha.cor, (id) => { escolha.cor = id; desenhar(); }, 'cor'),
              el('button', { type: 'button', class: 'vl-jg-botao forte grande', 'data-foco': 'bot', onclick() { comecar({ jogo, modo: 'bot', nivel: escolha.nivel, minhaCor: corEscolhida(), ritmo: jogo === 'xadrez' ? escolha.ritmo : 'livre' }); } }, [el('span', { 'aria-hidden': 'true', texto: '▶' }), el('span', { texto: 'Jogar agora' })]),
            ]),
            el('section', { class: 'vl-jg-bloco' }, [
              el('div', { class: 'vl-jg-bloco-cab' }, [el('span', { class: 'ic', 'aria-hidden': 'true', texto: '👥' }), el('h3', { texto: 'Jogar com alguém' })]),
              segmento('Com quem jogar', [['quarto', 'No quarto (' + noQuarto.length + ')'], ['amigos', 'Amigos online (' + amigos.length + ')']], aba, (id) => { abaPessoas = id; desenhar(); }, 'aba'),
              el('div', { class: 'vl-jg-gente' }, lista),
              el('p', { class: 'vl-jg-nota', texto: nota }),
            ]),
          ]),
          pp ? null : el('div', { class: 'vl-jg-rodape' }, [el('span', { texto: 'Animação das jogadas' }), seletorVelocidade()]),
          el('p', { class: 'vl-jg-aviso', role: 'status', hidden: !avisoInicio, texto: avisoInicio || '' }),
        ])];
      }
      let avisoInicio = '';

      // ---------- partida ----------
      function comecar(o) {
        if (o.jogo === 'pingpong') { comecarPingPong(o); return; }
        const regras = REGRAS[o.jogo];
        partida = {
          jogo: o.jogo, modo: o.modo, nivel: o.nivel, minhaCor: o.minhaCor, oponente: o.oponente || null, sessao: o.sessao || null,
          estado: o.posicao ? regras.dePosicao(o.posicao) : regras.novo(), estados: [], historico: [], ultimo: [], sel: null, caminho: null, promocao: null, fim: null,
          ply: 0, tomou: { w: 0, b: 0 }, pendente: null, empateProposto: null, virado: o.minhaCor === 'b', pensando: false,
          via: o.via || 'quarto', oponenteId: o.oponenteId != null ? String(o.oponenteId) : null, animando: false, fila: [], job: null, mostrado: null,
          pre: null, preSel: null, setas: [], circulos: [], ver: null,
          ritmo: o.jogo === 'xadrez' ? ritmoValido(o.ritmo) : 'livre', relogio: null,
        };
        const tempo = TEMPO[partida.ritmo];
        if (tempo) partida.relogio = { w: tempo[0] * 1000, b: tempo[0] * 1000, inc: tempo[1] * 1000, desde: Date.now() };
        avisoInicio = '';
        if (!janela) montarJanela();
        abrir();
        desenhar();
        if (o.modo === 'bot' && partida.estado.vez !== partida.minhaCor) setTimeout(vezDoBot, 400);
      }
      // Ping-pong: a tela (core/pingpong.js e pingpong-tela.js) roda sozinha; aqui ficam a rede, o fim e os botões.
      function comecarPingPong(o) {
        if (!VL.pingPongTela) { camada.aviso('O ping-pong não carregou. Recarregue o hotel.', { tipo: 'erro' }); return; }
        const p = partida = {
          jogo: 'pingpong', modo: o.modo, nivel: o.nivel, minhaCor: o.minhaCor, oponente: o.oponente || null, sessao: o.sessao || null,
          via: o.via || 'quarto', oponenteId: o.oponenteId != null ? String(o.oponenteId) : null, fim: null, historico: [],
          ppSeq: 0, ppRecebido: 0, ppPendentes: new Map(), ppFila: new Map(),
        };
        avisoInicio = '';
        p.pp = VL.pingPongTela.criar({
          minhaCor: o.minhaCor, modo: o.modo, nivel: o.nivel, primeiro: 'w',
          nome: (cor) => nomeDe(cor),
          cabeca: (cor) => (p.modo === 'bot' && cor !== p.minhaCor ? el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: '🤖' }) : cabeca(nomeDe(cor))),
          enviar: (dado, confiavel) => ppEnviar(p, dado, confiavel),
          atraso: () => Math.min(0.25, (p.ppRtt || 0) / 2000),
          som: (tipo) => { if (tipo !== 'fim' && ctx.secao().som !== false && SONS_PP[tipo]) bipes(SONS_PP[tipo], tipo === 'mesa' ? 0.045 : 0.08); },
          vivo: () => partida === p,
          encerrado: () => !!p.fim,
          pausado: () => p.modo === 'bot' && (minimizada || !janela || janela.style.display === 'none'),
          aoFim(vencedor, pontos) { if (partida === p) encerrar({ fim: true, vencedor, motivo: 'por ' + pontos[vencedor] + ' a ' + pontos[vencedor === 'w' ? 'b' : 'w'] }); },
        });
        if (!janela) montarJanela();
        abrir();
        desenhar();
      }
      function telaPingPong() {
        const p = partida;
        const acoes = [];
        if (!p.fim) acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Desistir', onclick: desistir }));
        else acoes.push(el('button', { type: 'button', class: 'vl-jg-botao forte', 'data-foco': 'revanche', texto: p.modo === 'bot' ? 'Jogar de novo' : 'Revanche', onclick: revanche }));
        acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Menu', title: 'Voltar ao menu do jogo', onclick: sairDaPartida }));
        // O placar final já aparece na própria mesa; aqui só o fim por desistência ou saída.
        let fim = null;
        if (p.fim && !/^por /.test(p.fim.motivo || '')) {
          const v = p.fim.vencedor;
          fim = v ? (v === p.minhaCor ? 'Você venceu' : p.modo === 'bot' ? 'O bot venceu' : 'Você perdeu') + ' (' + p.fim.motivo + ').' : 'Partida encerrada: ' + p.fim.motivo + '.';
        }
        return [p.pp.elemento, fim ? el('div', { class: 'vl-jg-estado fim', role: 'status', texto: fim }) : null, el('div', { class: 'vl-jg-acoes vl-pp-acoes' }, acoes)];
      }
      function nomeDe(cor) {
        if (!partida) return '';
        if (cor === partida.minhaCor) return (VL.pessoas && VL.pessoas.eu && VL.pessoas.eu()) || 'Você';
        return partida.modo === 'bot' ? 'Bot ' + NIVEIS.find(([id]) => id === partida.nivel)[1].toLowerCase() : partida.oponente;
      }
      function aplicar(lance, meu, tempoDele) {
        const p = partida;
        const regras = REGRAS[p.jogo];
        const antes = p.estado;
        let sobrou;
        if (p.relogio && !p.fim) {
          const r = p.relogio, agora = Date.now();
          r[antes.vez] = Number.isFinite(tempoDele) && !meu ? Math.max(0, tempoDele) : r[antes.vez] - (agora - r.desde) + r.inc;
          r.desde = agora;
          sobrou = Math.round(r[antes.vez]);
        }
        p.historico.push({ nota: regras.nota(antes, lance), cor: antes.vez, ultimo: regras.ultimo(lance) });
        p.estados.push(antes);
        p.estado = regras.jogar(antes, lance);
        if (lance.capturas) p.tomou[antes.vez] += lance.capturas.length;
        p.sel = null; p.caminho = null; p.promocao = null;
        p.ply++;
        const st = regras.situacao(p.estado);
        if (st.fim) p.fim = st;
        if (meu && p.modo === 'rede') mandarLance(regras.texto(lance), sobrou);
        p.fila.push({ antes, lance, depois: p.estado });
        if (!p.animando) proximaAnimacao(p);
      }

      // ---------- animação dos lances (pedido do usuário: o bot jogava rápido demais para entender) ----------
      // As regras já mudaram; a tela mostra um lance de cada vez: a peça desliza da casa de saída até a de chegada
      // (nas damas, pousando em cada casa do caminho), as tomadas somem quando ela passa e a torre anda no roque.
      // Enquanto anima, ninguém mexe e o bot espera; os lances que chegam no meio entram na fila.
      const naTela = (p, i) => (p.virado ? 63 - i : i); // casa do tabuleiro -> posição na tela
      const distancia = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
      function semMovimento() { try { return raiz.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
      function pecaEl(jogo, peca, nova) {
        if (jogo === 'xadrez') return el('span', { class: 'vl-jg-peca ' + X.corDe(peca) + (nova ? ' nova' : ''), 'aria-hidden': 'true', texto: GLIFO[peca.toLowerCase()] + VS });
        return el('span', { class: 'vl-jg-disco ' + D.corDe(peca) + (nova ? ' nova' : ''), 'aria-hidden': 'true' }, D.ehDama(peca) ? [el('span', { class: 'coroa', texto: '♛' + VS })] : []);
      }
      function fantasma(p, i, peca) {
        const k = naTela(p, i);
        return el('div', { class: 'vl-jg-fantasma', style: 'left:' + (k & 7) * 12.5 + '%;top:' + (k >> 3) * 12.5 + '%' }, [pecaEl(p.jogo, peca)]);
      }
      // O que anda (peça e caminho) e o que sai (casa, peça e em que pulo sai) em cada lance.
      function trechos(p, antes, lance) {
        if (p.jogo === 'damas') return { andam: [{ peca: antes.tab[lance.caminho[0]], caminho: lance.caminho }], saem: lance.capturas.map((i, k) => ({ i, peca: antes.tab[i], pulo: k })) };
        const andam = [{ peca: lance.peca, caminho: [lance.de, lance.para] }];
        if (lance.roque) { const [de, para] = TORRES[lance.roque]; andam.push({ peca: antes.tab[de], caminho: [de, para] }); }
        const tomada = lance.ep ? lance.para + (antes.vez === 'w' ? 8 : -8) : lance.captura ? lance.para : -1;
        return { andam, saem: tomada >= 0 ? [{ i: tomada, peca: antes.tab[tomada], pulo: 0 }] : [] };
      }
      function proximaAnimacao(p) {
        if (partida !== p) return;
        const job = p.fila.shift();
        if (!job) { terminouAnimacao(p); return; }
        const regras = REGRAS[p.jogo], lance = job.lance;
        const capturou = regras.captura(lance);
        const destino = p.jogo === 'xadrez' ? lance.para : lance.caminho[lance.caminho.length - 1];
        const promoveu = p.jogo === 'xadrez' ? !!lance.promo : !!lance.promove;
        const som = ctx.secao().som !== false;
        p.job = job; p.mostrado = job.depois; p.ultimo = regras.ultimo(lance); p.animando = true;
        pintar(); // o tabuleiro já com o lance; as peças que andam ficam escondidas até pousar
        const tab = corpo && corpo.querySelector('.vl-jg-tab');
        if (p.ver != null || !tab || typeof tab.animate !== 'function' || semMovimento() || minimizada || janela.style.display === 'none') {
          if (som) tocar(capturou);
          if (promoveu) p.novaCasa = destino;
          p.job = null;
          proximaAnimacao(p);
          return;
        }
        const t = tempos();
        const { andam, saem } = trechos(p, job.antes, lance);
        // Quando a peça pousa em cada casa do caminho (um pouco mais de tempo para quem vai mais longe).
        const voos = andam.map(function (a) {
          const marcas = [0];
          for (let k = 1; k < a.caminho.length; k++) marcas.push(marcas[k - 1] + t.casa * Math.min(1.5, 0.9 + 0.1 * distancia(a.caminho[k - 1], a.caminho[k])));
          return { a, marcas, total: marcas[marcas.length - 1] };
        });
        const principal = voos[0];
        let fim = Math.max(...voos.map((v) => v.total));
        const anim = el('div', { class: 'vl-jg-anim', 'aria-hidden': 'true' });
        for (const x of saem) {
          const quando = p.jogo === 'damas' ? principal.marcas[x.pulo] + (principal.marcas[x.pulo + 1] - principal.marcas[x.pulo]) * 0.55 : principal.total * 0.6;
          const g = fantasma(p, x.i, x.peca);
          anim.appendChild(g);
          g.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.5)' }], { duration: t.casa * 0.7, delay: quando, easing: 'ease-in', fill: 'forwards' });
          fim = Math.max(fim, quando + t.casa * 0.7);
        }
        voos.forEach(function (v, n) {
          const { a, marcas, total } = v;
          const casa = tab.children[naTela(p, a.caminho[a.caminho.length - 1])];
          const real = casa && casa.querySelector('.vl-jg-peca, .vl-jg-disco');
          if (real) real.classList.add('escondida');
          const g = fantasma(p, a.caminho[0], a.peca);
          g.classList.add('voando');
          anim.appendChild(g);
          const o = naTela(p, a.caminho[0]);
          const ponto = (i) => { const k = naTela(p, i); return [((k & 7) - (o & 7)) * 100, ((k >> 3) - (o >> 3)) * 100]; };
          const alto = p.jogo === 'damas' && lance.capturas.length ? 1.18 : 1.08; // nas capturas das damas a peça pula
          const quadros = [];
          a.caminho.forEach(function (c, k) {
            const [x, y] = ponto(c);
            if (k > 0) {
              const [x0, y0] = ponto(a.caminho[k - 1]);
              quadros.push({ offset: (marcas[k - 1] + marcas[k]) / 2 / total, transform: 'translate(' + (x0 + x) / 2 + '%, ' + (y0 + y) / 2 + '%) scale(' + alto + ')', easing: 'ease-out' });
            }
            quadros.push({ offset: marcas[k] / total, transform: 'translate(' + x + '%, ' + y + '%) scale(1)', easing: 'ease-in' });
          });
          g.animate(quadros, { duration: total, fill: 'forwards' });
          if (n === 0 && som) for (let k = 1; k < marcas.length; k++) setTimeout(function () { if (partida === p && p.job === job) tocar(capturou); }, marcas[k]);
        });
        tab.appendChild(anim);
        p.relogioAnim = setTimeout(function () {
          if (partida !== p || p.job !== job) return;
          p.job = null;
          if (promoveu) p.novaCasa = destino;
          proximaAnimacao(p);
        }, fim + 40);
      }
      function terminouAnimacao(p) {
        p.animando = false;
        p.mostrado = null;
        pintar();
        if (p.pre && minhaVez() && p.ver == null) {
          const pre = p.pre;
          p.pre = null;
          const m = X.lances(p.estado).filter((x) => x.de === pre.de && x.para === pre.para);
          if (m.length) { aplicar(m.find((x) => !x.promo || x.promo.toLowerCase() === 'q') || m[0], true); return; }
          pintar();
        }
        if (!p.fim && p.modo === 'bot' && p.estado.vez !== p.minhaCor) setTimeout(vezDoBot, tempos().pausa);
      }
      function vezDoBot() {
        const p = partida;
        if (!p || p.fim || p.modo !== 'bot' || p.pensando || p.animando || p.estado.vez === p.minhaCor) return;
        p.pensando = true;
        desenhar();
        // Deixa a tela mostrar "Pensando…" antes de calcular (o cálculo segura a página por até ~1,5 s).
        setTimeout(function () {
          if (partida !== p) return;
          p.pensando = false;
          if (p.fim || p.estado.vez === p.minhaCor) { desenhar(); return; }
          const lance = REGRAS[p.jogo].melhor(p.estado, p.nivel);
          if (lance) aplicar(lance, false); else desenhar();
        }, 120);
      }
      function minhaVez() { return partida && !partida.fim && !partida.pensando && !partida.animando && partida.estado.vez === partida.minhaCor && !(partida.modo === 'rede' && partida.pendente && partida.pendente.travado); }

      // Clique numa casa: escolhe a peça e depois o destino (xadrez) ou cada pouso do caminho (damas).
      function clicarCasa(i) {
        const p = partida;
        if (!p || p.ver != null) return;
        if (p.jogo === 'xadrez' && !p.fim && p.estado.vez !== p.minhaCor) { escolherPre(i); return; }
        if (!minhaVez()) return;
        const regras = REGRAS[partida.jogo];
        const todos = regras.lances(partida.estado);
        if (partida.jogo === 'xadrez') {
          if (partida.sel != null) {
            const destinos = todos.filter((m) => m.de === partida.sel && m.para === i);
            if (destinos.length > 1) { partida.promocao = destinos; desenhar(); return; }
            if (destinos.length === 1) { aplicar(destinos[0], true); return; }
          }
          partida.sel = todos.some((m) => m.de === i) ? (partida.sel === i ? null : i) : null;
          desenhar();
          return;
        }
        // Damas: o caminho vai crescendo; quando bate com um lance inteiro (ou só resta um), joga.
        const caminho = partida.caminho;
        if (caminho) {
          const seguem = todos.filter((m) => m.caminho.length > caminho.length && caminho.every((c, k) => m.caminho[k] === c) && m.caminho[caminho.length] === i);
          if (seguem.length) {
            const novo = caminho.concat(i);
            const exato = seguem.find((m) => m.caminho.length === novo.length);
            if (exato && seguem.length === 1) { aplicar(exato, true); return; }
            const restantes = new Set(seguem.map((m) => m.caminho.join(',')));
            if (restantes.size === 1) { aplicar(seguem[0], true); return; }
            partida.caminho = novo;
            desenhar();
            return;
          }
        }
        partida.caminho = todos.some((m) => m.caminho[0] === i) && !(caminho && caminho.length === 1 && caminho[0] === i) ? [i] : null;
        desenhar();
      }

      // Pré-lance (só xadrez): escolhe a peça e a casa enquanto o outro joga; ao chegar a sua vez, ele sai sozinho.
      function escolherPre(i) {
        const p = partida;
        const e = p.mostrado || p.estado;
        const minha = (k) => e.tab[k] && X.corDe(e.tab[k]) === p.minhaCor;
        if (p.preSel != null && i !== p.preSel && !minha(i)) { p.pre = { de: p.preSel, para: i }; p.preSel = null; }
        else if (minha(i) && p.preSel !== i) { p.preSel = i; p.pre = null; }
        else { p.preSel = null; p.pre = null; }
        marcarExtras();
      }
      // Marcas que só existem na sua tela: pré-lance e setas. Mexem só nas classes e no desenho por cima do tabuleiro,
      // então funcionam também no meio da animação.
      function marcarExtras() {
        const p = partida;
        const tab = corpo && corpo.querySelector('.vl-jg-tab');
        if (!p || !tab) return;
        for (let i = 0; i < 64; i++) {
          const c = tab.children[naTela(p, i)];
          if (!c || !c.classList.contains('vl-jg-casa')) continue;
          c.classList.toggle('pre', !!p.pre && (p.pre.de === i || p.pre.para === i));
          c.classList.toggle('presel', p.preSel === i);
        }
        let svg = tab.querySelector('.vl-jg-setas');
        if (!svg) {
          svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'vl-jg-setas');
          svg.setAttribute('viewBox', '0 0 8 8');
          tab.appendChild(svg);
        }
        const ns = 'http://www.w3.org/2000/svg';
        const novo = (tag, at) => { const n = document.createElementNS(ns, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };
        const centro = (i) => { const k = naTela(p, i); return [(k & 7) + 0.5, (k >> 3) + 0.5]; };
        const filhos = [];
        const defs = novo('defs', {});
        const ponta = novo('marker', { id: 'vl-jg-ponta', viewBox: '0 0 4 4', refX: '1.6', refY: '2', markerWidth: '3.2', markerHeight: '3.2', orient: 'auto' });
        ponta.appendChild(novo('path', { d: 'M0,0 L4,2 L0,4 Z', fill: 'rgba(255,170,0,.85)' }));
        defs.appendChild(ponta);
        filhos.push(defs);
        for (const i of p.circulos) { const [x, y] = centro(i); filhos.push(novo('circle', { cx: x, cy: y, r: '.44', fill: 'none', stroke: 'rgba(255,170,0,.85)', 'stroke-width': '.08' })); }
        for (const a of p.setas) {
          const [x0, y0] = centro(a.de), [x1, y1] = centro(a.para);
          const d = Math.hypot(x1 - x0, y1 - y0), fim = (d - 0.42) / d;
          filhos.push(novo('line', { x1: x0, y1: y0, x2: x0 + (x1 - x0) * fim, y2: y0 + (y1 - y0) * fim, stroke: 'rgba(255,170,0,.8)', 'stroke-width': '.17', 'stroke-linecap': 'round', 'marker-end': 'url(#vl-jg-ponta)' }));
        }
        svg.replaceChildren(...filhos);
      }
      // Botão direito: arrastar de uma casa a outra desenha uma seta; na mesma casa, um círculo. Clique comum apaga.
      function ligarSetas(tab) {
        const casaDe = (ev) => { const c = ev.target.closest && ev.target.closest('[data-i]'); return c ? Number(c.dataset.i) : null; };
        let inicio = null;
        tab.addEventListener('contextmenu', (ev) => ev.preventDefault());
        tab.addEventListener('pointerdown', (ev) => {
          const p = partida;
          if (!p) return;
          if (ev.button === 2) { inicio = casaDe(ev); ev.preventDefault(); return; }
          if (ev.button === 0 && (p.setas.length || p.circulos.length)) { p.setas = []; p.circulos = []; marcarExtras(); }
        });
        tab.addEventListener('pointerup', (ev) => {
          const p = partida;
          if (!p || ev.button !== 2 || inicio == null) return;
          const fim = casaDe(ev), de = inicio;
          inicio = null;
          if (fim == null) return;
          if (p.pre || p.preSel != null) { p.pre = null; p.preSel = null; } // botão direito também cancela o pré-lance
          if (fim === de) {
            const k = p.circulos.indexOf(de);
            if (k >= 0) p.circulos.splice(k, 1); else p.circulos.push(de);
          } else {
            const k = p.setas.findIndex((a) => a.de === de && a.para === fim);
            if (k >= 0) p.setas.splice(k, 1); else p.setas.push({ de, para: fim });
          }
          marcarExtras();
        });
      }
      // Revisão: mostra a posição depois de n lances (null = ao vivo). Só na sua tela.
      function verLance(n) {
        const p = partida;
        if (!p || p.jogo === 'pingpong') return;
        const total = p.historico.length;
        n = n == null ? null : Math.max(0, Math.min(total, n));
        p.ver = n === total ? null : n;
        p.sel = null; p.caminho = null; p.preSel = null;
        if (p.ver == null && p.pre) p.pre = null;
        if (!p.animando) pintar();
        if (p.ver == null && !p.animando && p.pre == null && !p.fim && p.modo === 'bot' && p.estado.vez !== p.minhaCor && !p.pensando) setTimeout(vezDoBot, 200);
      }
      function telaPartida() {
        const p = partida;
        const regras = REGRAS[p.jogo];
        const revendo = p.ver != null;
        const e = revendo ? (p.ver < p.estados.length ? p.estados[p.ver] : p.estado) : p.mostrado || p.estado; // durante a animação, a posição do lance que está na tela
        const ultimoLance = revendo ? (p.ver ? p.historico[p.ver - 1].ultimo || [] : []) : p.ultimo;
        const lado = 'min(448px, calc(100vh - 170px), calc(100vw - 80px))';
        const todos = minhaVez() && !revendo ? regras.lances(e) : [];
        // Casas marcadas: destinos da peça escolhida (xadrez) ou próximos pousos (damas).
        const alvos = new Map();
        if (p.jogo === 'xadrez' && p.sel != null) for (const m of todos) if (m.de === p.sel) alvos.set(m.para, !!m.captura);
        if (p.jogo === 'damas' && p.caminho) for (const m of todos) if (m.caminho.length > p.caminho.length && p.caminho.every((c, k) => m.caminho[k] === c)) alvos.set(m.caminho[p.caminho.length], m.capturas.length > 0);
        const podeMexer = new Set(todos.map((m) => (p.jogo === 'xadrez' ? m.de : m.caminho[0])));
        const reiEmXeque = p.jogo === 'xadrez' && X.emXeque(e) ? e.tab.indexOf(e.vez === 'w' ? 'K' : 'k') : -1;
        const casas = [];
        for (let k = 0; k < 64; k++) {
          const lin = k >> 3, col = k & 7;
          const i = p.virado ? (7 - lin) * 8 + (7 - col) : k;
          const escura = ((i >> 3) + (i & 7)) % 2 === 1;
          const classes = ['vl-jg-casa', escura ? 'escura' : 'clara'];
          if (ultimoLance.includes(i)) classes.push('ultimo');
          if ((p.jogo === 'xadrez' && p.sel === i) || (p.jogo === 'damas' && p.caminho && p.caminho[p.caminho.length - 1] === i)) classes.push('selecionada');
          if (i === reiEmXeque) classes.push('xeque');
          if (alvos.has(i)) classes.push(p.jogo === 'damas' ? 'passo' : 'alvo', alvos.get(i) ? 'come' : 'livre');
          const peca = e.tab[i];
          const filhos = [];
          if (col === 0) filhos.push(el('span', { class: 'vl-jg-coord l', texto: String(8 - (i >> 3)) }));
          if (lin === 7) filhos.push(el('span', { class: 'vl-jg-coord c', texto: 'abcdefgh'[i & 7] }));
          let rotulo = 'abcdefgh'[i & 7] + (8 - (i >> 3));
          if (peca && p.jogo === 'xadrez') {
            const cor = X.corDe(peca), t = peca.toLowerCase();
            filhos.push(pecaEl(p.jogo, peca, p.novaCasa === i));
            rotulo += ', ' + NOME_PECA[t] + ' das ' + COR_NOME[cor];
          } else if (peca) {
            const cor = D.corDe(peca);
            filhos.push(pecaEl(p.jogo, peca, p.novaCasa === i));
            rotulo += ', ' + (D.ehDama(peca) ? 'dama' : 'pedra') + ' das ' + COR_NOME[cor];
          }
          const clicavel = alvos.has(i) || podeMexer.has(i);
          casas.push(el('div', { class: classes.join(' '), 'data-i': String(i), role: 'button', tabindex: clicavel ? '0' : '-1', 'aria-label': rotulo, onclick() { clicarCasa(i); },
            onkeydown(ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); clicarCasa(i); } } }, filhos));
        }
        p.novaCasa = null;
        const tab = el('div', { class: 'vl-jg-tab', style: '--lado: ' + lado }, casas);
        ligarSetas(tab);
        setTimeout(marcarExtras, 0);
        if (p.promocao) {
          const cor = e.vez;
          tab.appendChild(el('div', { class: 'vl-jg-promo' }, [el('div', null, p.promocao.map((m) => el('button', { type: 'button', title: NOME_PECA[m.promo.toLowerCase()], 'aria-label': 'Promover a ' + NOME_PECA[m.promo.toLowerCase()],
            onclick() { aplicar(m, true); } }, [el('span', { class: 'vl-jg-peca ' + cor, style: 'font-size:40px', texto: GLIFO[m.promo.toLowerCase()] + VS })])))]));
        }
        const eu = p.minhaCor;
        const tomadas = (cor) => el('div', { class: 'vl-jg-tomadas ' + (cor === 'w' ? 'pretas' : 'brancas'), title: 'Peças tomadas', texto: tomadasPor(cor) });
        const vez = (p.mostrado || p.estado).vez; // a vez de verdade, mesmo revendo lances antigos
        const jogador = (cor) => el('div', { class: 'vl-jg-jogador' + (!p.fim && vez === cor ? ' vez' : '') }, [
          p.modo === 'bot' && cor !== eu ? el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: '🤖' }) : cabeca(nomeDe(cor)),
          el('span', { class: 'nome' }, [el('b', { texto: nomeDe(cor) }), el('small', { texto: (cor === 'w' ? 'Brancas' : 'Pretas') + (!p.fim && vez === cor ? ' · jogando' : '') })]),
          p.relogio ? el('span', { class: 'vl-jg-relogio', 'data-cor': cor, role: 'timer', 'aria-label': 'Relógio das ' + (cor === 'w' ? 'brancas' : 'pretas') }) : null,
          el('span', { class: 'vl-jg-cor ' + cor, 'aria-hidden': 'true' }),
        ]);
        setTimeout(pintarRelogios, 0);
        let estado;
        if (p.fim) estado = regras.motivoFim(p.fim, p.minhaCor, p.modo);
        else if (p.pensando) estado = 'O bot está pensando…';
        else if (vez === eu) estado = (!revendo && reiEmXeque >= 0 ? 'Xeque! ' : '') + (p.pendente && p.pendente.travado ? 'Sem resposta de ' + p.oponente + '…' : 'Sua vez.') + (p.jogo === 'damas' && todos.length && todos[0].capturas.length ? ' Captura obrigatória: ' + todos[0].capturas.length + (todos[0].capturas.length > 1 ? ' peças.' : ' peça.') : '');
        else estado = (!revendo && reiEmXeque >= 0 ? 'Xeque! ' : '') + 'Vez de ' + nomeDe(vez) + '.';
        if (p.empateProposto === 'deles' && !p.fim) estado += ' ' + p.oponente + ' propôs empate.';
        if (p.pre && !revendo) estado += ' Pré-lance marcado.';
        const total = p.historico.length, vendo = revendo ? p.ver : total;
        const itemLance = (k) => {
          if (!p.historico[k]) return el('span', { texto: '' });
          const cls = (k === total - 1 ? 'ult' : '') + (revendo && k === p.ver - 1 ? ' vendo' : '');
          return el('span', { class: cls, 'data-ply': String(k + 1), title: 'Ver a posição depois deste lance', texto: p.historico[k].nota, onclick() { verLance(k + 1); } });
        };
        const lances = [];
        for (let k = 0; k < total; k += 2) {
          lances.push(el('span', { class: 'n', texto: (k / 2 + 1) + '.' }));
          lances.push(itemLance(k));
          lances.push(itemLance(k + 1));
        }
        const listaLances = el('div', { class: 'vl-jg-lances', 'aria-label': 'Lances' }, lances);
        setTimeout(() => { const v = listaLances.querySelector('.vendo'); if (v) v.scrollIntoView({ block: 'nearest' }); else listaLances.scrollTop = listaLances.scrollHeight; }, 0);
        const bRev = (txt, titulo, n, off) => el('button', { type: 'button', title: titulo, 'aria-label': titulo, texto: txt, disabled: off, onclick() { verLance(n); } });
        const revisao = el('div', { class: 'vl-jg-revisao' }, [
          bRev('⏮', 'Início da partida', 0, vendo === 0),
          bRev('◀', 'Lance anterior (←)', vendo - 1, vendo === 0),
          bRev('▶', 'Próximo lance (→)', vendo + 1, !revendo),
          bRev('⏭', 'Voltar ao jogo', null, !revendo),
        ]);
        const avisoRevisao = revendo ? el('div', { class: 'vl-jg-revendo', texto: 'Revendo: ' + (p.ver ? 'depois do lance ' + p.ver : 'início') + ' de ' + total + '. Só você vê.' }) : null;
        const acoes = [];
        if (!p.fim) {
          if (p.modo === 'bot' && !p.relogio) acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Voltar lance', disabled: !p.estados.length || p.pensando || p.animando, onclick: voltarLance }));
          if (p.modo === 'rede') {
            if (p.empateProposto === 'deles') {
              acoes.push(el('button', { type: 'button', class: 'vl-jg-botao forte', texto: 'Aceitar empate', onclick() { enviar({ t: 'jg:empate', a: 'aceitar' }); encerrar({ fim: true, vencedor: null, motivo: 'acordo' }); } }));
              acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Recusar', onclick() { enviar({ t: 'jg:empate', a: 'recusar' }); p.empateProposto = null; desenhar(); } }));
            } else acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: p.empateProposto === 'meu' ? 'Empate proposto…' : 'Propor empate', disabled: p.empateProposto === 'meu', onclick() { p.empateProposto = 'meu'; enviar({ t: 'jg:empate', a: 'propor' }); desenhar(); } }));
          }
          acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Desistir', onclick: desistir }));
        } else {
          acoes.push(el('button', { type: 'button', class: 'vl-jg-botao forte', texto: p.modo === 'bot' ? 'Jogar de novo' : 'Revanche', onclick: revanche }));
        }
        acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Virar tabuleiro', onclick() { p.virado = !p.virado; desenhar(); } }));
        acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Menu', title: 'Voltar ao menu do jogo', onclick: sairDaPartida }));
        return [el('div', { class: 'vl-jg-partida' }, [
          tab,
          el('div', { class: 'vl-jg-lado' }, [
            jogador(p.virado ? 'w' : 'b'), tomadas(p.virado ? 'w' : 'b'),
            el('div', { class: 'vl-jg-estado' + (p.fim ? ' fim' : ''), role: 'status', 'aria-live': 'polite', texto: estado }),
            listaLances,
            revisao, avisoRevisao,
            tomadas(p.virado ? 'b' : 'w'), jogador(p.virado ? 'b' : 'w'),
            el('div', { class: 'vl-jg-acoes' }, acoes),
            linhaVelocidade(),
          ]),
        ])];
      }
      // Peças que a cor já tomou (símbolos das peças do outro lado que saíram do tabuleiro).
      function tomadasPor(cor) {
        const p = partida;
        if (!p) return '';
        if (p.jogo === 'damas') return '●'.repeat(Math.min(12, p.tomou[cor] || 0));
        const inicial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
        const alvo = cor === 'w' ? (x) => x === x.toLowerCase() : (x) => x === x.toUpperCase();
        const conta = {};
        for (const x of p.estado.tab) if (x && alvo(x)) conta[x.toLowerCase()] = (conta[x.toLowerCase()] || 0) + 1;
        let s = '';
        for (const t of ['q', 'r', 'b', 'n', 'p']) s += (GLIFO[t] + VS).repeat(Math.max(0, inicial[t] - (conta[t] || 0)));
        return s;
      }
      function restante(p, cor) {
        const r = p.relogio;
        return r[cor] - (!p.fim && p.estado.vez === cor ? Date.now() - r.desde : 0);
      }
      function pintarRelogios() {
        const p = partida;
        if (!p || !p.relogio || !corpo) return;
        for (const no of corpo.querySelectorAll('.vl-jg-relogio')) {
          const cor = no.getAttribute('data-cor'), ms = restante(p, cor);
          no.textContent = relogioTexto(ms);
          no.classList.toggle('ativo', !p.fim && p.estado.vez === cor && ms >= 10000);
          no.classList.toggle('pouco', ms < 10000);
        }
      }
      const relogioXadrez = setInterval(function () {
        const p = partida;
        if (!p || !p.relogio || p.fim) return;
        pintarRelogios();
        const vez = p.estado.vez, ms = restante(p, vez);
        if (vez === p.minhaCor && ms <= 0) {
          if (p.modo === 'rede') enviar({ t: 'jg:fim', m: 'tempo' });
          encerrar({ fim: true, vencedor: vez === 'w' ? 'b' : 'w', motivo: 'tempo esgotado' });
        } else if (vez !== p.minhaCor && ms <= (p.modo === 'bot' ? 0 : -3000)) {
          // O do outro acabou (pela rede, com 3 s de folga para o aviso dele chegar).
          if (p.modo === 'rede') enviar({ t: 'jg:fim', m: 'tempo-outro' });
          encerrar({ fim: true, vencedor: p.minhaCor, motivo: 'tempo esgotado' });
        }
      }, 200);
      ctx.aoParar(() => clearInterval(relogioXadrez));
      function voltarLance() {
        const p = partida;
        if (!p || p.modo !== 'bot' || !p.estados.length) return;
        clearTimeout(p.relogioAnim); p.fila = []; p.job = null; p.animando = false; p.mostrado = null;
        // Volta até a última vez sua (o seu lance e a resposta do bot).
        do {
          p.estado = p.estados.pop();
          p.historico.pop();
          p.ply--;
        } while (p.estados.length && p.estado.vez !== p.minhaCor);
        p.fim = null; p.sel = null; p.caminho = null; p.ultimo = []; p.pre = null; p.preSel = null; p.ver = null; p.festejado = false;
        desenhar();
        if (p.estado.vez !== p.minhaCor) setTimeout(vezDoBot, 200);
      }
      function encerrar(st) {
        if (!partida || partida.fim) return;
        partida.fim = st;
        partida.pensando = false;
        desenhar();
      }
      function desistir() {
        const p = partida;
        if (!p || p.fim) return;
        if (p.modo === 'rede') enviar({ t: 'jg:fim', m: 'desistiu' });
        encerrar({ fim: true, vencedor: p.minhaCor === 'w' ? 'b' : 'w', motivo: 'desistência' });
      }
      function revanche() {
        const p = partida;
        if (!p) return;
        if (p.modo === 'bot') { comecar({ jogo: p.jogo, modo: 'bot', nivel: p.nivel, minhaCor: p.minhaCor === 'w' ? 'b' : 'w', ritmo: p.ritmo }); return; }
        escolha.ritmo = p.ritmo || 'livre';
        convidar(adversario(p), p.jogo, p.minhaCor === 'w' ? 'b' : 'w');
        partida = null;
        desenhar();
      }
      function sairDaPartida() {
        if (partida && partida.modo === 'rede' && !partida.fim) enviar({ t: 'jg:fim', m: 'saiu' });
        if (partida) escolha.jogo = partida.jogo;
        partida = null;
        if (!(convidando && convidando.amigo)) sairDoCanal();
        desenhar();
      }

      // ---------- partida entre Vagalumes ----------
      // No mesmo quarto, pelo canal direto da Comunidade (pelo apelido); com um amigo de outro quarto, por uma sala
      // só da partida no servidor do Vagalume (pelo id da conta), aberta pelo convite que vai no console.
      const meuId = () => (VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null);
      const eu = () => (VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null);
      const adversario = (p) => ({ via: p.via, nome: p.oponente, id: p.oponenteId });
      // A mesma pessoa? No quarto vale o apelido; na sala da partida, o id da conta.
      const mesmaPessoa = (a, b) => (a.via === 'canal' ? b.via === 'canal' && String(a.id) === String(b.id) : b.via !== 'canal' && nomeChave(a.nome) === nomeChave(b.nome));
      const corEscolhida = () => (escolha.cor === '?' ? (Math.random() < 0.5 ? 'w' : 'b') : escolha.cor);
      function enviar(dado, alvo) {
        const a = alvo || (partida && adversario(partida));
        if (!a) return Promise.resolve(null);
        const msg = Object.assign({ s: partida && partida.sessao }, dado);
        if (a.via === 'canal') return canal ? sala('jogo:enviar', { para: a.id, dado: msg }).catch(() => null) : Promise.resolve(null);
        if (!a.nome || !VL.comunidade || !VL.comunidade.direto) return Promise.resolve(null);
        return VL.comunidade.direto(a.nome, msg);
      }

      // A sala da partida com um amigo (uma por vez); pessoas: os ids que estão nela agora.
      let canal = null; // { id, pessoas: Set, esperas: [] }
      function entrarNoCanal(id) {
        if (canal && canal.id === id) return Promise.resolve(canal);
        const c = { id, pessoas: new Set(), esperas: [] };
        canal = c;
        return sala('jogo:entrar', { canal: id, id: meuId(), nome: eu() }).then(() => c, (erro) => { if (canal === c) canal = null; throw erro; });
      }
      function sairDoCanal(id) {
        if (!canal || (id && canal.id !== id)) return;
        canal = null;
        sala('jogo:sair').catch(() => {});
      }
      // Espera alguém (pelo id) estar na sala; true se chegou a tempo.
      function esperarNoCanal(idPessoa, ms) {
        const c = canal;
        if (!c) return Promise.resolve(false);
        if (c.pessoas.has(String(idPessoa))) return Promise.resolve(true);
        return new Promise(function (resolver) {
          const espera = { id: String(idPessoa), ok() { clearTimeout(relogio); resolver(true); } };
          const relogio = setTimeout(function () { c.esperas = c.esperas.filter((x) => x !== espera); resolver(false); }, ms);
          c.esperas.push(espera);
        });
      }
      function aoAvisoDaSala(m) {
        if (!m || m.de !== 'sala' || !canal || String(m.canal) !== canal.id) return;
        if (m.tipo === 'jogo:pessoas') {
          const c = canal;
          c.pessoas = new Set((m.ids || []).map(String));
          c.esperas = c.esperas.filter((w) => { if (c.pessoas.has(w.id)) { w.ok(); return false; } return true; });
        } else if (m.tipo === 'jogo:direto' && m.dado && typeof m.dado === 'object') {
          receber({ via: 'canal', nome: String(m.nome || ''), id: String(m.autorId || '') }, m.dado);
        }
      }
      chrome.runtime.onMessage.addListener(aoAvisoDaSala);
      ctx.aoParar(function () { chrome.runtime.onMessage.removeListener(aoAvisoDaSala); sairDoCanal(); });

      // Convite para alguém do quarto (ou, na revanche, para o amigo na mesma sala).
      function convidar(alvo, jogo, corPedida) {
        if (alvo.via !== 'canal' && (!VL.comunidade || !VL.comunidade.direto)) { avisoInicio = 'Ligue a Comunidade Vagalume para jogar com outras pessoas.'; desenhar(); return; }
        if (convidando) cancelarConvite();
        const c = convidando = { via: alvo.via, nome: alvo.nome, id: alvo.id || null, sessao: novaSessao(), jogo: jogo || escolha.jogo, cor: corPedida || corEscolhida() };
        c.ritmo = c.jogo === 'xadrez' ? escolha.ritmo : 'livre';
        avisoInicio = '';
        enviar({ t: 'jg:convite', j: c.jogo, c: c.cor, s: c.sessao, r: c.ritmo }, alvo).then(function (r) {
          if (convidando !== c) return;
          if (!r || r.erro) { convidando = null; avisoInicio = 'Não consegui mandar o convite para ' + c.nome + (r && r.erro === 'pessoa' ? ' (a pessoa saiu do quarto ou não está com o Vagalume).' : '.'); desenhar(); }
        });
        c.relogio = setTimeout(function () { if (convidando !== c) return; convidando = null; avisoInicio = c.nome + ' não respondeu ao convite.'; desenhar(); }, 45000);
        abrir();
      }
      // Chamar um amigo de outro quarto: abre a sala da partida e manda o convite no console dele.
      const textoDoConvite = (c) => (c.jogo === 'pingpong' ? '🏓' : '♟') + ' Bora jogar ' + NOMES[c.jogo] + '? Convite do Vagalume: vl-jogo-' + LETRA_JOGO[c.jogo] + c.cor + c.sessao + (c.ritmo && c.ritmo !== 'livre' ? '-' + LETRA_RITMO[c.ritmo] : '');
      function convidarAmigo(a) {
        if (!meuId() || !eu()) { avisoInicio = 'Ligue a Conexão do jogo para chamar amigos.'; desenhar(); return; }
        if (convidando) cancelarConvite();
        const c = convidando = { via: 'canal', nome: a.nome, id: String(a.id), sessao: novoCanal(), jogo: escolha.jogo, cor: corEscolhida(), amigo: true, ritmo: escolha.jogo === 'xadrez' ? escolha.ritmo : 'livre' };
        avisoInicio = '';
        desenhar();
        entrarNoCanal(c.sessao).then(function () {
          if (convidando !== c) return;
          conexao.enviar(SAIDA.MENSAGEM_PRIVADA, [['i', Number(a.id)], ['s', textoDoConvite(c)]]);
        }, function () {
          if (convidando !== c) return;
          convidando = null;
          avisoInicio = 'Não consegui abrir a partida agora. Tente de novo em instantes.';
          desenhar();
        });
        c.relogio = setTimeout(function () {
          if (convidando !== c) return;
          convidando = null;
          sairDoCanal(c.sessao);
          avisoInicio = a.nome + ' não respondeu ao convite.';
          desenhar();
        }, 60000);
      }
      function cancelarConvite() {
        const c = convidando;
        if (!c) return;
        clearTimeout(c.relogio);
        convidando = null;
        enviar({ t: 'jg:resposta', ok: false, cancelado: true, s: c.sessao }, c);
        if (c.amigo) sairDoCanal(c.sessao);
        desenhar();
      }
      // Antes de começar outra partida: desiste do convite que estava esperando e avisa o adversário da atual.
      function largarPartida(canalQueFica) {
        if (convidando) cancelarConvite();
        const p = partida;
        if (p && p.modo === 'rede' && !p.fim) enviar({ t: 'jg:fim', m: 'saiu' });
        if (canal && canal.id !== canalQueFica) sairDoCanal();
      }
      // ---------- ping-pong pela rede ----------
      // Saque, rebatida e ponto vão numerados e confirmados (pp:ok) e são aplicados na ordem; a raquete vai solta.
      function ppEnviar(p, dado, confiavel) {
        if (p.modo !== 'rede' || p.fim) return;
        if (!confiavel) { enviar(dado); return; }
        const msg = Object.assign({ n: ++p.ppSeq }, dado);
        p.ppPendentes.set(msg.n, { msg, vezes: 1, enviadoEm: performance.now() });
        enviar(msg);
      }
      function receberPP(p, d) {
        if (d.t === 'pp:ok') {
          // Ida e volta medida pelas confirmações (só as que saíram uma vez): metade é o atraso de cada mensagem.
          const x = p.ppPendentes.get(Number(d.n));
          if (x && x.vezes === 1) { const rtt = Math.min(1500, performance.now() - x.enviadoEm); p.ppRtt = p.ppRtt ? p.ppRtt * 0.7 + rtt * 0.3 : rtt; }
          p.ppPendentes.delete(Number(d.n));
          return;
        }
        if (d.t === 'pp:raq') { p.pp.receber(d); return; }
        const n = Number(d.n);
        if (!Number.isInteger(n) || n < 1 || n > p.ppRecebido + 50) return;
        enviar({ t: 'pp:ok', n });
        if (n <= p.ppRecebido || p.ppFila.has(n)) return;
        p.ppFila.set(n, d);
        while (p.ppFila.has(p.ppRecebido + 1)) {
          const e = p.ppFila.get(p.ppRecebido + 1);
          p.ppFila.delete(p.ppRecebido + 1);
          p.ppRecebido++;
          // A rebatida do outro aconteceu há meia ida e volta: a tela adianta a bola esse tanto (até 0,25 s).
          p.pp.receber(Object.assign({}, e, { atraso: Math.min(0.25, (p.ppRtt || 0) / 2000) }));
        }
      }
      // O que não foi confirmado vai de novo (também depois do fim, para o último ponto chegar).
      const reenvioPP = setInterval(function () {
        const p = partida;
        if (!p || p.jogo !== 'pingpong' || p.modo !== 'rede') return;
        for (const [n, x] of p.ppPendentes) {
          if (x.vezes >= 12) { p.ppPendentes.delete(n); continue; }
          x.vezes++;
          enviar(x.msg);
        }
      }, 700);
      ctx.aoParar(() => clearInterval(reenvioPP));
      function mandarLance(texto, sobrou) {
        const p = partida;
        p.pendente = { n: p.ply, l: texto, tentativas: 0, travado: false, tr: sobrou };
        const tentar = function () {
          if (partida !== p || !p.pendente || p.pendente.l !== texto) return;
          p.pendente.tentativas++;
          enviar({ t: 'jg:lance', n: p.pendente.n, l: texto, tr: p.pendente.tr });
          if (p.pendente.tentativas >= 5) { p.pendente.travado = true; desenhar(); return; }
          p.pendente.relogio = setTimeout(tentar, 2500);
        };
        tentar();
      }

      // ---------- convite recebido: cartão no meio da tela, como uma chamada ----------
      function fecharChamada() {
        const c = chamada;
        if (!c) return;
        chamada = null;
        clearTimeout(c.relogio);
        if (c.pararToque) c.pararToque();
        c.cartao.remove();
      }
      // Toque baixinho enquanto o convite está na tela (três notas a cada 2,2 s).
      function tocarToque() {
        if (ctx.secao().som === false) return function () {};
        let c;
        try { c = new (raiz.AudioContext || raiz.webkitAudioContext)(); } catch (e) { return function () {}; }
        const nota = function (f, q) {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, q);
          g.gain.exponentialRampToValueAtTime(0.07, q + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, q + 0.3);
          o.connect(g).connect(c.destination);
          o.start(q); o.stop(q + 0.35);
        };
        const tocarUma = function () { const t = c.currentTime; nota(659, t); nota(880, t + 0.15); nota(988, t + 0.3); };
        tocarUma();
        const relogio = setInterval(tocarUma, 2200);
        return function () { clearInterval(relogio); c.close().catch(function () {}); };
      }
      function mostrarChamada(o) {
        fecharChamada();
        const foto = el('div', { class: 'vl-jg-chamada-foto', texto: String(o.nome || '?').charAt(0).toUpperCase() });
        const fig = visualDe(o.nome);
        if (fig) {
          const img = el('img', { alt: '', src: fotoDe(fig) });
          img.addEventListener('load', () => { foto.textContent = ''; foto.appendChild(img); });
        }
        const c = { sessao: o.sessao, cartao: null, relogio: null, pararToque: null };
        c.cartao = el('div', { class: 'vl-jg-chamada', role: 'alertdialog', 'aria-label': 'Convite de ' + o.nome + ' para jogar ' + NOMES[o.jogo] }, [
          el('div', { class: 'vl-jg-chamada-anel' }, [foto, el('span', { class: 'vl-jg-chamada-jogo', 'aria-hidden': 'true', texto: glifoDe(o.jogo) })]),
          el('b', { texto: o.nome }),
          el('p', { texto: 'Chamou você para jogar ' + NOMES[o.jogo] + '. ' + (o.jogo === 'pingpong' ? (o.minhaCor === 'w' ? 'Você saca primeiro.' : 'Quem chamou saca primeiro.') : 'Você joga com as ' + COR_NOME[o.minhaCor] + '.') }),
          el('div', { class: 'vl-jg-acoes' }, [
            el('button', { type: 'button', class: 'vl-jg-botao recusar', texto: 'Recusar', onclick() { fecharChamada(); o.recusar(); } }),
            el('button', { type: 'button', class: 'vl-jg-botao aceitar', texto: 'Aceitar', onclick() { fecharChamada(); o.aceitar(); } }),
          ]),
        ]);
        c.relogio = setTimeout(function () { if (chamada === c) { fecharChamada(); camada.aviso('Convite de ' + o.nome + ' para ' + NOMES[o.jogo] + ' perdido.'); } }, 45000);
        c.pararToque = tocarToque();
        chamada = c;
        camada.area().appendChild(c.cartao);
      }
      // Convite pelo canal do quarto (ou, na revanche, pela sala com o amigo).
      function conviteDireto(de, d) {
        if (chamada && chamada.sessao === d.s) return;
        const minhaCor = d.c === 'w' ? 'b' : 'w';
        mostrarChamada({ sessao: d.s, nome: de.nome, jogo: d.j, minhaCor,
          recusar() { enviar({ t: 'jg:resposta', ok: false, s: d.s }, de); },
          aceitar() {
            enviar({ t: 'jg:resposta', ok: true, s: d.s }, de);
            largarPartida(de.via === 'canal' && canal ? canal.id : null);
            comecar({ jogo: d.j, modo: 'rede', via: de.via, minhaCor, oponente: de.nome, oponenteId: de.id, sessao: d.s, ritmo: ritmoValido(d.r) });
          } });
      }
      // Convite de um amigo de outro quarto, pelo console.
      ctx.ouvir('amigos:mensagem', function (d) {
        const m = d && CODIGO_CONVITE.exec(String(d.texto || ''));
        if (!m || d.de == null) return;
        const de = { via: 'canal', nome: d.autor || 'Um amigo', id: String(d.de) };
        const jogo = JOGO_DA_LETRA[m[1]], minhaCor = m[2] === 'w' ? 'b' : 'w', sessao = m[3], ritmo = RITMO_DA_LETRA[m[4]] || 'livre';
        if ((partida && partida.sessao === sessao) || (chamada && chamada.sessao === sessao)) return;
        mostrarChamada({ sessao, nome: de.nome, jogo, minhaCor, recusar() { recusarAmigo(de, sessao); }, aceitar() { aceitarAmigo(de, sessao, jogo, minhaCor, ritmo); } });
      });
      function aceitarAmigo(de, sessao, jogo, minhaCor, ritmo) {
        if (!meuId() || !eu()) { camada.aviso('Ligue a Conexão do jogo para jogar com amigos.', { tipo: 'erro' }); return; }
        largarPartida(sessao);
        entrarNoCanal(sessao).then(() => esperarNoCanal(de.id, 8000)).then(function (chegou) {
          if (!chegou) { sairDoCanal(sessao); camada.aviso('O convite de ' + de.nome + ' não vale mais.'); return; }
          enviar({ t: 'jg:resposta', ok: true, s: sessao }, de);
          comecar({ jogo, modo: 'rede', via: 'canal', minhaCor, oponente: de.nome, oponenteId: de.id, sessao, ritmo });
        }, function () { camada.aviso('Não consegui entrar na partida agora.', { tipo: 'erro' }); });
      }
      function recusarAmigo(de, sessao) {
        if (canal && canal.id !== sessao) return; // não larga a sala em uso só para avisar a recusa
        entrarNoCanal(sessao).then(() => esperarNoCanal(de.id, 5000)).then(function (chegou) {
          if (chegou) enviar({ t: 'jg:resposta', ok: false, s: sessao }, de);
          setTimeout(() => sairDoCanal(sessao), 400);
        }, function () {});
      }

      function aoDireto(m) {
        if (!m || m.de !== 'sala' || m.tipo !== 'presenca:direto' || !m.dado || typeof m.dado !== 'object') return;
        receber({ via: 'quarto', nome: String(m.nome || ''), id: null }, m.dado);
      }
      // Mensagem da partida, venha do quarto ou da sala com o amigo (de: { via, nome, id }).
      function receber(de, d) {
        if (!/^(jg|pp):/.test(String(d.t || '')) || !sessaoValida(d.s)) return;
        if (d.t === 'jg:convite') { if (NOMES[d.j] && (d.c === 'w' || d.c === 'b')) conviteDireto(de, d); return; }
        if (d.t === 'jg:resposta') {
          const c = convidando;
          if (c && c.sessao === d.s && mesmaPessoa(c, de)) {
            clearTimeout(c.relogio);
            convidando = null;
            if (d.ok) {
              largarPartida(de.via === 'canal' && canal ? canal.id : null);
              comecar({ jogo: c.jogo, modo: 'rede', via: c.via, minhaCor: c.cor, oponente: c.nome, oponenteId: c.id, sessao: c.sessao, ritmo: c.ritmo });
            } else {
              avisoInicio = c.nome + ' recusou o convite.';
              if (c.amigo) sairDoCanal(c.sessao);
              desenhar();
            }
          } else if (d.cancelado && chamada && chamada.sessao === d.s) fecharChamada();
          return;
        }
        const p = partida;
        if (!p || p.modo !== 'rede' || p.sessao !== d.s || !mesmaPessoa(adversario(p), de)) return;
        if (/^pp:/.test(d.t)) { if (p.jogo === 'pingpong' && p.pp) receberPP(p, d); return; }
        const regras = REGRAS[p.jogo];
        if (!regras && /^jg:(lance|ok|pedirEstado|estado)$/.test(d.t)) return;
        if (d.t === 'jg:lance') {
          const n = Number(d.n);
          if (n <= p.ply) { enviar({ t: 'jg:ok', n }); return; } // repetido: só confirma de novo
          if (n !== p.ply + 1 || p.estado.vez === p.minhaCor || p.fim) { enviar({ t: 'jg:pedirEstado' }); return; }
          const lance = regras.lanceDe(p.estado, String(d.l || '').slice(0, 80));
          if (!lance) { enviar({ t: 'jg:pedirEstado' }); return; }
          aplicar(lance, false, Number(d.tr));
          enviar({ t: 'jg:ok', n });
          return;
        }
        if (d.t === 'jg:ok') { if (p.pendente && Number(d.n) === p.pendente.n) { clearTimeout(p.pendente.relogio); p.pendente = null; desenhar(); } return; }
        if (d.t === 'jg:pedirEstado') { enviar({ t: 'jg:estado', n: p.ply, p: regras.posicao(p.estado), u: p.ultimo.slice(0, 12) }); return; }
        if (d.t === 'jg:estado') {
          const n = Number(d.n);
          if (!(n >= p.ply)) return;
          try {
            p.estados.push(p.estado);
            p.estado = regras.dePosicao(String(d.p || '').slice(0, 120));
            p.ply = n;
            p.ultimo = Array.isArray(d.u) ? d.u.filter((x) => Number.isInteger(x) && x >= 0 && x < 64) : [];
            p.historico.push({ nota: '(sincronizado)', cor: '' });
            if (p.pendente) { clearTimeout(p.pendente.relogio); p.pendente = null; }
            const st = regras.situacao(p.estado);
            if (st.fim) p.fim = st;
            desenhar();
          } catch (e) { /* posição inválida: ignora */ }
          return;
        }
        if (d.t === 'jg:fim') {
          if (d.m === 'tempo-outro') { encerrar({ fim: true, vencedor: p.minhaCor === 'w' ? 'b' : 'w', motivo: 'tempo esgotado' }); return; }
          encerrar({ fim: true, vencedor: p.minhaCor, motivo: d.m === 'desistiu' ? p.oponente + ' desistiu' : d.m === 'tempo' ? 'tempo esgotado de ' + p.oponente : p.oponente + ' saiu da partida' });
          return;
        }
        if (d.t === 'jg:empate') {
          if (d.a === 'propor') { p.empateProposto = 'deles'; desenhar(); }
          else if (d.a === 'aceitar' && p.empateProposto === 'meu') encerrar({ fim: true, vencedor: null, motivo: 'acordo' });
          else if (d.a === 'recusar') { p.empateProposto = null; desenhar(); camada.aviso(p.oponente + ' recusou o empate.'); }
        }
      }
      if (VL.comunidade && VL.comunidade.aoAcao) ctx.aoParar(VL.comunidade.aoAcao(aoDireto));
      else {
        // A Comunidade pode iniciar depois deste módulo.
        const espera = setInterval(function () { if (VL.comunidade && VL.comunidade.aoAcao) { clearInterval(espera); ctx.aoParar(VL.comunidade.aoAcao(aoDireto)); } }, 1000);
        ctx.aoParar(() => clearInterval(espera));
      }
      // O adversário saiu (do quarto ou da sala da partida): encerra depois de um tempo.
      const vigia = setInterval(function () {
        const p = partida;
        if (!p || p.modo !== 'rede' || p.fim) return;
        let presente;
        if (p.via === 'canal') presente = !!(canal && canal.pessoas.has(String(p.oponenteId)));
        else if (VL.comunidade && VL.comunidade.usaVagalume) presente = VL.comunidade.usaVagalume(p.oponente);
        else return;
        if (presente) { p.sumiuEm = 0; return; }
        p.sumiuEm = p.sumiuEm || Date.now();
        if (Date.now() - p.sumiuEm > 20000) encerrar({ fim: true, vencedor: null, motivo: p.oponente + (p.via === 'canal' ? ' saiu da partida' : ' saiu do quarto') });
      }, 5000);
      ctx.aoParar(() => clearInterval(vigia));
      // Tela de início aberta: as listas de quem usa o Vagalume no quarto e dos amigos online se atualizam sozinhas.
      const relogioLista = setInterval(function () { if (janela && janela.style.display !== 'none' && !partida && !minimizada) desenhar(); }, 4000);
      ctx.aoParar(() => clearInterval(relogioLista));
      ctx.aoParar(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () {
        // Quarto novo: a partida com alguém do quarto acaba; contra o bot ou com um amigo de outro quarto, continua.
        if (partida && partida.modo === 'rede' && partida.via !== 'canal' && !partida.fim) { enviar({ t: 'jg:fim', m: 'saiu' }); encerrar({ fim: true, vencedor: null, motivo: 'você mudou de quarto' }); }
      }));

      ctx.comando({
        nome: 'jogos',
        apelidos: ['xadrez', 'damas', 'pingpong', 'pong'],
        uso: 'jogos',
        descricao: 'Abre os jogos do Vagalume (também pelo controle na barra do hotel, ao lado do ponto verde; xadrez e damas também com dois cliques num tabuleiro de xadrez do quarto). Contra o bot, contra quem usa o Vagalume no quarto ou chamando um amigo de outro quarto.',
        executar(pedido) {
          const qual = { xadrez: 'xadrez', damas: 'damas', pingpong: 'pingpong', pong: 'pingpong' }[pedido && pedido.nome];
          if (qual) escolha.jogo = qual;
          else if (!partida || partida.fim) { abrirHub(); return; }
          abrir();
        },
      });
      // Para os testes: abrir e jogar sem a página.
      // ---------- ícone de Jogos na barra do hotel (pedido do usuário em 2026-11-26) ----------
      // Um controle em pixel art logo depois do ponto verde do Vagalume (ou da câmera, sem o ponto). Abre a lista de jogos.
      // Controle em pixel art 32×32 (gerado por ferramentas/gerar-icone-jogos.js): corpo limão com brilho e sombra, cruz, botões coloridos e a luzinha do Vagalume.
      const CONTROLE = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' shape-rendering='crispEdges'><rect x='27' y='3' width='1' height='1' fill='#e8ff7a'/><rect x='27' y='4' width='1' height='1' fill='#ffffff'/><rect x='25' y='5' width='1' height='1' fill='#e8ff7a'/><rect x='26' y='5' width='3' height='1' fill='#ffffff'/><rect x='29' y='5' width='1' height='1' fill='#e8ff7a'/><rect x='5' y='6' width='1' height='1' fill='#e8ff7a'/><rect x='27' y='6' width='1' height='1' fill='#ffffff'/><rect x='4' y='7' width='1' height='1' fill='#e8ff7a'/><rect x='5' y='7' width='1' height='1' fill='#ffffff'/><rect x='6' y='7' width='1' height='1' fill='#e8ff7a'/><rect x='27' y='7' width='1' height='1' fill='#e8ff7a'/><rect x='5' y='8' width='1' height='1' fill='#e8ff7a'/><rect x='6' y='9' width='20' height='1' fill='#141a24'/><rect x='5' y='10' width='1' height='1' fill='#141a24'/><rect x='6' y='10' width='20' height='1' fill='#f2ffb6'/><rect x='26' y='10' width='1' height='1' fill='#141a24'/><rect x='4' y='11' width='1' height='1' fill='#141a24'/><rect x='5' y='11' width='1' height='1' fill='#f2ffb6'/><rect x='6' y='11' width='20' height='1' fill='#e1f77a'/><rect x='26' y='11' width='1' height='1' fill='#f2ffb6'/><rect x='27' y='11' width='1' height='1' fill='#141a24'/><rect x='3' y='12' width='1' height='1' fill='#141a24'/><rect x='4' y='12' width='1' height='1' fill='#f2ffb6'/><rect x='5' y='12' width='1' height='1' fill='#e1f77a'/><rect x='6' y='12' width='2' height='1' fill='#c6e43a'/><rect x='8' y='12' width='1' height='1' fill='#3e4a63'/><rect x='9' y='12' width='1' height='1' fill='#1f2737'/><rect x='10' y='12' width='5' height='1' fill='#c6e43a'/><rect x='15' y='12' width='2' height='1' fill='#e8ff7a'/><rect x='17' y='12' width='4' height='1' fill='#c6e43a'/><rect x='21' y='12' width='1' height='1' fill='#ffc6df'/><rect x='22' y='12' width='1' height='1' fill='#ff5aa0'/><rect x='23' y='12' width='3' height='1' fill='#c6e43a'/><rect x='26' y='12' width='1' height='1' fill='#e1f77a'/><rect x='27' y='12' width='1' height='1' fill='#f2ffb6'/><rect x='28' y='12' width='1' height='1' fill='#141a24'/><rect x='3' y='13' width='1' height='1' fill='#141a24'/><rect x='4' y='13' width='1' height='1' fill='#e1f77a'/><rect x='5' y='13' width='3' height='1' fill='#c6e43a'/><rect x='8' y='13' width='2' height='1' fill='#1f2737'/><rect x='10' y='13' width='5' height='1' fill='#c6e43a'/><rect x='15' y='13' width='2' height='1' fill='#ffffff'/><rect x='17' y='13' width='4' height='1' fill='#c6e43a'/><rect x='21' y='13' width='2' height='1' fill='#ff5aa0'/><rect x='23' y='13' width='4' height='1' fill='#c6e43a'/><rect x='27' y='13' width='1' height='1' fill='#e1f77a'/><rect x='28' y='13' width='1' height='1' fill='#141a24'/><rect x='3' y='14' width='1' height='1' fill='#141a24'/><rect x='4' y='14' width='1' height='1' fill='#e1f77a'/><rect x='5' y='14' width='1' height='1' fill='#c6e43a'/><rect x='6' y='14' width='1' height='1' fill='#3e4a63'/><rect x='7' y='14' width='1' height='1' fill='#1f2737'/><rect x='8' y='14' width='1' height='1' fill='#3e4a63'/><rect x='9' y='14' width='3' height='1' fill='#1f2737'/><rect x='12' y='14' width='3' height='1' fill='#c6e43a'/><rect x='15' y='14' width='2' height='1' fill='#e8ff7a'/><rect x='17' y='14' width='1' height='1' fill='#c6e43a'/><rect x='18' y='14' width='1' height='1' fill='#bff6d3'/><rect x='19' y='14' width='1' height='1' fill='#34c46b'/><rect x='20' y='14' width='4' height='1' fill='#c6e43a'/><rect x='24' y='14' width='1' height='1' fill='#c4e0ff'/><rect x='25' y='14' width='1' height='1' fill='#3d8ef2'/><rect x='26' y='14' width='1' height='1' fill='#c6e43a'/><rect x='27' y='14' width='1' height='1' fill='#93b21b'/><rect x='28' y='14' width='1' height='1' fill='#141a24'/><rect x='3' y='15' width='1' height='1' fill='#141a24'/><rect x='4' y='15' width='1' height='1' fill='#e1f77a'/><rect x='5' y='15' width='1' height='1' fill='#c6e43a'/><rect x='6' y='15' width='6' height='1' fill='#1f2737'/><rect x='12' y='15' width='6' height='1' fill='#c6e43a'/><rect x='18' y='15' width='2' height='1' fill='#34c46b'/><rect x='20' y='15' width='4' height='1' fill='#c6e43a'/><rect x='24' y='15' width='2' height='1' fill='#3d8ef2'/><rect x='26' y='15' width='1' height='1' fill='#c6e43a'/><rect x='27' y='15' width='1' height='1' fill='#93b21b'/><rect x='28' y='15' width='1' height='1' fill='#141a24'/><rect x='3' y='16' width='1' height='1' fill='#141a24'/><rect x='4' y='16' width='1' height='1' fill='#e1f77a'/><rect x='5' y='16' width='3' height='1' fill='#c6e43a'/><rect x='8' y='16' width='2' height='1' fill='#1f2737'/><rect x='10' y='16' width='11' height='1' fill='#c6e43a'/><rect x='21' y='16' width='1' height='1' fill='#fff4b8'/><rect x='22' y='16' width='1' height='1' fill='#ffd43b'/><rect x='23' y='16' width='4' height='1' fill='#c6e43a'/><rect x='27' y='16' width='1' height='1' fill='#93b21b'/><rect x='28' y='16' width='1' height='1' fill='#141a24'/><rect x='3' y='17' width='1' height='1' fill='#141a24'/><rect x='4' y='17' width='1' height='1' fill='#e1f77a'/><rect x='5' y='17' width='3' height='1' fill='#c6e43a'/><rect x='8' y='17' width='2' height='1' fill='#1f2737'/><rect x='10' y='17' width='3' height='1' fill='#c6e43a'/><rect x='13' y='17' width='2' height='1' fill='#1f2737'/><rect x='15' y='17' width='1' height='1' fill='#c6e43a'/><rect x='16' y='17' width='2' height='1' fill='#1f2737'/><rect x='18' y='17' width='3' height='1' fill='#c6e43a'/><rect x='21' y='17' width='2' height='1' fill='#ffd43b'/><rect x='23' y='17' width='4' height='1' fill='#c6e43a'/><rect x='27' y='17' width='1' height='1' fill='#93b21b'/><rect x='28' y='17' width='1' height='1' fill='#141a24'/><rect x='3' y='18' width='1' height='1' fill='#141a24'/><rect x='4' y='18' width='23' height='1' fill='#c6e43a'/><rect x='27' y='18' width='1' height='1' fill='#93b21b'/><rect x='28' y='18' width='1' height='1' fill='#141a24'/><rect x='3' y='19' width='1' height='1' fill='#141a24'/><rect x='4' y='19' width='9' height='1' fill='#c6e43a'/><rect x='13' y='19' width='6' height='1' fill='#93b21b'/><rect x='19' y='19' width='8' height='1' fill='#c6e43a'/><rect x='27' y='19' width='1' height='1' fill='#93b21b'/><rect x='28' y='19' width='1' height='1' fill='#141a24'/><rect x='3' y='20' width='1' height='1' fill='#141a24'/><rect x='4' y='20' width='9' height='1' fill='#c6e43a'/><rect x='13' y='20' width='6' height='1' fill='#647a10'/><rect x='19' y='20' width='8' height='1' fill='#c6e43a'/><rect x='27' y='20' width='1' height='1' fill='#93b21b'/><rect x='28' y='20' width='1' height='1' fill='#141a24'/><rect x='3' y='21' width='1' height='1' fill='#141a24'/><rect x='4' y='21' width='8' height='1' fill='#c6e43a'/><rect x='12' y='21' width='1' height='1' fill='#93b21b'/><rect x='13' y='21' width='6' height='1' fill='#141a24'/><rect x='19' y='21' width='1' height='1' fill='#93b21b'/><rect x='20' y='21' width='7' height='1' fill='#c6e43a'/><rect x='27' y='21' width='1' height='1' fill='#93b21b'/><rect x='28' y='21' width='1' height='1' fill='#141a24'/><rect x='3' y='22' width='1' height='1' fill='#141a24'/><rect x='4' y='22' width='1' height='1' fill='#93b21b'/><rect x='5' y='22' width='6' height='1' fill='#c6e43a'/><rect x='11' y='22' width='1' height='1' fill='#93b21b'/><rect x='12' y='22' width='1' height='1' fill='#647a10'/><rect x='13' y='22' width='1' height='1' fill='#141a24'/><rect x='14' y='22' width='4' height='1' fill='rgba(0,0,0,.28)'/><rect x='18' y='22' width='1' height='1' fill='#141a24'/><rect x='19' y='22' width='1' height='1' fill='#647a10'/><rect x='20' y='22' width='1' height='1' fill='#93b21b'/><rect x='21' y='22' width='6' height='1' fill='#c6e43a'/><rect x='27' y='22' width='1' height='1' fill='#93b21b'/><rect x='28' y='22' width='1' height='1' fill='#141a24'/><rect x='3' y='23' width='1' height='1' fill='#141a24'/><rect x='4' y='23' width='1' height='1' fill='#647a10'/><rect x='5' y='23' width='1' height='1' fill='#93b21b'/><rect x='6' y='23' width='4' height='1' fill='#c6e43a'/><rect x='10' y='23' width='1' height='1' fill='#93b21b'/><rect x='11' y='23' width='1' height='1' fill='#647a10'/><rect x='12' y='23' width='1' height='1' fill='#141a24'/><rect x='19' y='23' width='1' height='1' fill='#141a24'/><rect x='20' y='23' width='1' height='1' fill='#647a10'/><rect x='21' y='23' width='1' height='1' fill='#93b21b'/><rect x='22' y='23' width='4' height='1' fill='#c6e43a'/><rect x='26' y='23' width='1' height='1' fill='#93b21b'/><rect x='27' y='23' width='1' height='1' fill='#647a10'/><rect x='28' y='23' width='1' height='1' fill='#141a24'/><rect x='4' y='24' width='1' height='1' fill='#141a24'/><rect x='5' y='24' width='1' height='1' fill='#647a10'/><rect x='6' y='24' width='4' height='1' fill='#93b21b'/><rect x='10' y='24' width='1' height='1' fill='#647a10'/><rect x='11' y='24' width='1' height='1' fill='#141a24'/><rect x='12' y='24' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='19' y='24' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='20' y='24' width='1' height='1' fill='#141a24'/><rect x='21' y='24' width='1' height='1' fill='#647a10'/><rect x='22' y='24' width='4' height='1' fill='#93b21b'/><rect x='26' y='24' width='1' height='1' fill='#647a10'/><rect x='27' y='24' width='1' height='1' fill='#141a24'/><rect x='4' y='25' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='5' y='25' width='1' height='1' fill='#141a24'/><rect x='6' y='25' width='4' height='1' fill='#647a10'/><rect x='10' y='25' width='1' height='1' fill='#141a24'/><rect x='11' y='25' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='20' y='25' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='21' y='25' width='1' height='1' fill='#141a24'/><rect x='22' y='25' width='4' height='1' fill='#647a10'/><rect x='26' y='25' width='1' height='1' fill='#141a24'/><rect x='27' y='25' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='5' y='26' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='6' y='26' width='4' height='1' fill='#141a24'/><rect x='10' y='26' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='21' y='26' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='22' y='26' width='4' height='1' fill='#141a24'/><rect x='26' y='26' width='1' height='1' fill='rgba(0,0,0,.28)'/><rect x='6' y='27' width='4' height='1' fill='rgba(0,0,0,.28)'/><rect x='22' y='27' width='4' height='1' fill='rgba(0,0,0,.28)'/></svg>";
      ctx.aoParar(camada.estiloPagina('jogos-barra', '.nitro-toolbar .vl-icone-jogos { width: 32px; height: 32px; flex: none; align-self: center; cursor: pointer; '
        + 'background: url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CONTROLE) + '") center / 32px 32px no-repeat; image-rendering: pixelated; }'
        + ' .nitro-toolbar .vl-icone-jogos:hover { filter: drop-shadow(0 0 4px #d6f24a); }'));
      let iconeJogos = null;
      function cuidarDaBarra() {
        const vizinho = document.querySelector('.nitro-toolbar .vl-icone-barra') || document.querySelector('.nitro-toolbar .navigation-item.icon-camera') || document.querySelector('.nitro-toolbar .navigation-item.item-avatar');
        if (!vizinho) { if (iconeJogos) iconeJogos.remove(); return; }
        if (!iconeJogos) {
          iconeJogos = document.createElement('div');
          iconeJogos.className = 'navigation-item vl-icone-jogos';
          iconeJogos.setAttribute('role', 'button');
          iconeJogos.setAttribute('aria-label', 'Jogos do Vagalume');
          iconeJogos.title = 'Jogos do Vagalume';
          iconeJogos.addEventListener('click', function (ev) { ev.stopPropagation(); if (janela && janela.style.display !== 'none' && !partida) fechar(); else abrirHub(); });
        }
        if (vizinho.nextElementSibling !== iconeJogos) vizinho.after(iconeJogos);
      }
      let barraPendente = false;
      const observarBarra = new MutationObserver(function () {
        if (barraPendente) return;
        barraPendente = true;
        setTimeout(function () { barraPendente = false; cuidarDaBarra(); }, 300);
      });
      if (document.body) observarBarra.observe(document.body, { childList: true, subtree: true });
      cuidarDaBarra();
      ctx.aoParar(function () { observarBarra.disconnect(); if (iconeJogos) iconeJogos.remove(); });
      VL.jogosTabuleiro = { abrir, abrirHub, comecar, clicarCasa, partida: () => partida, aoDireto, receber };
      ctx.aoParar(() => { delete VL.jogosTabuleiro; });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
