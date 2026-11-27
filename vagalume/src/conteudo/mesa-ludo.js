// Vagalume — Ludo na mesa de jogos (regras em core/ludo.js).
// Tabuleiro clássico (bases coloridas com os ninhos, caminho branco, retas coloridas, estrelas e o centro em
// quatro triângulos), dado em 3D que gira e peões que pulam casa por casa. Cada lance vem numerado do
// anfitrião e a tela toca um de cada vez, na ordem.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.ludo || !VL.camada) return;
  const L = VL.ludo;
  const el = VL.camada.el;
  const COR = ['#a9d02a', '#2f86e6', '#e6508f', '#f08a24'];
  const ESCURA = ['#5f7c0e', '#164f96', '#9c2256', '#a2540a'];
  const NOME_COR = ['Lima', 'Azul', 'Rosa', 'Laranja'];
  const CANTO = [[0, 0], [0, 9], [9, 9], [9, 0]];        // base de cada cor (linha, coluna)
  const CHEGADA = [[7, 6], [6, 7], [7, 8], [8, 7]];      // triângulo do centro de cada cor
  const SETA = [0, 90, 180, 270];                         // sentido da casa de saída
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const CSS = `
  .vl-ld { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; align-items: start; }
  .vl-ld-tab { --c: 32px; position: relative; width: calc(var(--c) * 15); height: calc(var(--c) * 15); border-radius: 12px; background: #f4f6fa; overflow: hidden;
    box-shadow: 0 0 0 6px #e4e8ef, 0 0 0 8px #aab3c3, 0 18px 34px rgba(0,0,0,.5); }
  .vl-ld-cel { position: absolute; width: var(--c); height: var(--c); box-sizing: border-box; border: 1px solid #ccd3df; background: #fff; display: grid; place-items: center; color: #a7b0c0; font: calc(var(--c) * .56)/1 system-ui, sans-serif; }
  .vl-ld-cel.cor { background: var(--cor); border-color: rgba(0,0,0,.14); color: #fff; }
  .vl-ld-cel.cor::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.28), transparent 55%); }
  .vl-ld-cel span { position: relative; text-shadow: 0 1px 2px rgba(0,0,0,.35); }
  .vl-ld-base { position: absolute; width: calc(var(--c) * 6); height: calc(var(--c) * 6); background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%), var(--cor); box-shadow: inset 0 0 0 1px rgba(0,0,0,.18), inset 0 -10px 24px rgba(0,0,0,.16); }
  .vl-ld-quintal { position: absolute; left: var(--c); top: var(--c); width: calc(var(--c) * 4); height: calc(var(--c) * 4); border-radius: 20%; background: #fff; box-shadow: inset 0 3px 8px rgba(0,0,0,.18), 0 2px 0 rgba(255,255,255,.4); }
  .vl-ld-ninho { position: absolute; width: calc(var(--c) * .86); height: calc(var(--c) * .86); margin: calc(var(--c) * .07); border-radius: 50%; background: var(--cor); box-shadow: inset 0 3px 6px rgba(0,0,0,.35), 0 0 0 2px rgba(0,0,0,.05); opacity: .75; }
  .vl-ld-nome-base { position: absolute; left: 0; right: 0; bottom: calc(var(--c) * .12); text-align: center; color: #fff; font: 800 calc(var(--c) * .34)/1 system-ui, sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; }
  .vl-ld-centro { position: absolute; left: calc(var(--c) * 6); top: calc(var(--c) * 6); width: calc(var(--c) * 3); height: calc(var(--c) * 3);
    background: conic-gradient(from -45deg, #2f86e6 0 25%, #e6508f 0 50%, #f08a24 0 75%, #a9d02a 0); box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
  .vl-ld-centro::after { content: '★'; position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font: calc(var(--c) * .95)/1 system-ui, sans-serif; text-shadow: 0 0 12px rgba(255,255,255,.95), 0 2px 3px rgba(0,0,0,.4); }
  .vl-ld-peao { position: absolute; left: 0; top: 0; width: var(--c); height: var(--c); display: grid; place-items: center; z-index: 3; pointer-events: none; border: 0; padding: 0; background: none; }
  .vl-ld-peao i { position: relative; width: 76%; height: 76%; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle at 34% 28%, rgba(255,255,255,.9) 0 11%, transparent 30%), radial-gradient(circle at 50% 58%, var(--cor) 0 56%, var(--esc) 100%);
    box-shadow: 0 0 0 2px #fff, 0 3px 0 2px rgba(0,0,0,.25), 0 6px 10px rgba(0,0,0,.4); }
  .vl-ld-peao i::after { content: ''; position: absolute; inset: 31%; border-radius: 50%; background: rgba(255,255,255,.3); box-shadow: inset 0 1px 2px rgba(0,0,0,.3); }
  .vl-ld-peao.pode { pointer-events: auto; cursor: pointer; z-index: 7; }
  .vl-ld-peao.pode i { animation: vl-ld-pula .5s ease-in-out infinite alternate; box-shadow: 0 0 0 2px #fff, 0 0 0 5px rgba(255,255,255,.55), 0 0 16px 5px var(--cor), 0 6px 10px rgba(0,0,0,.4); }
  .vl-ld-peao:focus-visible { outline: 2px solid #fff; outline-offset: -2px; border-radius: 50%; }
  .vl-ld-lado { display: grid; gap: 12px; align-content: start; min-width: 0; }
  .vl-ld-jog { --cor: #888; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); transition: background .2s, box-shadow .2s; }
  .vl-ld-jog.vez { border-color: var(--cor); background: color-mix(in srgb, var(--cor) 14%, transparent); box-shadow: 0 0 0 1px var(--cor), 0 0 18px color-mix(in srgb, var(--cor) 40%, transparent); }
  .vl-ld-jog .vl-jg-cabeca { box-shadow: 0 0 0 2px var(--cor); }
  .vl-ld-jog .quem { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .vl-ld-jog .quem b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .vl-ld-jog .quem small { color: #9aa6b8; font-size: 11px; }
  .vl-ld-casas { display: flex; gap: 4px; }
  .vl-ld-casas i { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.12); }
  .vl-ld-casas i.ok { background: var(--cor); box-shadow: 0 0 6px var(--cor); }
  .vl-ld-dado-caixa { --cor: #d6f24a; position: relative; display: grid; justify-items: center; gap: 8px; padding: 16px 12px 12px; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--cor) 55%, transparent);
    background: radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--cor) 32%, #1a2130), #11151f 75%); transition: background .3s, border-color .3s; }
  .vl-ld-dado-caixa.pode { cursor: pointer; box-shadow: 0 0 0 2px var(--cor), 0 0 22px color-mix(in srgb, var(--cor) 50%, transparent); }
  .vl-ld-dado-caixa small { color: #dfe6f2; font-weight: 600; }
  .vl-ld-palco { width: 96px; height: 96px; display: grid; place-items: center; }
  .vl-ld-dado { width: 66px; height: 66px; box-sizing: border-box; border-radius: 15px; padding: 9px; display: grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr);
    background: radial-gradient(circle at 30% 25%, #ffffff, #eef1f6 55%, #cdd4df); box-shadow: inset 0 -5px 0 rgba(0,0,0,.12), inset 0 0 0 1px rgba(0,0,0,.08), 0 8px 16px rgba(0,0,0,.45); }
  .vl-ld-dado i { width: 12px; height: 12px; border-radius: 50%; place-self: center; background: radial-gradient(circle at 40% 35%, #4a4f5a, #0c0e12); box-shadow: inset 0 1px 1px rgba(255,255,255,.2); }
  .vl-ld-dado[data-n="1"] i { width: 17px; height: 17px; background: radial-gradient(circle at 40% 35%, #ff6b7a, #b3132a); }
  .vl-ld-dado.girando { filter: blur(.7px); }
  .vl-ld-sombra { width: 58px; height: 10px; margin-top: -6px; border-radius: 50%; background: radial-gradient(ellipse, rgba(0,0,0,.55), transparent 70%); }
  .vl-ld-msg { text-align: center; min-height: 38px; color: #dfe6f2; line-height: 1.35; }
  .vl-ld-msg b { color: #d6f24a; }
  .vl-ld-rolar { width: 100%; }
  .vl-ld-nota { margin: 0; color: #8f9bb0; font-size: 11.5px; text-align: center; }
  @keyframes vl-ld-pula { to { transform: translateY(-5px) scale(1.06); } }
  @media (max-width: 760px) { .vl-ld { grid-template-columns: 1fr; justify-items: center; } .vl-ld-tab { --c: min(30px, calc((100vw - 70px) / 15)); } .vl-ld-lado { width: 100%; } }
  @media (prefers-reduced-motion: reduce) { .vl-ld-peao.pode i { animation: none; } }
  `;

  VL.mesa.registrar('ludo', {
    nome: 'Ludo', glifo: '🎲', min: 2, max: 4,
    texto: 'Tire 6 para sair da base, dê a volta no tabuleiro e leve os 4 peões ao centro. Cair num adversário manda ele de volta para a base (menos nas estrelas). 6 ou captura: joga de novo.',
    fatos: ['De 2 a 4 jogadores', 'Com bots', 'Dado e peões animados'],
    bots: [['normal', 'Bot']],
    nova: (jogadores) => L.nova(jogadores),
    aplicar: (e, nome, a) => L.aplicar(e, nome, a),
    tick: (e) => L.tick(e),
    sair: (e, nome) => L.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.texto || e.fim.ordem[0] + ' levou os 4 peões ao centro!', detalhe: Object.fromEntries(e.js.map((j) => [j.nome, j.peoes.filter((p) => p === L.FIM).length + ' de 4 no centro'])) } : null),
    visao: (e) => L.visao(e),
    montar(api) {
      const tab = el('div', { class: 'vl-ld-tab', role: 'img', 'aria-label': 'Tabuleiro de Ludo' });
      const lado = el('div', { class: 'vl-ld-lado' });
      const raizEl = el('div', { class: 'vl-ld' }, [el('style', { texto: CSS }), tab, lado]);
      let parado = false;
      try { parado = raiz.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sem matchMedia */ }
      // ---------- fundo fixo ----------
      const cel = (l, c, classe, estilo, filhos) => el('div', { class: 'vl-ld-cel' + (classe ? ' ' + classe : ''), style: 'left:calc(var(--c) * ' + c + ');top:calc(var(--c) * ' + l + ');' + (estilo || '') }, filhos);
      const fundo = [];
      CANTO.forEach(function ([l0, c0], k) {
        const ninhos = L.BASE[k].map(([l, c]) => el('i', { class: 'vl-ld-ninho', style: 'left:calc(var(--c) * ' + (c - c0) + ');top:calc(var(--c) * ' + (l - l0) + ')' }));
        fundo.push(el('div', { class: 'vl-ld-base', 'data-lugar': String(k), style: '--cor:' + COR[k] + ';left:calc(var(--c) * ' + c0 + ');top:calc(var(--c) * ' + l0 + ')' }, [el('i', { class: 'vl-ld-quintal' })].concat(ninhos, [el('span', { class: 'vl-ld-nome-base' })])));
      });
      L.CAMINHO.forEach(function ([l, c], i) {
        const saida = L.SAIDA.indexOf(i);
        if (saida >= 0) fundo.push(cel(l, c, 'cor', '--cor:' + COR[saida], [el('span', { texto: '➜', style: 'display:inline-block;transform:rotate(' + SETA[saida] + 'deg)' })]));
        else fundo.push(cel(l, c, '', '', L.SEGURAS.has(i) ? [el('span', { texto: '★' })] : null));
      });
      L.RETA.forEach((r, k) => r.forEach(([l, c]) => fundo.push(cel(l, c, 'cor', '--cor:' + COR[k]))));
      fundo.push(el('div', { class: 'vl-ld-centro' }));
      const camadaPeoes = el('div');
      tab.append(...fundo, camadaPeoes);
      // ---------- lado: jogadores, dado, mensagem ----------
      const listaJog = el('div', { style: 'display:grid;gap:6px' });
      // Dado visto de cima: gira trocando de face e para de pé, mostrando só a face de cima.
      const dado = el('div', { class: 'vl-ld-dado', 'aria-hidden': 'true' });
      const mostrarFace = (n) => { dado.setAttribute('data-n', String(n)); dado.replaceChildren(...PIPS[n].map((p) => el('i', { style: 'grid-area:' + (Math.floor((p - 1) / 3) + 1) + '/' + ((p - 1) % 3 + 1) }))); };
      mostrarFace(6);
      const legendaDado = el('small', { texto: 'Dado' });
      const caixaDado = el('div', { class: 'vl-ld-dado-caixa', role: 'button', tabindex: '-1', 'aria-label': 'Dado' }, [el('div', { class: 'vl-ld-palco' }, [dado]), el('i', { class: 'vl-ld-sombra' }), legendaDado]);
      const msg = el('div', { class: 'vl-ld-msg', role: 'status', 'aria-live': 'polite' });
      const rolar = el('button', { type: 'button', class: 'vl-jg-botao forte grande vl-ld-rolar', texto: '🎲 Rolar o dado' });
      const nota = el('p', { class: 'vl-ld-nota' });
      lado.append(listaJog, caixaDado, msg, rolar, nota);
      // ---------- estado mostrado (anda atrás do estado real enquanto as animações tocam) ----------
      let v = null, ultimoN = null, fila = [], tocando = false, pedido = false, evMostrado = null, eraMinha = false, autoMover = null;
      let mostrado = new Map();     // lugar -> [4 progressos]
      const fichas = new Map();     // 'lugar-i' -> botão do peão
      const C = () => (tab.clientWidth || 480) / 15;
      const posDe = (lugar, prog, i) => (prog >= L.FIM ? CHEGADA[lugar] : L.casa(lugar, prog, i));
      const OFF = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
      function montarFichas() {
        const chave = v.js.map((j) => j.lugar).join(',');
        if (camadaPeoes.getAttribute('data-chave') === chave) return;
        camadaPeoes.setAttribute('data-chave', chave);
        fichas.clear();
        const nos = [];
        for (const j of v.js) for (let i = 0; i < 4; i++) {
          const b = el('button', { type: 'button', class: 'vl-ld-peao', style: '--cor:' + COR[j.lugar] + ';--esc:' + ESCURA[j.lugar], 'aria-label': 'Peão ' + (i + 1) + ' de ' + j.nome, tabindex: '-1',
            onclick() { moverPeao(j.lugar, i); } }, [el('i')]);
          fichas.set(j.lugar + '-' + i, b);
          nos.push(b);
        }
        camadaPeoes.replaceChildren(...nos);
        CANTO.forEach((_, k) => { const base = tab.querySelector('[data-lugar="' + k + '"] .vl-ld-nome-base'); const j = v.js.find((x) => x.lugar === k); if (base) base.textContent = j ? j.nome : ''; });
      }
      // Põe cada peão na casa dele; peões na mesma casa ficam menores, cada um num canto.
      function posicionar() {
        const c = C(), porCasa = new Map();
        for (const [lugar, ps] of mostrado) ps.forEach(function (p, i) {
          const pos = posDe(lugar, p, i), k = pos.join(',');
          if (!porCasa.has(k)) porCasa.set(k, []);
          porCasa.get(k).push({ lugar, i, pos });
        });
        for (const lista of porCasa.values()) lista.forEach(function ({ lugar, i, pos }, k) {
          const f = fichas.get(lugar + '-' + i);
          if (!f) return;
          const n = lista.length, o = n > 1 ? OFF[k % 4] : [0, 0];
          f.style.transform = 'translate(' + ((pos[1] + o[0]) * c) + 'px,' + ((pos[0] + o[1]) * c) + 'px) scale(' + (n > 1 ? 0.68 : 1) + ')';
        });
      }
      function sincronizar() {
        mostrado = new Map(v.js.map((j) => [j.lugar, j.peoes.slice()]));
        montarFichas();
        posicionar();
      }
      // Fim de uma animação, com prazo: com a aba escondida o navegador pausa as animações e o jogo não pode travar.
      const terminar = (a, ms) => Promise.race([a.finished.catch(() => {}), new Promise((ok) => setTimeout(ok, ms + 250))]).then(() => { try { a.cancel(); } catch (e) { /* já acabou */ } });
      const semAnimar = () => parado || (raiz.document && raiz.document.visibilityState === 'hidden');
      const xy = (lugar, prog, i) => { const p = posDe(lugar, prog, i), c = C(); return [p[1] * c, p[0] * c]; };
      function pulo(f, de, para, dur, altura, giro) {
        if (semAnimar() || !f.animate) { f.style.transform = 'translate(' + para[0] + 'px,' + para[1] + 'px)'; return Promise.resolve(); }
        f.style.zIndex = '9';
        const a = f.animate([
          { transform: 'translate(' + de[0] + 'px,' + de[1] + 'px) scale(1) rotate(0deg)' },
          { transform: 'translate(' + (de[0] + para[0]) / 2 + 'px,' + ((de[1] + para[1]) / 2 - altura) + 'px) scale(1.22) rotate(' + (giro || 0) / 2 + 'deg)', offset: 0.5 },
          { transform: 'translate(' + para[0] + 'px,' + para[1] + 'px) scale(1) rotate(' + (giro || 0) + 'deg)' },
        ], { duration: dur, easing: 'ease-in-out' });
        f.style.transform = 'translate(' + para[0] + 'px,' + para[1] + 'px)';
        return terminar(a, dur).then(() => { f.style.zIndex = ''; });
      }
      // ---------- animações dos lances ----------
      function animarDado(ev) {
        return new Promise(function (ok) {
          api.som('dado');
          caixaDado.style.setProperty('--cor', COR[ev.lugar] || '#d6f24a');
          const acabar = () => { mostrarFace(ev.dado); evMostrado = ev; pintarLado(); setTimeout(ok, ev.semJogada || ev.tres ? 900 : 120); };
          if (semAnimar() || !dado.animate) { acabar(); return; }
          // Gira (duas voltas, com pulos) trocando de face; para em pé, só com a face de cima.
          const voltas = 2, lado = Math.random() < 0.5 ? -1 : 1;
          const a = dado.animate([
            { transform: 'translate(0, 0) rotate(0deg) scale(1)' },
            { transform: 'translate(' + (-8 * lado) + 'px, -14px) rotate(' + (lado * 290) + 'deg) scale(1.24)', offset: 0.32 },
            { transform: 'translate(' + (6 * lado) + 'px, 5px) rotate(' + (lado * 560) + 'deg) scale(.9)', offset: 0.62 },
            { transform: 'translate(0, -4px) rotate(' + (lado * 700) + 'deg) scale(1.06)', offset: 0.84 },
            { transform: 'translate(0, 0) rotate(' + (lado * 360 * voltas) + 'deg) scale(1)' },
          ], { duration: 950, easing: 'cubic-bezier(.2,.7,.3,1)' });
          dado.classList.add('girando');
          const troca = setInterval(() => mostrarFace(1 + Math.floor(Math.random() * 6)), 70);
          setTimeout(() => { clearInterval(troca); dado.classList.remove('girando'); mostrarFace(ev.dado); }, 760);
          terminar(a, 950).then(function () {
            clearInterval(troca); dado.classList.remove('girando');
            if (dado.animate && !semAnimar()) dado.animate([{ transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
            acabar();
          });
        });
      }
      async function animarMovimento(ev) {
        const f = fichas.get(ev.lugar + '-' + ev.peao), ps = mostrado.get(ev.lugar);
        evMostrado = ev; pintarLado();
        if (f && ps) {
          const passos = ev.de < 0 ? [0] : Array.from({ length: Math.max(0, ev.para - ev.de) }, (_, k) => ev.de + 1 + k);
          let atual = ps[ev.peao];
          for (const p of passos) {
            api.som('pulo', 0.4 + 0.1 * (p % 3));
            await pulo(f, xy(ev.lugar, atual, ev.peao), xy(ev.lugar, p, ev.peao), 175, C() * 0.5);
            atual = p; ps[ev.peao] = p;
          }
          ps[ev.peao] = ev.para;
        }
        posicionar();
        if (ev.capturados && ev.capturados.length) {
          api.som('captura');
          await Promise.all(ev.capturados.map(function (c) {
            const g = fichas.get(c.lugar + '-' + c.peao), qs = mostrado.get(c.lugar);
            if (!g || !qs) return Promise.resolve();
            const de = xy(c.lugar, qs[c.peao], c.peao);
            qs[c.peao] = -1;
            return pulo(g, de, xy(c.lugar, -1, c.peao), 620, C() * 3, 360);
          }));
          posicionar();
        }
        if (ev.chegou) api.som('chegou');
      }
      async function tocar() {
        if (tocando) return;
        tocando = true;
        while (fila.length) {
          const ev = fila.shift();
          if (ev.tipo === 'rolou') await animarDado(ev);
          else if (ev.tipo === 'moveu') await animarMovimento(ev);
        }
        tocando = false;
        if (v) sincronizar();
        pintarLado();
      }
      function moverPeao(lugar, i) {
        if (!podeAgir() || !v.rolou) return;
        const minha = v.js.find((j) => j.nome === api.eu);
        if (!minha || minha.lugar !== lugar || !v.movem[i]) return;
        clearTimeout(autoMover);
        pedir({ tipo: 'mover', peao: i });
        pintarLado();
      }
      const podeAgir = () => v && !v.fim && v.vez === api.eu && !tocando && !fila.length && !pedido;
      function rolarDado() { if (!podeAgir() || v.rolou) return; pedir({ tipo: 'rolar' }); pintarLado(); }
      // Manda a jogada e espera a resposta; se o anfitrião não responder em 3 s, libera de novo.
      let soltar = null;
      function pedir(acao) { pedido = true; clearTimeout(soltar); soltar = setTimeout(() => { pedido = false; pintarLado(); }, 3000); api.agir(acao); }
      rolar.addEventListener('click', rolarDado);
      caixaDado.addEventListener('click', rolarDado);
      // ---------- texto e botões ----------
      const quem = (nome) => (nome === api.eu ? 'Você' : nome);
      function textoDo(ev) {
        if (!ev) return '';
        if (ev.tipo === 'rolou') return quem(ev.nome) + ' tirou ' + ev.dado + (ev.tres ? ': três 6 seguidos, perdeu a vez.' : ev.semJogada ? ': nenhum peão pode andar.' : '.');
        let t = quem(ev.nome) + (ev.de < 0 ? ' tirou um peão da base' : ' andou ' + ev.dado + (ev.dado === 1 ? ' casa' : ' casas'));
        if (ev.capturou) t += ' e capturou ' + (ev.capturados || []).map((c) => (c.nome === api.eu ? 'o seu peão' : 'um peão de ' + c.nome)).join(' e ') + '!';
        else if (ev.chegou) t += ' e chegou ao centro!';
        else t += '.';
        if (ev.dado === 6 || ev.capturou || ev.chegou) t += ' Joga de novo.';
        return t;
      }
      function pintarLado() {
        if (!v) return;
        const animando = tocando || fila.length > 0;
        const vez = animando && evMostrado ? evMostrado.nome : v.vez;
        listaJog.replaceChildren(...v.js.map((j) => el('div', { class: 'vl-ld-jog' + (j.nome === vez && !v.fim ? ' vez' : ''), style: '--cor:' + COR[j.lugar] }, [
          api.cabeca(j.nome),
          el('span', { class: 'quem' }, [el('b', { texto: j.nome + (j.nome === api.eu ? ' (você)' : '') }), el('small', { texto: NOME_COR[j.lugar] + (j.bot ? ' · bot' : '') })]),
          el('span', { class: 'vl-ld-casas', title: 'Peões no centro', 'aria-label': j.peoes.filter((p) => p === L.FIM).length + ' de 4 no centro' }, j.peoes.map((p) => el('i', { class: p === L.FIM ? 'ok' : '' }))),
        ])));
        const minhaVez = !animando && !v.fim && v.vez === api.eu;
        const jogVez = v.js.find((j) => j.nome === vez);
        caixaDado.style.setProperty('--cor', COR[jogVez ? jogVez.lugar : 0]);
        const podeRolar = minhaVez && !v.rolou && !pedido;
        caixaDado.classList.toggle('pode', podeRolar);
        caixaDado.tabIndex = podeRolar ? 0 : -1;
        legendaDado.textContent = podeRolar ? 'Clique para rolar' : vez === api.eu ? 'Sua vez' : vez ? 'Vez de ' + vez : 'Dado';
        rolar.hidden = !podeRolar;
        const instrucao = v.fim ? '' : minhaVez ? (v.rolou ? 'Escolha o peão que vai andar.' : 'Sua vez: role o dado!') : animando ? '' : 'Vez de ' + v.vez + '.';
        msg.replaceChildren(...[textoDo(evMostrado), instrucao ? el('br') : null, instrucao ? el('b', { texto: instrucao }) : null].filter(Boolean));
        const minha = v.js.find((j) => j.nome === api.eu);
        nota.textContent = minha ? 'Sua cor: ' + NOME_COR[minha.lugar] + '. Tire 6 para sair da base; estrelas são casas seguras.' : '';
        // Peões que podem andar pulam e aceitam clique.
        for (const [chave, f] of fichas) {
          const [lugar, i] = chave.split('-').map(Number);
          const pode = minhaVez && v.rolou && !pedido && minha && minha.lugar === lugar && v.movem[i];
          f.classList.toggle('pode', !!pode);
          f.tabIndex = pode ? 0 : -1;
        }
        if (minhaVez && !eraMinha) api.som('vez');
        eraMinha = minhaVez;
        // Só um peão pode andar: anda sozinho depois de um instante.
        clearTimeout(autoMover);
        if (minhaVez && v.rolou && !pedido && v.movem.filter(Boolean).length === 1) {
          const i = v.movem.indexOf(true), lugar = minha && minha.lugar;
          autoMover = setTimeout(() => moverPeao(lugar, i), 650);
        }
      }
      return {
        el: raizEl,
        atualizar(nova) {
          if (!nova || !Array.isArray(nova.js)) return;
          const antes = v;
          v = nova;
          if (!antes || (nova.n || 0) < (ultimoN || 0)) { ultimoN = nova.n || 0; evMostrado = (nova.eventos || []).slice(-1)[0] || null; sincronizar(); pintarLado(); return; }
          const novos = (nova.eventos || []).filter((ev) => ev.n > ultimoN);
          if (novos.length) {
            pedido = false;
            const seguido = novos[0].n === ultimoN + 1;
            ultimoN = novos[novos.length - 1].n;
            if (seguido && fila.length + novos.length <= 6) { fila.push(...novos); tocar(); }
            else { fila = []; evMostrado = novos[novos.length - 1]; if (!tocando) sincronizar(); } // perdeu lances: pula para o estado atual
          } else if (!tocando) sincronizar();
          pintarLado();
        },
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
