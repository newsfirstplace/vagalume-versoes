// Vagalume — Sinuca na mesa de jogos (regras e física em core/sinuca.js).
// Mira com o mouse sobre a mesa; segure o botão para encher a força e solte para tacar.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.sinuca || !VL.camada) return;
  const S = VL.sinuca;
  const el = VL.camada.el;
  const CORES = { 1: '#f2c41b', 2: '#2f6fe0', 3: '#e23a2e', 4: '#7b3fb5', 5: '#f07a1c', 6: '#1e9a4d', 7: '#8a2a1e', 8: '#111111' };
  const corDa = (id) => (id === 0 ? '#f6f3ea' : CORES[id > 8 ? id - 8 : id]);
  const BORDA = 10; // madeira em volta, em unidades da mesa
  const CSS = `
  .vl-sn { display: grid; gap: 10px; }
  .vl-sn-topo { display: flex; gap: 8px; flex-wrap: wrap; justify-content: space-between; align-items: center; }
  .vl-sn-jog { padding: 5px 10px; border-radius: 10px; background: #1a2230; border: 1px solid #2c3a4f; font-weight: 600; }
  .vl-sn-jog.vez { border-color: #d6f24a; box-shadow: 0 0 10px rgba(214,242,74,.35); }
  .vl-sn-jog small { color: #9aa6ba; font-weight: 500; }
  .vl-sn canvas { width: 100%; height: auto; border-radius: 14px; cursor: crosshair; display: block; touch-action: none; }
  .vl-sn-forca { height: 10px; border-radius: 6px; background: #1a2230; overflow: hidden; border: 1px solid #2c3a4f; }
  .vl-sn-forca i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #d6f24a, #f39232, #e5484d); }
  .vl-sn-msg { text-align: center; color: #c9d3e2; min-height: 18px; }
  `;
  VL.mesa.registrar('sinuca', {
    nome: 'Sinuca', glifo: '🎱', min: 2, max: 2,
    texto: 'Bola 8: lisas contra listradas. Mire com o mouse, segure para dar força e solte para tacar. Encaçape o seu grupo e depois a 8. Contra alguém do quarto ou contra o bot.',
    bots: [['facil', 'Bot fácil'], ['medio', 'Bot médio'], ['dificil', 'Bot difícil']],
    nova: (jogadores) => S.nova(jogadores),
    aplicar: (e, nome, a) => S.aplicar(e, nome, a),
    tick: (e) => S.tick(e),
    sair: (e, nome) => S.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.texto } : null),
    visao: (e) => S.visao(e),
    montar(api) {
      const tela = el('canvas', { width: String((S.W + BORDA * 2) * 4), height: String((S.H + BORDA * 2) * 4), 'aria-label': 'Mesa de sinuca' });
      const topo = el('div', { class: 'vl-sn-topo' });
      const forcaBarra = el('i');
      const msg = el('div', { class: 'vl-sn-msg', role: 'status', 'aria-live': 'polite' });
      const raizEl = el('div', { class: 'vl-sn' }, [el('style', { texto: CSS }), topo, tela, el('div', { class: 'vl-sn-forca', 'aria-hidden': 'true' }, [forcaBarra]), msg]);
      const g = tela.getContext('2d');
      const K = 4; // pixels por unidade
      let v = null, bolas = [], animando = null, tiroVisto = 0, mira = null, carregando = null, quadro = 0;
      const ponto = (x, y) => [(x + BORDA) * K, (y + BORDA) * K];
      const minhaVez = () => v && !v.fim && v.vez === api.eu && !animando;
      function desenhar() {
        g.clearRect(0, 0, tela.width, tela.height);
        g.fillStyle = '#5b3a1e'; g.fillRect(0, 0, tela.width, tela.height);
        g.fillStyle = '#7a4f29'; g.fillRect(K * 3, K * 3, tela.width - K * 6, tela.height - K * 6);
        g.fillStyle = '#1f7a4a'; g.fillRect(BORDA * K, BORDA * K, S.W * K, S.H * K);
        const grad = g.createRadialGradient(tela.width / 2, tela.height / 2, 20, tela.width / 2, tela.height / 2, tela.width / 1.6);
        grad.addColorStop(0, 'rgba(255,255,255,.08)'); grad.addColorStop(1, 'rgba(0,0,0,.25)');
        g.fillStyle = grad; g.fillRect(BORDA * K, BORDA * K, S.W * K, S.H * K);
        for (const [px, py, pr] of S.CACAPAS) { const [x, y] = ponto(px, py); g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(x, y, pr * K, 0, Math.PI * 2); g.fill(); }
        const branca = bolas.find((b) => b.id === 0 && !b.fora);
        if (minhaVez() && branca && mira) {
          const [bx, by] = ponto(branca.x, branca.y);
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([6, 6]); g.lineWidth = 2;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(mira) * 900, by + Math.sin(mira) * 900); g.stroke(); g.setLineDash([]);
          const recuo = 14 + (carregando ? carregando.forca * 60 : 0);
          g.strokeStyle = '#c8a46a'; g.lineWidth = 6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(bx - Math.cos(mira) * (S.R * K + recuo), by - Math.sin(mira) * (S.R * K + recuo)); g.lineTo(bx - Math.cos(mira) * (S.R * K + recuo + 200), by - Math.sin(mira) * (S.R * K + recuo + 200)); g.stroke();
        }
        for (const b of bolas) {
          if (b.fora) continue;
          const [x, y] = ponto(b.x, b.y), r = S.R * K;
          g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + 2, y + 3, r, 0, Math.PI * 2); g.fill();
          g.fillStyle = b.id > 8 ? '#f6f3ea' : corDa(b.id); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          if (b.id > 8) { g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip(); g.fillStyle = corDa(b.id); g.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1); g.restore(); }
          if (b.id) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.font = 'bold ' + Math.round(r * 0.6) + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(b.id), x, y + 0.5); }
          g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2); g.fill();
        }
      }
      function textos() {
        if (!v) return;
        topo.replaceChildren(...v.js.map((j) => el('span', { class: 'vl-sn-jog' + (j.nome === v.vez && !v.fim ? ' vez' : '') }, [(j.bot ? '🤖 ' : '') + j.nome + (j.nome === api.eu ? ' (você)' : '') + ' ',
          el('small', { texto: j.grupo ? j.grupo + ' · faltam ' + j.restam : 'grupo ainda não definido' })])));
        msg.textContent = v.fim ? '' : (v.msg ? v.msg + ' ' : '') + (animando ? '' : minhaVez() ? 'Sua vez: mire e segure o botão para dar força.' : 'Vez de ' + v.vez + '.');
      }
      // Anima a tacada nova a partir das bolas de antes (a mesma simulação do anfitrião), depois usa as finais.
      function animar(tiro) {
        const r = S.simular(tiro.antes, tiro.angulo, tiro.forca, 4); // 4 passos de 1/240 s por quadro: tempo real a 60 qps
        animando = { quadros: r.quadros, i: 0 };
        cancelAnimationFrame(quadro);
        const passo = function () {
          if (!raizEl.isConnected || !animando) return;
          const q = animando.quadros[animando.i++];
          if (q) { bolas = q; desenhar(); quadro = requestAnimationFrame(passo); return; }
          animando = null; bolas = v ? v.bolas : r.bolas; desenhar(); textos();
        };
        textos();
        passo();
      }
      function posMesa(ev) {
        const r = tela.getBoundingClientRect();
        return [(ev.clientX - r.left) / r.width * tela.width / K - BORDA, (ev.clientY - r.top) / r.height * tela.height / K - BORDA];
      }
      tela.addEventListener('pointermove', function (ev) {
        if (!minhaVez()) return;
        const branca = bolas.find((b) => b.id === 0);
        if (!branca) return;
        const [x, y] = posMesa(ev);
        mira = Math.atan2(y - branca.y, x - branca.x);
        if (!carregando) desenhar();
      });
      tela.addEventListener('pointerdown', function (ev) {
        if (!minhaVez() || mira == null || ev.button !== 0) return;
        tela.setPointerCapture(ev.pointerId);
        const inicio = performance.now();
        carregando = { forca: 0.05, inicio };
        const encher = function () {
          if (!carregando) return;
          carregando.forca = forcaDe(inicio);
          forcaBarra.style.width = Math.round(carregando.forca * 100) + '%';
          desenhar();
          requestAnimationFrame(encher);
        };
        encher();
      });
      // Sobe e desce enquanto segura (1,4 s para encher); calculada pelo tempo, não pelos quadros.
      const forcaDe = (inicio) => 0.05 + 0.95 * Math.abs(Math.sin(((performance.now() - inicio) / 1400) * Math.PI / 2 % Math.PI));
      const soltar = function () {
        if (!carregando) return;
        const f = forcaDe(carregando.inicio);
        carregando = null; forcaBarra.style.width = '0';
        if (minhaVez() && mira != null) api.agir({ tipo: 'tacar', angulo: mira, forca: f });
      };
      tela.addEventListener('pointerup', soltar);
      tela.addEventListener('pointercancel', function () { carregando = null; forcaBarra.style.width = '0'; });
      return {
        el: raizEl,
        atualizar(nova) {
          v = nova;
          if (!v) return;
          if (v.tiro && v.tiro.id !== tiroVisto) { tiroVisto = v.tiro.id; animar(v.tiro); return; }
          if (!animando) { bolas = v.bolas; desenhar(); }
          textos();
        },
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
