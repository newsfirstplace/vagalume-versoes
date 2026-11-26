// Vagalume — Corrida de digitação na mesa de jogos (regras em core/corrida.js).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.corrida || !VL.camada) return;
  const C = VL.corrida;
  const el = VL.camada.el;
  const CSS = `
  .vl-cr-estado { font: 700 15px system-ui, sans-serif; margin-bottom: 10px; min-height: 20px; }
  .vl-cr-estado.vai { color: #d6f24a; }
  .vl-cr-frase { font: 18px/1.6 ui-monospace, Consolas, monospace; background: #0f141c; border: 1px solid #2c3a4f; border-radius: 12px; padding: 12px 14px; user-select: none; }
  .vl-cr-frase .ok { color: #b6e35a; }
  .vl-cr-frase .erro { background: #e5484d; color: #fff; border-radius: 2px; }
  .vl-cr-frase .atual { border-bottom: 2px solid #d6f24a; }
  .vl-cr-frase .resto { color: #8391a7; }
  .vl-cr-campo { width: 100%; box-sizing: border-box; margin-top: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid #3b4a60; background: #0f141c; color: #fff; font: 16px ui-monospace, Consolas, monospace; outline: none; }
  .vl-cr-campo:focus { border-color: #d6f24a; }
  .vl-cr-campo.erro { border-color: #e5484d; background: #2a1316; }
  .vl-cr-pistas { margin-top: 14px; display: grid; gap: 8px; }
  .vl-cr-pista { display: grid; grid-template-columns: 130px 1fr 70px; align-items: center; gap: 10px; }
  .vl-cr-pista .nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .vl-cr-pista.eu .nome { color: #d6f24a; }
  .vl-cr-trilho { position: relative; height: 18px; border-radius: 9px; background: repeating-linear-gradient(90deg, #1d2634 0 18px, #222c3c 18px 36px); border: 1px solid #2c3a4f; }
  .vl-cr-trilho .luz { position: absolute; top: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; transform: translateY(-50%); background: radial-gradient(circle at 35% 35%, #fbffd0, #d6f24a 55%, #7fa312); box-shadow: 0 0 10px #d6f24a; transition: left .25s linear; }
  .vl-cr-trilho .chegada { position: absolute; right: 2px; top: 1px; bottom: 1px; width: 4px; background: repeating-linear-gradient(0deg, #fff 0 3px, #111 3px 6px); border-radius: 1px; }
  .vl-cr-pista .ppm { text-align: right; color: #9aa6ba; font-variant-numeric: tabular-nums; }
  `;
  VL.mesa.registrar('corrida', {
    nome: 'Corrida de Digitação', glifo: '⌨', min: 1, max: 8,
    texto: 'Uma frase aparece para todos ao mesmo tempo: quem digitar certinho e mais rápido chega primeiro. De 1 a 8 jogadores, com bots se quiser.',
    bots: [['facil', 'Bot fácil (~28 ppm)'], ['medio', 'Bot médio (~48 ppm)'], ['dificil', 'Bot difícil (~75 ppm)']],
    nova: (jogadores) => C.nova(jogadores),
    aplicar: (e, nome, a) => C.aplicar(e, nome, a),
    tick: (e) => C.andarBots(e) || C.tempoEsgotado(e),
    sair(e, nome) { delete e.jogadores[nome]; if (!e.fim && Object.values(e.jogadores).every((p) => p.fimMs != null)) e.fim = { ordem: C.classificacao(e) }; },
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.tempo ? 'Tempo esgotado!' : 'Corrida terminada!' } : null),
    visao: (e) => ({ id: e.comeca, frase: e.frase, falta: e.comeca - Date.now(), js: Object.entries(e.jogadores).map(([nome, p]) => ({ nome, pos: p.pos, fimMs: p.fimMs, bot: !!p.bot })) }),
    montar(api) {
      const raizEl = el('div', null, [el('style', { texto: CSS })]);
      const estado = el('div', { class: 'vl-cr-estado', role: 'status', 'aria-live': 'polite' });
      const frase = el('div', { class: 'vl-cr-frase', 'aria-label': 'Frase para digitar' });
      const campo = el('input', { class: 'vl-cr-campo', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Digite a frase', disabled: true, placeholder: 'Espere a largada…' });
      const pistas = el('div', { class: 'vl-cr-pistas' });
      raizEl.append(estado, frase, campo, pistas);
      let v = null, inicio = 0, idAtual = null, fraseAtual = '', enviado = 0, minhaPos = 0, meuFim = null, relogio = null;
      campo.addEventListener('paste', (ev) => ev.preventDefault()); // sem colar a frase
      campo.addEventListener('keydown', (ev) => ev.stopPropagation());
      campo.addEventListener('input', function () {
        if (!v || Date.now() < inicio || meuFim != null) return;
        const c = C.conferir(fraseAtual, campo.value);
        minhaPos = c.certos;
        campo.classList.toggle('erro', c.erroEm >= 0);
        if (c.completo) { meuFim = Date.now() - inicio; campo.disabled = true; }
        if (c.certos > enviado) { enviado = c.certos; api.agir({ pos: c.certos }); }
        pintarFrase(c); pintarPistas();
      });
      function pintarFrase(c) {
        const s = fraseAtual, k = c ? c.certos : 0, erro = c && c.erroEm >= 0;
        const partes = [el('span', { class: 'ok', texto: s.slice(0, k) })];
        if (k < s.length) partes.push(el('span', { class: erro ? 'erro' : 'atual', texto: s[k] }), el('span', { class: 'resto', texto: s.slice(k + 1) }));
        frase.replaceChildren(...partes);
      }
      function pintarPistas() {
        if (!v) return;
        const agora = Date.now();
        pistas.replaceChildren(...v.js.map(function (p) {
          const sou = p.nome === api.eu;
          const pos = sou ? Math.max(p.pos, minhaPos) : p.pos;
          const fim = sou && meuFim != null ? meuFim : p.fimMs;
          const ms = fim != null ? fim : Math.max(0, agora - inicio);
          return el('div', { class: 'vl-cr-pista' + (sou ? ' eu' : '') }, [
            el('span', { class: 'nome', texto: (p.bot ? '🤖 ' : '') + p.nome + (sou ? ' (você)' : '') }),
            el('span', { class: 'vl-cr-trilho', 'aria-label': Math.round(pos / fraseAtual.length * 100) + '%' }, [el('span', { class: 'chegada' }), el('span', { class: 'luz', style: 'left:' + (4 + pos / fraseAtual.length * 92) + '%' })]),
            el('span', { class: 'ppm', texto: (agora >= inicio ? C.ppm(pos, ms) : 0) + ' ppm' + (fim != null ? ' ✓' : '') }),
          ]);
        }));
      }
      function contar() {
        const falta = inicio - Date.now();
        if (falta > 0) { estado.className = 'vl-cr-estado'; estado.textContent = 'Prepare-se… ' + Math.ceil(falta / 1000); }
        else if (meuFim != null) { estado.className = 'vl-cr-estado vai'; estado.textContent = 'Você terminou em ' + (meuFim / 1000).toFixed(1) + ' s · ' + C.ppm(fraseAtual.length, meuFim) + ' palavras por minuto!'; }
        else {
          if (campo.disabled) { campo.disabled = false; campo.placeholder = 'Digite aqui…'; campo.focus(); }
          estado.className = 'vl-cr-estado vai'; estado.textContent = 'Vai! Digite a frase exatamente como está.';
        }
        pintarPistas();
      }
      return {
        el: raizEl,
        atualizar(nova) {
          if (!nova || typeof nova.frase !== 'string') return;
          if (nova.id !== idAtual) { // corrida nova
            idAtual = nova.id;
            fraseAtual = nova.frase; enviado = 0; minhaPos = 0; meuFim = null;
            inicio = Date.now() + Math.max(0, Math.min(10000, Number(nova.falta) || 0));
            campo.value = ''; campo.disabled = true; campo.classList.remove('erro'); campo.placeholder = 'Espere a largada…';
            pintarFrase(null);
            clearInterval(relogio);
            relogio = setInterval(function () { if (!raizEl.isConnected) { clearInterval(relogio); return; } contar(); }, 200);
          }
          v = nova;
          contar();
        },
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
