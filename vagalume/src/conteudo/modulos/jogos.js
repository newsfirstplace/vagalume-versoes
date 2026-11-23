// Vagalume — módulo "jogos": xadrez e damas jogáveis (pedido do usuário em 2026-11-22).
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

  const NOMES = { xadrez: 'Xadrez', damas: 'Damas' };
  const NIVEIS = [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']];
  const GLIFO = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const NOME_PECA = { k: 'rei', q: 'dama', r: 'torre', b: 'bispo', n: 'cavalo', p: 'peão' };
  const COR_NOME = { w: 'brancas', b: 'pretas' };
  const TORRES = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] }; // roque: de onde para onde a torre anda
  // Jogos da janela e da aba Jogos (os próximos entram aqui).
  const JOGOS = [
    { id: 'xadrez', glifo: '♞', texto: 'Regras completas: roque, en passant, promoção, xeque-mate e empates.' },
    { id: 'damas', glifo: '⛂', texto: 'Regra brasileira: captura obrigatória pela maioria e dama voadora.' },
  ];
  // Convite de amigo no console: jogo (x/d), cor de quem convida (w/b) e a sala da partida ("9" + 11 dígitos).
  const CODIGO_CONVITE = /vl-jogo-([xd])([wb])(9\d{11})/;
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
  .vl-jg-escolha { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .vl-jg-cartao { display: flex; gap: 12px; align-items: center; padding: 14px; border-radius: 14px; cursor: pointer; text-align: left; color: inherit;
    border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); transition: transform .12s, border-color .12s, background .12s; }
  .vl-jg-cartao:hover { transform: translateY(-1px); border-color: rgba(214,242,74,.5); }
  .vl-jg-cartao.ativo { border-color: #d6f24a; background: rgba(214,242,74,.12); box-shadow: 0 0 0 1px rgba(214,242,74,.35), 0 6px 22px rgba(214,242,74,.12); }
  .vl-jg-cartao .vl-jg-mini { width: 54px; height: 54px; border-radius: 10px; display: grid; place-items: center; font-size: 34px;
    background: conic-gradient(#e8edd0 0 25%, #74954e 0 50%, #e8edd0 0 75%, #74954e 0) 0 0 / 27px 27px; color: #fff;
    -webkit-text-stroke: 1.2px #1d2330; text-shadow: 0 2px 3px rgba(0,0,0,.4); }
  .vl-jg-cartao b { display: block; font-size: 16px; margin-bottom: 2px; }
  .vl-jg-cartao small { color: #aab5c7; }
  .vl-jg-modos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .vl-jg-modo { padding: 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.03); }
  .vl-jg-linha { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 10px; }
  .vl-jg-chip { padding: 6px 11px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); color: #dfe6f2; cursor: pointer; font: inherit; }
  .vl-jg-chip.ativo { background: #d6f24a; color: #1a2108; border-color: #d6f24a; font-weight: 600; }
  .vl-jg-botao { padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(214,242,74,.5); background: rgba(214,242,74,.14); color: #f2ffc0; cursor: pointer; font: 600 13px system-ui, sans-serif; }
  .vl-jg-botao:hover:not(:disabled) { background: rgba(214,242,74,.26); }
  .vl-jg-botao.forte { background: #d6f24a; color: #1a2108; border-color: #d6f24a; }
  .vl-jg-botao.forte:hover:not(:disabled) { background: #e4ff66; }
  .vl-jg-botao.discreto { border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.05); color: #dfe6f2; font-weight: 500; }
  .vl-jg-botao:disabled { opacity: .45; cursor: default; }
  .vl-jg-pessoas { display: flex; flex-direction: column; gap: 6px; max-height: 190px; overflow: auto; }
  .vl-jg-pessoa { display: flex; align-items: center; gap: 9px; padding: 6px 8px; border-radius: 10px; background: rgba(255,255,255,.04); }
  .vl-jg-pessoa > span:not(.vl-jg-cabeca) { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vl-jg-cabeca { width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex: none; background: rgba(214,242,74,.15); display: grid; place-items: center; font-weight: 700; color: #d6f24a; }
  .vl-jg-cabeca img { width: 54px; height: 78px; margin-top: 10px; object-fit: none; image-rendering: pixelated; }
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
  .vl-jg-modo.largo { grid-column: 1 / -1; }
  .vl-jg-amigos { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; max-height: 176px; overflow: auto; }
  .vl-jg-vel { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 12px; color: #9aa6b8; font-size: 12px; }
  .vl-jg-lado .vl-jg-vel { margin-top: 0; }
  .vl-jg-vel .vl-jg-chip { padding: 4px 10px; font-size: 12px; }
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
  @media (max-width: 720px) { .vl-jg-partida { flex-direction: column; align-items: center; } .vl-jg-escolha, .vl-jg-modos { grid-template-columns: 1fr; } }
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
        abrir();
      }));

      // ---------- janela ----------
      let janela = null, corpo = null, minimizada = false;
      let escolha = { jogo: 'xadrez', nivel: 'medio', cor: 'w' };
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
      function linhaVelocidade() {
        const v = velocidade();
        return el('div', { class: 'vl-jg-vel', role: 'group', 'aria-label': 'Velocidade das jogadas' }, [
          el('span', { texto: 'Velocidade das jogadas:' }),
          chip('Um pouco mais lenta', v === 'lenta', () => escolherVelocidade('lenta'), 'vel-lenta'),
          chip('Rápida', v === 'rapida', () => escolherVelocidade('rapida'), 'vel-rapida'),
        ]);
      }

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
          el('span', { class: 'vl-jg-ic', 'aria-hidden': 'true', texto: '♞' + VS }),
          el('b', { texto: 'Jogos de tabuleiro' }), el('span', { class: 'vl-jg-esp' }),
          el('button', { type: 'button', class: 'vl-jg-min', title: 'Minimizar', 'aria-label': 'Minimizar', texto: '−', onclick: alternarMinimizada }),
          el('button', { type: 'button', title: 'Fechar', 'aria-label': 'Fechar', texto: '×', onclick: fechar }),
        ]);
        corpo = el('div', { class: 'vl-jg-corpo' });
        janela = el('div', { class: 'vl-jg', role: 'dialog', 'aria-label': 'Jogos de tabuleiro do Vagalume', tabindex: '0' }, [cab, corpo]);
        janela.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); if (partida && partida.promocao) { partida.promocao = null; desenhar(); } else fechar(); } });
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
        janela.classList.toggle('damas', (partida ? partida.jogo : escolha.jogo) === 'damas');
        camada.trocar(corpo, partida ? telaPartida() : telaInicio());
      }

      // ---------- início: escolher o jogo e o adversário ----------
      function cartaoJogo(id, glifo, texto) {
        return el('button', { type: 'button', class: 'vl-jg-cartao' + (escolha.jogo === id ? ' ativo' : ''), 'aria-pressed': String(escolha.jogo === id), 'data-foco': 'jogo-' + id,
          onclick() { escolha.jogo = id; desenhar(); } }, [
          el('span', { class: 'vl-jg-mini', 'aria-hidden': 'true', texto: glifo }),
          el('span', null, [el('b', { texto: NOMES[id] }), el('small', { texto })]),
        ]);
      }
      function chip(texto, ativo, fn, foco) { return el('button', { type: 'button', class: 'vl-jg-chip' + (ativo ? ' ativo' : ''), 'aria-pressed': String(!!ativo), 'data-foco': foco, onclick: fn, texto }); }
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
      function linhaEspera() {
        const c = convidando;
        return el('div', { class: 'vl-jg-pessoa' }, [cabeca(c.nome), el('span', { texto: 'Esperando ' + c.nome + ' aceitar…' }),
          el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Cancelar', 'data-foco': 'cancelar-convite', onclick: cancelarConvite })]);
      }
      function amigosOnline() {
        const lista = VL.amigos && VL.amigos.lista ? VL.amigos.lista() : [];
        return lista.filter((a) => a && a.online && a.id != null && a.nome).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
      }
      function telaInicio() {
        const pessoas = vagalumesNoQuarto();
        const listaPessoas = convidando && convidando.via === 'quarto' ? linhaEspera()
          : pessoas.length
            ? el('div', { class: 'vl-jg-pessoas' }, pessoas.map((n) => el('div', { class: 'vl-jg-pessoa' }, [cabeca(n), el('span', { texto: n }), el('button', { type: 'button', class: 'vl-jg-botao', texto: 'Convidar', 'data-foco': 'conv-' + n, onclick() { convidar({ via: 'quarto', nome: n }); } })])))
            : el('p', { class: 'vl-jg-nota', texto: 'Ninguém com o Vagalume neste quarto agora. Quem usa o Vagalume aparece aqui (precisa da Comunidade Vagalume ligada).' });
        const amigos = amigosOnline();
        const listaAmigos = convidando && convidando.amigo ? linhaEspera()
          : amigos.length
            ? el('div', { class: 'vl-jg-amigos' }, amigos.map((a) => el('div', { class: 'vl-jg-pessoa' }, [cabeca(a.nome, a.visual), el('span', { texto: a.nome }), el('button', { type: 'button', class: 'vl-jg-botao', texto: 'Convidar', 'data-foco': 'amigo-' + a.id, onclick() { convidarAmigo(a); } })])))
            : el('p', { class: 'vl-jg-nota', texto: VL.amigos ? 'Nenhum amigo online agora.' : 'Ligue "Amigos e console" para chamar amigos de outros quartos.' });
        const comQual = escolha.cor === 'b' ? 'pretas' : escolha.cor === '?' ? 'brancas ou as pretas, por sorteio' : 'brancas';
        return [
          el('h3', { texto: 'Escolha o jogo' }),
          el('div', { class: 'vl-jg-escolha' }, JOGOS.map((j) => cartaoJogo(j.id, j.glifo + VS, j.texto))),
          el('div', { class: 'vl-jg-modos' }, [
            el('section', { class: 'vl-jg-modo' }, [
              el('h3', { texto: 'Contra o bot' }),
              el('div', { class: 'vl-jg-linha' }, NIVEIS.map(([id, nome]) => chip(nome, escolha.nivel === id, () => { escolha.nivel = id; desenhar(); }, 'nivel-' + id))),
              el('div', { class: 'vl-jg-linha' }, [['w', 'Brancas'], ['b', 'Pretas'], ['?', 'Sorteio']].map(([id, nome]) => chip(nome, escolha.cor === id, () => { escolha.cor = id; desenhar(); }, 'cor-' + id))),
              el('button', { type: 'button', class: 'vl-jg-botao forte', 'data-foco': 'bot', texto: 'Jogar contra o bot', onclick() { comecar({ jogo: escolha.jogo, modo: 'bot', nivel: escolha.nivel, minhaCor: corEscolhida() }); } }),
            ]),
            el('section', { class: 'vl-jg-modo' }, [
              el('h3', { texto: 'Contra alguém do quarto' }),
              listaPessoas,
              el('p', { class: 'vl-jg-nota', texto: 'Quem convida joga com as ' + comQual + '. A outra pessoa precisa usar o Vagalume.' }),
            ]),
            el('section', { class: 'vl-jg-modo largo' }, [
              el('h3', { texto: 'Chamar um amigo de outro quarto' }),
              listaAmigos,
              el('p', { class: 'vl-jg-nota', texto: 'O convite chega no console do amigo e toca como uma chamada; cada um joga do quarto em que está. Ele também precisa usar o Vagalume.' }),
            ]),
          ]),
          linhaVelocidade(),
          el('p', { class: 'vl-jg-aviso', role: 'status', texto: avisoInicio || '' }),
        ];
      }
      let avisoInicio = '';

      // ---------- partida ----------
      function comecar(o) {
        const regras = REGRAS[o.jogo];
        partida = {
          jogo: o.jogo, modo: o.modo, nivel: o.nivel, minhaCor: o.minhaCor, oponente: o.oponente || null, sessao: o.sessao || null,
          estado: o.posicao ? regras.dePosicao(o.posicao) : regras.novo(), estados: [], historico: [], ultimo: [], sel: null, caminho: null, promocao: null, fim: null,
          ply: 0, tomou: { w: 0, b: 0 }, pendente: null, empateProposto: null, virado: o.minhaCor === 'b', pensando: false,
          via: o.via || 'quarto', oponenteId: o.oponenteId != null ? String(o.oponenteId) : null, animando: false, fila: [], job: null, mostrado: null,
        };
        avisoInicio = '';
        if (!janela) montarJanela();
        abrir();
        desenhar();
        if (o.modo === 'bot' && partida.estado.vez !== partida.minhaCor) setTimeout(vezDoBot, 400);
      }
      function nomeDe(cor) {
        if (!partida) return '';
        if (cor === partida.minhaCor) return (VL.pessoas && VL.pessoas.eu && VL.pessoas.eu()) || 'Você';
        return partida.modo === 'bot' ? 'Bot ' + NIVEIS.find(([id]) => id === partida.nivel)[1].toLowerCase() : partida.oponente;
      }
      function aplicar(lance, meu) {
        const p = partida;
        const regras = REGRAS[p.jogo];
        const antes = p.estado;
        p.historico.push({ nota: regras.nota(antes, lance), cor: antes.vez });
        p.estados.push(antes);
        p.estado = regras.jogar(antes, lance);
        if (lance.capturas) p.tomou[antes.vez] += lance.capturas.length;
        p.sel = null; p.caminho = null; p.promocao = null;
        p.ply++;
        const st = regras.situacao(p.estado);
        if (st.fim) p.fim = st;
        if (meu && p.modo === 'rede') mandarLance(regras.texto(lance));
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
        if (!tab || typeof tab.animate !== 'function' || semMovimento() || minimizada || janela.style.display === 'none') {
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

      function telaPartida() {
        const p = partida;
        const regras = REGRAS[p.jogo];
        const e = p.mostrado || p.estado; // durante a animação, a posição do lance que está na tela
        const lado = 'min(448px, calc(100vh - 170px), calc(100vw - 80px))';
        const todos = minhaVez() ? regras.lances(e) : [];
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
          if (p.ultimo.includes(i)) classes.push('ultimo');
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
          casas.push(el('div', { class: classes.join(' '), role: 'button', tabindex: clicavel ? '0' : '-1', 'aria-label': rotulo, onclick() { clicarCasa(i); },
            onkeydown(ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); clicarCasa(i); } } }, filhos));
        }
        p.novaCasa = null;
        const tab = el('div', { class: 'vl-jg-tab', style: '--lado: ' + lado }, casas);
        if (p.promocao) {
          const cor = e.vez;
          tab.appendChild(el('div', { class: 'vl-jg-promo' }, [el('div', null, p.promocao.map((m) => el('button', { type: 'button', title: NOME_PECA[m.promo.toLowerCase()], 'aria-label': 'Promover a ' + NOME_PECA[m.promo.toLowerCase()],
            onclick() { aplicar(m, true); } }, [el('span', { class: 'vl-jg-peca ' + cor, style: 'font-size:40px', texto: GLIFO[m.promo.toLowerCase()] + VS })])))]));
        }
        const eu = p.minhaCor;
        const tomadas = (cor) => el('div', { class: 'vl-jg-tomadas ' + (cor === 'w' ? 'pretas' : 'brancas'), title: 'Peças tomadas', texto: tomadasPor(cor) });
        const jogador = (cor) => el('div', { class: 'vl-jg-jogador' + (!p.fim && e.vez === cor ? ' vez' : '') }, [
          p.modo === 'bot' && cor !== eu ? el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: '🤖' }) : cabeca(nomeDe(cor)),
          el('span', { class: 'nome' }, [el('b', { texto: nomeDe(cor) }), el('small', { texto: (cor === 'w' ? 'Brancas' : 'Pretas') + (!p.fim && e.vez === cor ? ' · jogando' : '') })]),
          el('span', { class: 'vl-jg-cor ' + cor, 'aria-hidden': 'true' }),
        ]);
        let estado;
        if (p.fim) estado = regras.motivoFim(p.fim, p.minhaCor, p.modo);
        else if (p.pensando) estado = 'O bot está pensando…';
        else if (e.vez === eu) estado = (reiEmXeque >= 0 ? 'Xeque! ' : '') + (p.pendente && p.pendente.travado ? 'Sem resposta de ' + p.oponente + '…' : 'Sua vez.') + (p.jogo === 'damas' && todos.length && todos[0].capturas.length ? ' Captura obrigatória: ' + todos[0].capturas.length + (todos[0].capturas.length > 1 ? ' peças.' : ' peça.') : '');
        else estado = (reiEmXeque >= 0 ? 'Xeque! ' : '') + 'Vez de ' + nomeDe(e.vez) + '.';
        if (p.empateProposto === 'deles' && !p.fim) estado += ' ' + p.oponente + ' propôs empate.';
        const lances = [];
        for (let k = 0; k < p.historico.length; k += 2) {
          lances.push(el('span', { class: 'n', texto: (k / 2 + 1) + '.' }));
          lances.push(el('span', { class: k === p.historico.length - 1 ? 'ult' : '', texto: p.historico[k].nota }));
          lances.push(el('span', { class: k + 1 === p.historico.length - 1 ? 'ult' : '', texto: p.historico[k + 1] ? p.historico[k + 1].nota : '' }));
        }
        const listaLances = el('div', { class: 'vl-jg-lances', 'aria-label': 'Lances' }, lances);
        setTimeout(() => { listaLances.scrollTop = listaLances.scrollHeight; }, 0);
        const acoes = [];
        if (!p.fim) {
          if (p.modo === 'bot') acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Voltar lance', disabled: !p.estados.length || p.pensando || p.animando, onclick: voltarLance }));
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
        acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Outro jogo', onclick: sairDaPartida }));
        return [el('div', { class: 'vl-jg-partida' }, [
          tab,
          el('div', { class: 'vl-jg-lado' }, [
            jogador(p.virado ? 'w' : 'b'), tomadas(p.virado ? 'w' : 'b'),
            el('div', { class: 'vl-jg-estado' + (p.fim ? ' fim' : ''), role: 'status', 'aria-live': 'polite', texto: estado }),
            listaLances,
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
        p.fim = null; p.sel = null; p.caminho = null; p.ultimo = [];
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
        if (p.modo === 'bot') { comecar({ jogo: p.jogo, modo: 'bot', nivel: p.nivel, minhaCor: p.minhaCor === 'w' ? 'b' : 'w' }); return; }
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
        avisoInicio = '';
        enviar({ t: 'jg:convite', j: c.jogo, c: c.cor, s: c.sessao }, alvo).then(function (r) {
          if (convidando !== c) return;
          if (!r || r.erro) { convidando = null; avisoInicio = 'Não consegui mandar o convite para ' + c.nome + (r && r.erro === 'pessoa' ? ' (a pessoa saiu do quarto ou não está com o Vagalume).' : '.'); desenhar(); }
        });
        c.relogio = setTimeout(function () { if (convidando !== c) return; convidando = null; avisoInicio = c.nome + ' não respondeu ao convite.'; desenhar(); }, 45000);
        abrir();
      }
      // Chamar um amigo de outro quarto: abre a sala da partida e manda o convite no console dele.
      const textoDoConvite = (c) => '♟ Bora jogar ' + NOMES[c.jogo] + '? Convite do Vagalume: vl-jogo-' + (c.jogo === 'damas' ? 'd' : 'x') + c.cor + c.sessao;
      function convidarAmigo(a) {
        if (!meuId() || !eu()) { avisoInicio = 'Ligue a Conexão do jogo para chamar amigos.'; desenhar(); return; }
        if (convidando) cancelarConvite();
        const c = convidando = { via: 'canal', nome: a.nome, id: String(a.id), sessao: novoCanal(), jogo: escolha.jogo, cor: corEscolhida(), amigo: true };
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
      function mandarLance(texto) {
        const p = partida;
        p.pendente = { n: p.ply, l: texto, tentativas: 0, travado: false };
        const tentar = function () {
          if (partida !== p || !p.pendente || p.pendente.l !== texto) return;
          p.pendente.tentativas++;
          enviar({ t: 'jg:lance', n: p.pendente.n, l: texto });
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
          el('div', { class: 'vl-jg-chamada-anel' }, [foto, el('span', { class: 'vl-jg-chamada-jogo', 'aria-hidden': 'true', texto: (o.jogo === 'damas' ? '⛂' : '♞') + VS })]),
          el('b', { texto: o.nome }),
          el('p', { texto: 'Chamou você para jogar ' + NOMES[o.jogo] + '. Você joga com as ' + COR_NOME[o.minhaCor] + '.' }),
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
            comecar({ jogo: d.j, modo: 'rede', via: de.via, minhaCor, oponente: de.nome, oponenteId: de.id, sessao: d.s });
          } });
      }
      // Convite de um amigo de outro quarto, pelo console.
      ctx.ouvir('amigos:mensagem', function (d) {
        const m = d && CODIGO_CONVITE.exec(String(d.texto || ''));
        if (!m || d.de == null) return;
        const de = { via: 'canal', nome: d.autor || 'Um amigo', id: String(d.de) };
        const jogo = m[1] === 'd' ? 'damas' : 'xadrez', minhaCor = m[2] === 'w' ? 'b' : 'w', sessao = m[3];
        if ((partida && partida.sessao === sessao) || (chamada && chamada.sessao === sessao)) return;
        mostrarChamada({ sessao, nome: de.nome, jogo, minhaCor, recusar() { recusarAmigo(de, sessao); }, aceitar() { aceitarAmigo(de, sessao, jogo, minhaCor); } });
      });
      function aceitarAmigo(de, sessao, jogo, minhaCor) {
        if (!meuId() || !eu()) { camada.aviso('Ligue a Conexão do jogo para jogar com amigos.', { tipo: 'erro' }); return; }
        largarPartida(sessao);
        entrarNoCanal(sessao).then(() => esperarNoCanal(de.id, 8000)).then(function (chegou) {
          if (!chegou) { sairDoCanal(sessao); camada.aviso('O convite de ' + de.nome + ' não vale mais.'); return; }
          enviar({ t: 'jg:resposta', ok: true, s: sessao }, de);
          comecar({ jogo, modo: 'rede', via: 'canal', minhaCor, oponente: de.nome, oponenteId: de.id, sessao });
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
        if (!/^jg:/.test(String(d.t || '')) || !sessaoValida(d.s)) return;
        if (d.t === 'jg:convite') { if (NOMES[d.j] && (d.c === 'w' || d.c === 'b')) conviteDireto(de, d); return; }
        if (d.t === 'jg:resposta') {
          const c = convidando;
          if (c && c.sessao === d.s && mesmaPessoa(c, de)) {
            clearTimeout(c.relogio);
            convidando = null;
            if (d.ok) {
              largarPartida(de.via === 'canal' && canal ? canal.id : null);
              comecar({ jogo: c.jogo, modo: 'rede', via: c.via, minhaCor: c.cor, oponente: c.nome, oponenteId: c.id, sessao: c.sessao });
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
        const regras = REGRAS[p.jogo];
        if (d.t === 'jg:lance') {
          const n = Number(d.n);
          if (n <= p.ply) { enviar({ t: 'jg:ok', n }); return; } // repetido: só confirma de novo
          if (n !== p.ply + 1 || p.estado.vez === p.minhaCor || p.fim) { enviar({ t: 'jg:pedirEstado' }); return; }
          const lance = regras.lanceDe(p.estado, String(d.l || '').slice(0, 80));
          if (!lance) { enviar({ t: 'jg:pedirEstado' }); return; }
          aplicar(lance, false);
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
          encerrar({ fim: true, vencedor: p.minhaCor, motivo: d.m === 'desistiu' ? p.oponente + ' desistiu' : p.oponente + ' saiu da partida' });
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
        apelidos: ['xadrez', 'damas'],
        uso: 'jogos',
        descricao: 'Abre o xadrez e as damas do Vagalume (também pela aba Jogos do painel ou com dois cliques num tabuleiro de xadrez do quarto): contra o bot, contra quem usa o Vagalume no quarto ou chamando um amigo de outro quarto.',
        executar(pedido) {
          if (pedido && /^(xadrez|damas)$/.test(pedido.nome)) escolha.jogo = pedido.nome;
          abrir();
        },
      });
      // Para os testes: abrir e jogar sem a página.
      // ---------- aba Jogos do painel (pedido do usuário: mais jogos vão entrar aqui) ----------
      ctx.aba({
        id: 'jogos',
        titulo: 'Jogos',
        ordem: 4,
        montar(alvo) {
          const cartoes = JOGOS.map((j) => el('button', { type: 'button', class: 'vl-jg-cartao', 'aria-label': 'Jogar ' + NOMES[j.id], onclick() {
            if (!partida || partida.fim) { if (partida) sairDaPartida(); escolha.jogo = j.id; }
            abrir();
          } }, [
            el('span', { class: 'vl-jg-mini', 'aria-hidden': 'true', texto: j.glifo + VS }),
            el('span', null, [el('b', { texto: NOMES[j.id] }), el('small', { texto: j.texto })]),
            el('span', { class: 'vl-jg-botao forte vl-jg-jogar', 'aria-hidden': 'true', texto: 'Jogar' }),
          ]));
          cartoes.push(el('div', { class: 'vl-jg-cartao embreve' }, [
            el('span', { class: 'vl-jg-mais', 'aria-hidden': 'true', texto: '+' }),
            el('span', null, [el('b', { texto: 'Mais jogos em breve' }), el('small', { texto: 'Os próximos jogos vão aparecer aqui.' })]),
          ]));
          alvo.replaceChildren(el('div', { class: 'vl-jg-pagina' }, [
            el('p', { class: 'vl-nota', texto: 'Jogue contra o bot, contra quem usa o Vagalume no quarto ou chame um amigo de outro quarto. Dois cliques num tabuleiro de xadrez do quarto também abrem o jogo.' }),
            el('div', { class: 'vl-jg-lista' }, cartoes),
          ]));
        },
      });
      VL.jogosTabuleiro = { abrir, comecar, clicarCasa, partida: () => partida, aoDireto, receber };
      ctx.aoParar(() => { delete VL.jogosTabuleiro; });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
