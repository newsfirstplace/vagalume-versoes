// Vagalume — Duelo de Pistas na mesa de jogos (regras em core/pistas.js).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.pistas || !VL.camada) return;
  const P = VL.pistas;
  const el = VL.camada.el;
  const NOME = { lima: 'Time Lima', rosa: 'Time Rosa' };
  const CSS = `
  .vl-dp { display: grid; gap: 10px; }
  .vl-dp-placar { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .vl-dp-time { padding: 6px 12px; border-radius: 10px; font-weight: 700; border: 2px solid transparent; }
  .vl-dp-time.lima { background: #2e3b10; color: #d6f24a; } .vl-dp-time.rosa { background: #3d1529; color: #ff8ec4; }
  .vl-dp-time.vez { border-color: currentColor; box-shadow: 0 0 12px currentColor; }
  .vl-dp-time small { display: block; font-weight: 500; opacity: .8; }
  .vl-dp-grade { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .vl-dp-carta { all: unset; box-sizing: border-box; min-height: 52px; padding: 6px 4px; border-radius: 10px; text-align: center; display: grid; place-items: center; font: 700 13px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .3px;
    background: #e8e2d0; color: #2a2a2a; border: 2px solid #c9c1a8; cursor: default; overflow-wrap: anywhere; }
  .vl-dp-carta.pode { cursor: pointer; } .vl-dp-carta.pode:hover { border-color: #d6f24a; transform: translateY(-2px); }
  .vl-dp-carta.t-lima { box-shadow: inset 0 -6px 0 #9fc51c; } .vl-dp-carta.t-rosa { box-shadow: inset 0 -6px 0 #e04d92; }
  .vl-dp-carta.t-neutra { box-shadow: inset 0 -6px 0 #b7a98a; } .vl-dp-carta.t-bomba { box-shadow: inset 0 -6px 0 #111; }
  .vl-dp-carta.aberta.t-lima { background: #b9dc2e; border-color: #7fa312; } .vl-dp-carta.aberta.t-rosa { background: #ea5a9e; border-color: #a8306a; color: #fff; }
  .vl-dp-carta.aberta.t-neutra { background: #b7a98a; border-color: #8a7c60; } .vl-dp-carta.aberta.t-bomba { background: #111; color: #fff; border-color: #e5484d; }
  .vl-dp-carta.aberta { opacity: .85; }
  .vl-dp-barra { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .vl-dp-barra input { padding: 8px 10px; border-radius: 10px; border: 1px solid #3b4a60; background: #0f141c; color: #fff; font: 14px system-ui, sans-serif; }
  .vl-dp-pista { font: 800 18px system-ui, sans-serif; color: #fff; text-align: center; }
  .vl-dp-log { color: #8f9bb0; font-size: 11px; text-align: center; }
  `;
  VL.mesa.registrar('pistas', {
    nome: 'Duelo de Pistas', glifo: '🕵', min: 4, minPessoas: 4, max: 10,
    texto: 'Dois times e 25 palavras. O mestre de cada time sabe quais são do time e dá uma pista de uma palavra e um número; o time adivinha. Cuidado com a bomba! De 4 a 10 pessoas.',
    bots: [],
    nova: (jogadores) => P.nova(jogadores),
    aplicar: (e, nome, a) => P.aplicar(e, nome, a),
    sair: (e, nome) => P.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: NOME[e.fim.time] + ' venceu' + (e.fim.motivo === 'bomba' ? ': o outro time abriu a bomba!' : e.fim.motivo === 'saiu' ? ' (o outro time saiu).' : '!') } : null),
    visao: (e, nome) => P.visao(e, nome),
    montar(api) {
      const raizEl = el('div', { class: 'vl-dp' }, [el('style', { texto: CSS })]);
      const placar = el('div', { class: 'vl-dp-placar' });
      const pista = el('div', { class: 'vl-dp-pista', role: 'status', 'aria-live': 'polite' });
      const grade = el('div', { class: 'vl-dp-grade' });
      const barra = el('div', { class: 'vl-dp-barra' });
      const log = el('div', { class: 'vl-dp-log' });
      raizEl.append(placar, pista, grade, barra, log);
      const palavra = el('input', { type: 'text', maxlength: '24', placeholder: 'Pista (uma palavra)', 'aria-label': 'Pista' });
      const numero = el('input', { type: 'number', min: '0', max: '9', value: '1', style: 'width:64px', 'aria-label': 'Quantas palavras' });
      for (const c of [palavra, numero]) c.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') darPista(); });
      function darPista() { api.agir({ tipo: 'pista', palavra: palavra.value, n: Number(numero.value) }); palavra.value = ''; }
      let v = null;
      return {
        el: raizEl,
        atualizar(nova) {
          v = nova;
          if (!v) return;
          const minhaVez = v.time === v.vez && !v.fim;
          placar.replaceChildren(...P.TIMES.map((t) => el('div', { class: 'vl-dp-time ' + t + (v.vez === t && !v.fim ? ' vez' : '') }, [
            NOME[t] + ' · faltam ' + v.faltam[t],
            el('small', { texto: 'Mestre: ' + (v.mestres[t] || '—') + ' · ' + Object.keys(v.times).filter((n) => v.times[n] === t && n !== v.mestres[t]).join(', ') }),
          ])).concat([el('span', { class: 'vl-ms-nota', texto: v.time ? 'Você: ' + NOME[v.time] + (v.mestre ? ' (mestre)' : '') : '' })]));
          pista.textContent = v.fim ? '' : v.fase === 'pista' ? 'Esperando a pista do mestre do ' + NOME[v.vez] + '…' : 'Pista: “' + v.pista.palavra + '” ' + v.pista.n + ' · ' + NOME[v.vez] + ' tem ' + (v.pista.n === 0 ? 'quantos palpites quiser' : v.restam + ' palpite(s)');
          const podeEscolher = minhaVez && !v.mestre && v.fase === 'palpite';
          grade.replaceChildren(...v.cartas.map((c, i) => el('button', {
            type: 'button', class: 'vl-dp-carta' + (c.tipo ? ' t-' + c.tipo : '') + (c.aberta ? ' aberta' : '') + (podeEscolher && !c.aberta ? ' pode' : ''),
            'aria-label': c.p + (c.aberta ? ', aberta (' + c.tipo + ')' : c.tipo ? ' (' + c.tipo + ')' : ''), disabled: !podeEscolher || c.aberta,
            onclick() { api.agir({ tipo: 'escolher', i }); },
          }, [c.p])));
          const itens = [];
          if (minhaVez && v.mestre && v.fase === 'pista') itens.push(el('b', { texto: 'Sua pista:' }), palavra, numero, el('button', { type: 'button', class: 'vl-ms-botao forte', texto: 'Dar pista', onclick: darPista }));
          if (podeEscolher) itens.push(el('button', { type: 'button', class: 'vl-ms-botao', texto: 'Passar a vez', onclick() { api.agir({ tipo: 'passar' }); } }));
          if (v.mestre && !v.fim) itens.push(el('span', { class: 'vl-ms-nota', texto: 'Você vê as cores: lima e rosa são dos times, bege é neutra e preta é a bomba. Não diga palavras da mesa!' }));
          barra.replaceChildren(...itens);
          log.textContent = v.log.join(' · ');
        },
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
