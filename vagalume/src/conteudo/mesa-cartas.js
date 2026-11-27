// Vagalume — Vagacartas na mesa de jogos (regras em core/cartas.js).
// Mesa de feltro com os jogadores em volta, monte e descarte no meio, a sua mão em leque embaixo. As cartas
// voam de quem joga até o descarte e do monte até quem compra.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.cartas || !VL.camada) return;
  const K = VL.cartas;
  const el = VL.camada.el;
  const COR = { lima: '#a9d02a', azul: '#2f86e6', rosa: '#e6508f', laranja: '#f08a24' };
  const NOME_COR = { lima: 'Lima', azul: 'Azul', rosa: 'Rosa', laranja: 'Laranja' };
  const SIMBOLO = { pular: '⊘', inverter: '⇄', '+2': '+2', coringa: '', '+4': '+4' };
  const CANTO = { pular: '⊘', inverter: '⇄', '+2': '+2', coringa: '★', '+4': '+4' };
  const CSS = `
  .vl-vc { position: relative; display: grid; gap: 10px; }
  .vl-vc-mesa { position: relative; height: 320px; border-radius: 170px / 120px; background: radial-gradient(ellipse at 50% 55%, #2f7a54 0%, #1f5a3d 52%, #143a28 78%, #0e2a1d 100%);
    box-shadow: inset 0 0 0 10px #3a2617, inset 0 0 0 13px #1d130b, inset 0 0 0 15px rgba(214,242,74,.35), inset 0 0 60px rgba(0,0,0,.55), 0 14px 34px rgba(0,0,0,.5); overflow: hidden; }
  .vl-vc-mesa::before { content: ''; position: absolute; inset: 15px; border-radius: inherit; background: repeating-radial-gradient(circle at 50% 55%, rgba(255,255,255,.018) 0 2px, transparent 2px 5px); pointer-events: none; }
  .vl-vc-sentido { position: absolute; left: 50%; top: 58%; width: 300px; height: 150px; margin: -75px 0 0 -150px; pointer-events: none; opacity: .5; animation: vl-vc-gira 14s linear infinite; }
  .vl-vc-sentido.anti { animation-direction: reverse; }
  .vl-vc-assento { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 3px; width: 116px; text-align: center; z-index: 2; }
  .vl-vc-assento .vl-jg-cabeca { width: 40px; height: 40px; box-shadow: 0 0 0 2px rgba(255,255,255,.25), 0 4px 10px rgba(0,0,0,.45); background-color: #1b2230; }
  .vl-vc-assento b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #fff; text-shadow: 0 1px 3px #000; }
  .vl-vc-assento.vez .vl-jg-cabeca { box-shadow: 0 0 0 3px #d6f24a, 0 0 18px rgba(214,242,74,.8); animation: vl-vc-vez 1.2s ease-in-out infinite; }
  .vl-vc-leque { position: relative; height: 26px; width: 70px; }
  .vl-vc-leque i { position: absolute; left: 50%; bottom: 0; width: 17px; height: 25px; margin-left: -8px; border-radius: 3px; transform-origin: 50% 100%; background: repeating-linear-gradient(45deg, #1b2433 0 3px, #26334a 3px 6px); box-shadow: inset 0 0 0 1.5px #fff, 0 1px 3px rgba(0,0,0,.5); }
  .vl-vc-qtd { font: 800 11px system-ui, sans-serif; padding: 1px 8px; border-radius: 999px; background: rgba(0,0,0,.45); color: #fff; }
  .vl-vc-assento.vez .vl-vc-qtd { background: #d6f24a; color: #1a2108; }
  .vl-vc-balao { position: absolute; top: -10px; left: 50%; transform: translate(-50%, -100%); padding: 4px 10px; border-radius: 10px; background: #ffe066; color: #3a2a00; font: 900 12px system-ui, sans-serif; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,.4); animation: vl-vc-balao 2.4s ease forwards; }
  .vl-vc-balao::after { content: ''; position: absolute; left: 50%; bottom: -5px; margin-left: -5px; border: 5px solid transparent; border-bottom: 0; border-top-color: #ffe066; }
  .vl-vc-centro { position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 34px; z-index: 1; }
  .vl-vc-monte { position: relative; border: 0; padding: 0; background: none; cursor: default; }
  .vl-vc-monte .vl-vc-carta:nth-child(1) { position: absolute; left: -4px; top: 4px; }
  .vl-vc-monte .vl-vc-carta:nth-child(2) { position: absolute; left: -2px; top: 2px; }
  .vl-vc-monte.pode { cursor: pointer; }
  .vl-vc-monte.pode .vl-vc-carta:last-child { box-shadow: inset 0 0 0 3.5px #fff, 0 0 0 3px #d6f24a, 0 0 22px rgba(214,242,74,.75); animation: vl-vc-vez 1.2s ease-in-out infinite; }
  .vl-vc-monte .num { position: absolute; right: -10px; bottom: -8px; z-index: 2; font: 800 11px system-ui, sans-serif; padding: 2px 7px; border-radius: 999px; background: #10151f; color: #d6f24a; border: 1px solid rgba(214,242,74,.5); }
  .vl-vc-pilha { position: relative; width: 74px; height: 110px; }
  .vl-vc-pilha::before { content: ''; position: absolute; left: 50%; top: 50%; width: 132px; height: 132px; margin: -66px 0 0 -66px; border-radius: 50%; background: radial-gradient(circle, var(--cor-mesa) 0%, transparent 68%); opacity: .55; transition: background .4s; }
  .vl-vc-pilha > span { position: absolute; left: 0; top: 0; }
  .vl-vc-cor { position: absolute; left: 50%; bottom: -30px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 2px 10px 2px 4px; border-radius: 999px; background: rgba(0,0,0,.45); color: #fff; font: 700 11.5px system-ui, sans-serif; white-space: nowrap; }
  .vl-vc-cor i { width: 14px; height: 14px; border-radius: 50%; background: var(--cor-mesa); box-shadow: 0 0 0 2px #fff, 0 0 10px var(--cor-mesa); }
  .vl-vc-msg { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); max-width: 82%; padding: 6px 14px; border-radius: 999px; background: rgba(8,12,18,.72); color: #e9eef7; font-size: 12.5px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 3; }
  .vl-vc-msg b { color: #d6f24a; }
  .vl-vc-carta { --w: 70px; --cor: #333; position: relative; width: var(--w); height: calc(var(--w) * 1.5); flex: none; border-radius: calc(var(--w) * .13); background: var(--cor); overflow: hidden; color: #fff; user-select: none;
    box-shadow: inset 0 0 0 calc(var(--w) * .055) #fff, 0 2px 0 rgba(0,0,0,.22), 0 6px 14px rgba(0,0,0,.42); font-family: system-ui, 'Segoe UI', sans-serif; }
  .vl-vc-carta::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.24), transparent 42%, rgba(0,0,0,.14)); pointer-events: none; }
  .vl-vc-carta .oval { position: absolute; left: 50%; top: 50%; width: 76%; height: 58%; transform: translate(-50%, -50%) rotate(-32deg); border-radius: 50%; background: #fff; }
  .vl-vc-carta .centro { position: absolute; inset: 0; display: grid; place-items: center; font: 900 calc(var(--w) * .46)/1 system-ui, 'Segoe UI', sans-serif; color: var(--cor); letter-spacing: -.04em;
    text-shadow: calc(var(--w) * .025) calc(var(--w) * .025) 0 rgba(0,0,0,.28); -webkit-text-stroke: calc(var(--w) * .012) rgba(0,0,0,.35); }
  .vl-vc-carta .canto { position: absolute; font: 900 calc(var(--w) * .19)/1 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 0 rgba(0,0,0,.45); }
  .vl-vc-carta .c1 { left: 12%; top: 8%; } .vl-vc-carta .c2 { right: 12%; bottom: 8%; transform: rotate(180deg); }
  .vl-vc-carta.coringa { --cor: #15171d; }
  .vl-vc-carta.coringa .oval { background: conic-gradient(from 45deg, #e6508f 0 25%, #2f86e6 0 50%, #a9d02a 0 75%, #f08a24 0); box-shadow: 0 0 0 calc(var(--w) * .03) #fff; }
  .vl-vc-carta.coringa .centro { color: #fff; -webkit-text-stroke: calc(var(--w) * .015) #111; }
  .vl-vc-carta.verso { --cor: #172030; background: radial-gradient(circle at 50% 50%, rgba(214,242,74,.3), transparent 46%), repeating-linear-gradient(45deg, #182131 0 5px, #1f2a3e 5px 10px); }
  .vl-vc-carta.verso .oval { background: #0f141d; box-shadow: inset 0 0 0 calc(var(--w) * .03) #d6f24a, 0 0 calc(var(--w) * .12) rgba(214,242,74,.35); }
  .vl-vc-carta.verso .centro { color: #d6f24a; font-size: calc(var(--w) * .17); -webkit-text-stroke: 0; text-shadow: 0 0 6px rgba(214,242,74,.7); transform: rotate(-32deg); letter-spacing: .05em; }
  .vl-vc-carta.mini { --w: 30px; }
  .vl-vc-baixo { display: flex; align-items: center; gap: 10px; }
  .vl-vc-eu { display: flex; align-items: center; gap: 8px; min-width: 150px; }
  .vl-vc-eu b { font-size: 13px; } .vl-vc-eu small { display: block; color: #8f9bb0; font-size: 11px; }
  .vl-vc-eu.vez .vl-jg-cabeca { box-shadow: 0 0 0 3px #d6f24a, 0 0 16px rgba(214,242,74,.7); }
  .vl-vc-acoes { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .vl-vc-ultima { background: linear-gradient(180deg, #ffe066, #f5b81c) !important; color: #3a2a00 !important; border-color: #f5b81c !important; font-weight: 900 !important; animation: vl-vc-vez 1s ease-in-out infinite; }
  .vl-vc-mao { position: relative; display: flex; justify-content: center; align-items: flex-end; height: 128px; padding: 18px 8px 14px; }
  .vl-vc-mao button { all: unset; position: relative; cursor: default; transition: transform .16s ease, filter .16s; transform-origin: 50% 130%; border-radius: 10px; }
  .vl-vc-mao button.pode { cursor: pointer; }
  .vl-vc-mao button.pode .vl-vc-carta { box-shadow: inset 0 0 0 calc(var(--w) * .055) #fff, 0 0 0 2px #d6f24a, 0 0 16px rgba(214,242,74,.55), 0 6px 14px rgba(0,0,0,.42); }
  .vl-vc-mao button.nao { filter: brightness(.55) saturate(.7); }
  .vl-vc-mao button:focus-visible { outline: 2px solid #d6f24a; outline-offset: 3px; }
  .vl-vc-escolha { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: rgba(6,10,16,.55); border-radius: inherit; }
  .vl-vc-roda { position: relative; width: 190px; height: 190px; display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 6px; transform: rotate(45deg); animation: vl-vc-roda .3s cubic-bezier(.2,1.4,.4,1); }
  .vl-vc-roda button { border: 3px solid #fff; cursor: pointer; transition: transform .12s, filter .12s; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
  .vl-vc-roda button:hover, .vl-vc-roda button:focus-visible { transform: scale(1.07); filter: brightness(1.12); outline: none; }
  .vl-vc-roda button:nth-child(1) { border-radius: 100% 6px 6px 6px; } .vl-vc-roda button:nth-child(2) { border-radius: 6px 100% 6px 6px; }
  .vl-vc-roda button:nth-child(3) { border-radius: 6px 6px 6px 100%; } .vl-vc-roda button:nth-child(4) { border-radius: 6px 6px 100% 6px; }
  .vl-vc-roda b { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-45deg); width: 86px; height: 86px; border-radius: 50%; display: grid; place-items: center; text-align: center; background: #10151f; color: #fff; font: 800 12px/1.2 system-ui, sans-serif; box-shadow: 0 0 0 3px #fff; pointer-events: none; }
  .vl-vc-voo { position: absolute; left: 0; top: 0; z-index: 8; pointer-events: none; }
  @keyframes vl-vc-gira { to { transform: rotate(360deg); } }
  @keyframes vl-vc-vez { 50% { filter: brightness(1.25); } }
  @keyframes vl-vc-balao { 0% { opacity: 0; transform: translate(-50%, -60%) scale(.6); } 12% { opacity: 1; transform: translate(-50%, -100%) scale(1.08); } 20% { transform: translate(-50%, -100%) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes vl-vc-roda { from { transform: rotate(45deg) scale(.4); opacity: 0; } }
  @media (max-width: 640px) { .vl-vc-mesa { height: 290px; } .vl-vc-carta { --w: 58px; } .vl-vc-centro { gap: 22px; } }
  @media (prefers-reduced-motion: reduce) { .vl-vc-sentido, .vl-vc-assento.vez .vl-jg-cabeca, .vl-vc-monte.pode .vl-vc-carta, .vl-vc-ultima { animation: none; } }
  `;
  const rotulo = (c) => (c.cor ? NOME_COR[c.cor] + ' ' : '') + ({ pular: 'Pular', inverter: 'Inverter', '+2': 'Mais dois', coringa: 'Coringa', '+4': 'Coringa mais quatro' }[c.valor] || c.valor);
  function carta(c, w) {
    const especial = c.cor == null;
    return el('div', { class: 'vl-vc-carta' + (especial ? ' coringa' : ''), style: (c.cor ? '--cor:' + COR[c.cor] + ';' : '') + (w ? '--w:' + w + 'px' : ''), role: 'img', 'aria-label': rotulo(c) }, [
      el('i', { class: 'oval' }), el('b', { class: 'centro', texto: SIMBOLO[c.valor] != null ? SIMBOLO[c.valor] : c.valor }),
      el('span', { class: 'canto c1', texto: CANTO[c.valor] || c.valor }), el('span', { class: 'canto c2', texto: CANTO[c.valor] || c.valor }),
    ]);
  }
  const verso = (w) => el('div', { class: 'vl-vc-carta verso', style: w ? '--w:' + w + 'px' : null, 'aria-hidden': 'true' }, [el('i', { class: 'oval' }), el('b', { class: 'centro', texto: 'VAGA' })]);
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
      const mesaEl = el('div', { class: 'vl-vc-mesa', 'aria-label': 'Mesa' });
      const eu = el('div', { class: 'vl-vc-eu' });
      const acoes = el('div', { class: 'vl-vc-acoes' });
      const mao = el('div', { class: 'vl-vc-mao', 'aria-label': 'Suas cartas' });
      const raizEl = el('div', { class: 'vl-vc' }, [el('style', { texto: CSS }), mesaEl, el('div', { class: 'vl-vc-baixo' }, [eu, acoes]), mao]);
      let v = null, escolhendo = null, ultimoN = null, ultimasAvisadas = {}, eraMinha = false;
      const assentos = new Map();
      let monteEl = null, pilhaTopo = null;
      // Voo de uma carta (ou de um verso) de um retângulo da tela para outro, por cima de tudo.
      function voar(no, de, para, atraso, giro) {
        const base = raizEl.getBoundingClientRect();
        if (!de || !para || !no.animate) return;
        const caixa = el('div', { class: 'vl-vc-voo' }, [no]);
        raizEl.appendChild(caixa);
        const w = no.offsetWidth || 70, h = no.offsetHeight || 105;
        const x0 = de.left - base.left + de.width / 2 - w / 2, y0 = de.top - base.top + de.height / 2 - h / 2;
        const x1 = para.left - base.left + para.width / 2 - w / 2, y1 = para.top - base.top + para.height / 2 - h / 2;
        const s0 = Math.max(0.3, Math.min(1, de.width / w));
        caixa.style.opacity = '0';
        const a = caixa.animate([
          { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(' + s0 + ') rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(1) rotate(' + (giro || 0) + 'deg)', opacity: 1 },
        ], { duration: 430, delay: atraso || 0, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'both' });
        a.onfinish = () => caixa.remove();
        setTimeout(() => caixa.remove(), 430 + (atraso || 0) + 400); // com a aba escondida a animação fica parada
        setTimeout(() => api.som('carta'), atraso || 0);
      }
      function desenhar() {
        if (!v) return;
        const minha = v.vez === api.eu && !v.fim;
        const n = v.outros.length;
        const souIdx = Math.max(0, v.outros.findIndex((o) => o.nome === api.eu));
        // Retângulos de antes (para as cartas voarem de onde estavam).
        const antesMao = new Map([...mao.querySelectorAll('[data-id]')].map((b) => [b.getAttribute('data-id'), b.getBoundingClientRect()]));
        const corMesa = COR[v.cor] || '#888';
        // Mesa: jogadores em volta (no sentido do jogo, a partir de mim), monte e descarte no meio.
        assentos.clear();
        const filhos = [el('div', { class: 'vl-vc-sentido' + (v.sentido < 0 ? ' anti' : ''), 'aria-hidden': 'true' }, [svg('svg', { viewBox: '0 0 300 168', width: '300', height: '150', preserveAspectRatio: 'none' }, [
          svg('ellipse', { cx: '150', cy: '84', rx: '144', ry: '78', fill: 'none', stroke: '#d6f24a', 'stroke-width': '2', 'stroke-dasharray': '8 10' }),
          svg('path', { d: 'M276 64 l18 18 l-24 4z', fill: '#d6f24a' }), svg('path', { d: 'M24 104 l-18 -18 l24 -4z', fill: '#d6f24a' }),
        ])])];
        for (let k = 1; k < n; k++) {
          const o = v.outros[(souIdx + k) % n];
          const ang = Math.PI - k * Math.PI / n;
          const x = 50 + 42 * Math.cos(ang), y = 50 - 32 * Math.sin(ang);
          const leque = el('div', { class: 'vl-vc-leque', 'aria-hidden': 'true' });
          const mostra = Math.min(o.cartas, 7);
          for (let i = 0; i < mostra; i++) { const g = (i - (mostra - 1) / 2) * 9; leque.appendChild(el('i', { style: 'transform: translateX(' + (g * 0.9) + 'px) rotate(' + g + 'deg)' })); }
          const a = el('div', { class: 'vl-vc-assento' + (o.nome === v.vez && !v.fim ? ' vez' : ''), style: 'left:' + x + '%;top:' + y + '%' }, [
            api.cabeca(o.nome), el('b', { texto: o.nome }), leque, el('span', { class: 'vl-vc-qtd', texto: o.cartas + (o.cartas === 1 ? ' carta' : ' cartas') }),
          ]);
          assentos.set(o.nome, a);
          filhos.push(a);
        }
        const pode = minha && v.comprada == null;
        monteEl = el('button', { type: 'button', class: 'vl-vc-monte' + (pode ? ' pode' : ''), disabled: !pode, title: pode ? 'Comprar uma carta' : 'Monte', 'aria-label': 'Monte: ' + v.pilha + ' cartas' + (pode ? '. Comprar uma carta' : ''), onclick() { if (pode) api.agir({ tipo: 'comprar' }); } },
          [verso(), verso(), verso(), el('span', { class: 'num', texto: v.pilha })]);
        const pilha = el('div', { class: 'vl-vc-pilha', style: '--cor-mesa:' + corMesa });
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
        filhos.push(el('div', { class: 'vl-vc-msg', role: 'status', 'aria-live': 'polite' }, v.fim ? [] : [txt, el('b', { texto: minha ? (v.comprada != null ? 'Jogue a carta comprada ou passe.' : 'Sua vez!') : 'Vez de ' + v.vez + '.' })]));
        if (escolhendo != null && minha) {
          filhos.push(el('div', { class: 'vl-vc-escolha' }, [el('div', { class: 'vl-vc-roda', role: 'group', 'aria-label': 'Escolha a cor' },
            K.CORES.map((cor) => el('button', { type: 'button', title: NOME_COR[cor], 'aria-label': NOME_COR[cor], style: 'background:' + COR[cor], onclick() { const id = escolhendo; escolhendo = null; api.agir({ tipo: 'jogar', id, cor }); } }))
              .concat([el('b', { texto: 'Escolha a cor' })]))]));
        }
        mesaEl.replaceChildren(...filhos);
        // Eu: rosto, quantas cartas e os botões.
        eu.className = 'vl-vc-eu' + (minha ? ' vez' : '');
        eu.replaceChildren(api.cabeca(api.eu), el('span', null, [el('b', { texto: 'Você' }), el('small', { texto: v.mao.length + (v.mao.length === 1 ? ' carta' : ' cartas') + (minha ? ' · sua vez' : '') })]));
        const botoes = [];
        if (escolhendo != null && minha) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Voltar', onclick() { escolhendo = null; desenhar(); } }));
        if (minha && v.comprada != null) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao', texto: 'Passar a vez', onclick() { api.agir({ tipo: 'passar' }); } }));
        if (minha && v.comprada == null) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao discreto', texto: 'Comprar', onclick() { api.agir({ tipo: 'comprar' }); } }));
        if (v.mao.length === 2 && !v.avisei && !v.fim) botoes.push(el('button', { type: 'button', class: 'vl-jg-botao vl-vc-ultima', texto: 'Última!', title: 'Avise antes de jogar a penúltima carta', onclick() { api.agir({ tipo: 'ultima' }); } }));
        acoes.replaceChildren(...botoes);
        // Mão em leque: as que servem sobem com um brilho.
        const largura = Math.max(320, (mao.clientWidth || 820) - 20), w = 70, qtd = v.mao.length;
        const passo = Math.min(w * 0.78, (largura - w) / Math.max(1, qtd - 1));
        const giro = Math.min(5, 50 / Math.max(1, qtd));
        mao.replaceChildren(...v.mao.map(function (c, i) {
          const serve = minha && K.serve({ descarte: [v.topo], cor: v.cor }, c) && (v.comprada == null || c.id === v.comprada);
          const meio = (qtd - 1) / 2, d = i - meio;
          const b = el('button', { type: 'button', 'data-id': String(c.id), class: serve ? 'pode' : minha ? 'nao' : '', 'aria-label': rotulo(c) + (serve ? '' : ' (não serve agora)'),
            style: 'margin-left:' + (i ? (passo - w) : 0) + 'px;z-index:' + (i + 1) + ';transform: translateY(' + (Math.abs(d) * Math.abs(d) * 0.6 - (serve ? 14 : 0)) + 'px) rotate(' + (d * giro) + 'deg)',
            onclick() {
              if (!serve) return;
              if (!c.cor) { escolhendo = c.id; desenhar(); return; }
              api.agir({ tipo: 'jogar', id: c.id });
            } }, [carta(c)]);
          if (serve) {
            b.addEventListener('mouseenter', () => { b.style.transform = 'translateY(-30px) rotate(' + (d * giro * 0.4) + 'deg)'; b.style.zIndex = '60'; });
            b.addEventListener('mouseleave', () => { b.style.transform = 'translateY(' + (Math.abs(d) * Math.abs(d) * 0.6 - 14) + 'px) rotate(' + (d * giro) + 'deg)'; b.style.zIndex = String(i + 1); });
          }
          return b;
        }));
        // Animações do lance novo (uma vez por lance).
        if (u && u.n != null && u.n !== ultimoN) {
          const primeira = ultimoN == null;
          ultimoN = u.n;
          if (!primeira) animarLance(u, antesMao);
        }
        // "Última!" de alguém: balão em cima do rosto.
        for (const o of v.outros) {
          if (o.ultima && !ultimasAvisadas[o.nome] && o.nome !== api.eu && assentos.get(o.nome)) assentos.get(o.nome).appendChild(el('span', { class: 'vl-vc-balao', texto: 'Última!' }));
          ultimasAvisadas[o.nome] = o.ultima;
        }
        if (minha && !eraMinha) api.som('vez');
        eraMinha = minha;
      }
      const retDe = (nome) => (nome === api.eu ? eu.getBoundingClientRect() : assentos.get(nome) ? assentos.get(nome).getBoundingClientRect() : null);
      function animarLance(u, antesMao) {
        const monte = monteEl ? monteEl.getBoundingClientRect() : null;
        if (u.tipo === 'jogou' && pilhaTopo) {
          const de = u.nome === api.eu ? (antesMao.get(String(u.carta.id)) || eu.getBoundingClientRect()) : retDe(u.nome);
          const para = pilhaTopo.getBoundingClientRect();
          pilhaTopo.style.visibility = 'hidden';
          const alvo = pilhaTopo;
          voar(carta(u.carta), de, para, 0, giroDe(u.carta.id));
          setTimeout(() => { alvo.style.visibility = ''; }, 440);
          if (u.vitima) for (let k = 0; k < u.qtd; k++) voarParaMao(u.vitima, monte, 380 + k * 140);
          if (u.esqueceu) for (let k = 0; k < 2; k++) voarParaMao(u.nome, monte, 380 + k * 140);
        } else if (u.tipo === 'comprou') voarParaMao(u.nome, monte, 0);
      }
      // Carta comprada: do monte para a mão de quem comprou (a minha mostra a carta de verdade no lugar dela).
      function voarParaMao(nome, monte, atraso) {
        if (nome !== api.eu) { voar(verso(36), monte, retDe(nome), atraso); return; }
        setTimeout(function () {
          const cartas = mao.querySelectorAll('[data-id]'), alvo = cartas[cartas.length - 1];
          if (!alvo) return;
          alvo.style.visibility = 'hidden';
          voar(verso(), monte, alvo.getBoundingClientRect(), 0);
          setTimeout(() => { alvo.style.visibility = ''; }, 440);
        }, atraso);
      }
      return { el: raizEl, atualizar(nova) { if (nova && nova.vez !== api.eu) escolhendo = null; v = nova; desenhar(); } };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
