// Vagalume — módulo "jogos": xadrez e damas jogáveis no tabuleiro do Habblet (pedido do usuário em 2026-11-22).
// Dois cliques num tabuleiro (o jogo manda "usar" o mobi) abrem a janela: escolhe o jogo e joga contra o bot ou
// contra outra pessoa com o Vagalume no mesmo quarto. A partida entre Vagalumes vai pelo canal direto da
// comunidade (servidor do Vagalume, só entre os dois): cada lance leva o número da jogada e é confirmado; se algo
// se perder, quem está atrás pede a posição. Regras em core/xadrez.js e core/damas.js.
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
  const VS = '︎'; // mostra o símbolo como texto, não como emoji

  const CSS = `
  .vl-jg { pointer-events: auto; position: fixed; z-index: 30; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(820px, calc(100vw - 24px));
    max-height: calc(100vh - 24px); display: flex; flex-direction: column; color: #e9eef7; font: 13px/1.4 system-ui, 'Segoe UI', sans-serif;
    background: linear-gradient(180deg, rgba(26,31,43,.97), rgba(16,19,27,.97)); border: 1px solid rgba(214,242,74,.35);
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
  .vl-jg-convite { pointer-events: auto; position: fixed; z-index: 31; right: 18px; bottom: 92px; width: 300px; padding: 14px; border-radius: 16px; color: #e9eef7; font: 13px system-ui, sans-serif;
    background: linear-gradient(180deg, #1d2333, #131722); border: 1px solid rgba(214,242,74,.55); box-shadow: 0 14px 40px rgba(0,0,0,.5), 0 0 24px rgba(214,242,74,.15); animation: vl-jg-pop .25s ease-out; }
  .vl-jg-convite p { margin: 8px 0 12px; }
  .vl-jg-convite .vl-jg-acoes { justify-content: flex-end; }
  @media (max-width: 720px) { .vl-jg-partida { flex-direction: column; align-items: center; } .vl-jg-escolha, .vl-jg-modos { grid-template-columns: 1fr; } }
  @media (prefers-reduced-motion: reduce) { .vl-jg-peca.nova, .vl-jg-disco.nova, .vl-jg-convite { animation: none; } }
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
  const sessaoValida = (s) => /^[a-f0-9]{16}$/.test(String(s || ''));
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
      let convidando = null; // { nome, sessao, jogo, cor, ate }
      const convitesRecebidos = new Map(); // sessao -> { nome, jogo, cor, cartao, relogio }

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
        janela = el('div', { class: 'vl-jg', role: 'dialog', 'aria-label': 'Jogos de tabuleiro do Vagalume', tabindex: '0' }, [el('style', { texto: CSS }), cab, corpo]);
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
      ctx.aoParar(function () { if (janela) janela.remove(); janela = null; for (const c of convitesRecebidos.values()) { clearTimeout(c.relogio); c.cartao.remove(); } convitesRecebidos.clear(); });

      function desenhar() {
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
      function cabeca(nome) {
        const c = el('span', { class: 'vl-jg-cabeca', 'aria-hidden': 'true', texto: String(nome || '?').charAt(0).toUpperCase() });
        const v = VL.pessoas && VL.pessoas.visualDe ? VL.pessoas.visualDe(nome) : null;
        if (v && v.visual) {
          const img = el('img', { alt: '', src: 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(v.visual) + '&headonly=1&direction=2&head_direction=3' });
          img.addEventListener('load', () => { c.textContent = ''; c.appendChild(img); });
        }
        return c;
      }
      function vagalumesNoQuarto() {
        const lista = VL.pessoas && VL.pessoas.lista ? VL.pessoas.lista() : [];
        return lista.filter((n) => VL.comunidade && VL.comunidade.usaVagalume && VL.comunidade.usaVagalume(n));
      }
      function telaInicio() {
        const pessoas = vagalumesNoQuarto();
        const listaPessoas = convidando
          ? el('div', { class: 'vl-jg-pessoa' }, [cabeca(convidando.nome), el('span', { texto: 'Esperando ' + convidando.nome + ' aceitar…' }), el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Cancelar', onclick: cancelarConvite })])
          : pessoas.length
            ? el('div', { class: 'vl-jg-pessoas' }, pessoas.map((n) => el('div', { class: 'vl-jg-pessoa' }, [cabeca(n), el('span', { texto: n }), el('button', { type: 'button', class: 'vl-jg-botao', texto: 'Convidar', 'data-foco': 'conv-' + n, onclick() { convidar(n); } })])))
            : el('p', { class: 'vl-jg-nota', texto: 'Ninguém com o Vagalume neste quarto agora. Quem usa o Vagalume aparece aqui (precisa da Comunidade Vagalume ligada).' });
        return [
          el('h3', { texto: 'Escolha o jogo' }),
          el('div', { class: 'vl-jg-escolha' }, [
            cartaoJogo('xadrez', '♞' + VS, 'Regras completas: roque, en passant, promoção, xeque-mate e empates.'),
            cartaoJogo('damas', '⛂' + VS, 'Regra brasileira: captura obrigatória pela maioria e dama voadora.'),
          ]),
          el('div', { class: 'vl-jg-modos' }, [
            el('section', { class: 'vl-jg-modo' }, [
              el('h3', { texto: 'Contra o bot' }),
              el('div', { class: 'vl-jg-linha' }, NIVEIS.map(([id, nome]) => chip(nome, escolha.nivel === id, () => { escolha.nivel = id; desenhar(); }, 'nivel-' + id))),
              el('div', { class: 'vl-jg-linha' }, [['w', 'Brancas'], ['b', 'Pretas'], ['?', 'Sorteio']].map(([id, nome]) => chip(nome, escolha.cor === id, () => { escolha.cor = id; desenhar(); }, 'cor-' + id))),
              el('button', { type: 'button', class: 'vl-jg-botao forte', 'data-foco': 'bot', texto: 'Jogar contra o bot', onclick() { comecar({ jogo: escolha.jogo, modo: 'bot', nivel: escolha.nivel, minhaCor: escolha.cor === '?' ? (Math.random() < 0.5 ? 'w' : 'b') : escolha.cor }); } }),
            ]),
            el('section', { class: 'vl-jg-modo' }, [
              el('h3', { texto: 'Contra alguém do quarto' }),
              listaPessoas,
              el('p', { class: 'vl-jg-nota', texto: 'Quem convida joga com as ' + (escolha.cor === 'b' ? 'pretas' : escolha.cor === '?' ? 'brancas ou as pretas, por sorteio' : 'brancas') + '. A outra pessoa precisa usar o Vagalume.' }),
            ]),
          ]),
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
        const regras = REGRAS[partida.jogo];
        const antes = partida.estado;
        partida.historico.push({ nota: regras.nota(antes, lance), cor: antes.vez });
        partida.estados.push(antes);
        partida.estado = regras.jogar(antes, lance);
        if (lance.capturas) partida.tomou[antes.vez] += lance.capturas.length;
        partida.ultimo = regras.ultimo(lance);
        partida.sel = null; partida.caminho = null; partida.promocao = null;
        partida.ply++;
        partida.novaCasa = lance.para != null ? lance.para : lance.caminho[lance.caminho.length - 1];
        if (ctx.secao().som !== false) tocar(regras.captura(lance));
        const st = regras.situacao(partida.estado);
        if (st.fim) partida.fim = st;
        if (meu && partida.modo === 'rede') mandarLance(regras.texto(lance));
        desenhar();
        if (!partida.fim && partida.modo === 'bot' && partida.estado.vez !== partida.minhaCor) setTimeout(vezDoBot, 60);
      }
      function vezDoBot() {
        if (!partida || partida.fim || partida.modo !== 'bot' || partida.estado.vez === partida.minhaCor) return;
        partida.pensando = true;
        desenhar();
        const p = partida;
        // Deixa a tela mostrar "Pensando…" antes de calcular (o cálculo segura a página por até ~1,5 s).
        setTimeout(function () {
          if (partida !== p || p.fim) return;
          const lance = REGRAS[p.jogo].melhor(p.estado, p.nivel);
          p.pensando = false;
          if (lance) aplicar(lance, false); else desenhar();
        }, 120);
      }
      function minhaVez() { return partida && !partida.fim && !partida.pensando && partida.estado.vez === partida.minhaCor && !(partida.modo === 'rede' && partida.pendente && partida.pendente.travado); }

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
        const e = p.estado;
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
            filhos.push(el('span', { class: 'vl-jg-peca ' + cor + (p.novaCasa === i ? ' nova' : ''), 'aria-hidden': 'true', texto: GLIFO[t] + VS }));
            rotulo += ', ' + NOME_PECA[t] + ' das ' + COR_NOME[cor];
          } else if (peca) {
            const cor = D.corDe(peca);
            filhos.push(el('span', { class: 'vl-jg-disco ' + cor + (p.novaCasa === i ? ' nova' : ''), 'aria-hidden': 'true' }, D.ehDama(peca) ? [el('span', { class: 'coroa', texto: '♛' + VS })] : []));
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
          if (p.modo === 'bot') acoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Voltar lance', disabled: !p.estados.length || p.pensando, onclick: voltarLance }));
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
        convidar(p.oponente, p.jogo, p.minhaCor === 'w' ? 'b' : 'w');
        partida = null;
        desenhar();
      }
      function sairDaPartida() {
        if (partida && partida.modo === 'rede' && !partida.fim) enviar({ t: 'jg:fim', m: 'saiu' });
        if (partida) escolha.jogo = partida.jogo;
        partida = null;
        desenhar();
      }

      // ---------- partida entre Vagalumes (canal direto) ----------
      function enviar(dado, para) {
        const alvo = para || (partida && partida.oponente);
        const sessao = dado.s || (partida && partida.sessao);
        if (!alvo || !VL.comunidade || !VL.comunidade.direto) return Promise.resolve(null);
        return VL.comunidade.direto(alvo, Object.assign({ s: sessao }, dado));
      }
      function convidar(nome, jogo, corPedida) {
        if (!VL.comunidade || !VL.comunidade.direto) { avisoInicio = 'Ligue a Comunidade Vagalume para jogar com outras pessoas.'; desenhar(); return; }
        const cor = corPedida || (escolha.cor === '?' ? (Math.random() < 0.5 ? 'w' : 'b') : escolha.cor);
        const sessao = novaSessao();
        convidando = { nome, sessao, jogo: jogo || escolha.jogo, cor };
        avisoInicio = '';
        enviar({ t: 'jg:convite', j: convidando.jogo, c: cor, s: sessao }, nome).then(function (r) {
          if (!convidando || convidando.sessao !== sessao) return;
          if (!r || r.erro) { convidando = null; avisoInicio = 'Não consegui mandar o convite para ' + nome + (r && r.erro === 'pessoa' ? ' (a pessoa saiu do quarto ou não está com o Vagalume).' : '.'); desenhar(); }
        });
        convidando.relogio = setTimeout(function () {
          if (!convidando || convidando.sessao !== sessao) return;
          convidando = null;
          avisoInicio = nome + ' não respondeu ao convite.';
          desenhar();
        }, 45000);
        abrir();
      }
      function cancelarConvite() {
        if (!convidando) return;
        clearTimeout(convidando.relogio);
        enviar({ t: 'jg:resposta', ok: false, cancelado: true, s: convidando.sessao }, convidando.nome);
        convidando = null;
        desenhar();
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
      function mostrarConvite(nome, d) {
        if (convitesRecebidos.has(d.s)) return;
        const minhaCor = d.c === 'w' ? 'b' : 'w';
        const cartao = el('div', { class: 'vl-jg-convite', role: 'dialog', 'aria-label': 'Convite para jogar' }, [
          el('style', { texto: CSS }),
          el('div', { style: 'display:flex;gap:10px;align-items:center' }, [cabeca(nome), el('b', { texto: nome })]),
          el('p', { texto: 'Convidou você para uma partida de ' + NOMES[d.j] + '. Você jogaria com as ' + COR_NOME[minhaCor] + '.' }),
          el('div', { class: 'vl-jg-acoes' }, [
            el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Recusar', onclick() { responder(false); } }),
            el('button', { type: 'button', class: 'vl-jg-botao forte', texto: 'Aceitar', onclick() { responder(true); } }),
          ]),
        ]);
        function tirar() { const c = convitesRecebidos.get(d.s); if (c) { clearTimeout(c.relogio); c.cartao.remove(); convitesRecebidos.delete(d.s); } }
        function responder(ok) {
          tirar();
          enviar({ t: 'jg:resposta', ok, s: d.s }, nome);
          if (!ok) return;
          if (partida && partida.modo === 'rede' && !partida.fim) enviar({ t: 'jg:fim', m: 'saiu' });
          comecar({ jogo: d.j, modo: 'rede', minhaCor, oponente: nome, sessao: d.s });
        }
        convitesRecebidos.set(d.s, { nome, cartao, relogio: setTimeout(tirar, 45000) });
        camada.area().appendChild(cartao);
        if (ctx.secao().som !== false) tocar(false);
      }
      function aoDireto(m) {
        if (!m || m.de !== 'sala' || m.tipo !== 'presenca:direto' || !m.dado || typeof m.dado !== 'object') return;
        const d = m.dado, nome = String(m.nome || '');
        if (!/^jg:/.test(String(d.t || '')) || !sessaoValida(d.s)) return;
        if (d.t === 'jg:convite') { if (NOMES[d.j] && (d.c === 'w' || d.c === 'b')) mostrarConvite(nome, d); return; }
        if (d.t === 'jg:resposta') {
          if (convidando && convidando.sessao === d.s && nomeChave(convidando.nome) === nomeChave(nome)) {
            clearTimeout(convidando.relogio);
            const c = convidando;
            convidando = null;
            if (d.ok) comecar({ jogo: c.jogo, modo: 'rede', minhaCor: c.cor, oponente: c.nome, sessao: c.sessao });
            else { avisoInicio = nome + ' recusou o convite.'; desenhar(); }
          } else if (d.cancelado) {
            const c = convitesRecebidos.get(d.s);
            if (c) { clearTimeout(c.relogio); c.cartao.remove(); convitesRecebidos.delete(d.s); }
          }
          return;
        }
        const p = partida;
        if (!p || p.modo !== 'rede' || p.sessao !== d.s || nomeChave(p.oponente) !== nomeChave(nome)) return;
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
      // O adversário saiu do quarto (ou do Vagalume): avisa e encerra depois de um tempo.
      const vigia = setInterval(function () {
        const p = partida;
        if (!p || p.modo !== 'rede' || p.fim || !VL.comunidade || !VL.comunidade.usaVagalume) return;
        if (VL.comunidade.usaVagalume(p.oponente)) { p.sumiuEm = 0; return; }
        p.sumiuEm = p.sumiuEm || Date.now();
        if (Date.now() - p.sumiuEm > 20000) encerrar({ fim: true, vencedor: null, motivo: p.oponente + ' saiu do quarto' });
      }, 5000);
      ctx.aoParar(() => clearInterval(vigia));
      // Tela de início aberta: a lista de quem usa o Vagalume no quarto se atualiza sozinha.
      const relogioLista = setInterval(function () { if (janela && janela.style.display !== 'none' && !partida && !minimizada) desenhar(); }, 4000);
      ctx.aoParar(() => clearInterval(relogioLista));
      ctx.aoParar(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () {
        // Quarto novo: a partida entre Vagalumes acaba (o canal é por quarto); contra o bot, continua.
        if (partida && partida.modo === 'rede' && !partida.fim) { enviar({ t: 'jg:fim', m: 'saiu' }); encerrar({ fim: true, vencedor: null, motivo: 'você mudou de quarto' }); }
      }));

      ctx.comando({
        nome: 'jogos',
        apelidos: ['xadrez', 'damas'],
        uso: 'jogos',
        descricao: 'Abre o xadrez e as damas do Vagalume (também abrem com dois cliques num tabuleiro de xadrez do quarto): contra o bot ou contra quem usa o Vagalume no quarto.',
        executar(pedido) {
          if (pedido && /^(xadrez|damas)$/.test(pedido.nome)) escolha.jogo = pedido.nome;
          abrir();
        },
      });
      // Para os testes: abrir e jogar sem a página.
      VL.jogosTabuleiro = { abrir, comecar, clicarCasa, partida: () => partida, aoDireto };
      ctx.aoParar(() => { delete VL.jogosTabuleiro; });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
