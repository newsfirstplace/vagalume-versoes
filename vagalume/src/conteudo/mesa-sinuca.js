// Vagalume — Sinuca na mesa de jogos (regras e física em core/sinuca.js), no jeito dos jogos de bola 8 online:
// mesa de pano com moldura de madeira, bolas com brilho, linha de mira com a bola fantasma e o caminho das bolas,
// taco que recua com a força, barra de força, efeito na branca, bola na mão e caçapa marcada para a 8.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.mesa || !VL.sinuca || !VL.camada) return;
  const S = VL.sinuca;
  const el = VL.camada.el;
  const CORES = { 1: '#f6c21a', 2: '#1e5fd8', 3: '#e2342c', 4: '#6b3db3', 5: '#f2801b', 6: '#13914c', 7: '#8a2418', 8: '#121418' };
  const corDe = (id) => (id === 0 ? '#f4f1e6' : CORES[id > 8 ? id - 8 : id]);
  const listrada = (id) => id >= 9;
  const BORDA = 12, K = 5, CW = 2.6; // moldura e almofada, em unidades da mesa; pixels por unidade
  const PANO = { 8: ['#33b06c', '#1d7d49', '#0f4b2c'], 9: ['#3487de', '#1d5ca8', '#103a6c'] };
  const CSS = `
  .vl-sn { display: grid; gap: 10px; }
  .vl-sn-hud { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 10px; align-items: center; }
  .vl-sn-jog { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.08); min-width: 0; transition: box-shadow .2s, border-color .2s; }
  .vl-sn-jog.dir { flex-direction: row-reverse; text-align: right; }
  .vl-sn-jog.vez { border-color: #d6f24a; box-shadow: 0 0 0 1px #d6f24a, 0 0 18px rgba(214,242,74,.35); }
  .vl-sn-jog .vl-jg-cabeca { width: 38px; height: 38px; }
  .vl-sn-jog .quem { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
  .vl-sn-jog .quem b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
  .vl-sn-jog .quem small { color: #9aa6b8; font-size: 11px; }
  .vl-sn-mini { display: flex; gap: 3px; min-height: 13px; }
  .vl-sn-jog.dir .vl-sn-mini { justify-content: flex-end; }
  .vl-sn-mini i { width: 13px; height: 13px; border-radius: 50%; background: #3a4354; box-shadow: inset 0 -2px 3px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.4); }
  .vl-sn-mini i.lis { background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.6), transparent 42%), var(--c); }
  .vl-sn-mini i.lst { background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.6), transparent 42%), linear-gradient(#f4f1e6 0 26%, var(--c) 26% 74%, #f4f1e6 74%); }
  .vl-sn-mini i.foi { opacity: .2; filter: grayscale(1); }
  .vl-sn-centro { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 100px; }
  .vl-sn-modo { font: 800 12px system-ui, sans-serif; padding: 4px 12px; border-radius: 999px; background: #d6f24a; color: #1a2108; letter-spacing: .3px; }
  .vl-sn-proxima { display: flex; align-items: center; gap: 6px; color: #c9d3e2; font-size: 11.5px; white-space: nowrap; }
  .vl-sn-meio { display: grid; grid-template-columns: 40px minmax(0, 1fr) 86px; gap: 10px; align-items: stretch; }
  .vl-sn-forca { position: relative; border-radius: 12px; background: linear-gradient(180deg, #11161f, #0b0f15); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 4px 10px rgba(0,0,0,.6); cursor: ns-resize; touch-action: none; overflow: hidden; }
  .vl-sn-forca .enche { position: absolute; left: 6px; right: 6px; top: 6px; height: 0; border-radius: 6px; background: linear-gradient(180deg, #d6f24a, #f2c21b 55%, #ff5a3c); box-shadow: 0 0 10px rgba(214,242,74,.4); }
  .vl-sn-forca .taco { position: absolute; left: 50%; top: 6px; width: 8px; height: 72%; margin-left: -4px; border-radius: 4px; pointer-events: none;
    background: linear-gradient(180deg, #3aa0ff 0 4%, #f4f1e6 4% 9%, #e4c48c 9% 62%, #1d1f24 62% 66%, #4a2812 66%); box-shadow: 0 2px 6px rgba(0,0,0,.5); }
  .vl-sn-forca.desligada { opacity: .4; cursor: default; }
  .vl-sn-forca small { position: absolute; left: 0; right: 0; bottom: 6px; text-align: center; font: 800 10px system-ui, sans-serif; color: #fff; text-shadow: 0 1px 2px #000; }
  .vl-sn-mesa { position: relative; min-width: 0; border-radius: 18px; box-shadow: 0 18px 36px rgba(0,0,0,.55); }
  .vl-sn-mesa canvas { display: block; width: 100%; height: auto; border-radius: 18px; touch-action: none; cursor: crosshair; outline: none; }
  .vl-sn-mesa canvas.mao { cursor: grab; }
  .vl-sn-mesa canvas.espera { cursor: default; }
  .vl-sn-mesa canvas:focus-visible { box-shadow: 0 0 0 2px #d6f24a; }
  .vl-sn-lado { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 6px; border-radius: 14px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); }
  .vl-sn-lado small { color: #aab5c7; font-size: 11px; text-align: center; }
  .vl-sn-efeito { position: relative; width: 66px; height: 66px; flex: none; border-radius: 50%; cursor: crosshair; touch-action: none; background: radial-gradient(circle at 35% 30%, #ffffff, #ece8dc 55%, #b9b3a3); box-shadow: inset 0 -4px 8px rgba(0,0,0,.25), 0 3px 8px rgba(0,0,0,.45); }
  .vl-sn-efeito::before, .vl-sn-efeito::after { content: ''; position: absolute; background: rgba(0,0,0,.12); }
  .vl-sn-efeito::before { left: 50%; top: 8%; bottom: 8%; width: 1px; } .vl-sn-efeito::after { top: 50%; left: 8%; right: 8%; height: 1px; }
  .vl-sn-efeito i { position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; pointer-events: none; background: radial-gradient(circle at 40% 35%, #ff7a7a, #d11d1d); box-shadow: 0 0 0 2px #fff, 0 1px 3px rgba(0,0,0,.5); }
  .vl-sn-baixo { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: 12px; background: rgba(0,0,0,.28); min-height: 20px; }
  .vl-sn-baixo span { flex: 1; color: #dfe6f2; }
  .vl-sn-baixo b { color: #d6f24a; font-weight: 700; text-align: right; }
  @media (max-width: 720px) { .vl-sn-meio { grid-template-columns: 32px minmax(0, 1fr); } .vl-sn-lado { grid-column: 1 / -1; flex-direction: row; justify-content: center; } }
  `;
  const px = (x) => (x + BORDA) * K;

  VL.mesa.registrar('sinuca', {
    nome: 'Sinuca', glifo: '🎱', min: 2, max: 2,
    texto: 'Bola 8 (lisas contra listradas, marque a caçapa da 8) ou bola 9 (toque sempre na menor; quem encaçapar a 9 vence). Mire com o mouse, puxe o taco para dar força e use efeito na branca.',
    fatos: ['Bola 8 e bola 9', 'Bola na mão e efeito', 'Bot em 3 níveis'],
    opcoes: [{ id: 'modo', rotulo: 'Modo de jogo', valores: [['8', 'Bola 8'], ['9', 'Bola 9']], padrao: '8' }],
    bots: [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']],
    nova: (jogadores, op) => S.nova(jogadores, op),
    aplicar: (e, nome, a) => S.aplicar(e, nome, a),
    tick: (e) => S.tick(e),
    sair: (e, nome) => S.sair(e, nome),
    fim: (e) => (e.fim ? { ordem: e.fim.ordem, texto: e.fim.texto } : null),
    visao: (e) => S.visao(e),
    montar(api) {
      const tela = el('canvas', { width: String((S.W + BORDA * 2) * K), height: String((S.H + BORDA * 2) * K), tabindex: '0', 'aria-label': 'Mesa de sinuca. Mire com o mouse; segure e puxe para trás para dar força. Setas ajustam a mira.' });
      const g = tela.getContext('2d');
      const hud = el('div', { class: 'vl-sn-hud' });
      const enche = el('i', { class: 'enche' }), tacoIco = el('i', { class: 'taco' }), forcaTxt = el('small');
      const barra = el('div', { class: 'vl-sn-forca', title: 'Força: arraste para baixo e solte para tacar', role: 'slider', 'aria-label': 'Força da tacada' }, [enche, tacoIco, forcaTxt]);
      const ponto = el('i');
      const efeito = el('div', { class: 'vl-sn-efeito', title: 'Efeito na branca: clique onde o taco vai bater (duplo clique tira o efeito)', role: 'slider', 'aria-label': 'Efeito na branca' }, [ponto]);
      const efeitoTxt = el('small', { texto: 'Sem efeito' });
      const msgEl = el('span'), dicaEl = el('b');
      const raizEl = el('div', { class: 'vl-sn' }, [el('style', { texto: CSS }), hud,
        el('div', { class: 'vl-sn-meio' }, [barra, el('div', { class: 'vl-sn-mesa' }, [tela]), el('div', { class: 'vl-sn-lado' }, [el('small', { texto: 'Efeito' }), efeito, efeitoTxt])]),
        el('div', { class: 'vl-sn-baixo', role: 'status', 'aria-live': 'polite' }, [msgEl, dicaEl])]);
      let v = null, bolas = [], tiroVisto = null, animacao = null, enviado = false, soltarEnvio = null;
      let mira = 0, puxando = null, forca = 0, giro = { topo: 0, lado: 0 }, colocando = false, brancaLocal = null, colocValida = true;
      let cacapaEscolhida = null, sugestao = null, mouse = null, sujo = true, rodando = false, fundo = null, fundoModo = null;
      const sprites = new Map();

      // ---------- desenho ----------
      function pintarFundo() {
        const c = document.createElement('canvas');
        c.width = tela.width; c.height = tela.height;
        const f = c.getContext('2d'), Wp = c.width, Hp = c.height, modo = v && v.modo === '9' ? 9 : 8;
        // Moldura de madeira.
        const madeira = f.createLinearGradient(0, 0, 0, Hp);
        madeira.addColorStop(0, '#6e4220'); madeira.addColorStop(0.5, '#4b2a12'); madeira.addColorStop(1, '#3a1f0c');
        f.fillStyle = madeira; arredondado(f, 0, 0, Wp, Hp, 9 * K); f.fill();
        f.globalAlpha = 0.08; f.strokeStyle = '#000';
        for (let k = 0; k < 46; k++) { const y = (k * 37) % Hp; f.lineWidth = 1 + (k % 3); f.beginPath(); f.moveTo(0, y); f.bezierCurveTo(Wp / 3, y + 6, Wp * 2 / 3, y - 6, Wp, y + 2); f.stroke(); }
        f.globalAlpha = 1;
        f.strokeStyle = 'rgba(255,220,170,.18)'; f.lineWidth = 3; arredondado(f, 3, 3, Wp - 6, Hp - 6, 8 * K); f.stroke();
        // Pano (vai por baixo das almofadas) com luz no meio e textura.
        const [claro, medio, escuro] = PANO[modo];
        const pano = f.createRadialGradient(Wp / 2, Hp / 2, 30, Wp / 2, Hp / 2, Wp * 0.62);
        pano.addColorStop(0, claro); pano.addColorStop(0.6, medio); pano.addColorStop(1, escuro);
        f.fillStyle = pano; f.fillRect(px(-CW), px(-CW), (S.W + 2 * CW) * K, (S.H + 2 * CW) * K);
        let semente = 7;
        const sorte = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
        for (let k = 0; k < 7000; k++) { f.fillStyle = sorte() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; f.fillRect(px(-CW) + sorte() * (S.W + 2 * CW) * K, px(-CW) + sorte() * (S.H + 2 * CW) * K, 1.4, 1.4); }
        // Almofadas entre as caçapas, com as quinas cortadas.
        const tabelas = [[5.4, 0, 95.6, 0, 0, 1], [104.4, 0, 194.6, 0, 0, 1], [5.4, 100, 95.6, 100, 0, -1], [104.4, 100, 194.6, 100, 0, -1], [0, 5.4, 0, 94.6, 1, 0], [200, 5.4, 200, 94.6, -1, 0]];
        for (const [x1, y1, x2, y2, nx, ny] of tabelas) {
          const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len;
          const j1 = perto(x1, y1) ? CW : CW * 0.4, j2 = perto(x2, y2) ? CW : CW * 0.4;
          const a = [x1, y1], b = [x2, y2], c2 = [x2 - nx * CW + ux * j2, y2 - ny * CW + uy * j2], d = [x1 - nx * CW - ux * j1, y1 - ny * CW - uy * j1];
          f.fillStyle = escuro; f.beginPath(); f.moveTo(px(a[0]), px(a[1])); f.lineTo(px(b[0]), px(b[1])); f.lineTo(px(c2[0]), px(c2[1])); f.lineTo(px(d[0]), px(d[1])); f.closePath(); f.fill();
          f.strokeStyle = 'rgba(255,255,255,.22)'; f.lineWidth = 2; f.beginPath(); f.moveTo(px(a[0]), px(a[1])); f.lineTo(px(b[0]), px(b[1])); f.stroke();
        }
        // Marcas: linha de cabeça, ponto do pé e losangos nas bordas.
        f.strokeStyle = 'rgba(255,255,255,.12)'; f.setLineDash([6, 8]); f.lineWidth = 2;
        f.beginPath(); f.moveTo(px(S.LINHA_CABECA), px(0)); f.lineTo(px(S.LINHA_CABECA), px(S.H)); f.stroke(); f.setLineDash([]);
        f.fillStyle = 'rgba(255,255,255,.25)'; f.beginPath(); f.arc(px(S.PE[0]), px(S.PE[1]), 3, 0, Math.PI * 2); f.fill();
        const meioBorda = CW + (BORDA - CW) / 2;
        const losango = (x, y) => { const cx = px(x), cy = px(y), r = 1.1 * K; f.fillStyle = '#efe7d2'; f.beginPath(); f.moveTo(cx, cy - r); f.lineTo(cx + r * 0.7, cy); f.lineTo(cx, cy + r); f.lineTo(cx - r * 0.7, cy); f.closePath(); f.fill(); };
        for (const k of [1, 2, 3, 5, 6, 7]) { losango(S.W * k / 8, -meioBorda); losango(S.W * k / 8, S.H + meioBorda); }
        for (const k of [1, 2, 3]) { losango(-meioBorda, S.H * k / 4); losango(S.W + meioBorda, S.H * k / 4); }
        // Caçapas.
        for (const [cx, cy, pr] of S.CACAPAS) {
          const x = px(cx), y = px(cy), r = (pr + 0.9) * K;
          f.fillStyle = '#26282d'; f.beginPath(); f.arc(x, y, r + 3, 0, Math.PI * 2); f.fill();
          const buraco = f.createRadialGradient(x, y, 2, x, y, r);
          buraco.addColorStop(0, '#000'); buraco.addColorStop(0.8, '#050505'); buraco.addColorStop(1, '#1b1b1b');
          f.fillStyle = buraco; f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
        }
        fundo = c; fundoModo = modo;
      }
      const perto = (x, y) => [[0, 0], [S.W, 0], [0, S.H], [S.W, S.H]].some(([a, b]) => Math.hypot(x - a, y - b) < 9);
      function arredondado(f, x, y, w, h, r) { f.beginPath(); f.moveTo(x + r, y); f.arcTo(x + w, y, x + w, y + h, r); f.arcTo(x + w, y + h, x, y + h, r); f.arcTo(x, y + h, x, y, r); f.arcTo(x, y, x + w, y, r); f.closePath(); }
      function sprite(id) {
        if (sprites.has(id)) return sprites.get(id);
        const rp = S.R * K, tam = Math.ceil(rp * 2 + 4), c = document.createElement('canvas');
        c.width = c.height = tam;
        const f = c.getContext('2d'), m = tam / 2;
        f.save(); f.beginPath(); f.arc(m, m, rp, 0, Math.PI * 2); f.clip();
        f.fillStyle = id === 0 || listrada(id) ? '#f4f1e6' : corDe(id); f.fillRect(0, 0, tam, tam);
        if (listrada(id)) { f.fillStyle = corDe(id); f.fillRect(0, m - rp * 0.56, tam, rp * 1.12); }
        if (id) {
          f.fillStyle = '#fbfaf5'; f.beginPath(); f.arc(m, m, rp * 0.48, 0, Math.PI * 2); f.fill();
          f.fillStyle = '#15171c'; f.font = '800 ' + Math.round(rp * (id > 9 ? 0.56 : 0.66)) + 'px system-ui, sans-serif'; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillText(String(id), m, m + rp * 0.05);
        }
        const luz = f.createRadialGradient(m - rp * 0.35, m - rp * 0.4, rp * 0.1, m, m, rp * 1.05);
        luz.addColorStop(0, 'rgba(255,255,255,.35)'); luz.addColorStop(0.45, 'rgba(255,255,255,0)'); luz.addColorStop(0.85, 'rgba(0,0,0,.18)'); luz.addColorStop(1, 'rgba(0,0,0,.5)');
        f.fillStyle = luz; f.fillRect(0, 0, tam, tam);
        f.fillStyle = 'rgba(255,255,255,.85)'; f.beginPath(); f.ellipse(m - rp * 0.38, m - rp * 0.42, rp * 0.2, rp * 0.13, -0.6, 0, Math.PI * 2); f.fill();
        f.restore();
        f.strokeStyle = 'rgba(0,0,0,.35)'; f.lineWidth = 1; f.beginPath(); f.arc(m, m, rp - 0.5, 0, Math.PI * 2); f.stroke();
        sprites.set(id, c);
        return c;
      }
      // Bola que a branca acerta primeiro (ou a tabela) na direção da mira.
      function guia(bs, cx, cy, ang) {
        const dx = Math.cos(ang), dy = Math.sin(ang), R = S.R;
        let alvo = null;
        for (const b of bs) {
          if (b.fora || b.id === 0) continue;
          const fx = cx - b.x, fy = cy - b.y, B = fx * dx + fy * dy, C = fx * fx + fy * fy - 4 * R * R, disc = B * B - C;
          if (disc < 0) continue;
          const t = -B - Math.sqrt(disc);
          if (t > 0 && (!alvo || t < alvo.t)) alvo = { t, b };
        }
        let tw = Infinity, nx = 0, ny = 0;
        if (dx > 1e-9 && (S.W - R - cx) / dx < tw) { tw = (S.W - R - cx) / dx; nx = -1; ny = 0; }
        if (dx < -1e-9 && (R - cx) / dx < tw) { tw = (R - cx) / dx; nx = 1; ny = 0; }
        if (dy > 1e-9 && (S.H - R - cy) / dy < tw) { tw = (S.H - R - cy) / dy; nx = 0; ny = -1; }
        if (dy < -1e-9 && (R - cy) / dy < tw) { tw = (R - cy) / dy; nx = 0; ny = 1; }
        if (alvo && alvo.t < tw) { const gx = cx + dx * alvo.t, gy = cy + dy * alvo.t; return { gx, gy, bola: alvo.b, ox: (alvo.b.x - gx) / (2 * R), oy: (alvo.b.y - gy) / (2 * R), dx, dy }; }
        return { gx: cx + dx * Math.max(0, tw), gy: cy + dy * Math.max(0, tw), nx, ny, dx, dy };
      }
      const euJ = () => (v ? v.js.find((j) => j.nome === api.eu) : null);
      function legal(id) {
        if (!v) return true;
        if (v.modo === '9') return id === v.menor;
        const j = euJ();
        if (v.quebra || !j) return true;
        if (!j.grupo) return id !== 8;
        if (v.precisa8) return id === 8;
        return S.grupoDe(id) === j.grupo;
      }
      const minhaVez = () => !!(v && !v.fim && v.vez === api.eu && !animacao && !enviado);
      function bolasMostradas() {
        if (!(minhaVez() && v.naMao && brancaLocal)) return bolas;
        return bolas.map((b) => (b.id === 0 ? { id: 0, x: brancaLocal[0], y: brancaLocal[1], fora: false } : b));
      }
      function pintarTaco(cx, cy, ang, recuo) {
        g.save(); g.translate(px(cx), px(cy)); g.rotate(ang + Math.PI);
        const ini = (S.R + 1.2 + recuo) * K, L = 150 * K;
        const pedaco = (a, b, w0, w1, cor) => { g.fillStyle = cor; g.beginPath(); g.moveTo(ini + a * L, -w0 * K / 2); g.lineTo(ini + b * L, -w1 * K / 2); g.lineTo(ini + b * L, w1 * K / 2); g.lineTo(ini + a * L, w0 * K / 2); g.closePath(); g.fill(); };
        g.save(); g.translate(5, 7); g.globalAlpha = 0.25; pedaco(0, 1, 1.1, 2.4, '#000'); g.restore();
        const fuste = g.createLinearGradient(0, -1.2 * K, 0, 1.2 * K);
        fuste.addColorStop(0, '#f6dfb0'); fuste.addColorStop(0.5, '#e0bd82'); fuste.addColorStop(1, '#a8834f');
        pedaco(0, 0.008, 1.0, 1.0, '#3aa0ff');
        pedaco(0.008, 0.028, 1.0, 1.06, '#f4f1e6');
        pedaco(0.028, 0.6, 1.06, 1.7, fuste);
        pedaco(0.6, 0.62, 1.7, 1.75, '#141619');
        const cabo = g.createLinearGradient(0, -1.4 * K, 0, 1.4 * K);
        cabo.addColorStop(0, '#6a3a1c'); cabo.addColorStop(0.5, '#3f200d'); cabo.addColorStop(1, '#1f0f05');
        pedaco(0.62, 1, 1.75, 2.4, cabo);
        pedaco(0.7, 0.71, 1.8, 1.82, '#d6f24a'); pedaco(0.9, 0.91, 2.15, 2.17, '#d6f24a');
        g.restore();
      }
      function pintar() {
        if (!v) return;
        if (!fundo || fundoModo !== (v.modo === '9' ? 9 : 8)) pintarFundo();
        g.drawImage(fundo, 0, 0);
        const bs = bolasMostradas(), branca = bs.find((b) => b.id === 0 && !b.fora), vez = minhaVez(), agora = performance.now();
        // Caçapa da 8: marcada (anel limão) e sugerida pela mira.
        if (vez && v.precisa8) {
          S.CACAPAS.forEach(function ([cx, cy, pr], k) {
            const marcada = k === cacapaEscolhida, sug = cacapaEscolhida == null && k === sugestao;
            g.strokeStyle = marcada ? '#d6f24a' : sug ? 'rgba(214,242,74,.6)' : 'rgba(255,255,255,' + (0.18 + 0.12 * Math.sin(agora / 250)) + ')';
            g.lineWidth = marcada ? 5 : 3; g.beginPath(); g.arc(px(cx), px(cy), (pr + 2.4) * K, 0, Math.PI * 2); g.stroke();
            if (marcada || sug) { g.fillStyle = marcada ? '#d6f24a' : 'rgba(214,242,74,.7)'; g.font = '900 ' + (3.2 * K) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', px(cx), px(cy)); }
          });
        }
        // Mira: linha até a bola fantasma, caminho da bola acertada e desvio da branca.
        if (vez && branca && !colocando) {
          const r = guia(bs, branca.x, branca.y, mira);
          g.lineWidth = 2.2; g.strokeStyle = 'rgba(255,255,255,.9)';
          g.beginPath(); g.moveTo(px(branca.x), px(branca.y)); g.lineTo(px(r.gx), px(r.gy)); g.stroke();
          const ok = !r.bola || legal(r.bola.id);
          g.strokeStyle = ok ? '#fff' : '#ff5a5a'; g.beginPath(); g.arc(px(r.gx), px(r.gy), S.R * K, 0, Math.PI * 2); g.stroke();
          if (r.bola && ok) {
            const cos = Math.max(0, r.dx * r.ox + r.dy * r.oy), tx = r.dx - cos * r.ox, ty = r.dy - cos * r.oy, tl = Math.hypot(tx, ty) || 1;
            g.strokeStyle = 'rgba(255,255,255,.85)';
            g.beginPath(); g.moveTo(px(r.bola.x), px(r.bola.y)); g.lineTo(px(r.bola.x + r.ox * 34 * cos), px(r.bola.y + r.oy * 34 * cos)); g.stroke();
            g.strokeStyle = 'rgba(255,255,255,.45)';
            g.beginPath(); g.moveTo(px(r.gx), px(r.gy)); g.lineTo(px(r.gx + tx / tl * 22 * (1 - cos)), px(r.gy + ty / tl * 22 * (1 - cos))); g.stroke();
            if (v.precisa8 && r.bola.id === 8) {
              let melhor = null;
              S.CACAPAS.forEach(function ([cx, cy], k) { const ax = cx - r.bola.x, ay = cy - r.bola.y, ao = ax * r.ox + ay * r.oy; if (ao <= 0) return; const fora = Math.abs(ax * r.oy - ay * r.ox); if (!melhor || fora < melhor[0]) melhor = [fora, k]; });
              sugestao = melhor ? melhor[1] : null;
            } else sugestao = null;
          } else if (r.bola) {
            g.beginPath(); const q = S.R * K * 0.55;
            g.moveTo(px(r.gx) - q, px(r.gy) - q); g.lineTo(px(r.gx) + q, px(r.gy) + q); g.moveTo(px(r.gx) + q, px(r.gy) - q); g.lineTo(px(r.gx) - q, px(r.gy) + q); g.stroke();
            sugestao = null;
          } else {
            const ref = r.dx * r.nx + r.dy * r.ny, rx = r.dx - 2 * ref * r.nx, ry = r.dy - 2 * ref * r.ny;
            g.strokeStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(px(r.gx), px(r.gy)); g.lineTo(px(r.gx + rx * 22), px(r.gy + ry * 22)); g.stroke();
            sugestao = null;
          }
        }
        // Sombras e bolas.
        for (const b of bs) {
          if (b.fora) continue;
          const sx = px(b.x + S.R * 0.3), sy = px(b.y + S.R * 0.45), sr = S.R * K * 1.1;
          const sombra = g.createRadialGradient(sx, sy, 1, sx, sy, sr);
          sombra.addColorStop(0, 'rgba(0,0,0,.42)'); sombra.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = sombra; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
        }
        for (const b of bs) {
          if (b.fora) continue;
          const s = sprite(b.id);
          if (b.id === 0 && vez && colocando) g.globalAlpha = colocValida ? 0.8 : 0.4;
          g.drawImage(s, px(b.x) - s.width / 2, px(b.y) - s.height / 2);
          g.globalAlpha = 1;
          if (b.id === 0 && vez && colocando) { g.strokeStyle = colocValida ? '#d6f24a' : '#ff5a5a'; g.lineWidth = 2.5; g.beginPath(); g.arc(px(b.x), px(b.y), (S.R + 1.6) * K, 0, Math.PI * 2); g.stroke(); }
        }
        if (vez && branca && !colocando) pintarTaco(branca.x, branca.y, mira, 2 + forca * 26);
        sujo = false;
      }
      // ---------- laço de desenho ----------
      function quadro(agora) {
        if (!raizEl.isConnected) { rodando = false; return; }
        if (animacao) avancar(agora);
        if (animacao || sujo || (minhaVez() && v.precisa8)) pintar();
        requestAnimationFrame(quadro);
      }
      function ligar() { sujo = true; if (!rodando) { rodando = true; requestAnimationFrame(quadro); } }
      // ---------- animação das tacadas (a mesma simulação de quem abriu a mesa, quadro a quadro) ----------
      function animar(tiro) {
        const r = S.simular(tiro.antes, tiro.angulo, tiro.forca, 4, tiro.giro, tiro.abertura);
        animacao = { quadros: r.quadros, t0: performance.now(), visto: -1 };
        bolas = tiro.antes;
        api.som('taco', tiro.forca);
        ligar();
      }
      function avancar(agora) {
        const a = animacao, n = a.quadros.length;
        const i = Math.min(n - 1, Math.floor((agora - a.t0) / (1000 / 60)));
        if (i - a.visto <= 12) for (let k = Math.max(0, a.visto + 1); k <= i; k++) tocarSons(a.quadros[k].s);
        a.visto = i;
        bolas = a.quadros[i].b;
        if (i >= n - 1) { animacao = null; bolas = v ? v.bolas : bolas; prepararVez(); textos(); }
      }
      function tocarSons(sons) {
        if (!sons || !sons.length) return;
        const forte = {};
        for (const [tipo, f] of sons) forte[tipo] = Math.max(forte[tipo] || 0, f);
        for (const tipo of Object.keys(forte)) api.som(tipo, Math.min(1, forte[tipo]));
      }
      // ---------- vez de jogar: bola na mão, caçapa, força ----------
      function prepararVez() {
        if (!minhaVez()) { colocando = false; brancaLocal = null; return; }
        const b = bolas.find((x) => x.id === 0);
        if (v.naMao && !brancaLocal) { brancaLocal = b ? [b.x, b.y] : [S.CABECA[0], S.CABECA[1]]; colocando = true; colocValida = S.lugarValido(v.bolas, brancaLocal[0], brancaLocal[1], v.naMao); }
        if (!v.naMao) { colocando = false; brancaLocal = null; }
        sujo = true;
      }
      function naMesa(ev) {
        const r = tela.getBoundingClientRect();
        return [(ev.clientX - r.left) / r.width * tela.width / K - BORDA, (ev.clientY - r.top) / r.height * tela.height / K - BORDA];
      }
      function brancaAtual() { const b = bolasMostradas().find((x) => x.id === 0 && !x.fora); return b || null; }
      function mostrarForca(f) {
        forca = Math.max(0, Math.min(1, f));
        enche.style.height = 'calc((100% - 12px) * ' + forca.toFixed(3) + ')';
        tacoIco.style.transform = 'translateY(' + (forca * 26) + '%)';
        forcaTxt.textContent = forca > 0.01 ? Math.round(forca * 100) + '%' : '';
        sujo = true;
      }
      function tacar() {
        const f = forca;
        mostrarForca(0);
        if (!minhaVez() || f < 0.03) return;
        const acao = { tipo: 'tacar', angulo: mira, forca: Math.min(1, f) };
        if (giro.topo || giro.lado) acao.giro = { topo: giro.topo, lado: giro.lado };
        if (v.naMao) {
          if (!brancaLocal || !S.lugarValido(v.bolas, brancaLocal[0], brancaLocal[1], v.naMao)) { dicaEl.textContent = 'Coloque a branca num lugar livre primeiro.'; return; }
          acao.branca = [brancaLocal[0], brancaLocal[1]];
        }
        if (v.precisa8) {
          const c = cacapaEscolhida != null ? cacapaEscolhida : sugestao;
          if (c == null) { dicaEl.textContent = 'Marque a caçapa da 8: clique nela.'; api.som('erro'); return; }
          acao.cacapa = c;
        }
        enviado = true;
        clearTimeout(soltarEnvio);
        soltarEnvio = setTimeout(() => { enviado = false; sujo = true; textos(); }, 4000);
        api.agir(acao);
        giro = { topo: 0, lado: 0 }; pintarEfeito();
        cacapaEscolhida = null;
        textos();
      }
      tela.addEventListener('pointermove', function (ev) {
        mouse = naMesa(ev);
        if (!minhaVez()) return;
        if (colocando) {
          brancaLocal = [Math.max(S.R, Math.min(S.W - S.R, mouse[0])), Math.max(S.R, Math.min(S.H - S.R, mouse[1]))];
          colocValida = S.lugarValido(v.bolas, brancaLocal[0], brancaLocal[1], v.naMao);
        } else if (puxando) {
          const d = (puxando[0] - mouse[0]) * Math.cos(mira) + (puxando[1] - mouse[1]) * Math.sin(mira);
          mostrarForca(d / 45);
        } else {
          const b = brancaAtual();
          if (b && Math.hypot(mouse[0] - b.x, mouse[1] - b.y) > 0.5) mira = Math.atan2(mouse[1] - b.y, mouse[0] - b.x);
        }
        tela.className = colocando ? 'mao' : '';
        sujo = true;
      });
      tela.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || !minhaVez()) return;
        const [x, y] = naMesa(ev);
        tela.focus();
        if (colocando) { if (colocValida) { colocando = false; tela.className = ''; textos(); } sujo = true; return; }
        const b = brancaAtual();
        if (v.naMao && b && Math.hypot(x - b.x, y - b.y) < S.R * 1.8) { colocando = true; tela.className = 'mao'; textos(); return; }
        if (v.precisa8) {
          const k = S.CACAPAS.findIndex(([cx, cy, pr]) => Math.hypot(x - cx, y - cy) < pr + 4);
          if (k >= 0) { cacapaEscolhida = k; sujo = true; textos(); return; }
        }
        puxando = [x, y];
        tela.setPointerCapture(ev.pointerId);
      });
      const soltar = function () { if (!puxando) return; puxando = null; tacar(); };
      tela.addEventListener('pointerup', soltar);
      tela.addEventListener('pointercancel', function () { puxando = null; mostrarForca(0); });
      tela.addEventListener('wheel', function (ev) { if (!minhaVez() || colocando) return; ev.preventDefault(); mira += Math.sign(ev.deltaY) * 0.004; sujo = true; }, { passive: false });
      tela.addEventListener('keydown', function (ev) {
        if (!minhaVez() || colocando) return;
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); mira += (ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 0.02 : 0.003); sujo = true; }
      });
      // Barra de força: arraste para baixo e solte.
      let naBarra = false;
      const forcaDaBarra = (ev) => { const r = barra.getBoundingClientRect(); return (ev.clientY - r.top - 6) / Math.max(1, r.height - 12); };
      barra.addEventListener('pointerdown', function (ev) { if (ev.button !== 0 || !minhaVez() || colocando) return; naBarra = true; barra.setPointerCapture(ev.pointerId); mostrarForca(forcaDaBarra(ev)); });
      barra.addEventListener('pointermove', function (ev) { if (naBarra) mostrarForca(forcaDaBarra(ev)); });
      barra.addEventListener('pointerup', function () { if (!naBarra) return; naBarra = false; tacar(); });
      barra.addEventListener('pointercancel', function () { naBarra = false; mostrarForca(0); });
      // Efeito: onde o taco bate na branca.
      function pintarEfeito() {
        ponto.style.left = (50 + giro.lado * 38) + '%'; ponto.style.top = (50 - giro.topo * 38) + '%';
        efeitoTxt.textContent = !giro.topo && !giro.lado ? 'Sem efeito' : [giro.topo > 0.2 ? 'Segue' : giro.topo < -0.2 ? 'Volta' : '', giro.lado > 0.2 ? 'direita' : giro.lado < -0.2 ? 'esquerda' : ''].filter(Boolean).join(' · ') || 'Leve';
      }
      let noEfeito = false;
      const efeitoDe = function (ev) {
        const r = efeito.getBoundingClientRect();
        let l = ((ev.clientX - r.left) / r.width - 0.5) / 0.38, t = -((ev.clientY - r.top) / r.height - 0.5) / 0.38;
        const m = Math.hypot(l, t); if (m > 1) { l /= m; t /= m; }
        giro = { topo: Math.round(t * 100) / 100, lado: Math.round(l * 100) / 100 }; pintarEfeito();
      };
      efeito.addEventListener('pointerdown', function (ev) { if (ev.button !== 0) return; noEfeito = true; efeito.setPointerCapture(ev.pointerId); efeitoDe(ev); });
      efeito.addEventListener('pointermove', function (ev) { if (noEfeito) efeitoDe(ev); });
      efeito.addEventListener('pointerup', function () { noEfeito = false; });
      efeito.addEventListener('dblclick', function () { giro = { topo: 0, lado: 0 }; pintarEfeito(); });
      // ---------- placar e textos ----------
      function textos() {
        if (!v) return;
        const painel = function (j, i) {
          const vez = j.nome === v.vez && !v.fim && !animacao;
          let mini = [];
          if (v.modo !== '9') mini = !j.grupo ? Array.from({ length: 7 }, () => el('i')) : (j.grupo === 'lisas' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).map(function (id) {
            const b = v.bolas.find((x) => x.id === id);
            return el('i', { class: (listrada(id) ? 'lst' : 'lis') + (b && b.fora ? ' foi' : ''), style: '--c:' + corDe(id), title: 'Bola ' + id });
          });
          const estado = v.modo === '9' ? (j.bot ? 'Bot' : 'Jogador') : j.grupo ? (j.grupo === 'lisas' ? 'Lisas' : 'Listradas') + (j.restam ? ' · faltam ' + j.restam : ' · vez da 8') : 'Mesa aberta';
          return el('div', { class: 'vl-sn-jog ' + (i ? 'dir' : 'esq') + (vez ? ' vez' : '') }, [api.cabeca(j.nome),
            el('div', { class: 'quem' }, [el('b', { texto: j.nome + (j.nome === api.eu ? ' (você)' : '') }), el('small', { texto: estado + (vez && v.naMao ? ' · ✋ bola na mão' : '') }), el('div', { class: 'vl-sn-mini', 'aria-hidden': 'true' }, mini)])]);
        };
        const centro = [el('span', { class: 'vl-sn-modo', texto: v.modo === '9' ? 'Bola 9' : 'Bola 8' })];
        if (v.modo === '9' && v.menor) centro.push(el('span', { class: 'vl-sn-proxima' }, ['Bola da vez', el('span', { class: 'vl-sn-mini' }, [el('i', { class: listrada(v.menor) ? 'lst' : 'lis', style: '--c:' + corDe(v.menor) })]), String(v.menor)]));
        else if (v.quebra) centro.push(el('span', { class: 'vl-sn-proxima', texto: 'Abertura' }));
        hud.replaceChildren(v.js[0] ? painel(v.js[0], 0) : el('span'), el('div', { class: 'vl-sn-centro' }, centro), v.js[1] ? painel(v.js[1], 1) : el('span'));
        msgEl.textContent = v.fim || animacao ? '' : v.msg || '';
        const vez = minhaVez();
        dicaEl.textContent = v.fim || animacao || !vez ? ''
          : colocando ? 'Bola na mão: clique na mesa para colocar a branca' + (v.naMao === 'cabeca' ? ' (antes da linha).' : '.')
            : v.precisa8 && cacapaEscolhida == null ? 'Vez da 8: clique na caçapa e tacada!' : 'Sua vez! Puxe o taco para trás e solte.';
        barra.classList.toggle('desligada', !vez || colocando);
        tela.className = !vez ? 'espera' : colocando ? 'mao' : '';
      }
      pintarEfeito();
      return {
        el: raizEl,
        atualizar(nova) {
          if (!nova || !Array.isArray(nova.bolas)) return;
          const antes = v;
          v = nova;
          if (v.tiro && v.tiro.id !== tiroVisto) {
            const primeira = tiroVisto == null && !antes;
            tiroVisto = v.tiro.id;
            enviado = false; clearTimeout(soltarEnvio);
            if (!primeira) { animar(v.tiro); textos(); return; }
          }
          if (!animacao) { bolas = v.bolas; prepararVez(); }
          if (minhaVez() && !(antes && antes.vez === api.eu)) { api.som('vez'); const b = bolas.find((x) => x.id === 0); if (b) mira = Math.atan2(S.H / 2 - b.y, S.W * 0.75 - b.x); }
          textos();
          ligar();
        },
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
