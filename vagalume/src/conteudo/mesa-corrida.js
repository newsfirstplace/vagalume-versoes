// Vagalume — Corrida de digitação na mesa de jogos (regras em core/corrida.js).
// Várias rodadas: contagem 3, 2, 1, frase para todos, raias com um vagalume para cada jogador, placar entre as rodadas.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.corrida || !VL.camada) return;
  const C = VL.corrida;
  const el = VL.camada.el;
  const CORES = ['#5fb8ff', '#ff7ab6', '#ffa24c', '#b28cff', '#4fe0c0', '#ffd65a', '#ff6b6b'];
  const MEDALHAS = ['🥇', '🥈', '🥉'];
  const CSS = `
  .vl-cr { display: grid; gap: 12px; }
  .vl-cr-topo { display: flex; align-items: center; gap: 10px; }
  .vl-cr-topo .esp { flex: 1; }
  .vl-cr-rodada { padding: 5px 12px; border-radius: 999px; background: rgba(214,242,74,.14); border: 1px solid rgba(214,242,74,.4); color: #f2ffc0; font-weight: 700; font-size: 12.5px; }
  .vl-cr-relogio { padding: 5px 12px; border-radius: 999px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); font: 700 13px ui-monospace, Consolas, monospace; color: #dfe6f2; }
  .vl-cr-relogio.pouco { color: #ff8a8a; border-color: rgba(255,90,90,.5); animation: vl-cr-pulsa 1s ease-in-out infinite; }
  .vl-cr-meu { text-align: right; line-height: 1.15; }
  .vl-cr-meu b { display: block; font: 800 22px system-ui, sans-serif; color: #d6f24a; font-variant-numeric: tabular-nums; text-shadow: 0 0 12px rgba(214,242,74,.35); }
  .vl-cr-meu small { color: #9aa6b8; font-size: 11.5px; }
  .vl-cr-digitar { display: grid; gap: 10px; }
  .vl-cr-palco { position: relative; border-radius: 16px; overflow: hidden; }
  .vl-cr-frase { font: 20px/1.7 ui-monospace, 'Cascadia Mono', Consolas, monospace; background: linear-gradient(180deg, #0e131c, #0b0f16); border: 1px solid rgba(214,242,74,.22); border-radius: 16px;
    padding: 16px 18px; user-select: none; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 72px; box-shadow: inset 0 10px 30px rgba(0,0,0,.35); transition: filter .3s, opacity .3s; }
  .vl-cr-frase .ok { color: #b6e35a; }
  .vl-cr-frase .erro { background: #e5484d; color: #fff; border-radius: 3px; }
  .vl-cr-frase .atual { position: relative; color: #fff; }
  .vl-cr-frase .atual::before { content: ''; position: absolute; left: -1px; top: .2em; bottom: .14em; width: 2px; background: #d6f24a; box-shadow: 0 0 8px #d6f24a; animation: vl-cr-cursor 1s steps(1) infinite; }
  .vl-cr-frase .resto { color: #6f7d93; }
  .vl-cr-palco.esperando .vl-cr-frase { filter: blur(6px); opacity: .5; }
  .vl-cr-contagem { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; font: 900 66px/1 system-ui, sans-serif; color: #fff; text-shadow: 0 0 24px rgba(214,242,74,.8), 0 4px 0 #2c3a06; }
  .vl-cr-contagem span { animation: vl-cr-num .9s cubic-bezier(.2,1.6,.4,1) both; }
  .vl-cr-contagem span.ja { color: #d6f24a; }
  .vl-cr-campo { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid #344157; background: #0f141c; color: #fff; font: 17px ui-monospace, Consolas, monospace; outline: none; transition: border-color .15s, box-shadow .15s; }
  .vl-cr-campo:focus { border-color: #d6f24a; box-shadow: 0 0 0 3px rgba(214,242,74,.15); }
  .vl-cr-campo:disabled { opacity: .6; }
  .vl-cr-campo.erro { border-color: #e5484d; background: #2a1316; box-shadow: 0 0 0 3px rgba(229,72,77,.18); animation: vl-cr-treme .25s; }
  .vl-cr-raias { display: grid; gap: 6px; padding: 10px; border-radius: 16px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); }
  .vl-cr-raia { display: grid; grid-template-columns: 170px 1fr 86px; align-items: center; gap: 10px; padding: 4px 6px; border-radius: 10px; }
  .vl-cr-raia.eu { background: rgba(214,242,74,.06); }
  .vl-cr-quem { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .vl-cr-quem .n { display: flex; flex-direction: column; min-width: 0; }
  .vl-cr-quem b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .vl-cr-quem small { color: #8f9bb0; font-size: 11px; }
  .vl-cr-pista { position: relative; height: 26px; border-radius: 13px; background: linear-gradient(180deg, #161d29, #11161f); box-shadow: inset 0 1px 3px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.05); overflow: hidden; }
  .vl-cr-pista::before { content: ''; position: absolute; left: 10px; right: 24px; top: 50%; height: 2px; margin-top: -1px; background: repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 10px, transparent 10px 20px); }
  .vl-cr-feito { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, transparent, var(--cor-raia)); opacity: .32; transition: width .25s linear; }
  .vl-cr-luz { position: absolute; top: 50%; left: 9px; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff, var(--cor-raia) 55%, rgba(0,0,0,.35));
    box-shadow: 0 0 10px var(--cor-raia), 0 0 22px var(--cor-raia); transition: left .25s linear; z-index: 1; }
  .vl-cr-luz::after { content: ''; position: absolute; right: 72%; top: 50%; width: 28px; height: 6px; margin-top: -3px; border-radius: 3px; background: linear-gradient(90deg, transparent, var(--cor-raia)); opacity: .75; }
  .vl-cr-chegada { position: absolute; right: 0; top: 0; bottom: 0; width: 14px; background: conic-gradient(#fff 0 25%, #222 0 50%, #fff 0 75%, #222 0) 0 0 / 7px 7px; opacity: .85; }
  .vl-cr-ppm { text-align: right; font-variant-numeric: tabular-nums; color: #c9d3e2; font-weight: 700; font-size: 13px; line-height: 1.2; }
  .vl-cr-ppm small { display: block; color: #8f9bb0; font-weight: 500; font-size: 10.5px; }
  .vl-cr-pausa { padding: 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(214,242,74,.08), rgba(255,255,255,.02)); border: 1px solid rgba(214,242,74,.28); display: grid; gap: 12px; }
  .vl-cr-pausa h4 { margin: 0; font-size: 17px; color: #f2ffc0; text-align: center; }
  .vl-cr-tabela { display: grid; gap: 5px; }
  .vl-cr-linha { display: grid; grid-template-columns: 34px 30px 1fr 70px 84px 46px; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; background: rgba(255,255,255,.04); }
  .vl-cr-linha.eu { background: rgba(214,242,74,.1); box-shadow: inset 0 0 0 1px rgba(214,242,74,.3); }
  .vl-cr-linha .pos { font: 800 16px system-ui, sans-serif; text-align: center; }
  .vl-cr-linha b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vl-cr-linha .num { text-align: right; font-variant-numeric: tabular-nums; color: #c9d3e2; font-size: 12.5px; }
  .vl-cr-linha .pts { text-align: right; font-weight: 800; color: #d6f24a; }
  .vl-cr-geral { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .vl-cr-geral span { padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); font-size: 12px; }
  .vl-cr-geral span b { color: #d6f24a; }
  .vl-cr-prox { text-align: center; color: #c9d3e2; }
  .vl-cr-barra { height: 6px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; margin: 6px auto 0; max-width: 320px; }
  .vl-cr-barra i { display: block; height: 100%; background: linear-gradient(90deg, #d6f24a, #9fd12a); transition: width .2s linear; }
  @keyframes vl-cr-cursor { 50% { opacity: 0; } }
  @keyframes vl-cr-num { from { transform: scale(2.2); opacity: 0; } 30% { opacity: 1; } to { transform: scale(1); opacity: .92; } }
  @keyframes vl-cr-treme { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
  @keyframes vl-cr-pulsa { 50% { opacity: .55; } }
  @media (max-width: 640px) { .vl-cr-raia { grid-template-columns: 110px 1fr 66px; } .vl-cr-linha { grid-template-columns: 28px 26px 1fr 56px 40px; } .vl-cr-linha .tempo { display: none; } }
  @media (prefers-reduced-motion: reduce) { .vl-cr-contagem span, .vl-cr-campo.erro, .vl-cr-relogio.pouco, .vl-cr-frase .atual::before { animation: none; } }
  `;
  const relogioTexto = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  VL.mesa.registrar('corrida', {
    nome: 'Corrida de Digitação', glifo: '⌨', min: 1, max: 8,
    texto: 'Uma frase aparece para todos ao mesmo tempo: quem digitar certinho e mais rápido chega primeiro. Várias rodadas, pontos pela colocação em cada uma.',
    fatos: ['De 1 a 8 jogadores', 'Bots de 28 a 75 ppm', 'Até 5 rodadas'],
    opcoes: [{ id: 'rodadas', rotulo: 'Rodadas', valores: [['1', '1 rodada'], ['3', '3 rodadas'], ['5', '5 rodadas']], padrao: '3' }],
    bots: [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']],
    nova: (jogadores, op) => C.nova(jogadores, { rodadas: Number(op && op.rodadas) || 3 }),
    aplicar: (e, nome, a) => C.aplicar(e, nome, a),
    tick: (e) => C.tick(e),
    sair: (e, nome) => C.sair(e, nome),
    fim: (e) => (e.fim ? {
      ordem: e.fim.ordem,
      texto: e.rodadas > 1 ? 'Fim das ' + e.rodadas + ' rodadas!' : e.fim.tempo ? 'Tempo esgotado!' : 'Corrida terminada!',
      detalhe: Object.fromEntries(e.fim.ordem.map((n) => [n, (e.fim.placar[n] || 0) + ' pts'])),
    } : null),
    visao: (e) => ({
      id: e.comeca, rodada: e.rodada, rodadas: e.rodadas, frase: e.frase, falta: e.comeca - Date.now(), fim: !!e.fim,
      pausa: e.pausaAte != null ? Math.max(0, e.pausaAte - Date.now()) : null, placar: e.placar, ultima: e.ultima,
      js: Object.entries(e.jogadores).map(([nome, p]) => ({ nome, pos: p.pos, fimMs: p.fimMs, bot: !!p.bot })),
    }),
    montar(api) {
      const raizEl = el('div', { class: 'vl-cr' }, [el('style', { texto: CSS })]);
      const rodadaEl = el('span', { class: 'vl-cr-rodada' });
      const relogioEl = el('span', { class: 'vl-cr-relogio', 'aria-label': 'Tempo da rodada' });
      const meuPpm = el('b', { texto: '0 ppm' }), meuAcerto = el('small', { texto: 'acerto —' });
      const frase = el('div', { class: 'vl-cr-frase', 'aria-label': 'Frase para digitar' });
      const contagem = el('div', { class: 'vl-cr-contagem', 'aria-live': 'assertive' });
      const palco = el('div', { class: 'vl-cr-palco' }, [frase, contagem]);
      const campo = el('input', { class: 'vl-cr-campo', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Digite a frase', disabled: true, placeholder: 'Espere a largada…' });
      const digitar = el('div', { class: 'vl-cr-digitar' }, [palco, campo]);
      const pausa = el('div', { class: 'vl-cr-pausa', hidden: true });
      const raias = el('div', { class: 'vl-cr-raias', 'aria-label': 'Corrida' });
      raizEl.append(el('div', { class: 'vl-cr-topo' }, [rodadaEl, relogioEl, el('span', { class: 'esp' }), el('div', { class: 'vl-cr-meu' }, [meuPpm, meuAcerto])]), digitar, pausa, raias);
      let v = null, inicio = 0, idAtual = null, fraseAtual = '', enviado = 0, minhaPos = 0, meuFim = null, relogio = null;
      let teclas = 0, erros = 0, erroAtivo = false, ultimaContagem = null, pausaAte = null, pausaChave = null, pausaTotal = 7000, barra = null, proxTexto = null;
      const raiaDe = new Map();
      let chaveRaias = '';
      campo.addEventListener('paste', (ev) => ev.preventDefault()); // sem colar a frase
      campo.addEventListener('drop', (ev) => ev.preventDefault());
      campo.addEventListener('keydown', (ev) => ev.stopPropagation());
      campo.addEventListener('input', function () {
        if (!v || Date.now() < inicio || meuFim != null) return;
        const c = C.conferir(fraseAtual, campo.value);
        teclas++;
        if (c.erroEm >= 0 && !erroAtivo) { erros++; erroAtivo = true; api.som('erro'); }
        if (c.erroEm < 0) erroAtivo = false;
        minhaPos = c.certos;
        campo.classList.toggle('erro', c.erroEm >= 0);
        if (c.completo) { meuFim = Date.now() - inicio; campo.disabled = true; api.som('chegou'); }
        if (c.certos > enviado) { enviado = c.certos; api.agir({ pos: c.certos }); }
        pintarFrase(c); pintarRaias(); pintarMeu();
      });
      function pintarFrase(c) {
        const s = fraseAtual, k = c ? c.certos : 0, erro = c && c.erroEm >= 0;
        const partes = [el('span', { class: 'ok', texto: s.slice(0, k) })];
        if (k < s.length) partes.push(el('span', { class: erro ? 'erro' : 'atual', texto: s[k] }), el('span', { class: 'resto', texto: s.slice(k + 1) }));
        frase.replaceChildren(...partes);
      }
      function pintarMeu() {
        const ms = meuFim != null ? meuFim : Math.max(0, Date.now() - inicio);
        meuPpm.textContent = (Date.now() >= inicio ? C.ppm(minhaPos, ms) : 0) + ' ppm';
        meuAcerto.textContent = teclas ? Math.round(Math.max(0, teclas - erros) / teclas * 100) + '% de acerto' : 'acerto —';
      }
      // Raias: montadas uma vez por rodada (a luz desliza por transição); a cada 200 ms só a posição muda.
      function montarRaias() {
        const chave = v.js.map((p) => p.nome).join('|');
        if (chave === chaveRaias) return;
        chaveRaias = chave; raiaDe.clear();
        let k = 0;
        raias.replaceChildren(...v.js.map(function (p) {
          const sou = p.nome === api.eu, cor = sou ? '#d6f24a' : CORES[k++ % CORES.length];
          const feito = el('i', { class: 'vl-cr-feito' }), luz = el('i', { class: 'vl-cr-luz' }), detalhe = el('small'), ppmEl = el('span', { class: 'vl-cr-ppm' });
          raiaDe.set(p.nome, { feito, luz, detalhe, ppmEl });
          return el('div', { class: 'vl-cr-raia' + (sou ? ' eu' : ''), style: '--cor-raia:' + cor }, [
            el('div', { class: 'vl-cr-quem' }, [api.cabeca(p.nome), el('span', { class: 'n' }, [el('b', { texto: p.nome + (sou ? ' (você)' : '') }), detalhe])]),
            el('div', { class: 'vl-cr-pista' }, [feito, el('i', { class: 'vl-cr-chegada' }), luz]),
            ppmEl,
          ]);
        }));
      }
      function pintarRaias() {
        if (!v) return;
        montarRaias();
        const agora = Date.now(), len = fraseAtual.length || 1;
        const fimDe = (p) => (p.nome === api.eu && meuFim != null ? meuFim : p.fimMs);
        const chegaram = v.js.filter((p) => fimDe(p) != null).sort((a, b) => fimDe(a) - fimDe(b)).map((p) => p.nome);
        for (const p of v.js) {
          const r = raiaDe.get(p.nome);
          if (!r) continue;
          const sou = p.nome === api.eu, pos = sou ? Math.max(p.pos, minhaPos) : p.pos, fim = fimDe(p), pct = Math.min(1, pos / len);
          r.feito.style.width = (pct * 100) + '%';
          r.luz.style.left = 'calc(9px + (100% - 30px) * ' + pct.toFixed(4) + ')';
          r.detalhe.textContent = v.rodadas > 1 ? (v.placar[p.nome] || 0) + ' pts' : p.bot ? 'Bot' : 'Na corrida';
          const lugar = chegaram.indexOf(p.nome);
          const ms = fim != null ? fim : Math.max(0, agora - inicio);
          r.ppmEl.replaceChildren((agora >= inicio ? C.ppm(pos, ms) : 0) + ' ppm', el('small', { texto: lugar >= 0 ? (MEDALHAS[lugar] || (lugar + 1) + 'º') + ' ' + (fim / 1000).toFixed(1) + ' s' : Math.round(pct * 100) + '%' }));
        }
      }
      // Cartão entre as rodadas (e no fim): resultado da rodada, placar geral e quanto falta para a próxima.
      function pintarPausa() {
        const u = v.ultima;
        if (!u) return;
        const chave = u.rodada + (v.fim ? ':fim' : '');
        if (chave !== pausaChave) {
          pausaChave = chave;
          const geral = Object.keys(v.placar).sort((a, b) => v.placar[b] - v.placar[a]);
          barra = el('i'); proxTexto = el('span');
          pausa.replaceChildren(
            el('h4', { texto: (u.porTempo ? 'Tempo! ' : '') + (v.fim ? 'Última rodada' : 'Fim da rodada ' + u.rodada + ' de ' + v.rodadas) }),
            el('div', { class: 'vl-cr-tabela' }, u.ordem.map((nome, i) => el('div', { class: 'vl-cr-linha' + (nome === api.eu ? ' eu' : '') }, [
              el('span', { class: 'pos', texto: u.tempos[nome] != null ? (MEDALHAS[i] || (i + 1) + 'º') : '—' }),
              api.cabeca(nome),
              el('b', { texto: nome + (nome === api.eu ? ' (você)' : '') }),
              el('span', { class: 'num', texto: (u.ppm[nome] || 0) + ' ppm' }),
              el('span', { class: 'num tempo', texto: u.tempos[nome] != null ? (u.tempos[nome] / 1000).toFixed(1) + ' s' : 'não terminou' }),
              el('span', { class: 'pts', texto: '+' + (u.pontos[nome] || 0) }),
            ]))),
            v.rodadas > 1 ? el('div', { class: 'vl-cr-geral', 'aria-label': 'Placar geral' }, geral.map((n) => el('span', null, [n + ' · ', el('b', { texto: v.placar[n] + ' pts' })]))) : null,
            v.fim ? null : el('div', { class: 'vl-cr-prox' }, [proxTexto, el('div', { class: 'vl-cr-barra' }, [barra])]),
          );
          if (!v.fim) api.som('ponto');
        }
        if (!v.fim && pausaAte != null && barra) {
          const falta = Math.max(0, pausaAte - Date.now());
          proxTexto.textContent = 'Próxima rodada em ' + Math.ceil(falta / 1000) + '…';
          barra.style.width = (100 - falta / pausaTotal * 100).toFixed(1) + '%';
        }
      }
      function contar() {
        if (!v) return;
        const agora = Date.now(), falta = inicio - agora;
        rodadaEl.textContent = v.rodadas > 1 ? 'Rodada ' + v.rodada + ' de ' + v.rodadas : 'Rodada única';
        const entre = v.pausa != null || v.fim;
        digitar.hidden = !!entre; pausa.hidden = !entre;
        if (entre) { relogioEl.textContent = v.fim ? 'Fim' : 'Intervalo'; relogioEl.classList.remove('pouco'); pintarPausa(); pintarRaias(); return; }
        if (falta > 0) {
          palco.classList.add('esperando');
          const n = Math.ceil(falta / 1000);
          if (n !== ultimaContagem) { ultimaContagem = n; contagem.replaceChildren(el('span', { texto: String(n) })); api.som('tique'); }
          relogioEl.textContent = '⏱ ' + relogioTexto(C.DURACAO);
        } else {
          palco.classList.remove('esperando');
          if (ultimaContagem !== 0 && falta > -700) { ultimaContagem = 0; contagem.replaceChildren(el('span', { class: 'ja', texto: 'Já!' })); api.som('largada'); }
          else if (falta <= -700 && contagem.firstChild) contagem.replaceChildren();
          if (campo.disabled && meuFim == null) { campo.disabled = false; campo.placeholder = 'Digite aqui…'; campo.focus(); }
          const resta = C.DURACAO - (agora - inicio);
          relogioEl.textContent = meuFim != null ? '✓ ' + (meuFim / 1000).toFixed(1) + ' s' : '⏱ ' + relogioTexto(resta);
          relogioEl.classList.toggle('pouco', meuFim == null && resta < 10000);
        }
        pintarRaias(); pintarMeu();
      }
      return {
        el: raizEl,
        atualizar(nova) {
          if (!nova || typeof nova.frase !== 'string') return;
          v = nova;
          if (nova.id !== idAtual) { // rodada nova
            idAtual = nova.id;
            fraseAtual = nova.frase; enviado = 0; minhaPos = 0; meuFim = null; teclas = 0; erros = 0; erroAtivo = false; ultimaContagem = null; chaveRaias = '';
            inicio = Date.now() + Math.max(0, Math.min(10000, Number(nova.falta) || 0));
            campo.value = ''; campo.disabled = true; campo.classList.remove('erro'); campo.placeholder = 'Espere a largada…';
            pintarFrase(null);
          }
          if (nova.pausa != null) { const ate = Date.now() + Math.max(0, Math.min(15000, Number(nova.pausa) || 0)); if (pausaAte == null || Math.abs(ate - pausaAte) > 400) pausaAte = ate; }
          else pausaAte = null;
          if (!relogio) relogio = setInterval(function () { if (!raizEl.isConnected) { clearInterval(relogio); relogio = null; return; } contar(); }, 200);
          contar();
        },
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
