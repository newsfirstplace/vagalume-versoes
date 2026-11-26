// Vagalume — Ludo na mesa de jogos (regras em core/ludo.js). Tabuleiro 15 × 15 desenhado com CSS grid.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.ludo || !VL.camada) return;
  const L = VL.ludo;
  const el = VL.camada.el;
  const COR = ['#b9dc2e', '#3a8ee8', '#ea5a9e', '#f39232'];
  const NOME_COR = ['lima', 'azul', 'rosa', 'laranja'];
  const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const CSS = `
  .vl-ld { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; }
  .vl-ld-tab { --c: min(30px, calc((100vw - 120px) / 15)); display: grid; grid-template: repeat(15, var(--c)) / repeat(15, var(--c)); background: #0f141c; border: 2px solid #2c3a4f; border-radius: 10px; overflow: hidden; }
  .vl-ld-tab > div { position: relative; box-sizing: border-box; }
  .vl-ld-caminho { background: #e9ecf2; border: 1px solid #c3c9d6; }
  .vl-ld-segura::after { content: '★'; position: absolute; inset: 0; display: grid; place-items: center; color: #9aa4b6; font-size: 13px; }
  .vl-ld-centro { background: #2a3446; }
  .vl-ld-meio::after { content: '★'; position: absolute; inset: 0; display: grid; place-items: center; color: #d6f24a; font-size: 18px; text-shadow: 0 0 8px #d6f24a; }
  .vl-ld-peao { all: unset; position: absolute; inset: 12%; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,.5); z-index: 2; display: grid; place-items: center; font: 800 9px system-ui, sans-serif; color: #111; }
  .vl-ld-peao.pode { cursor: pointer; animation: vl-ld-pula .6s ease-in-out infinite alternate; outline: 2px solid #fff; }
  @keyframes vl-ld-pula { to { transform: translateY(-4px); } }
  .vl-ld-lado { display: grid; gap: 10px; }
  .vl-ld-jog { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; background: #1a2230; border: 1px solid #2c3a4f; font-weight: 600; }
  .vl-ld-jog.vez { border-color: #d6f24a; box-shadow: 0 0 10px rgba(214,242,74,.35); }
  .vl-ld-jog i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; flex: none; }
  .vl-ld-jog small { margin-left: auto; color: #9aa6ba; font-weight: 500; }
  .vl-ld-dado { font-size: 58px; line-height: 1; text-align: center; color: #fff; min-height: 60px; }
  .vl-ld-msg { color: #c9d3e2; text-align: center; min-height: 36px; }
  @media (max-width: 680px) { .vl-ld { grid-template-columns: 1fr; } }
  `;
  VL.mesa.registrar('ludo', {
    nome: 'Ludo', glifo: '🎲', min: 2, max: 4,
    texto: 'Tire 6 para sair da base, dê a volta no tabuleiro e chegue ao centro com os 4 peões. Cair num adversário manda ele de volta (menos nas estrelas). De 2 a 4, com bots.',
    bots: [['normal', 'Bot']],
    nova: (jogadores) => L.nova(jogadores),
    aplicar: (e, nome, a) => L.aplicar(e, nome, a),
    tick: (e) => L.tick(e),
    sair: (e, nome) => L.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.texto || e.fim.ordem[0] + ' levou os 4 peões ao centro!' } : null),
    visao: (e) => L.visao(e),
    montar(api) {
      const tab = el('div', { class: 'vl-ld-tab', 'aria-label': 'Tabuleiro de Ludo' });
      const lado = el('div', { class: 'vl-ld-lado' });
      const raizEl = el('div', { class: 'vl-ld' }, [el('style', { texto: CSS }), tab, lado]);
      // Fundo fixo: caminho, estrelas, retas, bases e centro.
      const fundo = new Map();
      const marcar = (l, c, classe, cor) => fundo.set(l + ',' + c, { classe, cor });
      L.CAMINHO.forEach(([l, c], i) => marcar(l, c, 'vl-ld-caminho' + (L.SEGURAS.has(i) ? ' vl-ld-segura' : ''), L.SAIDA.includes(i) ? COR[L.SAIDA.indexOf(i)] : null));
      L.RETA.forEach((r, k) => r.forEach(([l, c]) => marcar(l, c, 'vl-ld-caminho', COR[k])));
      const cantos = [[0, 0], [0, 9], [9, 9], [9, 0]];
      let v = null;
      function desenhar() {
        const cel = [];
        for (let l = 0; l < 15; l++) for (let c = 0; c < 15; c++) {
          const f = fundo.get(l + ',' + c);
          const k = cantos.findIndex(([l0, c0]) => l >= l0 && l < l0 + 6 && c >= c0 && c < c0 + 6);
          let classe = '', estilo = '';
          if (f) { classe = f.classe; if (f.cor) estilo = 'background:' + f.cor; }
          else if (l >= 6 && l <= 8 && c >= 6 && c <= 8) { const braco = { '6,7': 1, '7,6': 0, '7,8': 2, '8,7': 3 }[l + ',' + c]; classe = 'vl-ld-centro' + (l === 7 && c === 7 ? ' vl-ld-meio' : ''); if (braco != null) estilo = 'background:' + COR[braco]; }
          else if (k >= 0 && l >= cantos[k][0] + 1 && l <= cantos[k][0] + 4 && c >= cantos[k][1] + 1 && c <= cantos[k][1] + 4) estilo = 'background:' + COR[k] + '55';
          else if (k >= 0) estilo = 'background:' + COR[k] + '22';
          cel.push(el('div', { class: classe, style: estilo + ';grid-row:' + (l + 1) + ';grid-column:' + (c + 1) }));
        }
        if (v) {
          const minha = v.vez === api.eu && v.rolou && !v.fim;
          const porCasa = new Map();
          for (const j of v.js) j.peoes.forEach(function (p, i) {
            const pos = L.casa(j.lugar, p, i);
            if (!pos) return;
            const chave = pos.join(',');
            porCasa.set(chave, (porCasa.get(chave) || []).concat([{ j, i, pos }]));
          });
          const CANTOS = ['4% 36% 36% 4%', '36% 4% 4% 36%', '4% 4% 36% 36%', '36% 36% 4% 4%'];
          for (const lista of porCasa.values()) lista.forEach(function ({ j, i, pos }, k) {
            const pode = minha && j.nome === api.eu && v.movem[i];
            cel.push(el('div', { style: 'grid-row:' + (pos[0] + 1) + ';grid-column:' + (pos[1] + 1) + ';z-index:2' }, [el('button', {
              type: 'button', class: 'vl-ld-peao' + (pode ? ' pode' : ''), style: 'background:' + COR[j.lugar] + (lista.length > 1 ? ';inset:' + CANTOS[k % 4] : ''), disabled: !pode,
              'aria-label': 'Peão ' + (i + 1) + ' de ' + j.nome + (pode ? ', mover' : ''), onclick() { api.agir({ tipo: 'mover', peao: i }); },
            }, [])]));
          });
        }
        tab.replaceChildren(...cel);
        if (!v) return;
        const eu = v.vez === api.eu && !v.fim;
        const u = v.ultimo;
        lado.replaceChildren(
          ...v.js.map((j) => el('div', { class: 'vl-ld-jog' + (j.nome === v.vez && !v.fim ? ' vez' : '') }, [el('i', { style: 'background:' + COR[j.lugar] }), (j.bot ? '🤖 ' : '') + j.nome + (j.nome === api.eu ? ' (você)' : ''),
            el('small', { texto: j.peoes.filter((p) => p === L.FIM).length + '/4 no centro' })])),
          el('div', { class: 'vl-ld-dado', 'aria-label': v.dado ? 'Dado: ' + v.dado : 'Dado' }, [v.dado ? FACES[v.dado] : '🎲']),
          el('div', { class: 'vl-ld-msg', role: 'status', 'aria-live': 'polite', texto: v.fim ? '' : (u ? (u.nome === api.eu ? 'Você ' : u.nome + ' ') + (u.tipo === 'rolou' ? 'tirou ' + u.dado + (u.tres ? ' (três 6 seguidos: perdeu a vez)' : '') : 'andou ' + u.dado + (u.capturou ? ' e capturou um peão!' : u.chegou ? ' e chegou ao centro!' : '')) + '. ' : '')
            + (eu ? (v.rolou ? 'Escolha o peão que pula.' : 'Sua vez: role o dado.') : 'Vez de ' + v.vez + '.') }),
          eu && !v.rolou ? el('button', { type: 'button', class: 'vl-ms-botao forte', texto: 'Rolar o dado', onclick() { api.agir({ tipo: 'rolar' }); } }) : el('span'),
          el('p', { class: 'vl-ms-nota', texto: 'Sua cor: ' + ((v.js.find((j) => j.nome === api.eu) || {}).lugar != null ? NOME_COR[v.js.find((j) => j.nome === api.eu).lugar] : '—') + '. 6 ou captura: joga de novo.' }),
        );
      }
      return { el: raizEl, atualizar(nova) { v = nova; desenhar(); } };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
