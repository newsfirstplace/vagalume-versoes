// Vagalume — Vagacartas na mesa de jogos (regras em core/cartas.js).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.cartas || !VL.camada) return;
  const K = VL.cartas;
  const el = VL.camada.el;
  const COR = { lima: '#b9dc2e', azul: '#3a8ee8', rosa: '#ea5a9e', laranja: '#f39232' };
  const NOME_COR = { lima: 'Lima', azul: 'Azul', rosa: 'Rosa', laranja: 'Laranja' };
  const SIMBOLO = { pular: '⊘', inverter: '⇄', '+2': '+2', coringa: '★', '+4': '+4' };
  const CSS = `
  .vl-vc { display: grid; gap: 12px; }
  .vl-vc-jogadores { display: flex; flex-wrap: wrap; gap: 6px; }
  .vl-vc-jog { padding: 5px 10px; border-radius: 999px; background: #1a2230; border: 1px solid #2c3a4f; font-weight: 600; }
  .vl-vc-jog.vez { border-color: #d6f24a; box-shadow: 0 0 10px rgba(214,242,74,.4); color: #d6f24a; }
  .vl-vc-jog small { color: #9aa6ba; font-weight: 500; }
  .vl-vc-mesa { display: flex; align-items: center; justify-content: center; gap: 22px; padding: 14px; border-radius: 16px; background: radial-gradient(circle at 50% 40%, #1f3b2c, #13221a); border: 1px solid #2c4a37; }
  .vl-vc-carta { position: relative; width: 52px; height: 76px; border-radius: 10px; border: 3px solid #fff; display: grid; place-items: center; font: 900 22px system-ui, sans-serif; color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,.35); box-shadow: 0 3px 8px rgba(0,0,0,.45); flex: none; }
  .vl-vc-carta::after { content: ''; position: absolute; inset: 9px 6px; border-radius: 50% / 40%; background: rgba(255,255,255,.18); transform: rotate(-20deg); }
  .vl-vc-carta span { position: relative; z-index: 1; }
  .vl-vc-carta.coringa { background: conic-gradient(#b9dc2e 0 25%, #3a8ee8 0 50%, #ea5a9e 0 75%, #f39232 0) !important; }
  .vl-vc-carta.grande { width: 70px; height: 102px; font-size: 30px; }
  .vl-vc-verso { background: repeating-linear-gradient(45deg, #1b2533 0 6px, #24324a 6px 12px); color: #d6f24a; font-size: 13px; cursor: pointer; }
  .vl-vc-verso:disabled { cursor: default; opacity: .6; }
  .vl-vc-cor { font-weight: 700; display: flex; align-items: center; gap: 6px; }
  .vl-vc-cor i { width: 14px; height: 14px; border-radius: 50%; display: inline-block; border: 2px solid #fff; }
  .vl-vc-mao { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 6px; min-height: 90px; }
  .vl-vc-mao button { all: unset; cursor: pointer; transition: transform .12s; border-radius: 10px; }
  .vl-vc-mao button.pode { transform: translateY(-8px); }
  .vl-vc-mao button.pode:hover { transform: translateY(-14px); }
  .vl-vc-mao button.nao { opacity: .45; cursor: default; }
  .vl-vc-mao button:focus-visible { outline: 2px solid #d6f24a; outline-offset: 2px; }
  .vl-vc-acoes { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; align-items: center; }
  .vl-vc-escolha { display: flex; gap: 8px; justify-content: center; align-items: center; }
  .vl-vc-escolha button { width: 42px; height: 42px; border-radius: 50%; border: 3px solid #fff; cursor: pointer; }
  .vl-vc-msg { text-align: center; color: #c9d3e2; min-height: 18px; }
  `;
  const carta = (c, grande) => el('div', { class: 'vl-vc-carta' + (c.cor ? '' : ' coringa') + (grande ? ' grande' : ''), style: c.cor ? 'background:' + COR[c.cor] : '', 'aria-label': rotulo(c) }, [el('span', { texto: SIMBOLO[c.valor] || c.valor })]);
  const rotulo = (c) => (c.cor ? NOME_COR[c.cor] + ' ' : '') + ({ pular: 'Pular', inverter: 'Inverter', '+2': 'Mais dois', coringa: 'Coringa', '+4': 'Coringa mais quatro' }[c.valor] || c.valor);

  VL.mesa.registrar('cartas', {
    nome: 'Vagacartas', glifo: '🃏', min: 2, max: 6,
    texto: 'Jogo de cartas coloridas: jogue a mesma cor ou o mesmo número; Pular, Inverter, +2 e Coringas. Avise "Última!" antes de ficar com uma carta. De 2 a 6, com bots.',
    bots: [['normal', 'Bot']],
    nova: (jogadores) => K.nova(jogadores),
    aplicar: (e, nome, a) => K.aplicar(e, nome, a),
    tick: (e) => K.tick(e),
    sair: (e, nome) => K.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.texto || e.fim.ordem[0] + ' ficou sem cartas!' } : null),
    visao: (e, nome) => K.visao(e, nome),
    montar(api) {
      const raizEl = el('div', { class: 'vl-vc' }, [el('style', { texto: CSS })]);
      const jogadores = el('div', { class: 'vl-vc-jogadores' });
      const mesa = el('div', { class: 'vl-vc-mesa' });
      const msg = el('div', { class: 'vl-vc-msg', role: 'status', 'aria-live': 'polite' });
      const mao = el('div', { class: 'vl-vc-mao', 'aria-label': 'Suas cartas' });
      const acoes = el('div', { class: 'vl-vc-acoes' });
      raizEl.append(jogadores, mesa, msg, mao, acoes);
      let escolhendo = null; // id do coringa esperando a cor
      let v = null;
      function desenhar() {
        if (!v) return;
        const minha = v.vez === api.eu && !v.fim;
        jogadores.replaceChildren(...v.outros.map((o) => el('span', { class: 'vl-vc-jog' + (o.nome === v.vez ? ' vez' : '') }, [
          (o.bot ? '🤖 ' : '') + o.nome + (o.nome === api.eu ? ' (você)' : '') + ' ', el('small', { texto: o.cartas + (o.cartas === 1 ? ' carta' : ' cartas') + (o.ultima && o.cartas <= 1 ? ' · Última!' : '') }),
        ])));
        const verso = el('button', { type: 'button', class: 'vl-vc-carta grande vl-vc-verso', disabled: !minha || v.comprada != null, title: 'Comprar uma carta', onclick() { api.agir({ tipo: 'comprar' }); } }, [el('span', { texto: v.pilha })]);
        mesa.replaceChildren(verso, carta(v.topo, true), el('div', { class: 'vl-vc-cor' }, [el('i', { style: 'background:' + COR[v.cor] }), 'Cor: ' + NOME_COR[v.cor], el('span', { texto: v.sentido > 0 ? ' ↻' : ' ↺', title: 'Sentido' })]));
        const u = v.ultimaJogada;
        msg.textContent = v.fim ? '' : (u ? (u.nome === api.eu ? 'Você ' : u.nome + ' ') + (u.tipo === 'jogou' ? 'jogou ' + rotulo(u.carta) + (u.carta.cor ? '' : ' (' + NOME_COR[u.cor] + ')') + (u.esqueceu ? ' e esqueceu do "Última!": +2 cartas' : '') : u.tipo === 'comprou' ? 'comprou uma carta' : 'passou') + '. ' : '')
          + (minha ? (v.comprada != null ? 'Jogue a carta comprada ou passe.' : 'Sua vez!') : 'Vez de ' + v.vez + '.');
        mao.replaceChildren(...v.mao.map(function (c) {
          const pode = minha && K.serve({ descarte: [v.topo], cor: v.cor }, c) && (v.comprada == null || c.id === v.comprada);
          return el('button', { type: 'button', class: pode ? 'pode' : minha ? 'nao' : '', 'aria-label': rotulo(c) + (pode ? '' : ' (não serve agora)'), onclick() {
            if (!pode) return;
            if (!c.cor) { escolhendo = c.id; desenhar(); return; }
            api.agir({ tipo: 'jogar', id: c.id });
          } }, [carta(c)]);
        }));
        const botoes = [];
        if (escolhendo != null && minha) {
          botoes.push(el('div', { class: 'vl-vc-escolha' }, [el('b', { texto: 'Escolha a cor:' })].concat(K.CORES.map((cor) => el('button', { type: 'button', title: NOME_COR[cor], 'aria-label': NOME_COR[cor], style: 'background:' + COR[cor], onclick() { const id = escolhendo; escolhendo = null; api.agir({ tipo: 'jogar', id, cor }); } })),
            [el('button', { type: 'button', class: 'vl-ms-botao', style: 'width:auto;height:auto;border-radius:10px', texto: 'Voltar', onclick() { escolhendo = null; desenhar(); } })])));
        }
        if (minha && v.comprada != null) botoes.push(el('button', { type: 'button', class: 'vl-ms-botao', texto: 'Passar', onclick() { api.agir({ tipo: 'passar' }); } }));
        if (v.mao.length === 2 && !v.avisei && !v.fim) botoes.push(el('button', { type: 'button', class: 'vl-ms-botao forte', texto: 'Última!', title: 'Avise antes de jogar a penúltima carta', onclick() { api.agir({ tipo: 'ultima' }); } }));
        acoes.replaceChildren(...botoes);
      }
      return { el: raizEl, atualizar(nova) { if (nova && nova.vez !== api.eu) escolhendo = null; v = nova; desenhar(); } };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
