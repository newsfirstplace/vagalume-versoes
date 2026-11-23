// Vagalume — tela do ping-pong em 3D (pedido do usuário em 2026-11-23, com um vídeo mostrando o estilo): mesa em
// perspectiva vista de trás de quem joga, bola em arco com sombra e marca do quique, a sua raquete grande na frente
// seguindo o mouse (para os lados e para a frente) e o adversário no fundo. Visual próprio: arena noturna com
// vagalumes, mesa azul e rede com faixa limão. Regras e física em core/pingpong.js.
// Contra o bot tudo roda aqui. Entre duas pessoas, quem recebe a bola decide o lance (rebatida, quique, rede, fora) e
// manda a rebatida ou o ponto ao outro (com confirmação, pelo módulo Jogos); a raquete de cada um vai para o outro
// várias vezes por segundo só para aparecer. Do lado de quem bateu, a bola espera na raquete do outro até a resposta.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada || !VL.pingpong) return;
  const P = VL.pingpong;
  const el = VL.camada.el;
  const { MESA, BOLA, RAQUETE, MEIO } = P;
  const L = MESA.comprimento, W2 = MESA.largura / 2;
  const PASSO = 1 / 240;
  const agora = () => performance.now() / 1000;
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sorteio = (a, b) => a + Math.random() * (b - a);
  // Vagalumes do fundo: posições fixas (fração da tela), cada um piscando no seu ritmo.
  // Por que o ponto aconteceu (aviso grande e linha de baixo).
  const MOTIVO = { fora: 'Fora!', rede: 'Na rede!', dois: 'Quicou duas vezes', passou: 'Passou!', proprio: 'Quicou do lado errado' };
  const LUZES = Array.from({ length: 28 }, (_, i) => ({ x: (i * 0.6180339 + 0.05) % 1, y: ((i * 0.381966 + 0.11) % 1) * 0.5, f: 0.7 + (i % 5) * 0.23, d: i * 1.7 }));

  function criar(o) {
    const eu = o.minhaCor, ele = P.outra(eu), bot = o.modo === 'bot';
    const nivel = P.NIVEIS[o.nivel] || P.NIVEIS.medio;
    // Vista: quem joga de 'b' vê a mesa girada, com a sua ponta sempre embaixo (a conta vale nos dois sentidos).
    const vista = (x, y) => (eu === 'b' ? { x: -x, y: L - y } : { x, y });
    const raqueteNova = (lado) => ({ x: 0, y: P.fundo(lado), py: P.fundo(lado), vx: 0, vy: 0, ax: 0, ay: P.fundo(lado) });
    const s = {
      pontos: { w: 0, b: 0 }, fase: 'contagem', ate: agora() + 2.4, saqueDesde: 0,
      bola: null, ultimo: null, quiques: { w: 0, b: 0 }, segura: false,
      raq: { w: raqueteNova('w'), b: raqueteNova('b') },
      rastro: [], marcas: [], efeitos: [], festa: [], aviso: null, venceu: null,
      botMira: null, botMiraEm: 0, botSaqueEm: 0, cam: 0, camera: null,
      teclas: new Set(), mouse: null, querSacar: false, enviadoEm: 0, enviado: null,
      mouseVista: null, empurrao: 0, lateral: 0, mira: null, miraQuique: null,
    };

    // ---------- elementos ----------
    const canvas = el('canvas', { class: 'vl-pp-canvas', 'aria-label': 'Mesa de ping-pong' });
    const pontosEu = el('b', { class: 'vl-pp-pontos', texto: '0' }), pontosEle = el('b', { class: 'vl-pp-pontos', texto: '0' });
    const saqueEu = el('span', { class: 'vl-pp-saque', title: 'Saque' }), saqueEle = el('span', { class: 'vl-pp-saque', title: 'Saque' });
    const estado = el('div', { class: 'vl-pp-estado', role: 'status', 'aria-live': 'polite' });
    const jogador = (cor, lado) => el('div', { class: 'vl-pp-jogador ' + lado }, lado === 'eu'
      ? [o.cabeca(cor), el('span', { class: 'nome', texto: o.nome(cor) }), saqueEu, pontosEu]
      : [pontosEle, saqueEle, el('span', { class: 'nome', texto: o.nome(cor) }), o.cabeca(cor)]);
    const raizEl = el('div', { class: 'vl-pp', tabindex: '0', 'data-foco': 'pingpong' }, [
      el('div', { class: 'vl-pp-placar' }, [jogador(eu, 'eu'), el('span', { class: 'vl-pp-meio', texto: 'até ' + P.PONTOS }), jogador(ele, 'ele')]),
      el('div', { class: 'vl-pp-mesa' }, [canvas]),
      estado,
      el('p', { class: 'vl-pp-dica', texto: 'Leve a raquete até a bola com o mouse (ou setas / WASD). Na hora da batida, empurre para a frente para bater mais forte (forte demais vai para fora) e puxe para o lado para dar efeito: a bola faz curva. Clique ou espaço para sacar.' }),
    ]);
    const g = canvas.getContext('2d');

    // ---------- controles ----------
    const dpr = () => Math.min(2, raiz.devicePixelRatio || 1);
    function guardarMouse(ev) {
      const r = canvas.getBoundingClientRect();
      s.mouse = { x: (ev.clientX - r.left) * dpr(), y: (ev.clientY - r.top) * dpr() };
      s.teclas.clear();
    }
    canvas.addEventListener('pointermove', guardarMouse);
    canvas.addEventListener('pointerdown', function (ev) { guardarMouse(ev); s.querSacar = true; raizEl.focus(); });
    const TECLAS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1], a: [-1, 0], d: [1, 0], w: [0, 1], s: [0, -1], A: [-1, 0], D: [1, 0], W: [0, 1], S: [0, -1] };
    raizEl.addEventListener('keydown', function (ev) {
      if (ev.key in TECLAS || ev.key === ' ') {
        ev.preventDefault();
        ev.stopPropagation(); // o jogo não abre o chat nem anda com o avatar
        if (ev.key === ' ') s.querSacar = true; else s.teclas.add(ev.key);
      }
    });
    raizEl.addEventListener('keyup', function (ev) { if (ev.key in TECLAS) { ev.stopPropagation(); s.teclas.delete(ev.key); } });
    raizEl.addEventListener('blur', function () { s.teclas.clear(); });

    // ---------- regras da partida ----------
    const sacadorAgora = () => P.sacador(s.pontos, o.primeiro || 'w');
    function avisar(texto, dur) { s.aviso = { texto, desde: agora(), ate: agora() + (dur || 1.1) }; }
    function bolaParaRede(b) { return { x: r4(b.x), y: r4(b.y), z: r4(b.z), vx: r4(b.vx), vy: r4(b.vy), vz: r4(b.vz), e: r4(b.e || 0) }; }
    function novaJogada(lado) { s.ultimo = lado; s.quiques = { w: 0, b: 0 }; s.botMira = null; s.segura = false; s.mira = null; s.miraQuique = null; }
    function sacar(lado) {
      const r = s.raq[lado];
      const pos = P.posicaoDeSaque(lado, r.x);
      let forca, desvio, efeito;
      if (lado === eu) { const ld = eu === 'b' ? -s.lateral : s.lateral; forca = 0.45 + 0.5 * (1 - Math.exp(-Math.max(0, s.empurrao) / 3.5)); desvio = clamp(ld * 0.03, -0.3, 0.3); efeito = clamp(ld * 0.35, -3, 3); }
      else { forca = sorteio(nivel.forca[0], nivel.forca[1]) * 0.85; desvio = sorteio(-0.35, 0.35); efeito = sorteio(-nivel.efeito, nivel.efeito) * 0.6; }
      s.bola = P.rebater(pos, lado, forca, desvio, efeito);
      novaJogada(lado);
      s.fase = 'jogo'; s.querSacar = false;
      o.som('saque');
      if (!bot && lado === eu) o.enviar(Object.assign({ t: 'pp:saque' }, bolaParaRede(s.bola)), true);
    }
    function rebaterAqui(lado) {
      const r = s.raq[lado];
      let forca, desvio, efeito = 0;
      if (lado === eu) {
        // Força pelo empurrão para a frente, numa curva suave: um empurrão normal manda a bola funda e segura; só um
        // empurrão muito forte passa do fim da mesa. A ponta da raquete abre o ângulo e puxar para o lado dá efeito.
        forca = 0.45 + 0.65 * (1 - Math.exp(-Math.max(0, s.empurrao) / 3.5));
        const lado = eu === 'b' ? -s.lateral : s.lateral;
        desvio = (s.bola.x - r.x) * 1.0 + lado * 0.03;
        efeito = clamp(lado * 0.45, -P.EFEITO_MAX, P.EFEITO_MAX);
      } else {
        forca = sorteio(nivel.forca[0], nivel.forca[1]);
        desvio = sorteio(-nivel.abre, nivel.abre) - s.bola.x;
        efeito = sorteio(-nivel.efeito, nivel.efeito);
        if (Math.random() < nivel.falha) {
          const tipo = Math.floor(Math.random() * 3);
          if (tipo === 0) forca = 1.3; else if (tipo === 1) desvio = (Math.random() < 0.5 ? -1 : 1) * 1.15 - s.bola.x;
          else { // bola baixa e reta na rede
            const dir = lado === 'w' ? 1 : -1;
            s.bola = { x: s.bola.x, y: s.bola.y, z: Math.max(0.05, Math.min(0.09, s.bola.z)), vx: 0, vy: dir * 5, vz: 0 };
            novaJogada(lado); anel(s.bola, false); o.som('bate');
            return;
          }
        }
      }
      s.bola = P.rebater(s.bola, lado, forca, desvio, efeito);
      novaJogada(lado);
      anel(s.bola, lado === eu);
      o.som('bate');
      if (!bot && lado === eu) o.enviar(Object.assign({ t: 'pp:bate' }, bolaParaRede(s.bola)), true);
    }
    function ponto(ganhou, placar, motivo) {
      if (placar) s.pontos = placar; else s.pontos[ganhou]++;
      s.fase = 'ponto'; s.ate = agora() + 1.4; s.segura = false;
      s.ultimoPonto = { ganhou, motivo: MOTIVO[motivo] ? motivo : null };
      o.som('ponto');
      const v = P.vencedor(s.pontos);
      if (v) { s.venceu = v; avisar(v === eu ? 'Você venceu!' : o.nome(v) + ' venceu!', 3); if (v === eu) festa(); }
      else if (s.pontos.w >= P.PONTOS - 1 && s.pontos.w === s.pontos.b) avisar('Empate! ' + s.pontos.w + ' a ' + s.pontos.b, 1.2);
      else avisar(MOTIVO[motivo] || (ganhou === eu ? 'Ponto seu!' : 'Ponto de ' + o.nome(ganhou)), 1.2);
      if (!bot && !placar) o.enviar({ t: 'pp:ponto', a: ganhou, pw: s.pontos.w, pb: s.pontos.b, m: motivo }, true);
    }
    function anel(b, meu) { s.efeitos.push({ x: b.x, y: b.y, z: b.z, desde: agora(), meu }); if (s.efeitos.length > 8) s.efeitos.shift(); }
    function marca(b) { s.marcas.push({ x: b.x, y: b.y, desde: agora() }); if (s.marcas.length > 6) s.marcas.shift(); }
    function festa() { for (let i = 0; i < 70; i++) s.festa.push({ x: 0.5, y: 0.45, vx: sorteio(-0.6, 0.6), vy: sorteio(-0.9, -0.1), desde: agora(), vida: sorteio(1.2, 2.4) }); }

    // Mensagens do outro jogador (já na ordem, sem repetidas).
    function receber(d) {
      if (!d || s.fase === 'fim') return;
      if (d.t === 'pp:raq') {
        if (Number.isFinite(d.x) && Number.isFinite(d.y)) { s.raq[ele].ax = clamp(d.x, -1.3, 1.3); s.raq[ele].ay = clamp(d.y, -1, L + 1); }
        return;
      }
      if (d.t === 'pp:saque' || d.t === 'pp:bate') {
        const b = P.bolaValida(d);
        if (!b) return;
        s.bola = b; novaJogada(ele); s.fase = 'jogo';
        if (d.t === 'pp:bate') { anel(b, false); o.som('bate'); } else o.som('saque');
        return;
      }
      if (d.t === 'pp:ponto' && (d.a === 'w' || d.a === 'b')) {
        const pw = Number(d.pw), pb = Number(d.pb);
        if (!Number.isInteger(pw) || !Number.isInteger(pb) || pw < 0 || pb < 0 || pw > 99 || pb > 99) return;
        ponto(d.a, { w: pw, b: pb }, String(d.m || ''));
      }
    }

    // ---------- simulação ----------
    // Onde o bot vai esperar a bola: um pouco atrás do quique, na linha em que ela vai passar.
    function planoDoBot() {
      const q = P.preverQuique(s.bola);
      if (!q || q.lado !== ele) return { x: 0, y: P.fundo(ele) };
      const y = ele === 'b' ? Math.min(P.fundo('b'), q.y + 0.6) : Math.max(P.fundo('w'), q.y - 0.6);
      const c = P.preverCruzamento(s.bola, y);
      return { x: (c ? c.x : q.x) + sorteio(-1, 1) * nivel.erro, y };
    }
    function moverRaquete(r, ax, ay, velMax, h) {
      r.py = r.y;
      const dx = ax - r.x, dy = ay - r.y, d = Math.hypot(dx, dy), passo = Math.min(d, velMax * h);
      const nx = d > 1e-9 ? r.x + (dx / d) * passo : r.x, ny = d > 1e-9 ? r.y + (dy / d) * passo : r.y;
      r.vx = (nx - r.x) / h; r.vy = (ny - r.y) / h; r.x = nx; r.y = ny;
    }
    function moverRaquetes(h, t) {
      const r = s.raq[eu];
      moverRaquete(r, r.ax, r.ay, 9, h);
      const o2 = s.raq[ele];
      if (bot) {
        const vindo = s.fase === 'jogo' && s.bola && s.ultimo === eu;
        if (vindo && s.botMira == null) { s.botMiraEm = t + nivel.reacao; s.botMira = planoDoBot(); }
        if (!vindo) s.botMira = null;
        let alvo = { x: 0, y: P.fundo(ele) };
        if (vindo && t >= s.botMiraEm) alvo = s.botMira;
        else if (vindo) alvo = { x: o2.x, y: o2.y };
        else if (s.fase === 'saque' && sacadorAgora() === ele) alvo = { x: o2.ax, y: P.fundo(ele) };
        moverRaquete(o2, alvo.x, alvo.y, vindo ? nivel.vel : nivel.vel * 0.6, h);
      } else {
        o2.py = o2.y;
        const k = Math.min(1, h * 14), nx = o2.x + (o2.ax - o2.x) * k, ny = o2.y + (o2.ay - o2.y) * k;
        o2.vx = (nx - o2.x) / h; o2.vy = (ny - o2.y) / h; o2.x = nx; o2.y = ny;
      }
    }
    function fisica(h) {
      const antes = s.bola;
      const r = P.passo(antes, h);
      s.bola = r.bola;
      const recebe = P.outra(s.ultimo);
      const juiz = bot || recebe === eu;
      if (r.quique) {
        s.quiques[r.quique]++;
        marca(r.bola);
        o.som('mesa');
        if (juiz) {
          if (r.quique === s.ultimo) { ponto(recebe, null, 'proprio'); return; }
          if (s.quiques[r.quique] >= 2) { ponto(s.ultimo, null, 'dois'); return; }
        }
      }
      if (r.rede) { o.som('rede'); if (juiz) { ponto(recebe, null, 'rede'); return; } }
      // A bola passa pela linha da raquete de quem recebe (na direção dela), depois de quicar uma vez do lado dele.
      const rr = s.raq[recebe];
      const relA = antes.y - rr.py, relD = s.bola.y - rr.y;
      const cruzou = recebe === 'w' ? relA > 0 && relD <= 0 : relA < 0 && relD >= 0;
      const naZona = Math.abs(relD) <= 0.12; // a bola passa bem perto da raquete
      // Pessoas podem rebater antes do quique (voleio); o bot espera o quique.
      const pessoa = recebe === eu || !bot;
      if ((cruzou || naZona) && (s.quiques[recebe] === 1 || (pessoa && s.quiques[recebe] === 0))) {
        if (juiz) {
          const alcance = recebe === eu ? 0.25 : RAQUETE.alcance; // a sua raquete pega um pouco além da borda
          if (Math.abs(s.bola.x - rr.x) <= alcance && s.bola.z > -0.02 && s.bola.z < 0.8) { rebaterAqui(recebe); return; }
        } else if (cruzou) { s.segura = true; return; } // chegou à raquete do outro: espera a resposta dele
      }
      if (s.bola.z < -0.35 || Math.abs(s.bola.x) > 3 || s.bola.y < -2.5 || s.bola.y > L + 2.5) {
        if (juiz) { if (s.quiques[recebe] === 1) ponto(s.ultimo, null, 'passou'); else ponto(recebe, null, 'fora'); } else s.segura = true;
      }
    }
    function atualizar(dt) {
      const t = agora();
      // Alvo da minha raquete: teclas (na vista) ou o mouse projetado na altura da raquete.
      const r = s.raq[eu];
      // O que o mouse (ou as teclas) pede, na vista: x para os lados, y para a frente.
      const pedido = s.mouseVista ? { x: s.mouseVista.x, y: s.mouseVista.y } : vista(r.ax, r.ay);
      // Empurrão (para a frente) e puxada (para o lado) do mouse nos últimos instantes: viram força e efeito.
      let empurrao = 0, lateral = 0;
      if (s.teclas.size) {
        let mx = 0, my = 0;
        for (const k of s.teclas) { mx += TECLAS[k][0]; my += TECLAS[k][1]; }
        pedido.x += mx * 2.4 * dt; pedido.y += my * 2.4 * dt;
        empurrao = my > 0 ? 3 : 0; lateral = mx * 3;
      } else if (s.mouse && s.camera) {
        const p = s.camera.plano(s.mouse.x, s.mouse.y, RAQUETE.altura);
        if (p) { if (s.mouseVista && dt > 0) { empurrao = (p.y - s.mouseVista.y) / dt; lateral = (p.x - s.mouseVista.x) / dt; } pedido.x = p.x; pedido.y = p.y; }
      }
      pedido.x = clamp(pedido.x, -1.05, 1.05); pedido.y = clamp(pedido.y, -0.6, MEIO - 0.15);
      s.mouseVista = pedido;
      s.empurrao += (empurrao - s.empurrao) * Math.min(1, dt * 12);
      s.lateral += (clamp(lateral, -15, 15) - s.lateral) * Math.min(1, dt * 10);
      // Onde a bola do outro vai quicar do seu lado (a marca limão na mesa, já contando a curva do efeito).
      const vindo = s.fase === 'jogo' && s.bola && s.ultimo === ele && !s.segura;
      if (vindo && !s.mira) {
        const q = s.quiques[eu] === 0 ? P.preverQuique(s.bola) : null;
        s.mira = true;
        s.miraQuique = q && q.lado === eu ? { x: q.x, y: q.y } : null;
      }
      if (!vindo) { s.mira = null; s.miraQuique = null; }
      const alvo = vista(pedido.x, pedido.y);
      r.ax = alvo.x; r.ay = alvo.y;
      // Física em passos curtos (também recupera quadros atrasados).
      let resta = dt;
      while (resta > 1e-6) {
        const h = Math.min(PASSO, resta);
        resta -= h;
        moverRaquetes(h, t);
        if (s.fase === 'jogo' && s.bola && !s.segura) fisica(h);
        else if (s.fase === 'ponto' && s.bola && s.bola.z > -1.5) s.bola = P.passo(s.bola, h).bola;
      }
      // Fases.
      if (s.fase === 'contagem') {
        const falta = Math.ceil(s.ate - t);
        if (falta > 0) { if (!s.aviso || s.aviso.texto !== String(falta)) avisar(String(falta), 0.9); }
        else { s.fase = 'saque'; s.saqueDesde = t; s.querSacar = false; avisar('Já!', 0.6); }
      } else if (s.fase === 'saque') {
        const quem = sacadorAgora();
        s.bola = null;
        if (quem === eu && (s.querSacar || s.empurrao > 2.5 || t - s.saqueDesde > 5)) sacar(eu);
        else if (bot && quem === ele) {
          if (!s.botSaqueEm) { s.botSaqueEm = t + 1; s.raq[ele].ax = sorteio(-0.4, 0.4); }
          if (t >= s.botSaqueEm) { s.botSaqueEm = 0; sacar(ele); }
        }
      } else if (s.fase === 'ponto' && t >= s.ate) {
        if (s.venceu) { s.fase = 'fim'; o.som('fim'); o.aoFim(s.venceu, Object.assign({}, s.pontos)); }
        else { s.fase = 'saque'; s.saqueDesde = t; s.querSacar = false; s.bola = null; }
      }
      if (s.bola && (s.fase === 'jogo' || s.fase === 'ponto')) { s.rastro.push({ x: s.bola.x, y: s.bola.y, z: s.bola.z }); if (s.rastro.length > 8) s.rastro.shift(); } else s.rastro.length = 0;
      // A câmera acompanha um pouco a sua raquete para os lados.
      const v = vista(r.x, r.y);
      s.cam += (clamp(v.x * 0.3, -0.25, 0.25) - s.cam) * Math.min(1, dt * 3);
      // Minha raquete para o outro, umas 16 vezes por segundo (e um sinal de vida a cada meio segundo).
      if (!bot) {
        const mudou = !s.enviado || Math.hypot(r.x - s.enviado.x, r.y - s.enviado.y) > 0.005;
        if ((t - s.enviadoEm > 0.06 && mudou) || t - s.enviadoEm > 0.5) { s.enviadoEm = t; s.enviado = { x: r.x, y: r.y }; o.enviar({ t: 'pp:raq', x: r4(r.x), y: r4(r.y) }, false); }
      }
    }

    // ---------- câmera ----------
    // Perspectiva de trás da sua ponta da mesa, olhando para a outra; p() projeta (na vista) e plano() faz o caminho
    // de volta (do ponto da tela até a altura z), para a raquete seguir o mouse.
    function montarCamera(W, H) {
      const C = { x: s.cam, y: -1.8, z: 1.18 }, T = { x: s.cam * 0.35, y: 1.5, z: -0.2 };
      let fx = T.x - C.x, fy = T.y - C.y, fz = T.z - C.z;
      const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      let rx = fy, ry = -fx;
      const rl = Math.hypot(rx, ry); rx /= rl; ry /= rl;
      const cima = { x: ry * fz, y: -rx * fz, z: rx * fy - ry * fx }; // direita × frente
      const foco = H * 1.32, ox = W / 2, oy = H * 0.46;
      return {
        p(x, y, z) {
          const dx = x - C.x, dy = y - C.y, dz = z - C.z;
          const zc = dx * fx + dy * fy + dz * fz;
          const xc = dx * rx + dy * ry;
          const yc = dx * cima.x + dy * cima.y + dz * cima.z;
          return { x: ox + (foco * xc) / zc, y: oy - (foco * yc) / zc, s: foco / zc };
        },
        plano(sx, sy, h) {
          const a = (sx - ox) / foco, b = -(sy - oy) / foco;
          const dx = fx + rx * a + cima.x * b, dy = fy + ry * a + cima.y * b, dz = fz + cima.z * b;
          if (dz >= -1e-4) return null;
          const t = (h - C.z) / dz;
          return { x: C.x + dx * t, y: C.y + dy * t };
        },
      };
    }

    // ---------- desenho ----------
    function medir() {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr())), h = Math.max(1, Math.round(r.height * dpr()));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    function poligono(pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); }
    function desenhar() {
      medir();
      const W = canvas.width, H = canvas.height, d = dpr();
      const cam = (s.camera = montarCamera(W, H));
      const t = agora();
      // Arena à noite: degradê, luz no chão embaixo da mesa e vagalumes piscando ao fundo.
      const ceu = g.createLinearGradient(0, 0, 0, H);
      ceu.addColorStop(0, '#0a1024'); ceu.addColorStop(0.55, '#151c35'); ceu.addColorStop(1, '#090c16');
      g.fillStyle = ceu; g.fillRect(0, 0, W, H);
      const chao = cam.p(0, MEIO, -0.76);
      const luz = g.createRadialGradient(chao.x, chao.y, 0, chao.x, chao.y, W * 0.5);
      luz.addColorStop(0, 'rgba(214,242,74,.13)'); luz.addColorStop(1, 'rgba(214,242,74,0)');
      g.fillStyle = luz; g.fillRect(0, 0, W, H);
      for (const v of LUZES) {
        const a = 0.2 + 0.8 * Math.max(0, Math.sin(t * v.f + v.d));
        const x = v.x * W + Math.sin(t * 0.3 + v.d) * W * 0.02, y = v.y * H + Math.cos(t * 0.27 + v.d) * H * 0.02;
        const brilho = g.createRadialGradient(x, y, 0, x, y, 7 * d);
        brilho.addColorStop(0, 'rgba(214,242,74,' + (a * 0.55).toFixed(2) + ')'); brilho.addColorStop(1, 'rgba(214,242,74,0)');
        g.fillStyle = brilho; g.fillRect(x - 7 * d, y - 7 * d, 14 * d, 14 * d);
        g.fillStyle = 'rgba(244,255,190,' + a.toFixed(2) + ')';
        g.beginPath(); g.arc(x, y, 1.3 * d, 0, Math.PI * 2); g.fill();
      }
      mesa(cam, d);
      sombras(cam, d);
      // Raquetes, rede e bola na ordem da profundidade (do fundo para a frente).
      const itens = [{ y: MEIO, f: () => rede(cam, d) }];
      for (const lado of ['w', 'b']) { const v = vista(s.raq[lado].x, s.raq[lado].y); itens.push({ y: v.y - (lado === eu ? 0.001 : 0), f: () => raquete(cam, lado, d) }); }
      const b = bolaVisivel();
      if (b) itens.push({ y: vista(b.x, b.y).y, f: () => bola(cam, b, d) });
      itens.sort((a, c) => c.y - a.y).forEach((i) => i.f());
      // Anéis das rebatidas.
      s.efeitos = s.efeitos.filter((e) => t - e.desde < 0.35);
      for (const e of s.efeitos) {
        const v = vista(e.x, e.y), c = cam.p(v.x, v.y, e.z), f = (t - e.desde) / 0.35;
        g.strokeStyle = (e.meu ? 'rgba(214,242,74,' : 'rgba(255,255,255,') + (1 - f).toFixed(2) + ')';
        g.lineWidth = 2.5 * d;
        g.beginPath(); g.arc(c.x, c.y, (0.03 + f * 0.14) * c.s, 0, Math.PI * 2); g.stroke();
      }
      // Vagalumes da vitória.
      s.festa = s.festa.filter((p) => t - p.desde < p.vida);
      for (const p of s.festa) {
        const k = t - p.desde, x = (p.x + p.vx * k) * W, y = (p.y + p.vy * k + 0.35 * k * k) * H, a = 1 - k / p.vida;
        const brilho = g.createRadialGradient(x, y, 0, x, y, 9 * d);
        brilho.addColorStop(0, 'rgba(214,242,74,' + (a * 0.8).toFixed(2) + ')'); brilho.addColorStop(1, 'rgba(214,242,74,0)');
        g.fillStyle = brilho; g.fillRect(x - 9 * d, y - 9 * d, 18 * d, 18 * d);
      }
      // Aviso grande no meio (contagem, ponto, vitória).
      if (s.aviso && t < s.aviso.ate) {
        const vida = t - s.aviso.desde, resto = s.aviso.ate - t;
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, resto / 0.3, vida / 0.12));
        g.translate(W / 2, H * 0.3);
        const escala = 1 + Math.max(0, 0.25 - vida) * 1.2;
        g.scale(escala, escala);
        g.font = '800 ' + Math.round(H * 0.11) + 'px system-ui, "Segoe UI", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = H * 0.018; g.strokeStyle = 'rgba(10,14,26,.85)'; g.strokeText(s.aviso.texto, 0, 0);
        g.fillStyle = '#f2ffc0'; g.fillText(s.aviso.texto, 0, 0);
        g.restore();
      }
    }
    function bolaVisivel() {
      if (s.bola) return s.bola;
      if (s.fase === 'saque') { const q = sacadorAgora(); const b = P.posicaoDeSaque(q, s.raq[q].x); b.z = 0.24 + Math.sin(agora() * 4) * 0.03; return b; }
      return null;
    }
    // Mesa: pés, espessura na ponta da frente, tampo azul com brilho e as linhas brancas.
    function mesa(cam, d) {
      g.strokeStyle = '#0c1020';
      for (const [x, y] of [[-W2 + 0.15, 0.3], [W2 - 0.15, 0.3], [-W2 + 0.15, L - 0.3], [W2 - 0.15, L - 0.3]]) {
        const a = cam.p(x, y, -0.02), b = cam.p(x, y, -0.76);
        g.lineWidth = Math.max(2, 0.05 * a.s);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      const c = [cam.p(-W2, 0, 0), cam.p(W2, 0, 0), cam.p(W2, L, 0), cam.p(-W2, L, 0)];
      const frente = [cam.p(-W2, 0, 0), cam.p(W2, 0, 0), cam.p(W2, 0, -0.04), cam.p(-W2, 0, -0.04)];
      g.fillStyle = '#0f2c52'; poligono(frente); g.fill();
      const tampo = g.createLinearGradient(0, c[2].y, 0, c[0].y);
      tampo.addColorStop(0, '#1d4c86'); tampo.addColorStop(1, '#2a6cb8');
      g.fillStyle = tampo; poligono(c); g.fill();
      const centro = cam.p(0, MEIO * 0.8, 0);
      const brilho = g.createRadialGradient(centro.x, centro.y, 0, centro.x, centro.y, (c[1].x - c[0].x) * 0.6);
      brilho.addColorStop(0, 'rgba(255,255,255,.12)'); brilho.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = brilho; poligono(c); g.fill();
      const m = 0.02;
      g.strokeStyle = '#f2f6fb'; g.lineWidth = 2.2 * d;
      poligono([cam.p(-W2 + m, m, 0), cam.p(W2 - m, m, 0), cam.p(W2 - m, L - m, 0), cam.p(-W2 + m, L - m, 0)]); g.stroke();
      g.lineWidth = 1.2 * d;
      const a = cam.p(0, m, 0), b = cam.p(0, L - m, 0);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    // Sombras no tampo (bola e raquetes) e as marcas dos quiques.
    function sombras(cam, d) {
      const t = agora();
      const sobre = (x, y) => Math.abs(x) <= W2 && y >= 0 && y <= L;
      const b = bolaVisivel();
      if (b && b.z >= 0 && sobre(b.x, b.y)) {
        const v = vista(b.x, b.y), c = cam.p(v.x, v.y, 0);
        const r = BOLA.raio * c.s * (1.3 + b.z * 0.8);
        g.fillStyle = 'rgba(5,10,25,' + clamp(0.5 - b.z * 0.55, 0.12, 0.5).toFixed(2) + ')';
        g.beginPath(); g.ellipse(c.x, c.y, r, r * 0.5, 0, 0, Math.PI * 2); g.fill();
      }
      for (const lado of ['w', 'b']) {
        const rq = s.raq[lado];
        if (!sobre(rq.x, rq.y)) continue;
        const v = vista(rq.x, rq.y), c = cam.p(v.x, v.y, 0);
        g.fillStyle = 'rgba(5,10,25,.25)';
        g.beginPath(); g.ellipse(c.x, c.y, RAQUETE.raio * c.s, RAQUETE.raio * c.s * 0.35, 0, 0, Math.PI * 2); g.fill();
      }
      // Onde a bola do outro vai quicar do seu lado: marca limão pulsando.
      if (s.miraQuique && s.ultimo === ele && s.quiques[eu] === 0) {
        const v = vista(s.miraQuique.x, s.miraQuique.y), c = cam.p(v.x, v.y, 0), pulso = 0.5 + 0.5 * Math.sin(t * 9);
        const raio = (0.05 + 0.012 * pulso) * c.s;
        g.beginPath(); g.ellipse(c.x, c.y, raio, raio * 0.45, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(214,242,74,.16)'; g.fill();
        g.strokeStyle = 'rgba(214,242,74,' + (0.45 + 0.35 * pulso).toFixed(2) + ')'; g.lineWidth = 2 * d; g.stroke();
      }
      s.marcas = s.marcas.filter((m) => t - m.desde < 0.6);
      for (const m of s.marcas) {
        const v = vista(m.x, m.y), c = cam.p(v.x, v.y, 0), f = (t - m.desde) / 0.6;
        g.strokeStyle = 'rgba(242,255,192,' + (0.8 * (1 - f)).toFixed(2) + ')';
        g.lineWidth = 1.6 * d;
        g.beginPath(); g.ellipse(c.x, c.y, (0.025 + f * 0.05) * c.s, (0.025 + f * 0.05) * c.s * 0.45, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    // Rede: tela translúcida com fios, faixa limão em cima e postes.
    function rede(cam, d) {
      const x0 = -W2 - 0.15, x1 = W2 + 0.15, h = MESA.rede;
      g.fillStyle = 'rgba(225,232,245,.16)';
      poligono([cam.p(x0, MEIO, 0), cam.p(x1, MEIO, 0), cam.p(x1, MEIO, h), cam.p(x0, MEIO, h)]); g.fill();
      g.strokeStyle = 'rgba(230,236,248,.28)'; g.lineWidth = 1 * d;
      g.beginPath();
      for (let x = x0; x <= x1 + 1e-6; x += 0.04) { const a = cam.p(x, MEIO, 0), b = cam.p(x, MEIO, h); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      for (let z = 0.04; z < h; z += 0.04) { const a = cam.p(x0, MEIO, z), b = cam.p(x1, MEIO, z); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      g.stroke();
      const a = cam.p(x0, MEIO, h), b = cam.p(x1, MEIO, h);
      g.strokeStyle = '#d6f24a'; g.lineWidth = 3.2 * d;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1 * d;
      g.beginPath(); g.moveTo(a.x, a.y - 1.2 * d); g.lineTo(b.x, b.y - 1.2 * d); g.stroke();
      g.strokeStyle = '#2b2f36'; g.lineWidth = 4 * d;
      for (const x of [x0, x1]) { const p = cam.p(x, MEIO, -0.03), q = cam.p(x, MEIO, h + 0.012); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
    }
    // Raquete virada para a câmera: borracha (vermelha a sua, escura a do outro), borda de madeira e cabo; inclina
    // quando corre para o lado. A sua fica um pouco transparente para não esconder a bola.
    function raquete(cam, lado, d) {
      const rq = s.raq[lado], v = vista(rq.x, rq.y), c = cam.p(v.x, v.y, RAQUETE.altura);
      const rb = RAQUETE.raio * c.s, minha = lado === eu;
      const vxVista = eu === 'b' ? -rq.vx : rq.vx;
      g.save();
      g.globalAlpha = minha ? 0.72 : 1;
      g.translate(c.x, c.y);
      g.rotate(clamp(vxVista * 0.05, -0.45, 0.45));
      const madeira = g.createLinearGradient(-rb * 0.2, 0, rb * 0.2, 0);
      madeira.addColorStop(0, '#e2b273'); madeira.addColorStop(1, '#8a5a2c');
      g.fillStyle = madeira;
      g.beginPath(); g.roundRect ? g.roundRect(-rb * 0.17, rb * 0.75, rb * 0.34, rb * 1.05, rb * 0.12) : g.rect(-rb * 0.17, rb * 0.75, rb * 0.34, rb * 1.05); g.fill();
      if (minha) { g.shadowColor = 'rgba(214,242,74,.65)'; g.shadowBlur = 14 * d; }
      const borracha = g.createRadialGradient(-rb * 0.3, -rb * 0.35, rb * 0.1, 0, 0, rb * 1.05);
      if (minha) { borracha.addColorStop(0, '#ff7b6e'); borracha.addColorStop(1, '#b3261e'); }
      else { borracha.addColorStop(0, '#4b5668'); borracha.addColorStop(1, '#141922'); }
      g.fillStyle = borracha;
      g.beginPath(); g.ellipse(0, 0, rb * 0.92, rb, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#d9b37a'; g.lineWidth = Math.max(1.5 * d, rb * 0.08);
      g.beginPath(); g.ellipse(0, 0, rb * 0.92, rb, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    // Bola: rastro, esfera com luz de cima e, quando espera a resposta do outro, um anel pulsando.
    function bola(cam, b, d) {
      const girando = Math.abs(b.e || 0) > 0.3;
      s.rastro.forEach((p, i) => {
        const v = vista(p.x, p.y), c = cam.p(v.x, v.y, p.z);
        g.fillStyle = (girando ? 'rgba(214,242,74,' : 'rgba(255,190,110,') + (((i + 1) / s.rastro.length) * 0.3).toFixed(2) + ')';
        g.beginPath(); g.arc(c.x, c.y, Math.max(1.5 * d, BOLA.raio * c.s * (0.4 + (0.5 * (i + 1)) / s.rastro.length)), 0, Math.PI * 2); g.fill();
      });
      const v = vista(b.x, b.y), c = cam.p(v.x, v.y, b.z);
      const rb = Math.max(2.4 * d, BOLA.raio * c.s * 1.15);
      const gb = g.createRadialGradient(c.x - rb * 0.35, c.y - rb * 0.35, rb * 0.1, c.x, c.y, rb);
      gb.addColorStop(0, '#ffffff'); gb.addColorStop(0.45, '#ffe6b8'); gb.addColorStop(1, '#ff9b3d');
      g.fillStyle = gb; g.beginPath(); g.arc(c.x, c.y, rb, 0, Math.PI * 2); g.fill();
      if (girando) { // efeito: uma faixa girando na bola (para o lado da curva)
        const ang = agora() * 24 * Math.sign(eu === 'b' ? -b.e : b.e);
        g.save();
        g.beginPath(); g.arc(c.x, c.y, rb, 0, Math.PI * 2); g.clip();
        g.strokeStyle = 'rgba(230,90,20,.8)'; g.lineWidth = Math.max(1, rb * 0.45);
        g.beginPath(); g.moveTo(c.x + Math.cos(ang) * rb * 1.3, c.y + Math.sin(ang) * rb * 1.3); g.lineTo(c.x - Math.cos(ang) * rb * 1.3, c.y - Math.sin(ang) * rb * 1.3); g.stroke();
        g.restore();
      }
      if (s.segura || (s.fase === 'saque' && sacadorAgora() === eu)) {
        g.strokeStyle = 'rgba(214,242,74,' + (0.35 + 0.3 * Math.sin(agora() * 8)).toFixed(2) + ')';
        g.lineWidth = 1.5 * d;
        g.beginPath(); g.arc(c.x, c.y, rb * 2.2, 0, Math.PI * 2); g.stroke();
      }
    }

    // ---------- placar e situação ----------
    let ultimoEstado = '';
    function placar() {
      const v = P.vencedor(s.pontos);
      pontosEu.textContent = String(s.pontos[eu]); pontosEle.textContent = String(s.pontos[ele]);
      const quem = v ? null : sacadorAgora();
      saqueEu.classList.toggle('ativo', quem === eu); saqueEle.classList.toggle('ativo', quem === ele);
      let texto;
      if (v) texto = (v === eu ? 'Você venceu' : o.nome(v) + ' venceu') + ' por ' + s.pontos[v] + ' a ' + s.pontos[P.outra(v)] + '.';
      else if (s.fase === 'contagem') texto = 'Prepare-se! ' + (quem === eu ? 'Você saca.' : o.nome(quem) + ' saca.');
      else if (s.fase === 'saque') texto = quem === eu ? 'Seu saque: clique, aperte espaço ou empurre a raquete para a frente.' : 'Saque de ' + o.nome(quem) + '…';
      else if (s.fase === 'ponto' && s.ultimoPonto) texto = (s.ultimoPonto.ganhou === eu ? 'Ponto seu' : 'Ponto de ' + o.nome(s.ultimoPonto.ganhou)) + (s.ultimoPonto.motivo ? ' (' + MOTIVO[s.ultimoPonto.motivo].replace(/!$/, '').toLowerCase() + ')' : '') + '.';
      else if (s.segura) texto = 'Esperando ' + o.nome(ele) + '…';
      else if (s.pontos.w >= P.PONTOS - 1 && s.pontos.b >= P.PONTOS - 1) texto = s.pontos.w === s.pontos.b ? 'Empate: um saque para cada.' : 'Vantagem de ' + o.nome(s.pontos.w > s.pontos.b ? 'w' : 'b') + '.';
      else texto = s.ultimo === ele ? 'Vá até a bola: a marca limão mostra onde ela vai quicar.' : (Math.abs((s.bola && s.bola.e) || 0) > 1 ? 'Com efeito! A bola vai fazer curva.' : 'Boa! A bola vai para ' + o.nome(ele) + '.');
      if (texto !== ultimoEstado) { ultimoEstado = texto; estado.textContent = texto; }
    }

    // ---------- laço ----------
    let antes = agora(), parado = false;
    function quadro() {
      if (parado || !o.vivo()) { parado = true; return; }
      const t = agora();
      const dt = Math.min(0.25, t - antes); // quadros atrasados: a física recupera o tempo (em passos de 1/240 s)
      antes = t;
      if (!o.encerrado() && s.fase !== 'fim' && !(o.pausado && o.pausado())) atualizar(dt);
      if (raizEl.isConnected) { desenhar(); placar(); }
      raiz.requestAnimationFrame(quadro);
    }
    raiz.requestAnimationFrame(quadro);
    setTimeout(() => { if (raizEl.isConnected) raizEl.focus(); }, 0);
    return { elemento: raizEl, receber, parar() { parado = true; }, estado: () => s };
  }

  VL.pingPongTela = { criar };
})(typeof globalThis !== 'undefined' ? globalThis : this);
