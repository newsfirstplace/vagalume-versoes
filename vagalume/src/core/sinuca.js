// Vagalume — Sinuca (bola 8, regras simplificadas; pedido do usuário em 2026-11-26). Puro: física 2D, regras, bot.
// Mesa 200 × 100. Bola branca (0), lisas 1–7, a 8 preta, listradas 9–15. A primeira bola encaçapada (sem falta)
// define o grupo de cada um. Continua jogando quem encaçapa bola do seu grupo sem falta. Falta: branca na
// caçapa ou não tocar primeiro numa bola do seu grupo (ou em nenhuma) — a vez passa e a branca volta ao lugar.
// Ganha quem encaçapar a 8 depois de limpar o seu grupo; encaçapar a 8 antes (ou com falta) perde.
// A tacada é simulada em passos fixos: as duas telas chegam ao mesmo resultado a partir da mesma tacada.
(function (raiz) {
  'use strict';
  const W = 200, H = 100, R = 2.6, DT = 1 / 240, ATRITO = 28, VMAX = 170, QUIQUE = 0.78;
  const CACAPAS = [[0, 0, 5.2], [W / 2, -1.5, 4.6], [W, 0, 5.2], [0, H, 5.2], [W / 2, H + 1.5, 4.6], [W, H, 5.2]];
  const grupoDe = (id) => (id >= 1 && id <= 7 ? 'lisas' : id >= 9 ? 'listradas' : null);
  const CABECA = [50, 50];

  function arrumar() {
    const ordem = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    const bolas = [{ id: 0, x: CABECA[0], y: CABECA[1], fora: false }];
    let k = 0;
    for (let col = 0; col < 5; col++) for (let lin = 0; lin <= col; lin++) {
      bolas.push({ id: ordem[k++], x: 140 + col * R * 2 * 0.88, y: H / 2 + (lin - col / 2) * R * 2.02, fora: false });
    }
    return bolas;
  }
  function nova(jogadores) {
    return { bolas: arrumar(), js: jogadores.slice(0, 2).map((p) => ({ nome: p.nome, bot: p.bot || null, grupo: null })), vez: 0, tiro: null, num: 0, fim: null, msg: 'Abertura!', desde: Date.now(), duracao: 0 };
  }

  // Simula a tacada: devolve as bolas no fim, a primeira tocada, as encaçapadas e quantos passos levou.
  // Com "cada", guarda as posições a cada tantos passos (para animar a tacada na tela).
  function simular(bolasAntes, angulo, forca, cada) {
    const b = bolasAntes.map((x) => ({ id: x.id, x: x.x, y: x.y, vx: 0, vy: 0, fora: x.fora }));
    const branca = b.find((x) => x.id === 0);
    const v = Math.max(0.05, Math.min(1, forca)) * VMAX;
    branca.vx = Math.cos(angulo) * v; branca.vy = Math.sin(angulo) * v;
    let primeira = null, passos = 0;
    const caidas = [], quadros = [];
    const vivas = () => b.filter((x) => !x.fora);
    while (passos < 240 * 25) {
      passos++;
      let andando = false;
      for (const x of vivas()) {
        const s = Math.hypot(x.vx, x.vy);
        if (s < 0.6) { x.vx = 0; x.vy = 0; continue; }
        andando = true;
        const ns = Math.max(0, s - ATRITO * DT);
        x.vx *= ns / s; x.vy *= ns / s;
        x.x += x.vx * DT; x.y += x.vy * DT;
        for (const [px, py, pr] of CACAPAS) if (Math.hypot(x.x - px, x.y - py) < pr) { x.fora = true; x.vx = 0; x.vy = 0; caidas.push(x.id); break; }
        if (x.fora) continue;
        // Tabelas (menos na boca das caçapas).
        const boca = (p, q) => CACAPAS.some(([px, py, pr]) => Math.hypot(p - px, q - py) < pr + 2.2);
        if (x.x < R && !boca(x.x, x.y)) { x.x = R; x.vx = Math.abs(x.vx) * QUIQUE; }
        if (x.x > W - R && !boca(x.x, x.y)) { x.x = W - R; x.vx = -Math.abs(x.vx) * QUIQUE; }
        if (x.y < R && !boca(x.x, x.y)) { x.y = R; x.vy = Math.abs(x.vy) * QUIQUE; }
        if (x.y > H - R && !boca(x.x, x.y)) { x.y = H - R; x.vy = -Math.abs(x.vy) * QUIQUE; }
      }
      // Choques entre bolas (massas iguais).
      const v2 = vivas();
      for (let i = 0; i < v2.length; i++) for (let j = i + 1; j < v2.length; j++) {
        const p = v2[i], q = v2[j];
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d >= 2 * R || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        const rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
        const sobra = (2 * R - d) / 2;
        p.x -= nx * sobra; p.y -= ny * sobra; q.x += nx * sobra; q.y += ny * sobra;
        if (rel <= 0) continue;
        const imp = rel * 0.97;
        p.vx -= imp * nx; p.vy -= imp * ny; q.vx += imp * nx; q.vy += imp * ny;
        if (primeira == null && (p.id === 0 || q.id === 0)) primeira = p.id === 0 ? q.id : p.id;
        andando = true;
      }
      if (cada && passos % cada === 0) quadros.push(b.map((x) => ({ id: x.id, x: x.x, y: x.y, fora: x.fora })));
      if (!andando) break;
    }
    return { bolas: b.map((x) => ({ id: x.id, x: x.x, y: x.y, fora: x.fora })), primeira, caidas, passos, quadros };
  }

  const restam = (e, grupo) => e.bolas.filter((x) => !x.fora && grupoDe(x.id) === grupo).length;
  // Ação: { tipo: 'tacar', angulo, forca }.
  function aplicar(e, nome, a) {
    const j = e.js[e.vez];
    if (e.fim || !a || !j || j.nome !== nome || a.tipo !== 'tacar') return false;
    const angulo = Number(a.angulo), forca = Number(a.forca);
    if (!Number.isFinite(angulo) || !Number.isFinite(forca) || forca <= 0 || forca > 1) return false;
    if (Date.now() - e.desde < e.duracao) return false; // a tacada anterior ainda está rolando na tela
    const antes = e.bolas;
    const r = simular(antes, angulo, forca);
    e.num++;
    e.tiro = { id: e.num, angulo, forca, antes, quem: nome };
    e.bolas = r.bolas;
    e.desde = Date.now(); e.duracao = Math.round(r.passos / 240 * 1000) + 300;
    const outro = e.js[1 - e.vez];
    const limpou = j.grupo && restam({ bolas: antes }, j.grupo) === 0;
    const alvoCerto = r.primeira != null && (!j.grupo || grupoDe(r.primeira) === j.grupo || (limpou && r.primeira === 8));
    const brancaCaiu = r.caidas.includes(0);
    const falta = brancaCaiu || !alvoCerto;
    if (brancaCaiu) { const bb = e.bolas.find((x) => x.id === 0); bb.fora = false; bb.x = CABECA[0]; bb.y = CABECA[1]; empurrarDaCabeca(e.bolas); }
    if (r.caidas.includes(8)) {
      const venceu = limpou && !falta;
      e.fim = { vencedor: venceu ? j.nome : outro.nome, ordem: venceu ? [j.nome, outro.nome] : [outro.nome, j.nome], texto: venceu ? j.nome + ' encaçapou a 8 e venceu!' : j.nome + ' encaçapou a 8 ' + (falta ? 'com falta' : 'antes da hora') + ': ' + outro.nome + ' venceu!' };
      e.msg = '';
      return true;
    }
    const minhas = r.caidas.filter((id) => id !== 0 && (!j.grupo || grupoDe(id) === j.grupo));
    if (!j.grupo && !falta && minhas.length) { j.grupo = grupoDe(minhas[0]); outro.grupo = j.grupo === 'lisas' ? 'listradas' : 'lisas'; }
    if (falta) { e.msg = 'Falta de ' + j.nome + (brancaCaiu ? ': a branca caiu.' : r.primeira == null ? ': não tocou em nenhuma bola.' : ': tocou primeiro na bola errada.'); e.vez = 1 - e.vez; }
    else if (minhas.length) e.msg = j.nome + ' encaçapou ' + minhas.length + (minhas.length > 1 ? ' bolas' : ' bola') + ' e joga de novo.';
    else { e.msg = j.nome + ' não encaçapou.'; e.vez = 1 - e.vez; }
    return true;
  }
  function empurrarDaCabeca(bolas) {
    const bb = bolas.find((x) => x.id === 0);
    for (let k = 0; k < 40 && bolas.some((x) => x !== bb && !x.fora && Math.hypot(x.x - bb.x, x.y - bb.y) < 2 * R + 0.5); k++) bb.y += 2 * R + 0.6;
  }
  // Bot: procura bola do grupo que tenha caminho livre até a caçapa e mira o "fantasma" atrás dela.
  const NIVEIS = { facil: 0.09, medio: 0.04, dificil: 0.012 };
  function livre(bolas, ax, ay, bx, by, ignorar) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    return bolas.every((x) => x.fora || ignorar.includes(x.id) || (function () {
      const t = Math.max(0, Math.min(1, ((x.x - ax) * dx + (x.y - ay) * dy) / L2));
      return Math.hypot(ax + dx * t - x.x, ay + dy * t - x.y) >= 2 * R;
    })());
  }
  function jogadaDoBot(e, aleatorio) {
    const j = e.js[e.vez], rnd = aleatorio || Math.random;
    const branca = e.bolas.find((x) => x.id === 0);
    const limpou = j.grupo && restam(e, j.grupo) === 0;
    const alvos = e.bolas.filter((x) => !x.fora && x.id !== 0 && (limpou ? x.id === 8 : x.id !== 8 && (!j.grupo || grupoDe(x.id) === j.grupo)));
    let melhor = null;
    for (const b of alvos) for (const [px, py] of CACAPAS) {
      const d = Math.hypot(px - b.x, py - b.y) || 1;
      const gx = b.x - (px - b.x) / d * 2 * R, gy = b.y - (py - b.y) / d * 2 * R;
      const ang = Math.atan2(gy - branca.y, gx - branca.x);
      const corte = Math.abs(((Math.atan2(py - b.y, px - b.x) - ang + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (corte > 1.25) continue;
      if (!livre(e.bolas, branca.x, branca.y, gx, gy, [0, b.id]) || !livre(e.bolas, b.x, b.y, px, py, [b.id])) continue;
      const dist = Math.hypot(gx - branca.x, gy - branca.y) + d;
      const nota = dist + corte * 60;
      if (!melhor || nota < melhor.nota) melhor = { nota, ang, dist };
    }
    const erro = NIVEIS[j.bot] || NIVEIS.medio;
    if (!melhor) { // sem tacada limpa: bate na bola do grupo mais perto
      const b = alvos.sort((p, q) => Math.hypot(p.x - branca.x, p.y - branca.y) - Math.hypot(q.x - branca.x, q.y - branca.y))[0] || e.bolas.find((x) => !x.fora && x.id !== 0);
      return { tipo: 'tacar', angulo: Math.atan2(b.y - branca.y, b.x - branca.x) + (rnd() - 0.5) * erro, forca: 0.6 };
    }
    return { tipo: 'tacar', angulo: melhor.ang + (rnd() - 0.5) * erro * 2, forca: Math.min(0.95, 0.3 + melhor.dist / 260) };
  }
  function tick(e, agora) {
    const j = e.js[e.vez];
    if (e.fim || !j || !j.bot || (agora == null ? Date.now() : agora) - e.desde < e.duracao + 900) return false;
    return aplicar(e, j.nome, jogadaDoBot(e));
  }
  function sair(e, nome) { const o = e.js.find((j) => j.nome !== nome); if (!e.fim && o) e.fim = { vencedor: o.nome, ordem: [o.nome], texto: nome + ' saiu: ' + o.nome + ' venceu.' }; }
  function visao(e) {
    return { bolas: e.bolas, js: e.js.map((j) => ({ nome: j.nome, bot: !!j.bot, grupo: j.grupo, restam: j.grupo ? restam(e, j.grupo) : 7 })), vez: e.js[e.vez] ? e.js[e.vez].nome : null,
      tiro: e.tiro, msg: e.msg, fim: !!e.fim, espera: Math.max(0, e.duracao - (Date.now() - e.desde)) };
  }
  const api = { W, H, R, CACAPAS, grupoDe, nova, simular, aplicar, jogadaDoBot, tick, sair, visao, restam };
  raiz.VL = raiz.VL || {};
  raiz.VL.sinuca = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
