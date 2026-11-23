// Vagalume — regras e física do ping-pong em 3D (pedido do usuário em 2026-11-23). Puro, sem página: o mesmo código
// roda nas duas telas da partida e nos testes. Medidas em metros (mesa oficial 2,74 × 1,525, rede de 15,25 cm),
// gravidade de verdade. Coordenadas "da mesa": x de um lado ao outro (0 no meio), y ao longo da mesa ('w' joga na
// ponta y = 0 e 'b' na ponta y = 2,74) e z para cima (0 = tampo). Quem joga de 'b' vê tudo espelhado.
// Regras: depois de cada rebatida a bola precisa quicar uma vez do lado de quem recebe; quique do próprio lado, bola
// na rede ou fora da mesa é ponto do outro; quem recebe só rebate depois desse quique e perde se ela quicar duas vezes
// ou passar. Partida até 11, com 2 de vantagem; dois saques para cada um e, a partir de 10 a 10, um saque cada.
(function (raiz) {
  'use strict';
  const MESA = { largura: 1.525, comprimento: 2.74, rede: 0.1525 };
  const BOLA = { raio: 0.02, gravidade: 9.8, quique: 0.86, atrito: 0.985, maxima: 25 };
  const RAQUETE = { raio: 0.085, alcance: 0.19, altura: 0.17 };
  const PONTOS = 11;
  const MEIO = MESA.comprimento / 2;
  const G = BOLA.gravidade;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const outra = (c) => (c === 'w' ? 'b' : 'w');
  const ladoDe = (y) => (y < MEIO ? 'w' : 'b');
  const naMesa = (x, y) => Math.abs(x) <= MESA.largura / 2 && y >= 0 && y <= MESA.comprimento;
  // Linha de espera de cada raquete: um pouco atrás da ponta da mesa.
  const fundo = (lado) => (lado === 'w' ? -0.25 : MESA.comprimento + 0.25);

  function sacador(pontos, primeiro) {
    const total = pontos.w + pontos.b;
    const k = total >= 2 * (PONTOS - 1) ? total - (PONTOS - 1) : Math.floor(total / 2);
    return k % 2 === 0 ? primeiro : outra(primeiro);
  }
  function vencedor(pontos) {
    if (Math.max(pontos.w, pontos.b) >= PONTOS && Math.abs(pontos.w - pontos.b) >= 2) return pontos.w > pontos.b ? 'w' : 'b';
    return null;
  }

  // Um passo de física. Devolve a bola nova e o que aconteceu: quique (lado da mesa) ou rede.
  function passo(b, dt) {
    const n = { x: b.x + b.vx * dt, y: b.y + b.vy * dt, z: b.z + b.vz * dt - 0.5 * G * dt * dt, vx: b.vx, vy: b.vy, vz: b.vz - G * dt };
    let quique = null, rede = false;
    if ((b.y - MEIO) * (n.y - MEIO) < 0) {
      const f = (MEIO - b.y) / (n.y - b.y);
      const zr = b.z + (n.z - b.z) * f, xr = b.x + (n.x - b.x) * f;
      if (zr < MESA.rede + BOLA.raio && zr > -0.03 && Math.abs(xr) <= MESA.largura / 2 + 0.15) {
        rede = true;
        n.y = MEIO - Math.sign(b.vy) * (BOLA.raio + 0.002);
        n.vy = -b.vy * 0.12; n.vx *= 0.3;
      }
    }
    if (n.z <= BOLA.raio && n.vz < 0 && b.z >= BOLA.raio - 0.03 && naMesa(n.x, n.y)) {
      n.z = BOLA.raio; n.vz = -n.vz * BOLA.quique; n.vx *= BOLA.atrito; n.vy *= BOLA.atrito;
      quique = ladoDe(n.y);
    }
    return { bola: n, quique, rede };
  }

  // Velocidade para a bola sair de pos e cair em alvo (no tampo) em T segundos; se o arco não passa a rede, sobe
  // (e aí cai um pouco mais longe, como de verdade).
  function golpe(pos, alvo, T) {
    const vx = (alvo.x - pos.x) / T, vy = (alvo.y - pos.y) / T;
    let vz = (BOLA.raio - pos.z + 0.5 * G * T * T) / T;
    const tn = (MEIO - pos.y) / vy;
    if (tn > 0 && tn < T) {
      const zn = pos.z + vz * tn - 0.5 * G * tn * tn;
      const minimo = MESA.rede + BOLA.raio + 0.03;
      if (zn < minimo) vz += (minimo - zn) / tn;
    }
    return { x: pos.x, y: pos.y, z: pos.z, vx, vy, vz };
  }
  // Rebatida de quem joga no `lado`: forca 0 a 1,25 (1 = quase no fim da mesa; acima disso tende a sair) e desvio
  // lateral em metros (bater com a ponta da raquete e puxar para o lado mandam a bola na diagonal).
  function rebater(bola, lado, forca, desvioX) {
    const dir = lado === 'w' ? 1 : -1;
    const f = clamp(forca, 0.12, 1.3);
    const alvo = { x: clamp(bola.x + desvioX, -1.3, 1.3), y: MEIO + dir * (0.3 + f * 1.05) };
    const T = 0.68 - 0.24 * Math.min(1, f); // arco de uns 30 a 50 cm acima da mesa; um pouco mais lenta para dar tempo
    return golpe({ x: bola.x, y: bola.y, z: Math.max(bola.z, BOLA.raio + 0.01) }, alvo, T);
  }
  // Bola parada na frente da raquete de quem saca.
  function posicaoDeSaque(lado, raqueteX) {
    return { x: clamp(raqueteX, -MESA.largura / 2 + 0.1, MESA.largura / 2 - 0.1), y: lado === 'w' ? -0.05 : MESA.comprimento + 0.05, z: 0.24, vx: 0, vy: 0, vz: 0 };
  }
  // A bola cruza a linha y (indo para ela)? Simula até lá. Devolve { x, z, t, quiques } ou null (rede, caiu ou demorou).
  function preverCruzamento(bola, y, maxT) {
    let b = bola, t = 0;
    const dt = 1 / 240, quiques = { w: 0, b: 0 };
    while (t < (maxT || 3)) {
      const r = passo(b, dt);
      t += dt;
      if (r.rede) return null;
      if (r.quique) quiques[r.quique]++;
      if ((b.y - y) * (r.bola.y - y) <= 0 && b.y !== r.bola.y) return { x: r.bola.x, z: r.bola.z, t, quiques };
      b = r.bola;
      if (b.z < -0.6) return null;
    }
    return null;
  }
  // Primeiro quique da bola (onde e quando), para o bot se posicionar.
  function preverQuique(bola, maxT) {
    let b = bola, t = 0;
    const dt = 1 / 240;
    while (t < (maxT || 3)) {
      const r = passo(b, dt);
      t += dt;
      if (r.rede) return null;
      if (r.quique) return { x: r.bola.x, y: r.bola.y, t, lado: r.quique };
      b = r.bola;
      if (b.z < -0.6) return null;
    }
    return null;
  }
  // Bot por nível: velocidade da raquete (m/s), tempo até reagir, erro de mira, chance de errar o golpe e força.
  const NIVEIS = {
    facil: { vel: 1.3, reacao: 0.35, erro: 0.12, falha: 0.2, forca: [0.3, 0.6], abre: 0.3 },
    medio: { vel: 2.0, reacao: 0.2, erro: 0.06, falha: 0.1, forca: [0.4, 0.8], abre: 0.45 },
    dificil: { vel: 3.2, reacao: 0.08, erro: 0.02, falha: 0.04, forca: [0.55, 0.95], abre: 0.6 },
  };
  // Bola recebida pela rede: só números possíveis.
  function bolaValida(b) {
    if (!b || ![b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite)) return null;
    if (Math.hypot(b.vx, b.vy, b.vz) > BOLA.maxima || Math.abs(b.x) > 3 || b.y < -2 || b.y > MESA.comprimento + 2 || b.z < -1 || b.z > 3) return null;
    return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz };
  }

  const api = { MESA, BOLA, RAQUETE, PONTOS, MEIO, NIVEIS, outra, ladoDe, naMesa, fundo, sacador, vencedor, passo, golpe, rebater, posicaoDeSaque, preverCruzamento, preverQuique, bolaValida };
  raiz.VL = raiz.VL || {};
  raiz.VL.pingpong = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
