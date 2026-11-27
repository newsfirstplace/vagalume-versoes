// Vagalume — Vagacartas na mesa de jogos (regras em core/cartas.js).
// Arena noturna com raios de luz e vagalumes, os jogadores em volta (moldura, nome e quantas cartas, com o
// leque refletido), monte e descarte no meio com um anel na cor da vez, e a sua mão em leque embaixo.
// As cartas voam de quem joga até o descarte e do monte até quem compra; lances especiais aparecem grandes
// no meio da mesa (+2, +4, Pulou!, Inverteu!, a cor escolhida e "Última!").
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.cartas || !VL.camada) return;
  const K = VL.cartas;
  const el = VL.camada.el;
  const COR = { lima: '#a6cf26', azul: '#2f86e6', rosa: '#e6508f', laranja: '#f08a24' };
  const ESC = { lima: '#53700a', azul: '#123f7c', rosa: '#861b49', laranja: '#8f4706' };
  const NOME_COR = { lima: 'Lima', azul: 'Azul', rosa: 'Rosa', laranja: 'Laranja' };
  const SIMBOLO = { pular: '⊘', inverter: '⇄', '+2': '+2', coringa: '★', '+4': '+4' };
  const CSS = `
  .vl-vc { position: relative; display: grid; gap: 8px; }
  .vl-vc-arena { --cor-mesa: #d6f24a; position: relative; height: 392px; border-radius: 22px; overflow: hidden;
    background: radial-gradient(ellipse at 50% 50%, #34407e 0%, #1f2552 42%, #11142e 78%, #0a0c1c 100%);
    box-shadow: inset 0 0 0 1px rgba(214,242,74,.25), inset 0 0 80px rgba(0,0,0,.6), 0 14px 34px rgba(0,0,0,.5); }
  .vl-vc-raios { position: absolute; left: 50%; top: 52%; width: 1300px; height: 1300px; margin: -650px 0 0 -650px; pointer-events: none;
    background: repeating-conic-gradient(from 0deg, rgba(214,242,74,.08) 0deg 7deg, transparent 7deg 20deg);
    -webkit-mask-image: radial-gradient(circle, #000 0 14%, transparent 44%); mask-image: radial-gradient(circle, #000 0 14%, transparent 44%); animation: vl-vc-gira 70s linear infinite; }
  .vl-vc-anel { position: absolute; left: 50%; top: 53%; width: 340px; height: 176px; margin: -88px 0 0 -170px; border-radius: 50%; pointer-events: none;
    border: 2px solid color-mix(in srgb, var(--cor-mesa) 70%, #fff); box-shadow: 0 0 28px 5px color-mix(in srgb, var(--cor-mesa) 55%, transparent), inset 0 0 28px 2px color-mix(in srgb, var(--cor-mesa) 45%, transparent);
    animation: vl-vc-respira 2.4s ease-in-out infinite; transition: border-color .4s, box-shadow .4s; }
  .vl-vc-luz { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #efff9a; box-shadow: 0 0 8px 2px rgba(214,242,74,.85); opacity: 0; pointer-events: none; animation: vl-vc-voa 7s ease-in-out infinite; }
  .vl-vc-sentido { position: absolute; left: 50%; top: 53%; width: 372px; height: 196px; margin: -98px 0 0 -186px; pointer-events: none; opacity: .55; animation: vl-vc-gira 16s linear infinite; }
  .vl-vc-sentido.anti { animation-direction: reverse; }
  .vl-vc-din { position: absolute; inset: 0; }
  .vl-vc-assento { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 5px; z-index: 2; width: 128px; }
  .vl-vc-tag { max-width: 124px; padding: 2px 10px; border-radius: 7px; background: rgba(8,12,26,.8); border: 1px solid rgba(255,255,255,.14); color: #fff; font: 800 11.5px system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 2px 6px rgba(0,0,0,.4); }
  .vl-vc-assento.vez .vl-vc-tag { background: #d6f24a; border-color: #d6f24a; color: #1a2108; }
  .vl-vc-quadro { position: relative; width: 58px; height: 58px; border-radius: 15px; background: linear-gradient(160deg, #2d3762, #141a35); box-shadow: 0 0 0 3px rgba(255,255,255,.2), 0 6px 14px rgba(0,0,0,.5); display: grid; place-items: center; }
  .vl-vc-quadro .vl-jg-cabeca { width: 52px; height: 52px; border-radius: 12px; background: transparent; font-size: 22px; }
  .vl-vc-assento.vez .vl-vc-quadro { box-shadow: 0 0 0 3px #d6f24a, 0 0 24px rgba(214,242,74,.8); animation: vl-vc-pulso 1.1s ease-in-out infinite; }
  .vl-vc-qtd { position: absolute; right: -15px; bottom: -6px; min-width: 22px; height: 28px; padding: 0 4px; box-sizing: border-box; border-radius: 6px; background: #fff; color: #11142e; font: 900 14px/28px system-ui, sans-serif; text-align: center; box-shadow: 0 3px 8px rgba(0,0,0,.45), inset 0 -3px 0 rgba(0,0,0,.12); }
  .vl-vc-flag { position: absolute; left: -18px; top: -10px; padding: 2px 6px; border-radius: 6px; background: #ffd23a; color: #3a2a00; font: 900 10px system-ui, sans-serif; transform: rotate(-10deg); box-shadow: 0 2px 6px rgba(0,0,0,.4); }
  .vl-vc-leque { position: relative; height: 40px; width: 96px; -webkit-box-reflect: below 1px linear-gradient(transparent 55%, rgba(255,255,255,.2)); }
  .vl-vc-leque .vl-vc-carta { position: absolute; left: 50%; bottom: 0; margin-left: -13px; transform-origin: 50% 110%; }
  .vl-vc-eu-assento { left: 10%; top: 84%; }
  .vl-vc-centro { position: absolute; left: 50%; top: 53%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 40px; z-index: 1; }
  .vl-vc-monte { position: relative; border: 0; padding: 0; background: none; cursor: default; width: 84px; height: 122px; }
  .vl-vc-monte .vl-vc-carta { position: absolute; left: 0; top: 0; }
  .vl-vc-monte.pode { cursor: pointer; }
  .vl-vc-monte.pode .vl-vc-carta:nth-last-child(2) { box-shadow: inset 0 0 0 calc(var(--w) * .05) #fff, 0 0 0 3px #d6f24a, 0 0 24px rgba(214,242,74,.75); animation: vl-vc-pulso 1.1s ease-in-out infinite; }
  .vl-vc-monte .num { position: absolute; right: -10px; bottom: -8px; z-index: 2; font: 800 11px system-ui, sans-serif; padding: 2px 7px; border-radius: 999px; background: #0b0f22; color: #d6f24a; border: 1px solid rgba(214,242,74,.5); }
  .vl-vc-pilha { position: relative; width: 84px; height: 122px; }
  .vl-vc-pilha > span { position: absolute; left: 0; top: 0; }
  .vl-vc-cor { position: absolute; left: 50%; bottom: -32px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 2px 10px 2px 4px; border-radius: 999px; background: rgba(0,0,0,.5); color: #fff; font: 700 11.5px system-ui, sans-serif; white-space: nowrap; }
  .vl-vc-cor i { width: 14px; height: 14px; border-radius: 50%; background: var(--cor-mesa); box-shadow: 0 0 0 2px #fff, 0 0 10px var(--cor-mesa); }
  .vl-vc-msg { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); max-width: 62%; padding: 6px 14px; border-radius: 999px; background: rgba(6,9,20,.75); color: #e9eef7; font-size: 12.5px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 3; }
  .vl-vc-msg b { color: #d6f24a; }
  .vl-vc-anuncio { position: absolute; left: 50%; top: 47%; z-index: 7; pointer-events: none; font: 900 56px/1 system-ui, sans-serif; color: #fff; white-space: nowrap;
    -webkit-text-stroke: 2px #0b0f22; text-shadow: 0 5px 0 #0b0f22, 0 0 32px var(--cor-anuncio, #d6f24a); animation: vl-vc-anuncio 1.5s cubic-bezier(.2,1.4,.4,1) forwards; }
  .vl-vc-anuncio small { display: block; margin-top: 4px; text-align: center; font-size: 16px; -webkit-text-stroke: 0; text-shadow: 0 2px 4px #000; }
  .vl-vc-carta { --w: 80px; --cor: #333; --esc: #111; position: relative; width: var(--w); height: calc(var(--w) * 1.45); flex: none; border-radius: calc(var(--w) * .14); overflow: hidden; user-select: none; color: #fff;
    background: linear-gradient(145deg, color-mix(in srgb, var(--cor) 78%, #fff) 0%, var(--cor) 45%, var(--esc) 100%);
    box-shadow: inset 0 0 0 calc(var(--w) * .05) #fff, 0 2px 0 rgba(0,0,0,.25), 0 8px 16px rgba(0,0,0,.45); font-family: system-ui, 'Segoe UI', sans-serif; }
  .vl-vc-carta::before { content: ''; position: absolute; inset: calc(var(--w) * .1); border-radius: calc(var(--w) * .08); border: calc(var(--w) * .018) solid rgba(255,255,255,.55); }
  .vl-vc-carta::after { content: ''; position: absolute; inset: 0; background: linear-gradient(125deg, rgba(255,255,255,.3) 0 16%, transparent 30%); pointer-events: none; }
  .vl-vc-carta .luz { position: absolute; left: 50%; top: 50%; width: 62%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #fff 0 56%, color-mix(in srgb, var(--cor) 22%, #fff) 72%); box-shadow: 0 0 0 calc(var(--w) * .03) color-mix(in srgb, var(--cor) 35%, #fff), 0 0 calc(var(--w) * .2) rgba(255,255,255,.55); }
  .vl-vc-carta .valor { position: absolute; inset: 0; display: grid; place-items: center; font: 900 calc(var(--w) * .38)/1 system-ui, 'Segoe UI', sans-serif; color: var(--cor);
    -webkit-text-stroke: calc(var(--w) * .014) var(--esc); text-shadow: 0 calc(var(--w) * .025) 0 var(--esc); letter-spacing: -.04em; }
  .vl-vc-carta .canto { position: absolute; font: 900 calc(var(--w) * .17)/1 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 0 var(--esc), 0 0 3px rgba(0,0,0,.35); }
  .vl-vc-carta .c1 { left: 14%; top: 7%; } .vl-vc-carta .c2 { right: 14%; bottom: 7%; transform: rotate(180deg); }
  .vl-vc-carta.coringa { --cor: #2a2f4a; --esc: #0c0f20; }
  .vl-vc-carta.coringa .luz { background: conic-gradient(#e6508f 0 25%, #2f86e6 0 50%, #a6cf26 0 75%, #f08a24 0); box-shadow: 0 0 0 calc(var(--w) * .035) #fff, 0 0 calc(var(--w) * .22) rgba(255,255,255,.5); }
  .vl-vc-carta.coringa .valor { color: #fff; -webkit-text-stroke: calc(var(--w) * .016) #0c0f20; text-shadow: 0 calc(var(--w) * .03) 0 #0c0f20; }
  .vl-vc-carta.verso { --cor: #1b2346; --esc: #0b0f22; background: radial-gradient(circle at 50% 40%, rgba(214,242,74,.32), transparent 40%), repeating-linear-gradient(45deg, #182044 0 calc(var(--w) * .06), #1d2650 calc(var(--w) * .06) calc(var(--w) * .12)); }
  .vl-vc-carta.verso::before { border-color: rgba(214,242,74,.55); }
  .vl-vc-carta.verso .luz { width: 38%; top: 40%; background: radial-gradient(circle at 40% 35%, #fbffd6, #d6f24a 45%, #6f8f10 100%); box-shadow: 0 0 calc(var(--w) * .22) rgba(214,242,74,.9); }
  .vl-vc-carta.verso .valor { inset: auto 0 15% 0; display: block; text-align: center; font-size: calc(var(--w) * .15); color: #d6f24a; -webkit-text-stroke: 0; text-shadow: 0 0 6px rgba(214,242,74,.6); letter-spacing: .08em; }
  .vl-vc-carta.mini { --w: 26px; box-shadow: inset 0 0 0 1.5px #fff, 0 1px 3px rgba(0,0,0,.5); }
  .vl-vc-carta.mini .valor, .vl-vc-carta.mini::before { display: none; }
  .vl-vc-baixo { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-height: 36px; }
  .vl-vc-baixo .dica { margin-right: auto; color: #aab5c7; font-size: 12px; }
  .vl-vc-ultima { background: linear-gradient(180deg, #ffe066, #f5b81c) !important; color: #3a2a00 !important; border-color: #f5b81c !important; font-weight: 900 !important; animation: vl-vc-pulso 1s ease-in-out infinite; }
  .vl-vc-mao { position: relative; display: flex; justify-content: center; align-items: flex-end; height: 150px; padding: 20px 8px 12px; }
  .vl-vc-mao button { all: unset; position: relative; cursor: default; transition: transform .16s ease, filter .16s; transform-origin: 50% 130%; border-radius: 12px; }
  .vl-vc-mao button.pode { cursor: pointer; }
  .vl-vc-mao button.pode .vl-vc-carta { box-shadow: inset 0 0 0 calc(var(--w) * .05) #fff, 0 0 0 2px #d6f24a, 0 0 18px rgba(214,242,74,.6), 0 8px 16px rgba(0,0,0,.45); }
  .vl-vc-mao button.nao { filter: brightness(.55) saturate(.7); }
  .vl-vc-mao button:focus-visible { outline: 2px solid #d6f24a; outline-offset: 3px; }
  .vl-vc-escolha { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; background: rgba(6,10,20,.55); }
  .vl-vc-roda { position: relative; width: 200px; height: 200px; display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 6px; transform: rotate(45deg); animation: vl-vc-roda .3s cubic-bezier(.2,1.4,.4,1); }
  .vl-vc-roda button { border: 3px solid #fff; cursor: pointer; transition: transform .12s, filter .12s; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
  .vl-vc-roda button:hover, .vl-vc-roda button:focus-visible { transform: scale(1.07); filter: brightness(1.12); outline: none; }
  .vl-vc-roda button:nth-child(1) { border-radius: 100% 6px 6px 6px; } .vl-vc-roda button:nth-child(2) { border-radius: 6px 100% 6px 6px; }
  .vl-vc-roda button:nth-child(3) { border-radius: 6px 6px 6px 100%; } .vl-vc-roda button:nth-child(4) { border-radius: 6px 6px 100% 6px; }
  .vl-vc-roda b { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-45deg); width: 90px; height: 90px; border-radius: 50%; display: grid; place-items: center; text-align: center; background: #10152c; color: #fff; font: 800 12px/1.2 system-ui, sans-serif; box-shadow: 0 0 0 3px #fff; pointer-events: none; }
  .vl-vc-voo { position: absolute; left: 0; top: 0; z-index: 9; pointer-events: none; }
  @keyframes vl-vc-gira { to { transform: rotate(360deg); } }
  @keyframes vl-vc-pulso { 50% { filter: brightness(1.25); } }
  @keyframes vl-vc-respira { 50% { opacity: .55; } }
  @keyframes vl-vc-voa { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: .9; } 70% { opacity: .5; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)); } }
  @keyframes vl-vc-roda { from { transform: rotate(45deg) scale(.4); opacity: 0; } }
  @keyframes vl-vc-anuncio { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3) rotate(-8deg); } 18% { opacity: 1; transform: translate(-50%, -50%) scale(1.12) rotate(2deg); }
    30% { transform: translate(-50%, -50%) scale(1) rotate(0deg); } 78% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -62%) scale(1.04); } }
  @media (max-width: 640px) { .vl-vc-arena { height: 330px; } .vl-vc-carta { --w: 62px; } .vl-vc-centro { gap: 24px; } .vl-vc-anuncio { font-size: 40px; } }
  @media (prefers-reduced-motion: reduce) { .vl-vc-raios, .vl-vc-anel, .vl-vc-luz, .vl-vc-sentido, .vl-vc-assento.vez .vl-vc-quadro, .vl-vc-monte.pode .vl-vc-carta, .vl-vc-ultima { animation: none; } .vl-vc-luz { opacity: .6; } }
  `;
  const rotulo = (c) => (c.cor ? NOME_COR[c.cor] + ' ' : '') + ({ pular: 'Pular', inverter: 'Inverter', '+2': 'Mais dois', coringa: 'Coringa', '+4': 'Coringa mais quatro' }[c.valor] || c.valor);
  function carta(c, w) {
    const especial = c.cor == null;
    const marca = SIMBOLO[c.valor] || c.valor;
    return el('div', { class: 'vl-vc-carta' + (especial ? ' coringa' : ''), style: (c.cor ? '--cor:' + COR[c.cor] + ';--esc:' + ESC[c.cor] + ';' : '') + (w ? '--w:' + w + 'px' : ''), role: 'img', 'aria-label': rotulo(c) }, [
      el('i', { class: 'luz' }), el('b', { class: 'valor', texto: c.valor === 'coringa' ? '' : marca }),
      el('span', { class: 'canto c1', texto: marca }), el('span', { class: 'canto c2', texto: marca }),
    ]);
  }
  const verso = (w) => el('div', { class: 'vl-vc-carta verso' + (w && w < 40 ? ' mini' : ''), style: w ? '--w:' + w + 'px' : null, 'aria-hidden': 'true' }, [el('i', { class: 'luz' }), el('b', { class: 'valor', texto: 'VAGA' })]);
  // Desenho em SVG feito nó a nó (sem HTML em texto).
  function svg(tag, attrs, filhos) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k of Object.keys(attrs || {})) n.setAttribute(k, attrs[k]);
    for (const f of filhos || []) n.appendChild(f);
    return n;
  }
  const giroDe = (id) => ((Number(id) * 37) % 29) - 14; // cada carta cai no descarte com um ângulo próprio

  VL.mesa.registrar('cartas', {
    nome: 'Vagacartas', glifo: '🃏', min: 2, max: 6,
    texto: 'Jogue a mesma cor ou o mesmo número da carta de cima. Pular, Inverter, +2 e Coringas mudam tudo. Avise "Última!" antes de ficar com uma carta. Ganha quem esvaziar a mão.',
    fatos: ['De 2 a 6 jogadores', 'Com bots', '108 cartas em 4 cores'],
    bots: [['normal', 'Bot']],
    nova: (jogadores) => K.nova(jogadores),
    aplicar: (e, nome, a) => K.aplicar(e, nome, a),
    tick: (e) => K.tick(e),
    sair: (e, nome) => K.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.texto || e.fim.ordem[0] + ' ficou sem cartas!', detalhe: Object.fromEntries(e.fim.ordem.map((n) => [n, (e.maos[n] ? e.maos[n].length : 0) + ' cartas na mão'])) } : null),
    visao: (e, nome) => K.visao(e, nome),
    montar(api) {
      // Parte fixa da arena (raios, vagalumes, anel da cor, sentido); o resto é redesenhado a cada lance.
      const luzes = Array.from({ length: 14 }, function (_, i) {
        const x = 6 + ((i * 37) % 88), y = 8 + ((i * 53) % 80), dx = ((i * 29) % 60) - 30, dy = -20 - ((i * 17) % 50);
        return el('i', { class: 'vl-vc-luz', style: 'left:' + x + '%;top:' + y + '%;--dx:' + dx + 'px;--dy:' + dy + 'px;animation-delay:' + (i * 0.55).toFixed(2) + 's;animation-duration:' + (5 + (i % 5)) + 's' });
      });
      const sentido = el('div', { class: 'vl-vc-sentido', 'aria-hidden': 'true' }, [svg('svg', { viewBox: '0 0 372 196', width: '372', height: '196' }, [
        svg('ellipse', { cx: '186', cy: '98', rx: '180', ry: '92', fill: 'none', stroke: '#d6f24a', 'stroke-width': '2', 'stroke-dasharray': '8 12' }),
        svg('path', { d: 'M350 74 l20 20 l-27 4z', fill: '#d6f24a' }), svg('path', { d: 'M22 122 l-20 -20 l27 -4z', fill: '#d6f24a' }),
      ])]);
      const din = el('div', { class: 'vl-vc-din' });
      const arena = el('div', { class: 'vl-vc-arena', 'aria-label': 'Mesa' }, [el('div', { class: 'vl-vc-raios', 'aria-hidden': 'true' })].concat(luzes, [el('div', { class: 'vl-vc-anel', 'aria-hidden': 'true' }), sentido, din]));
      const dica = el('span', { class: 'dica' });
      const acoes = el('div', { class: 'vl-vc-baixo' }, [dica]);
      const mao = el('div', { class: 'vl-vc-mao', 'aria-label': 'Suas cartas' });
      const raizEl = el('div', { class: 'vl-vc' }, [el('style', { texto: CSS }), arena, acoes, mao]);
      let v = null, escolhendo = null, ultimoN = null, eraMinha = false;
      const ultimasAvisadas = {};
      const assentos = new Map();
      let monteEl = null, pilhaTopo = null, meuAssento = null;
      // Voo de uma carta (ou de um verso) de um retângulo da tela para outro, por cima de tudo.
      function voar(no, de, para, atraso, giro) {
        const base = raizEl.getBoundingClientRect();
        if (!de || !para || !no.animate) return;
        const caixa = el('div', { class: 'vl-vc-voo' }, [no]);
        raizEl.appendChild(caixa);
        const w = no.offsetWidth || 80, h = no.offsetHeight || 116;
        const x0 = de.left - base.left + de.width / 2 - w / 2, y0 = de.top - base.top + de.height / 2 - h / 2;
        const x1 = para.left - base.left + para.width / 2 - w / 2, y1 = para.top - base.top + para.height / 2 - h / 2;
        const s0 = Math.max(0.3, Math.min(1, de.width / w));
        const a = caixa.animate([
          { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(' + s0 + ') rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + (x0 + x1) / 2 + 'px,' + ((y0 + y1) / 2 - 30) + 'px) scale(' + (s0 + 1) / 2 * 1.08 + ') rotate(' + (giro || 0) / 2 + 'deg)', opacity: 1, offset: 0.5 },
          { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(1) rotate(' + (giro || 0) + 'deg)', opacity: 1 },
        ], { duration: 460, delay: atraso || 0, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'both' });
        a.onfinish = () => caixa.remove();
        setTimeout(() => caixa.remove(), 460 + (atraso || 0) + 400); // com a aba escondida a animação fica parada
        setTimeout(() => api.som('carta'), atraso || 0);
      }
      // Lance especial grande no meio da mesa.
      function anunciar(texto, cor, sub) {
        const velho = arena.querySelector('.vl-vc-anuncio');
        if (velho) velho.remove();
        const a = el('div', { class: 'vl-vc-anuncio', style: '--cor-anuncio:' + (cor || '#d6f24a') }, [texto, sub ? el('small', { texto: sub }) : null]);
        arena.appendChild(a);
        setTimeout(() => a.remove(), 1600);
      }
      function assento(o, x, y, classe) {
        const leque = el('div', { class: 'vl-vc-leque', 'aria-hidden': 'true' });
        const mostra = Math.min(o.cartas, 8);
        for (let i = 0; i < mostra; i++) { const g = (i - (mostra - 1) / 2) * 8; const c = verso(26); c.style.transform = 'translateX(' + (g * 1.1) + 'px) rotate(' + g + 'deg)'; leque.appendChild(c); }
        const quadro = el('div', { class: 'vl-vc-quadro' }, [api.cabeca(o.nome), el('span', { class: 'vl-vc-qtd', title: o.cartas + ' cartas', texto: o.cartas }), o.ultima && o.cartas <= 1 ? el('span', { class: 'vl-vc-flag', texto: 'Última!' }) : null]);
        return el('div', { class: 'vl-vc-assento ' + (classe || '') + (o.nome === v.vez && !v.fim ? ' vez' : ''), style: x != null ? 'left:' + x + '%;top:' + y + '%' : null }, [
          el('span', { class: 'vl-vc-tag', texto: o.nome === api.eu ? 'Você' : o.nome }), quadro, o.nome === api.eu ? null : leque,
        ]);
      }
      function desenhar() {
        if (!v) return;
        const minha = v.vez === api.eu && !v.fim;
        const n = v.outros.length;
        const souIdx = Math.max(0, v.outros.findIndex((o) => o.nome === api.eu));
        // Retângulos de antes (para as cartas voarem de onde estavam).
        const antesMao = new Map([...mao.querySelectorAll('[data-id]')].map((b) => [b.getAttribute('data-id'), b.getBoundingClientRect()]));
        arena.style.setProperty('--cor-mesa', COR[v.cor] || '#d6f24a');
        sentido.classList.toggle('anti', v.sentido < 0);
        // Jogadores em volta, no sentido do jogo a partir de mim; eu no canto de baixo.
        assentos.clear();
        const filhos = [];
        for (let k = 1; k < n; k++) {
          const o = v.outros[(souIdx + k) % n];
          const ang = Math.PI - k * Math.PI / n;
          const a = assento(o, 50 + 41 * Math.cos(ang), 46 - 30 * Math.sin(ang));
          assentos.set(o.nome, a);
          filhos.push(a);
        }
        const eu = v.outros[souIdx];
        meuAssento = eu ? assento(eu, null, null, 'vl-vc-eu-assento') : null;
        if (meuAssento) { assentos.set(api.eu, meuAssento); filhos.push(meuAssento); }
        const pode = minha && v.comprada == null;
        monteEl = el('button', { type: 'button', class: 'vl-vc-monte' + (pode ? ' pode' : ''), disabled: !pode, title: pode ? 'Comprar uma carta' : 'Monte', 'aria-label': 'Monte: ' + v.pilha + ' cartas' + (pode ? '. Comprar uma carta' : ''), onclick() { if (pode) api.agir({ tipo: 'comprar' }); } },
          [3, 2, 1, 0].map(function (k) { const c = verso(); c.style.transform = 'translate(' + (-k * 2) + 'px,' + (k * 2) + 'px)'; return c; }).concat([el('span', { class: 'num', texto: v.pilha })]));
        const pilha = el('div', { class: 'vl-vc-pilha' });
        const desc = (v.descarte && v.descarte.length ? v.descarte : [v.topo]);
        desc.forEach(function (c, i) {
          const ultima = i === desc.length - 1;
          const w = el('span', { style: 'transform: rotate(' + giroDe(c.id) + 'deg) translate(' + (ultima ? 0 : (i - desc.length) * 2) + 'px,' + (ultima ? 0 : (i - desc.length)) + 'px)' }, [carta(c)]);
          if (ultima) pilhaTopo = w;
          pilha.appendChild(w);
        });
        pilha.appendChild(el('div', { class: 'vl-vc-cor' }, [el('i'), 'Cor: ' + (NOME_COR[v.cor] || '—')]));
        filhos.push(el('div', { class: 'vl-vc-centro' }, [monteEl, pilha]));
        const u = v.ultimaJogada;
        const quem = (nome) => (nome === api.eu ? 'Você' : nome);
        const txt = u ? quem(u.nome) + ' ' + (u.tipo === 'jogou' ? 'jogou ' + rotulo(u.carta) + (u.carta.cor ? '' : ' (' + NOME_COR[u.cor] + ')') + (u.vitima ? ' e ' + quem(u.vitima) + ' comprou ' + u.qtd : '') + (u.esqueceu ? ' e esqueceu do "Última!": +2' : '')
          : u.tipo === 'comprou' ? 'comprou uma carta' : 'passou a vez') + '. ' : '';
        filhos.push(el('div', { class: 'vl-vc-msg', role: 'status', 'aria-live': 'polite' }, v.fim ? [] : [txt, el('b', { texto: minha ? (v.comprada != null ? 'Jogue a comprada ou passe.' : 'Sua vez!') : 'Vez de ' + v.vez + '.' })]));
        if (escolhendo != null && minha) {
          filhos.push(el('div', { class: 'vl-vc-escolha' }, [el('div', { class: 'vl-vc-roda', role: 'group', 'aria-label': 'Escolha a cor' },
            K.CORES.map((cor) => el('button', { type: 'button', title: NOME_COR[cor], 'aria-label': NOME_COR[cor], style: 'background:' + COR[cor], onclick() { const id = escolhendo; escolhendo = null; api.agir({ tipo: 'jogar', id, cor }); } }))
              .concat([el('b', { texto: 'Escolha a cor' })]))]));
        }
        din.replaceChildren(...filhos);
        // Botões e dica.
        const botoes = [];
        if (escolhendo != null && minha) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Voltar', onclick() { escolhendo = null; desenhar(); } }));
        if (minha && v.comprada != null) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao', texto: 'Passar a vez', onclick() { api.agir({ tipo: 'passar' }); } }));
        if (minha && v.comprada == null) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Comprar', onclick() { api.agir({ tipo: 'comprar' }); } }));
        if (v.mao.length === 2 && !v.avisei && !v.fim) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao vl-vc-ultima', texto: 'Última!', title: 'Avise antes de jogar a penúltima carta', onclick() { api.agir({ tipo: 'ultima' }); } }));
        const servem = minha ? v.mao.filter((c) => K.serve({ descarte: [v.topo], cor: v.cor }, c) && (v.comprada == null || c.id === v.comprada)).length : 0;
        dica.textContent = v.fim ? '' : minha ? (servem ? 'Clique numa carta que brilha para jogar.' : v.comprada == null ? 'Nenhuma carta serve: compre do monte.' : 'A comprada não serve: passe a vez.') : '';
        acoes.replaceChildren(dica, ...botoes);
        // Mão em leque: as que servem sobem com um brilho.
        const largura = Math.max(320, (mao.clientWidth || 840) - 20), w = 80, qtd = v.mao.length;
        const passo = Math.min(w * 0.8, (largura - w) / Math.max(1, qtd - 1));
        const giro = Math.min(5, 52 / Math.max(1, qtd));
        mao.replaceChildren(...v.mao.map(function (c, i) {
          const serve = minha && K.serve({ descarte: [v.topo], cor: v.cor }, c) && (v.comprada == null || c.id === v.comprada);
          const d = i - (qtd - 1) / 2, base = 'translateY(' + (d * d * 0.6 - (serve ? 16 : 0)) + 'px) rotate(' + (d * giro) + 'deg)';
          const b = el('button', { type: 'button', 'data-id': String(c.id), class: serve ? 'pode' : minha ? 'nao' : '', 'aria-label': rotulo(c) + (serve ? '' : ' (não serve agora)'),
            style: 'margin-left:' + (i ? (passo - w) : 0) + 'px;z-index:' + (i + 1) + ';transform:' + base,
            onclick() {
              if (!serve) return;
              if (!c.cor) { escolhendo = c.id; desenhar(); return; }
              api.agir({ tipo: 'jogar', id: c.id });
            } }, [carta(c)]);
          if (serve) {
            b.addEventListener('mouseenter', () => { b.style.transform = 'translateY(-34px) rotate(' + (d * giro * 0.4) + 'deg) scale(1.05)'; b.style.zIndex = '60'; });
            b.addEventListener('mouseleave', () => { b.style.transform = base; b.style.zIndex = String(i + 1); });
          }
          return b;
        }));
        // Animações do lance novo (uma vez por lance).
        if (u && u.n != null && u.n !== ultimoN) {
          const primeira = ultimoN == null;
          ultimoN = u.n;
          if (!primeira) animarLance(u, antesMao);
        }
        // "Última!" de alguém: aviso grande no meio.
        for (const o of v.outros) {
          if (o.ultima && !ultimasAvisadas[o.nome]) anunciar('ÚLTIMA!', '#ffd23a', o.nome === api.eu ? 'Você avisou' : o.nome + ' avisou');
          ultimasAvisadas[o.nome] = o.ultima;
        }
        if (minha && !eraMinha) api.som('vez');
        eraMinha = minha;
      }
      const retDe = (nome) => (assentos.get(nome) ? assentos.get(nome).querySelector('.vl-vc-quadro').getBoundingClientRect() : null);
      function animarLance(u, antesMao) {
        const monte = monteEl ? monteEl.getBoundingClientRect() : null;
        if (u.tipo === 'jogou' && pilhaTopo) {
          const de = u.nome === api.eu ? (antesMao.get(String(u.carta.id)) || retDe(u.nome)) : retDe(u.nome);
          const para = pilhaTopo.getBoundingClientRect();
          pilhaTopo.style.visibility = 'hidden';
          const alvo = pilhaTopo;
          voar(carta(u.carta), de, para, 0, giroDe(u.carta.id));
          setTimeout(() => { alvo.style.visibility = ''; }, 470);
          const cor = COR[u.cor] || '#d6f24a';
          if (u.carta.valor === '+2' || u.carta.valor === '+4') setTimeout(() => anunciar(u.carta.valor, cor, u.vitima ? (u.vitima === api.eu ? 'Você compra ' : u.vitima + ' compra ') + u.qtd : ''), 380);
          else if (u.carta.valor === 'pular') setTimeout(() => anunciar('⊘', cor, 'Pulou a vez!'), 380);
          else if (u.carta.valor === 'inverter') setTimeout(() => anunciar('⇄', cor, 'Inverteu!'), 380);
          else if (u.carta.valor === 'coringa') setTimeout(() => anunciar(NOME_COR[u.cor] || '', cor, 'Cor escolhida'), 380);
          if (u.vitima) for (let k = 0; k < u.qtd; k++) voarParaMao(u.vitima, monte, 420 + k * 140);
          if (u.esqueceu) { setTimeout(() => anunciar('+2', '#ffd23a', 'Esqueceu do "Última!"'), 380); for (let k = 0; k < 2; k++) voarParaMao(u.nome, monte, 420 + k * 140); }
        } else if (u.tipo === 'comprou') voarParaMao(u.nome, monte, 0);
      }
      // Carta comprada: do monte para quem comprou (na minha mão, a carta de verdade aparece quando o verso chega).
      function voarParaMao(nome, monte, atraso) {
        if (nome !== api.eu) { voar(verso(36), monte, retDe(nome), atraso); return; }
        setTimeout(function () {
          const cartas = mao.querySelectorAll('[data-id]'), alvo = cartas[cartas.length - 1];
          if (!alvo) return;
          alvo.style.visibility = 'hidden';
          voar(verso(), monte, alvo.getBoundingClientRect(), 0);
          setTimeout(() => { alvo.style.visibility = ''; }, 470);
        }, atraso);
      }
      return { el: raizEl, atualizar(nova) { if (nova && nova.vez !== api.eu) escolhendo = null; v = nova; desenhar(); } };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
