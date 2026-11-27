// Vagalume — Sinuca (pedido do usuário em 2026-11-26; refeita em 2026-11-27 no jeito dos jogos de bola 8 online).
// Puro: física 2D, regras de bola 8 e de bola 9, bot.
// Mesa 200 × 100. Bola branca (0), lisas 1–7, a 8 preta, listradas 9–15 (na bola 9 só vão de 1 a 9).
// Bola 8: a mesa fica aberta até a primeira bola encaçapada depois da abertura, que define o grupo de cada um.
//   Continua jogando quem encaçapa bola do seu grupo sem falta. Falta (a outra pessoa fica com a bola na mão,
//   em qualquer lugar): branca na caçapa, não tocar em nada, tocar primeiro em bola errada, ou nenhuma bola
//   bater na tabela depois do toque. Para vencer, limpe o seu grupo, marque a caçapa e encaçape a 8 nela.
//   A 8 antes da hora, com falta ou em outra caçapa perde. A 8 na abertura volta para a mesa.
// Bola 9: toque primeiro na bola de menor número; qualquer bola que cair sem falta continua a vez; quem
//   encaçapar a 9 sem falta vence (até na abertura). A 9 com falta volta para a mesa.
// A tacada é simulada em passos fixos: as telas chegam ao mesmo resultado a partir da mesma tacada.
(function (raiz) {
  'use strict';
  const W = 200, H = 100, R = 2.6, DT = 1 / 240, ATRITO = 26, VMAX = 190, VMAX_ABERTURA = 300, QUIQUE = 0.76;
  const CACAPAS = [[0, 0, 5.4], [W / 2, -1.4, 4.7], [W, 0, 5.4], [0, H, 5.4], [W / 2, H + 1.4, 4.7], [W, H, 5.4]];
  const CABECA = [W * 0.25, H / 2], PE = [W * 0.75, H / 2], LINHA_CABECA = W * 0.25;
  // Tabelas: seis segmentos entre as caçapas (as pontas são as quinas, arredondadas). [x1, y1, x2, y2, normal x, normal y]
  const BOCA_CANTO = 5.4, BOCA_MEIO = 4.4;
  const TABELAS = [[BOCA_CANTO, 0, W / 2 - BOCA_MEIO, 0, 0, 1], [W / 2 + BOCA_MEIO, 0, W - BOCA_CANTO, 0, 0, 1], [BOCA_CANTO, H, W / 2 - BOCA_MEIO, H, 0, -1],
    [W / 2 + BOCA_MEIO, H, W - BOCA_CANTO, H, 0, -1], [0, BOCA_CANTO, 0, H - BOCA_CANTO, 1, 0], [W, BOCA_CANTO, W, H - BOCA_CANTO, -1, 0]];
  const grupoDe = (id) => (id >= 1 && id <= 7 ? 'lisas' : id >= 9 && id <= 15 ? 'listradas' : null);
  const lim = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
  const copia = (bolas) => bolas.map((x) => ({ id: x.id, x: x.x, y: x.y, fora: !!x.fora }));

  function triangulo(linhas, idDe) {
    const bolas = [{ id: 0, x: CABECA[0], y: CABECA[1], fora: false }];
    linhas.forEach(function (qtd, col) {
      for (let lin = 0; lin < qtd; lin++) bolas.push({ id: idDe(col, lin), x: PE[0] + col * R * 2 * 0.87, y: PE[1] + (lin - (qtd - 1) / 2) * R * 2.02, fora: false });
    });
    return bolas;
  }
  // Bola 8: triângulo com a 8 no meio e uma lisa e uma listrada nos cantos de trás.
  function arrumar8() {
    const ordem = [[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [7, 13, 6, 14, 15]];
    return triangulo([1, 2, 3, 4, 5], (col, lin) => ordem[col][lin]);
  }
  // Bola 9: losango com a 1 na frente, a 9 no meio e as outras sorteadas.
  function arrumar9(aleatorio) {
    const rnd = aleatorio || Math.random, meio = [2, 3, 4, 5, 6, 7, 8];
    for (let i = meio.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [meio[i], meio[k]] = [meio[k], meio[i]]; }
    let m = 0;
    return triangulo([1, 2, 3, 2, 1], (col, lin) => (col === 0 ? 1 : col === 2 && lin === 1 ? 9 : meio[m++]));
  }
  function nova(jogadores, opcoes, aleatorio) {
    const modo = opcoes && String(opcoes.modo) === '9' ? '9' : '8';
    const js = jogadores.slice(0, 2).map((p) => ({ nome: p.nome, bot: p.bot || null, grupo: null }));
    return { modo, bolas: modo === '9' ? arrumar9(aleatorio) : arrumar8(), js, vez: 0, tiro: null, num: 0, fim: null, quebra: true, naMao: 'cabeca',
      msg: 'Abertura de ' + (js[0] ? js[0].nome : '') + '.', desde: Date.now(), duracao: 0 };
  }

  // Simula a tacada: as bolas no fim, a primeira tocada pela branca, as encaçapadas (e em qual caçapa), se alguma
  // bola bateu na tabela depois do toque e quantos passos levou. Com "cada", guarda os quadros e os sons.
  // giro = { topo, lado } entre -1 e 1: topo puxa a branca para a frente (ou para trás) depois do primeiro toque;
  // lado muda o ângulo da branca quando ela bate na tabela. Na abertura a tacada pode ser mais forte.
  function simular(bolasAntes, angulo, forca, cada, giro, abertura) {
    const b = bolasAntes.map((x) => ({ id: x.id, x: x.x, y: x.y, vx: 0, vy: 0, fora: !!x.fora }));
    const branca = b.find((x) => x.id === 0);
    const v0 = Math.max(0.03, Math.min(1, forca)) * (abertura ? VMAX_ABERTURA : VMAX);
    branca.vx = Math.cos(angulo) * v0; branca.vy = Math.sin(angulo) * v0;
    let topo = giro ? lim(giro.topo) : 0, lado = giro ? lim(giro.lado) : 0;
    let primeira = null, trilho = false, passos = 0, sons = [];
    const caidas = [], bolsos = {}, quadros = [];
    while (passos < 240 * 30) {
      passos++;
      let andando = false;
      for (const x of b) {
        if (x.fora) continue;
        const s = Math.hypot(x.vx, x.vy);
        if (s < 0.6) { x.vx = 0; x.vy = 0; continue; }
        andando = true;
        const ns = Math.max(0, s - ATRITO * DT);
        x.vx *= ns / s; x.vy *= ns / s;
        x.x += x.vx * DT; x.y += x.vy * DT;
        // Caçapa: dentro do círculo dela, ou já do lado de fora da linha da tabela (só dá para passar pela boca).
        let caiu = -1;
        for (let k = 0; k < 6; k++) { const [px, py, pr] = CACAPAS[k]; if (Math.hypot(x.x - px, x.y - py) < pr) { caiu = k; break; } }
        if (caiu < 0 && (x.x < -0.8 || x.x > W + 0.8 || x.y < -0.8 || x.y > H + 0.8)) caiu = CACAPAS.map(([px, py], k) => [Math.hypot(x.x - px, x.y - py), k]).sort((p, q) => p[0] - q[0])[0][1];
        if (caiu >= 0) { x.fora = true; x.vx = 0; x.vy = 0; caidas.push(x.id); bolsos[x.id] = caiu; sons.push(['cacapa', 1]); continue; }
        // Tabelas. O efeito lateral desvia a branca quando ela bate.
        let bateu = 0;
        for (const [x1, y1, x2, y2, nx0, ny0] of TABELAS) {
          const sx = x2 - x1, sy = y2 - y1, t = Math.max(0, Math.min(1, ((x.x - x1) * sx + (x.y - y1) * sy) / (sx * sx + sy * sy)));
          const qx = x1 + sx * t, qy = y1 + sy * t, dd = Math.hypot(x.x - qx, x.y - qy);
          if (dd >= R) continue;
          const nx = dd > 1e-6 ? (x.x - qx) / dd : nx0, ny = dd > 1e-6 ? (x.y - qy) / dd : ny0;
          x.x = qx + nx * R; x.y = qy + ny * R;
          const vn = x.vx * nx + x.vy * ny;
          if (vn >= 0) continue;
          const ex = -x.vy, ey = x.vx, es = Math.hypot(ex, ey) || 1; // lado direito de quem vai na direção da bola
          x.vx -= (1 + QUIQUE) * vn * nx; x.vy -= (1 + QUIQUE) * vn * ny;
          if (x.id === 0 && lado) { const tx = -ny, ty = nx, k = lado * 0.35 * -vn * (ex * tx + ey * ty) / es; x.vx += tx * k; x.vy += ty * k; }
          bateu = Math.max(bateu, -vn);
        }
        if (bateu) { if (primeira != null) trilho = true; if (x.id === 0) lado *= 0.5; sons.push(['tabela', bateu / 140]); }
      }
      // Choques entre bolas (massas iguais).
      for (let i = 0; i < b.length; i++) {
        const p = b[i];
        if (p.fora) continue;
        for (let k = i + 1; k < b.length; k++) {
          const q = b[k];
          if (q.fora) continue;
          const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
          if (d >= 2 * R || d === 0) continue;
          const nx = dx / d, ny = dy / d;
          const rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
          const sobra = (2 * R - d) / 2;
          p.x -= nx * sobra; p.y -= ny * sobra; q.x += nx * sobra; q.y += ny * sobra;
          if (rel <= 0) continue;
          const c = p.id === 0 ? p : q.id === 0 ? q : null;
          const sc = c ? Math.hypot(c.vx, c.vy) : 0, dxc = c && sc ? c.vx / sc : 0, dyc = c && sc ? c.vy / sc : 0;
          const imp = rel * 0.97;
          p.vx -= imp * nx; p.vy -= imp * ny; q.vx += imp * nx; q.vy += imp * ny;
          if (primeira == null && c) {
            primeira = c === p ? q.id : p.id;
            if (topo) { c.vx += dxc * topo * sc * 0.55; c.vy += dyc * topo * sc * 0.55; topo = 0; } // segue ou volta
          }
          sons.push(['bola', rel / 110]);
          andando = true;
        }
      }
      if (cada && passos % cada === 0) { quadros.push({ b: b.map((x) => ({ id: x.id, x: x.x, y: x.y, fora: x.fora })), s: sons.slice(0, 3) }); sons = []; }
      else if (!cada) sons.length = 0;
      if (!andando) break;
    }
    if (cada) quadros.push({ b: b.map((x) => ({ id: x.id, x: x.x, y: x.y, fora: x.fora })), s: sons.slice(0, 3) });
    return { bolas: b.map((x) => ({ id: x.id, x: x.x, y: x.y, fora: x.fora })), primeira, caidas, bolsos, trilho, passos, quadros };
  }

  const restam = (bolas, grupo) => bolas.filter((x) => !x.fora && grupoDe(x.id) === grupo).length;
  const menorNaMesa = (bolas) => Math.min(...bolas.filter((x) => !x.fora && x.id !== 0).map((x) => x.id));
  // Lugar onde a branca pode ficar (bola na mão): dentro da mesa, longe das caçapas, sem encostar em outra bola.
  function lugarValido(outras, x, y, zona) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < R || x > W - R || y < R || y > H - R) return false;
    if (zona === 'cabeca' && x > LINHA_CABECA) return false;
    if (CACAPAS.some(([px, py, pr]) => Math.hypot(x - px, y - py) < pr + R)) return false;
    return outras.every((o) => o.fora || o.id === 0 || Math.hypot(o.x - x, o.y - y) >= 2 * R + 0.05);
  }
  function lugarLivre(bolas, x0, y0, zona) {
    for (let k = 0; k < 200; k++) {
      const ang = k * 2.4, d = k * 0.9, x = x0 + Math.cos(ang) * d, y = y0 + Math.sin(ang) * d;
      if (lugarValido(bolas, x, y, zona)) return [x, y];
    }
    return [x0, y0];
  }
  // Bola que volta para a mesa: no ponto do pé (ou no lugar livre mais perto dele, na mesma linha).
  function recolocar(bolas, id) {
    const b = bolas.find((x) => x.id === id);
    if (!b) return;
    b.fora = false;
    const outras = bolas.filter((x) => x !== b);
    for (let k = 0; k < 60; k++) {
      const x = PE[0] + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (2 * R + 0.2);
      if (x >= R && x <= W - R && outras.every((o) => o.fora || Math.hypot(o.x - x, o.y - PE[1]) >= 2 * R + 0.05)) { b.x = x; b.y = PE[1]; return; }
    }
  }
  const listaBolas = (ids) => (ids.length === 1 ? 'a ' + ids[0] : 'a ' + ids.slice(0, -1).join(', a ') + ' e a ' + ids[ids.length - 1]);

  // Ação: { tipo: 'tacar', angulo, forca (0 a 1], giro?: { topo, lado }, branca?: [x, y] (com a bola na mão),
  //         cacapa?: 0 a 5 (a caçapa marcada para a 8) }.
  function aplicar(e, nome, a) {
    const j = e.js[e.vez];
    if (e.fim || !a || !j || j.nome !== nome || a.tipo !== 'tacar') return false;
    const angulo = Number(a.angulo), forca = Number(a.forca);
    if (!Number.isFinite(angulo) || !Number.isFinite(forca) || forca <= 0 || forca > 1) return false;
    if (Date.now() - e.desde < e.duracao) return false; // a tacada anterior ainda está rolando na tela
    let giro = null;
    if (a.giro && typeof a.giro === 'object') {
      const t = lim(a.giro.topo), l = lim(a.giro.lado), m = Math.hypot(t, l);
      giro = m > 1 ? { topo: t / m, lado: l / m } : { topo: t, lado: l };
    }
    const antes = copia(e.bolas);
    const branca = antes.find((x) => x.id === 0);
    if (e.naMao && Array.isArray(a.branca)) {
      const bx = Number(a.branca[0]), by = Number(a.branca[1]);
      if (!lugarValido(antes, bx, by, e.naMao)) return false;
      branca.x = bx; branca.y = by; branca.fora = false;
    }
    const precisa8 = e.modo === '8' && !!j.grupo && restam(antes, j.grupo) === 0;
    const cacapa = Number.isInteger(Number(a.cacapa)) && Number(a.cacapa) >= 0 && Number(a.cacapa) < 6 ? Number(a.cacapa) : null;
    if (precisa8 && cacapa == null) return false; // na vez da 8, marque a caçapa
    const r = simular(antes, angulo, forca, 0, giro, e.quebra);
    e.num++;
    e.tiro = { id: e.num, angulo, forca, giro, antes, quem: nome, cacapa, abertura: e.quebra };
    e.bolas = r.bolas;
    e.desde = Date.now(); e.duracao = Math.round(r.passos / 240 * 1000) + 300;
    const outro = e.js[1 - e.vez];
    if (e.modo === '9') regras9(e, j, outro, r, antes); else regras8(e, j, outro, r, antes, cacapa, precisa8);
    return true;
  }
  function regras8(e, j, outro, r, antes, cacapa, precisa8) {
    const quebra = e.quebra;
    e.quebra = false;
    const brancaCaiu = r.caidas.includes(0), outras = r.caidas.filter((id) => id !== 0 && id !== 8);
    let falta = null;
    if (brancaCaiu) falta = 'a branca caiu';
    else if (r.primeira == null) falta = 'não tocou em nenhuma bola';
    else if (!quebra) {
      if (!j.grupo) { if (r.primeira === 8) falta = 'tocou primeiro na 8'; }
      else if (precisa8) { if (r.primeira !== 8) falta = 'precisava tocar primeiro na 8'; }
      else if (grupoDe(r.primeira) !== j.grupo) falta = 'tocou primeiro numa bola ' + (j.grupo === 'lisas' ? 'listrada' : 'lisa');
      if (!falta && !r.caidas.length && !r.trilho) falta = 'nenhuma bola bateu na tabela';
    }
    let extra = '';
    if (r.caidas.includes(8)) {
      if (quebra) { recolocar(e.bolas, 8); extra = ' A 8 caiu na abertura e voltou para a mesa.'; }
      else {
        const certa = cacapa != null && r.bolsos[8] === cacapa, venceu = precisa8 && !falta && certa;
        const como = venceu ? 'encaçapou a 8 na caçapa marcada' : !precisa8 ? 'encaçapou a 8 antes da hora' : falta ? 'encaçapou a 8 com falta (' + falta + ')' : 'encaçapou a 8 em outra caçapa';
        e.fim = { vencedor: venceu ? j.nome : outro.nome, ordem: venceu ? [j.nome, outro.nome] : [outro.nome, j.nome], texto: j.nome + ' ' + como + (venceu ? ' e venceu!' : ': ' + outro.nome + ' venceu!') };
        e.msg = ''; e.naMao = null;
        return;
      }
    }
    if (!j.grupo && !quebra && !falta && outras.length) {
      j.grupo = grupoDe(outras[0]); outro.grupo = j.grupo === 'lisas' ? 'listradas' : 'lisas';
      extra += ' ' + j.nome + ' fica com as ' + j.grupo + '.';
    }
    fecharVez(e, j, outro, r, falta, outras.filter((id) => quebra || !j.grupo || grupoDe(id) === j.grupo), quebra, extra);
  }
  function regras9(e, j, outro, r, antes) {
    const quebra = e.quebra;
    e.quebra = false;
    const menor = menorNaMesa(antes);
    let falta = null;
    if (r.caidas.includes(0)) falta = 'a branca caiu';
    else if (r.primeira == null) falta = 'não tocou em nenhuma bola';
    else if (r.primeira !== menor) falta = 'tocou primeiro na ' + r.primeira + ' (a da vez era a ' + menor + ')';
    else if (!quebra && !r.caidas.length && !r.trilho) falta = 'nenhuma bola bateu na tabela';
    let extra = '';
    if (r.caidas.includes(9)) {
      if (!falta) {
        e.fim = { vencedor: j.nome, ordem: [j.nome, outro.nome], texto: j.nome + ' encaçapou a 9' + (quebra ? ' na abertura' : '') + ' e venceu!' };
        e.msg = ''; e.naMao = null;
        return;
      }
      recolocar(e.bolas, 9);
      extra = ' A 9 voltou para a mesa.';
    }
    fecharVez(e, j, outro, r, falta, r.caidas.filter((id) => id !== 0 && id !== 9), quebra, extra);
  }
  function fecharVez(e, j, outro, r, falta, minhas, quebra, extra) {
    const brancaCaiu = r.caidas.includes(0);
    if (brancaCaiu) {
      const c = e.bolas.find((x) => x.id === 0), p = lugarLivre(e.bolas, CABECA[0], CABECA[1], null);
      c.fora = false; c.x = p[0]; c.y = p[1];
    }
    if (falta) {
      e.vez = 1 - e.vez;
      e.naMao = quebra && brancaCaiu && e.modo === '8' ? 'cabeca' : 'livre';
      e.msg = 'Falta de ' + j.nome + ': ' + falta + '. Bola na mão para ' + outro.nome + '.' + extra;
      return;
    }
    e.naMao = null;
    if (minhas.length) e.msg = j.nome + ' encaçapou ' + listaBolas(minhas) + ' e joga de novo.' + extra;
    else { e.msg = j.nome + (quebra ? ' abriu a mesa.' : ' não encaçapou.') + ' Vez de ' + outro.nome + '.' + extra; e.vez = 1 - e.vez; }
  }

  // ---------- bot ----------
  const NIVEIS = { facil: 0.05, medio: 0.018, dificil: 0.005 };
  function livre(bolas, ax, ay, bx, by, ignorar) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    return bolas.every((x) => x.fora || ignorar.includes(x.id) || (function () {
      const t = Math.max(0, Math.min(1, ((x.x - ax) * dx + (x.y - ay) * dy) / L2));
      return Math.hypot(ax + dx * t - x.x, ay + dy * t - x.y) >= 2 * R;
    })());
  }
  function alvosDe(e, j, bolas) {
    const vivas = bolas.filter((x) => !x.fora && x.id !== 0);
    if (e.modo === '9') { const m = menorNaMesa(bolas); return vivas.filter((x) => x.id === m); }
    if (!j.grupo) return vivas.filter((x) => x.id !== 8);
    if (restam(bolas, j.grupo) === 0) return vivas.filter((x) => x.id === 8);
    return vivas.filter((x) => grupoDe(x.id) === j.grupo);
  }
  // Melhor bola e caçapa para a branca em (cx, cy): caminho livre, corte pequeno, distância curta.
  function melhorTacada(bolas, cx, cy, alvos) {
    let melhor = null;
    for (const b of alvos) for (let k = 0; k < 6; k++) {
      const [px, py] = CACAPAS[k];
      const d = Math.hypot(px - b.x, py - b.y) || 1, ux = (px - b.x) / d, uy = (py - b.y) / d;
      if ((k === 1 || k === 4) && Math.abs(uy) < 0.5) continue; // caçapa do meio só de frente
      const gx = b.x - ux * 2 * R, gy = b.y - uy * 2 * R, dc = Math.hypot(gx - cx, gy - cy);
      if (dc < 0.5) continue;
      const corte = Math.acos(Math.max(-1, Math.min(1, ((gx - cx) * ux + (gy - cy) * uy) / dc)));
      if (corte > 1.2) continue;
      if (!livre(bolas, cx, cy, gx, gy, [0, b.id]) || !livre(bolas, b.x, b.y, px, py, [b.id])) continue;
      const nota = dc * 0.6 + d + corte * 70;
      if (!melhor || nota < melhor.nota) melhor = { nota, ang: Math.atan2(gy - cy, gx - cx), dc, d, cacapa: k };
    }
    return melhor;
  }
  function jogadaDoBot(e, aleatorio) {
    const j = e.js[e.vez], rnd = aleatorio || Math.random, erro = NIVEIS[j.bot] || NIVEIS.medio;
    const branca = e.bolas.find((x) => x.id === 0);
    let pos = [branca.x, branca.y];
    if (e.naMao && !lugarValido(e.bolas, pos[0], pos[1], e.naMao)) pos = lugarLivre(e.bolas, e.naMao === 'cabeca' ? CABECA[0] : pos[0], e.naMao === 'cabeca' ? CABECA[1] : pos[1], e.naMao);
    const comMao = (p, extra) => Object.assign(extra, e.naMao ? { branca: [p[0], p[1]] } : {});
    if (e.quebra) { // abertura: forte, na bola da frente
      const frente = e.bolas.filter((x) => !x.fora && x.id !== 0).sort((p, q) => p.x - q.x)[0];
      return comMao(pos, { tipo: 'tacar', angulo: Math.atan2(frente.y - pos[1], frente.x - pos[0]) + (rnd() - 0.5) * 0.01, forca: 1 });
    }
    const alvos = alvosDe(e, j, e.bolas);
    const candidatos = [pos];
    if (e.naMao) for (let x = 8; x <= W - 8; x += 9) for (let y = 8; y <= H - 8; y += 9) if (lugarValido(e.bolas, x, y, e.naMao)) candidatos.push([x, y]);
    let melhor = null;
    for (const c of candidatos) {
      const bs = e.bolas.map((x) => (x.id === 0 ? { id: 0, x: c[0], y: c[1], fora: false } : x));
      const t = melhorTacada(bs, c[0], c[1], alvos);
      if (t && (!melhor || t.nota < melhor.nota)) melhor = Object.assign(t, { pos: c });
    }
    if (melhor) return comMao(melhor.pos, { tipo: 'tacar', angulo: melhor.ang + (rnd() - 0.5) * 2 * erro, forca: Math.min(0.92, 0.28 + (melhor.dc + melhor.d) / 330), cacapa: melhor.cacapa });
    // Sem tacada limpa: bate firme na bola-alvo mais perto (para ela ir na tabela).
    const alvo = alvos.slice().sort((p, q) => Math.hypot(p.x - pos[0], p.y - pos[1]) - Math.hypot(q.x - pos[0], q.y - pos[1]))[0] || e.bolas.find((x) => !x.fora && x.id !== 0);
    const perto = CACAPAS.map(([px, py], k) => [Math.hypot(px - alvo.x, py - alvo.y), k]).sort((p, q) => p[0] - q[0])[0][1];
    return comMao(pos, { tipo: 'tacar', angulo: Math.atan2(alvo.y - pos[1], alvo.x - pos[0]) + (rnd() - 0.5) * erro, forca: 0.62, cacapa: perto });
  }
  function tick(e, agora) {
    const j = e.js[e.vez];
    if (e.fim || !j || !j.bot || (agora == null ? Date.now() : agora) - e.desde < e.duracao + 900) return false;
    if (aplicar(e, j.nome, jogadaDoBot(e))) return true;
    // Segurança: nunca deixa a mesa parada esperando o bot.
    const c = e.bolas.find((x) => x.id === 0), alvo = e.bolas.find((x) => !x.fora && x.id !== 0);
    return aplicar(e, j.nome, { tipo: 'tacar', angulo: Math.atan2(alvo.y - c.y, alvo.x - c.x), forca: 0.6, cacapa: 0 });
  }
  function sair(e, nome) { const o = e.js.find((j) => j.nome !== nome); if (!e.fim && o) e.fim = { vencedor: o.nome, ordem: [o.nome], texto: nome + ' saiu: ' + o.nome + ' venceu.' }; }
  function visao(e) {
    const j = e.js[e.vez];
    return {
      modo: e.modo, bolas: e.bolas, vez: j ? j.nome : null, tiro: e.tiro, msg: e.msg, fim: !!e.fim, espera: Math.max(0, e.duracao - (Date.now() - e.desde)),
      js: e.js.map((x) => ({ nome: x.nome, bot: !!x.bot, grupo: x.grupo, restam: x.grupo ? restam(e.bolas, x.grupo) : 7 })),
      naMao: e.naMao, quebra: e.quebra, precisa8: e.modo === '8' && !!(j && j.grupo) && restam(e.bolas, j.grupo) === 0, menor: e.modo === '9' ? menorNaMesa(e.bolas) : null,
    };
  }
  const api = { W, H, R, CACAPAS, CABECA, PE, LINHA_CABECA, grupoDe, nova, simular, aplicar, jogadaDoBot, tick, sair, visao, restam, lugarValido, menorNaMesa };
  raiz.VL = raiz.VL || {};
  raiz.VL.sinuca = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
