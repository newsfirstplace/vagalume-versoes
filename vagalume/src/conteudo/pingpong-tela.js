// Vagalume — tela do ping-pong em 3D (pedido do usuário em 2026-11-23, com um vídeo mostrando o estilo): mesa em
// perspectiva vista de trás de quem joga, bola em arco com sombra e marca do quique, a sua raquete grande na frente
// seguindo o mouse (para os lados e para a frente) e o adversário no fundo. Cenário: arena de campeonato em tigela (quadra,
// placas, arquibancada com público e refletores), mesa azul com pés de metal e raquetes com espessura. Regras e física
// em core/pingpong.js.
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
  // Por que o ponto aconteceu (aviso grande e linha de baixo).
  const MOTIVO = { fora: 'Fora!', rede: 'Na rede!', dois: 'Quicou duas vezes', passou: 'Passou!', proprio: 'Quicou do lado errado' };
  // Ginásio: chão da quadra (altura do piso, em metros abaixo do tampo), placas, arquibancada e público fixos.
  const CHAO = -0.76;
  const QUADRA = { x: 4.6, y0: -1.4, y1: L + 5 };
  // Tigela da arena: centro, raios do muro e o arco desenhado (o lado de trás da câmera fica de fora).
  const ARENA = { cx: 0, cy: MEIO + 1, rx: 8.2, ry: 9.5, ang0: 0.12, ang1: Math.PI - 0.12, segmentos: 44 };

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
      rastro: [], marcas: [], efeitos: [], batidas: {}, festa: [], aviso: null, venceu: null,
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
    function novaJogada(lado) { s.ultimo = lado; s.quiques = { w: 0, b: 0 }; s.botMira = null; s.segura = false; s.mira = null; s.miraQuique = null; s.escala = 1; s.previsao = null; }
    // A bola chegou à raquete do outro e a rebatida dele ainda não chegou pela rede: em vez de parar, ela volta numa
    // devolução provável. Quando a rebatida de verdade chega, a bola passa para ela deslizando (sem salto). Enquanto é
    // só previsão ninguém marca ponto nem rebate aqui.
    function preverDevolucao(lado) {
      if (s.previsao || !s.bola) { s.segura = true; return; }
      s.bola = P.rebater(s.bola, lado, 0.62, -s.bola.x * 0.6, 0);
      novaJogada(lado);
      s.previsao = { desde: agora() };
      anel(s.bola, false, 0.62, lado); o.som('bate');
    }
    // Atraso da rede sem a bola parar (pedido do usuário em 2026-11-26): indo para o outro jogador, a bola anda um pouco
    // mais devagar na minha tela e chega à raquete dele quando a rebatida dele já chegou aqui; voltando, anda um pouco
    // mais depressa e alcança o tempo de verdade antes de chegar à minha raquete (eu sou o juiz do meu lado).
    function escalaIndo() {
      const L = !bot && o.atraso ? o.atraso() : 0;
      if (L < 0.01 || !s.bola) return;
      const c = P.preverCruzamento(s.bola, s.raq[ele].y, 3);
      if (c && c.t > 0.1) s.escala = clamp(c.t / (c.t + L), 0.6, 1);
    }
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
      if (!bot && lado === eu) { o.enviar(Object.assign({ t: 'pp:saque' }, bolaParaRede(s.bola)), true); escalaIndo(); }
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
      anel(s.bola, lado === eu, forca, lado);
      o.som('bate');
      if (!bot && lado === eu) { o.enviar(Object.assign({ t: 'pp:bate' }, bolaParaRede(s.bola)), true); escalaIndo(); }
    }
    function ponto(ganhou, placar, motivo) {
      if (placar) s.pontos = placar; else s.pontos[ganhou]++;
      s.fase = 'ponto'; s.ate = agora() + 1.4; s.segura = false; s.escala = 1; s.previsao = null; s.desvio = null;
      s.ultimoPonto = { ganhou, motivo: MOTIVO[motivo] ? motivo : null };
      o.som('ponto');
      const v = P.vencedor(s.pontos);
      if (v) { s.venceu = v; avisar(v === eu ? 'Você venceu!' : o.nome(v) + ' venceu!', 3); if (v === eu) festa(); }
      else if (s.pontos.w >= P.PONTOS - 1 && s.pontos.w === s.pontos.b) avisar('Empate! ' + s.pontos.w + ' a ' + s.pontos.b, 1.2);
      else avisar(MOTIVO[motivo] || (ganhou === eu ? 'Ponto seu!' : 'Ponto de ' + o.nome(ganhou)), 1.2);
      if (!bot && !placar) o.enviar({ t: 'pp:ponto', a: ganhou, pw: s.pontos.w, pb: s.pontos.b, m: motivo }, true);
    }
    function anel(b, meu, forca, lado) {
      const f = clamp(forca == null ? 0.6 : forca, 0.3, 1.2);
      s.efeitos.push({ x: b.x, y: b.y, z: b.z, desde: agora(), meu, forca: f, faiscas: Array.from({ length: 8 + Math.round(f * 8) }, () => ({ a: sorteio(0, Math.PI * 2), v: sorteio(0.5, 1.2) })) });
      if (s.efeitos.length > 8) s.efeitos.shift();
      if (lado) s.batidas[lado] = agora();
    }
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
        const previsto = s.previsao && s.bola ? { x: s.bola.x, y: s.bola.y, z: s.bola.z } : null;
        s.bola = b; novaJogada(ele); s.fase = 'jogo';
        if (d.t === 'pp:bate') { anel(b, false, Math.min(1.2, Math.hypot(b.vx, b.vy, b.vz) / 9), ele); o.som('bate'); } else o.som('saque');
        // Compensa o atraso da rede: a bola anda na hora o que andou do lado de lá enquanto a mensagem vinha,
        // em vez de parecer que o outro demorou para devolver.
        let resta = Number.isFinite(d.atraso) ? Math.max(0, Math.min(0.4, d.atraso)) : 0;
        const c = resta > 0.01 ? P.preverCruzamento(b, s.raq[eu].y, 3) : null;
        if (c && c.t > resta * 1.5 + 0.08) { s.escala = clamp(c.t / (c.t - resta), 1, 1.8); resta = 0; } // alcança o tempo aos poucos
        while (resta > 1e-6 && s.fase === 'jogo' && s.bola && !s.segura) { const h = Math.min(PASSO, resta); resta -= h; fisica(h); }
        // Saindo da devolução prevista: a bola desliza até a posição de verdade.
        if (previsto && s.bola) s.desvio = { x: previsto.x - s.bola.x, y: previsto.y - s.bola.y, z: previsto.z - s.bola.z, desde: agora() };
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
      const juiz = !s.previsao && (bot || recebe === eu);
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
      // Como na regra: só dá para rebater depois de a bola quicar uma vez do lado de quem recebe (sem voleio).
      if ((cruzou || naZona) && s.quiques[recebe] === 1) {
        if (juiz) {
          const alcance = recebe === eu ? 0.25 : RAQUETE.alcance; // a sua raquete pega um pouco além da borda
          if (Math.abs(s.bola.x - rr.x) <= alcance && s.bola.z > -0.02 && s.bola.z < 0.8) { rebaterAqui(recebe); return; }
        } else if (cruzou && !s.previsao) { preverDevolucao(recebe); return; } // chegou à raquete do outro: devolução provável até a de verdade chegar
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
        if (s.previsao && t - s.previsao.desde > 0.9) s.segura = true; // a previsão não passa do meio da mesa
        if (s.fase === 'jogo' && s.bola && !s.segura) fisica(h * (s.escala || 1));
        else if (s.fase === 'ponto' && s.bola) {
          const nb = P.passo(s.bola, h).bola;
          if (nb.z < CHAO + BOLA.raio && nb.vz < 0) { nb.z = CHAO + BOLA.raio; nb.vz = -nb.vz * 0.55; nb.vx *= 0.8; nb.vy *= 0.8; }
          s.bola = nb;
        }
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
    function montarCamera(W, H, camX) {
      const cx = camX == null ? s.cam : camX;
      const C = { x: cx, y: -1.8, z: 1.18 }, T = { x: cx * 0.35, y: 1.5, z: 0.5 };
      let fx = T.x - C.x, fy = T.y - C.y, fz = T.z - C.z;
      const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      let rx = fy, ry = -fx;
      const rl = Math.hypot(rx, ry); rx /= rl; ry /= rl;
      const cima = { x: ry * fz, y: -rx * fz, z: rx * fy - ry * fx }; // direita × frente
      const foco = H * 1.05, ox = W / 2, oy = H * 0.36;
      return {
        C,
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
      ginasio(cam, d, W, H, t);
      const b = bolaVisivel();
      const bolaEmbaixo = b && escondidaPelaMesa(cam, b);
      sombrasNoChao(cam, d, b);
      if (bolaEmbaixo) bola(cam, b, d);
      mesa(cam, d);
      sombras(cam, d);
      // Raquetes, rede e bola na ordem da profundidade (do fundo para a frente).
      const itens = [{ y: MEIO, f: () => rede(cam, d) }];
      for (const lado of ['w', 'b']) { const v = vista(s.raq[lado].x, s.raq[lado].y); itens.push({ y: v.y - (lado === eu ? 0.001 : 0), f: () => raquete(cam, lado, d) }); }
      if (b && !bolaEmbaixo) itens.push({ y: vista(b.x, b.y).y, f: () => bola(cam, b, d) });
      itens.sort((a, c) => c.y - a.y).forEach((i) => i.f());
      // Batidas: clarão no ponto do impacto, duas ondas, faíscas voando (tudo maior numa batida forte).
      const DUR = 0.45;
      s.efeitos = s.efeitos.filter((e) => t - e.desde < DUR);
      for (const e of s.efeitos) {
        const v = vista(e.x, e.y), c = cam.p(v.x, v.y, e.z), f = (t - e.desde) / DUR, tam = 0.7 + e.forca * 0.6;
        const cor = e.meu ? '214,242,74' : '170,210,255';
        if (f < 0.35) {
          const k = f / 0.35, r = (0.05 + 0.13 * k) * c.s * tam;
          const cl = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
          cl.addColorStop(0, 'rgba(255,255,255,' + (0.95 * (1 - k)).toFixed(2) + ')'); cl.addColorStop(0.35, 'rgba(' + cor + ',' + (0.6 * (1 - k)).toFixed(2) + ')'); cl.addColorStop(1, 'rgba(' + cor + ',0)');
          g.fillStyle = cl; g.fillRect(c.x - r, c.y - r, r * 2, r * 2);
        }
        for (const atraso of [0, 0.14]) {
          const k = (f - atraso) / (1 - atraso);
          if (k < 0 || k > 1) continue;
          g.strokeStyle = 'rgba(' + (atraso ? '255,255,255' : cor) + ',' + (0.9 * (1 - k)).toFixed(2) + ')';
          g.lineWidth = Math.max(0.5, (1 - k) * 3.5 * d * tam);
          g.beginPath(); g.ellipse(c.x, c.y, (0.03 + k * 0.22) * c.s * tam, (0.03 + k * 0.22) * c.s * tam * 0.75, 0, 0, Math.PI * 2); g.stroke();
        }
        g.lineCap = 'round';
        for (const q of e.faiscas) {
          const dist = (0.03 + f * 0.3 * q.v) * c.s * tam, comp = (1 - f) * 0.07 * c.s * q.v * tam;
          const cx = Math.cos(q.a), cy = Math.sin(q.a) * 0.8 + f * 0.3; // caem um pouco
          g.strokeStyle = 'rgba(255,' + (e.meu ? 245 : 235) + ',' + (e.meu ? 170 : 210) + ',' + (1 - f).toFixed(2) + ')';
          g.lineWidth = Math.max(0.8, (1 - f) * 2.4 * d);
          g.beginPath(); g.moveTo(c.x + cx * (dist - comp), c.y + cy * (dist - comp)); g.lineTo(c.x + cx * dist, c.y + cy * dist); g.stroke();
        }
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
    // Arena de campeonato em forma de tigela: dois anéis de arquibancada com o público na penumbra, faixas de LED,
    // escadas iluminadas e refletores no teto. Essa parte é desenhada uma vez numa tela à parte (com a câmera no meio)
    // e copiada a cada quadro com o deslocamento da câmera; piso, placas e flashes são desenhados ao vivo.
    let arenaCache = null;
    function pol(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); }
    const ok = (...pts) => pts.every((p) => p.s > 0 && Number.isFinite(p.x) && Number.isFinite(p.y));
    const tigela = (r, a, z) => ({ x: ARENA.cx + (ARENA.rx + r) * Math.cos(a), y: ARENA.cy + (ARENA.ry + r) * Math.sin(a), z });
    function pintarArena(c, cam, W, H) {
      const ceu = c.createLinearGradient(0, 0, 0, H);
      ceu.addColorStop(0, '#020308'); ceu.addColorStop(0.6, '#070b16'); ceu.addColorStop(1, '#0a0e1a');
      c.fillStyle = ceu; c.fillRect(0, 0, W, H);
      // Piso vinho até o muro da tigela.
      const chao = [cam.p(ARENA.rx + 1, -1.4, CHAO)]; // canto direito, arco da direita para a esquerda, canto esquerdo
      for (let i = 0; i <= 40; i++) { const a = ARENA.ang0 - 0.1 + i * (ARENA.ang1 - ARENA.ang0 + 0.2) / 40, q = tigela(0.3, a, CHAO), p = cam.p(q.x, q.y, CHAO); if (ok(p)) chao.push(p); }
      chao.push(cam.p(-ARENA.rx - 1, -1.4, CHAO));
      const piso = c.createLinearGradient(0, H * 0.3, 0, H);
      piso.addColorStop(0, '#3a101d'); piso.addColorStop(1, '#6a1f2e');
      c.fillStyle = piso; pol(c, chao); c.fill();
      const P3 = (r, a, z) => { const q = tigela(r, a, z); return cam.p(q.x, q.y, z); };
      const quad = (r0, r1, a0, a1, z0, z1, cor) => { // trecho de superfície entre dois raios/alturas
        const pts = [P3(r0, a0, z0), P3(r0, a1, z0), P3(r1, a1, z1), P3(r1, a0, z1)];
        if (!ok(...pts)) return; c.fillStyle = cor; pol(c, pts); c.fill();
      };
      const N = ARENA.segmentos, a0 = ARENA.ang0, da = (ARENA.ang1 - ARENA.ang0) / N;
      const corredor = (i) => i % 7 === 3; // escadas
      // Teto: treliça escura em anel e as caixas de luz.
      for (let i = 0; i < 26; i++) {
        const a = 0.15 + i * (Math.PI - 0.3) / 25, q = { x: Math.cos(a) * 7.5, y: MEIO + 2 + Math.sin(a) * 8.5 }, p = cam.p(q.x, q.y, CHAO + 15);
        if (!ok(p) || p.y > H * 0.6) continue;
        const w = 0.9 * p.s, h = 0.32 * p.s;
        const brilho = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * 2.2);
        brilho.addColorStop(0, 'rgba(235,240,255,.35)'); brilho.addColorStop(1, 'rgba(235,240,255,0)');
        c.fillStyle = brilho; c.fillRect(p.x - w * 2.2, p.y - w * 2.2, w * 4.4, w * 4.4);
        c.fillStyle = '#1a1f2c'; c.fillRect(p.x - w * 0.6, p.y - h * 0.65, w * 1.2, h * 1.3);
        c.fillStyle = '#f6f8ff';
        for (let k = -1; k <= 1; k++) c.fillRect(p.x + k * w * 0.36 - w * 0.14, p.y - h * 0.35, w * 0.28, h * 0.7);
      }
      // Anel de cima (do fundo para a frente), faixa de LED do meio, anel de baixo e o muro.
      const fileiras = (rIni, zIni, n, alto) => {
        for (let k = n - 1; k >= 0; k--) {
          const r = rIni + k * 0.8, z = zIni + k * alto;
          for (let i = 0; i < N; i++) {
            const aa = a0 + i * da, ab = aa + da;
            quad(r, r + 0.8, aa, ab, z, z, corredor(i) ? '#1d2436' : (k % 2 ? '#111725' : '#141b2b'));
            quad(r, r, aa, ab, z - alto, z, '#0b101c');
            if (corredor(i)) { const p = P3(r + 0.1, aa + da / 2, z); if (ok(p)) { c.fillStyle = 'rgba(120,200,255,.55)'; c.fillRect(p.x - 1.2, p.y - 0.6, 2.4, 1.2); } continue; }
            for (let j = 0; j < 4; j++) { // público
              const h = Math.sin(i * 12.9898 + k * 78.233 + j * 37.719) * 43758.5453, q = h - Math.floor(h);
              if (q < 0.1) continue;
              const a = aa + da * (j + 0.5) / 4, corpo = P3(r + 0.42, a, z + 0.28), cab = P3(r + 0.42, a, z + 0.62);
              if (!ok(corpo, cab)) continue;
              const luz = 0.3 + 0.35 * (1 - k / n) + q * 0.1; // na penumbra, mais claro perto da quadra
              c.fillStyle = 'hsl(' + Math.floor(q * 360) + ',' + Math.floor(12 + q * 18) + '%,' + Math.floor(9 + luz * 16) + '%)';
              c.beginPath(); c.ellipse(corpo.x, corpo.y, 0.12 * corpo.s, 0.16 * corpo.s, 0, 0, Math.PI * 2); c.fill();
              c.fillStyle = 'hsl(24,' + Math.floor(18 + q * 15) + '%,' + Math.floor(14 + luz * 20) + '%)';
              c.beginPath(); c.arc(cab.x, cab.y, 0.075 * cab.s, 0, Math.PI * 2); c.fill();
            }
          }
        }
      };
      const zBaixo = CHAO + 1.05, zCima = zBaixo + 10 * 0.42 + 0.9;
      fileiras(9.2, zCima, 11, 0.5);
      // Faixa de LED do meio (como um painel contínuo) com o nome do torneio no centro.
      for (let i = 0; i < N; i++) {
        const aa = a0 + i * da, ab = aa + da;
        const pts = [P3(8.4, aa, zCima - 0.9), P3(8.4, ab, zCima - 0.9), P3(8.4, ab, zCima - 0.2), P3(8.4, aa, zCima - 0.2)];
        if (!ok(...pts)) continue;
        const gr = c.createLinearGradient(0, pts[3].y, 0, pts[0].y);
        gr.addColorStop(0, '#5ee7ff'); gr.addColorStop(0.5, '#1a7fe0'); gr.addColorStop(1, '#0a2f7a');
        c.fillStyle = gr; pol(c, pts); c.fill();
      }
      const mid = P3(8.4, Math.PI / 2, zCima - 0.55);
      if (ok(mid)) {
        c.font = '800 ' + Math.round(0.5 * mid.s) + 'px system-ui, "Segoe UI", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#ffffff'; c.fillText('VAGALUME OPEN', mid.x, mid.y);
      }
      fileiras(0.4, zBaixo + 0.42, 10, 0.42);
      // Muro da tigela com faixa de LED em cima.
      for (let i = 0; i < N; i++) {
        const aa = a0 + i * da, ab = aa + da;
        quad(0, 0, aa, ab, CHAO, zBaixo, '#0c1222');
        const pts = [P3(0, aa, zBaixo - 0.3), P3(0, ab, zBaixo - 0.3), P3(0, ab, zBaixo - 0.05), P3(0, aa, zBaixo - 0.05)];
        if (ok(...pts)) { c.fillStyle = i % 2 ? '#1e88ff' : '#2aa3ff'; pol(c, pts); c.fill(); }
      }
      // Névoa de luz sobre a arena.
      const ar = c.createRadialGradient(W / 2, H * 0.1, 0, W / 2, H * 0.1, H);
      ar.addColorStop(0, 'rgba(140,170,255,.10)'); ar.addColorStop(1, 'rgba(140,170,255,0)');
      c.fillStyle = ar; c.fillRect(0, 0, W, H);
    }
    // Flashes de câmera na arquibancada: lugares fixos, cada um pisca às vezes.
    const FLASHES = Array.from({ length: 36 }, (_, i) => { const h = Math.sin(i * 91.17) * 43758.5453, q = h - Math.floor(h); return { r: 1 + q * 16, a: ARENA.ang0 + 0.2 + ((i * 0.618) % 1) * (ARENA.ang1 - ARENA.ang0 - 0.4), z: 0, fase: q * 40 }; });
    FLASHES.forEach((f) => { f.z = f.r < 8.4 ? CHAO + 1.6 + (f.r / 8) * 4 : CHAO + 7 + ((f.r - 9) / 8) * 5; });
    function ginasio(cam, d, W, H, t) {
      const margem = Math.round(W * 0.12);
      if (!arenaCache || arenaCache.w !== W || arenaCache.h !== H) {
        const tela = document.createElement('canvas'); tela.width = W + margem * 2; tela.height = H;
        const ctx = tela.getContext('2d');
        if (ctx) pintarArena(ctx, montarCamera(W + margem * 2, H, 0), W + margem * 2, H);
        arenaCache = { w: W, h: H, tela, cam: montarCamera(W + margem * 2, H, 0) };
      }
      // Deslocamento da câmera: casa um ponto do fundo da arena entre a câmera fixa e a de agora.
      const ref = { x: 0, y: ARENA.cy + ARENA.ry + 5, z: CHAO + 5 };
      const vivo = cam.p(ref.x, ref.y, ref.z), fixo = arenaCache.cam.p(ref.x, ref.y, ref.z);
      g.drawImage(arenaCache.tela, Math.round(vivo.x - fixo.x) - margem + 0, Math.round(vivo.y - fixo.y));
      for (const f of FLASHES) {
        const k = Math.sin(t * 0.7 + f.fase);
        if (k < 0.985) continue;
        const q = tigela(f.r, f.a, f.z), p = cam.p(q.x, q.y, f.z);
        if (!ok(p)) continue;
        const r = 9 * d * (k - 0.985) / 0.015;
        const br = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        br.addColorStop(0, 'rgba(255,255,255,.95)'); br.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = br; g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
      const cm = cam.p(0, MEIO, CHAO);
      const reflexo = g.createRadialGradient(cm.x, cm.y, 0, cm.x, cm.y, W * 0.5);
      reflexo.addColorStop(0, 'rgba(255,225,235,.14)'); reflexo.addColorStop(1, 'rgba(255,225,235,0)');
      g.fillStyle = reflexo; g.fillRect(0, 0, W, H);
      // Placas em volta da área de jogo: painéis azuis com faixas coloridas e o nome.
      const hp = 0.8;
      const painel = (pA, pB, rot) => { // pA, pB: pontas de baixo (x, y) do painel
        const P = (u, v) => cam.p(pA.x + (pB.x - pA.x) * u, pA.y + (pB.y - pA.y) * u, CHAO + hp * v);
        const base = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
        if (!ok(...base)) return;
        const gr = g.createLinearGradient(base[0].x, 0, base[1].x, 0);
        gr.addColorStop(0, '#0f3fb8'); gr.addColorStop(1, '#2d72f0');
        g.fillStyle = gr; poligono(base); g.fill();
        g.save(); poligono(base); g.clip();
        for (const [u, larg, cor] of [[0.05, 0.12, '#ff3d8b'], [0.2, 0.06, '#22d3ee'], [0.62, 0.1, '#8b5cf6'], [0.78, 0.05, '#ff3d8b']]) {
          g.fillStyle = cor; poligono([P(u, 0), P(u + larg, 0), P(u + larg + 0.12, 1), P(u + 0.12, 1)]); g.fill();
        }
        g.restore();
        if (rot) {
          const c = P(0.5, 0.5);
          g.font = 'italic 800 ' + Math.max(6, Math.round(0.24 * c.s)) + 'px system-ui, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = Math.max(1, 0.05 * c.s); g.strokeStyle = 'rgba(5,20,60,.6)'; g.strokeText(rot, c.x, c.y);
          g.fillStyle = '#ffffff'; g.fillText(rot, c.x, c.y);
          const pt = P(0.1, 0.5);
          g.fillStyle = '#d6f24a'; g.beginPath(); g.arc(pt.x, pt.y, 0.08 * pt.s, 0, Math.PI * 2); g.fill();
        }
        const t1 = P(0, 1), t2 = P(1, 1);
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1 * d; g.beginPath(); g.moveTo(t1.x, t1.y); g.lineTo(t2.x, t2.y); g.stroke();
      };
      const fx = QUADRA.x, y1 = QUADRA.y1, n = 5, larg = (2 * fx) / n;
      for (const x of [-fx, fx]) for (let i = 0; i < 4; i++) { const ya = QUADRA.y0 + i * (y1 - QUADRA.y0) / 4, yb = ya + (y1 - QUADRA.y0) / 4; painel({ x, y: ya }, { x, y: yb }, ''); }
      for (let i = 0; i < n; i++) painel({ x: -fx + i * larg, y: y1 }, { x: -fx + (i + 1) * larg, y: y1 }, i % 2 ? 'OPEN' : 'VAGALUME');
    }
    // A mesa esconde a bola quando ela está abaixo do tampo e a linha da câmera até ela atravessa o tampo.
    function escondidaPelaMesa(cam, b) {
      if (b.z >= 0) return false;
      const v = vista(b.x, b.y), C = cam.C, k = C.z / (C.z - b.z);
      const x = C.x + (v.x - C.x) * k, y = C.y + (v.y - C.y) * k;
      return Math.abs(x) <= W2 && y >= 0 && y <= L;
    }
    // Sombras no chão do ginásio: a da mesa e a da bola quando ela está fora da mesa.
    function sombrasNoChao(cam, d, b) {
      g.save();
      g.filter = 'blur(' + Math.round(6 * d) + 'px)';
      g.fillStyle = 'rgba(0,0,0,.55)';
      poligono([cam.p(-W2 - 0.08, 0.05, CHAO), cam.p(W2 + 0.08, 0.05, CHAO), cam.p(W2 + 0.08, L + 0.1, CHAO), cam.p(-W2 - 0.08, L + 0.1, CHAO)]); g.fill();
      g.restore();
      if (!b || (b.z >= 0 && Math.abs(b.x) <= W2 && b.y >= 0 && b.y <= L)) return;
      const v = vista(b.x, b.y);
      if (escondidaPelaMesa(cam, { x: b.x, y: b.y, z: CHAO })) return;
      const c = cam.p(v.x, v.y, CHAO), r = BOLA.raio * c.s * (1.4 + Math.max(0, b.z - CHAO) * 0.5);
      g.fillStyle = 'rgba(0,0,0,' + clamp(0.45 - (b.z - CHAO) * 0.25, 0.1, 0.45).toFixed(2) + ')';
      g.beginPath(); g.ellipse(c.x, c.y, r, r * 0.45, 0, 0, Math.PI * 2); g.fill();
    }
    // Mesa de competição: cavaletes de metal com travessa e rodinhas, tampo com espessura, azul fosco com o brilho
    // dos refletores e as linhas brancas pintadas.
    function mesa(cam, d) {
      const perna = (x, y) => {
        const a = cam.p(x, y, -0.03), b = cam.p(x, y, CHAO + 0.05);
        const lw = Math.max(2 * d, 0.05 * a.s);
        g.lineCap = 'round';
        g.strokeStyle = '#3c424c'; g.lineWidth = lw; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        g.strokeStyle = 'rgba(200,208,220,.45)'; g.lineWidth = Math.max(1, lw * 0.25);
        g.beginPath(); g.moveTo(a.x - lw * 0.22, a.y); g.lineTo(b.x - lw * 0.22, b.y); g.stroke();
        const r = cam.p(x, y, CHAO + 0.03);
        g.fillStyle = '#0d0f13'; g.beginPath(); g.ellipse(r.x, r.y, 0.045 * r.s, 0.03 * r.s, 0, 0, Math.PI * 2); g.fill();
      };
      for (const y of [0.34, L - 0.34]) {
        const xa = -W2 + 0.13, xb = W2 - 0.13;
        const a = cam.p(xa, y, -0.42), b = cam.p(xb, y, -0.42);
        g.strokeStyle = '#2f343c'; g.lineWidth = Math.max(2 * d, 0.035 * a.s); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        perna(xa, y); perna(xb, y);
      }
      // Armação embaixo do tampo (aparece nas bordas).
      g.fillStyle = '#16191f';
      poligono([cam.p(-W2 + 0.04, 0.04, -0.06), cam.p(W2 - 0.04, 0.04, -0.06), cam.p(W2 - 0.04, L - 0.04, -0.06), cam.p(-W2 + 0.04, L - 0.04, -0.06)]); g.fill();
      // Espessura: ponta da frente e, se a câmera estiver de lado, a lateral.
      const e = 0.03;
      g.fillStyle = '#0b2244';
      poligono([cam.p(-W2, 0, 0), cam.p(W2, 0, 0), cam.p(W2, 0, -e), cam.p(-W2, 0, -e)]); g.fill();
      if (Math.abs(cam.C.x) > W2) {
        const x = Math.sign(cam.C.x) * W2;
        g.fillStyle = '#0a1d3a';
        poligono([cam.p(x, 0, 0), cam.p(x, L, 0), cam.p(x, L, -e), cam.p(x, 0, -e)]); g.fill();
      }
      const c = [cam.p(-W2, 0, 0), cam.p(W2, 0, 0), cam.p(W2, L, 0), cam.p(-W2, L, 0)];
      const tampo = g.createLinearGradient(0, c[2].y, 0, c[0].y);
      tampo.addColorStop(0, '#173f74'); tampo.addColorStop(0.55, '#1c4f8f'); tampo.addColorStop(1, '#215a9e');
      g.fillStyle = tampo; poligono(c); g.fill();
      // Brilho dos refletores no tampo (fosco: manchas largas e suaves).
      g.save(); poligono(c); g.clip();
      for (const x of [-0.42, 0.42]) {
        const r = cam.p(x, L * 0.7, 0), rr = 0.5 * r.s;
        g.save(); g.translate(r.x, r.y); g.scale(1, 0.32);
        const br = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        br.addColorStop(0, 'rgba(255,255,255,.16)'); br.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = br; g.fillRect(-rr, -rr, rr * 2, rr * 2);
        g.restore();
      }
      g.restore();
      // Linhas brancas: borda de 2 cm (faixas em perspectiva) e a linha do meio.
      const m = 0.02;
      g.fillStyle = '#eef3f8';
      poligono([cam.p(-W2, 0, 0), cam.p(W2, 0, 0), cam.p(W2, m, 0), cam.p(-W2, m, 0)]); g.fill();
      poligono([cam.p(-W2, L - m, 0), cam.p(W2, L - m, 0), cam.p(W2, L, 0), cam.p(-W2, L, 0)]); g.fill();
      poligono([cam.p(-W2, 0, 0), cam.p(-W2 + m, 0, 0), cam.p(-W2 + m, L, 0), cam.p(-W2, L, 0)]); g.fill();
      poligono([cam.p(W2 - m, 0, 0), cam.p(W2, 0, 0), cam.p(W2, L, 0), cam.p(W2 - m, L, 0)]); g.fill();
      g.strokeStyle = 'rgba(238,243,248,.9)'; g.lineWidth = 1 * d;
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
    // Rede de competição: malha escura, fita branca em cima, postes e presilhas na borda da mesa.
    function rede(cam, d) {
      const x0 = -W2 - 0.15, x1 = W2 + 0.15, h = MESA.rede;
      g.fillStyle = 'rgba(14,18,28,.5)';
      poligono([cam.p(x0, MEIO, 0), cam.p(x1, MEIO, 0), cam.p(x1, MEIO, h), cam.p(x0, MEIO, h)]); g.fill();
      g.strokeStyle = 'rgba(190,200,220,.22)'; g.lineWidth = 0.8 * d;
      g.beginPath();
      for (let x = x0; x <= x1 + 1e-6; x += 0.025) { const a = cam.p(x, MEIO, 0), b = cam.p(x, MEIO, h); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      for (let z = 0.025; z < h; z += 0.025) { const a = cam.p(x0, MEIO, z), b = cam.p(x1, MEIO, z); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      g.stroke();
      g.fillStyle = '#f5f7fb';
      poligono([cam.p(x0, MEIO, h - 0.016), cam.p(x1, MEIO, h - 0.016), cam.p(x1, MEIO, h), cam.p(x0, MEIO, h)]); g.fill();
      for (const x of [x0, x1]) {
        const p = cam.p(x, MEIO, -0.035), q = cam.p(x, MEIO, h + 0.01), lw = Math.max(3 * d, 0.03 * p.s);
        g.strokeStyle = '#1d2128'; g.lineWidth = lw; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
        g.strokeStyle = 'rgba(210,218,230,.4)'; g.lineWidth = Math.max(1, lw * 0.3);
        g.beginPath(); g.moveTo(p.x - lw * 0.2, p.y); g.lineTo(q.x - lw * 0.2, q.y); g.stroke();
        const borda = Math.sign(x) * W2, pa = cam.p(borda, MEIO - 0.03, 0.012), pb = cam.p(x, MEIO + 0.03, -0.035);
        g.fillStyle = '#23272f'; g.fillRect(Math.min(pa.x, pb.x), Math.min(pa.y, pb.y), Math.abs(pb.x - pa.x), Math.abs(pb.y - pa.y));
      }
    }
    // Raquete em 3D: lâmina com espessura (madeira entre as duas borrachas) que aparece quando ela gira, borracha com
    // textura e brilho, cabo de madeira anatômico. A sua é vermelha e um pouco transparente para não esconder a bola;
    // a do outro mostra a borracha preta.
    function raquete(cam, lado, d) {
      const rq = s.raq[lado], v = vista(rq.x, rq.y), c = cam.p(v.x, v.y, RAQUETE.altura);
      const rb = RAQUETE.raio * c.s, minha = lado === eu;
      const vxVista = eu === 'b' ? -rq.vx : rq.vx;
      const giro = clamp(vxVista * 0.07 + v.x * 0.6, -0.9, 0.9);
      const rx = rb * 0.92 * Math.max(0.4, Math.cos(giro)), ry = rb, esp = rb * 0.24 * Math.sin(giro);
      const pulso = s.batidas[lado] ? Math.max(0, 1 - (agora() - s.batidas[lado]) / 0.2) : 0;
      g.save();
      g.globalAlpha = minha ? 0.8 : 1;
      g.translate(c.x, c.y);
      if (pulso) g.scale(1 + 0.12 * pulso, 1 + 0.12 * pulso);
      g.rotate(clamp(vxVista * 0.05, -0.45, 0.45));
      // Cabo: um lado mais escuro (a espessura) e a frente com veios.
      const cabo = (dx, claro) => {
        g.beginPath();
        g.moveTo(dx - rb * 0.1, rb * 0.82);
        g.bezierCurveTo(dx - rb * 0.12, rb * 1.2, dx - rb * 0.2, rb * 1.45, dx - rb * 0.17, rb * 1.72);
        g.quadraticCurveTo(dx, rb * 1.84, dx + rb * 0.17, rb * 1.72);
        g.bezierCurveTo(dx + rb * 0.2, rb * 1.45, dx + rb * 0.12, rb * 1.2, dx + rb * 0.1, rb * 0.82);
        g.closePath();
        if (claro) {
          const m = g.createLinearGradient(dx - rb * 0.2, 0, dx + rb * 0.2, 0);
          m.addColorStop(0, '#f4cf98'); m.addColorStop(0.45, '#d9a466'); m.addColorStop(1, '#8a5a2c');
          g.fillStyle = m;
        } else g.fillStyle = '#6b4320';
        g.fill();
      };
      cabo(esp * 0.8, false);
      cabo(0, true);
      g.save(); g.clip();
      g.strokeStyle = 'rgba(110,65,25,.35)'; g.lineWidth = Math.max(0.8, rb * 0.015);
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * rb * 0.05, rb * 0.85); g.quadraticCurveTo(i * rb * 0.07 + rb * 0.02, rb * 1.3, i * rb * 0.06, rb * 1.8); g.stroke(); }
      g.fillStyle = '#1b1b1f'; g.fillRect(-rb * 0.25, rb * 1.02, rb * 0.5, rb * 0.09);
      g.restore();
      // Espessura da lâmina: borracha do outro lado, madeira e a borda da borracha da frente.
      g.fillStyle = minha ? '#141418' : '#b3201a';
      g.beginPath(); g.ellipse(esp, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d6a96c';
      g.beginPath(); g.ellipse(esp * 0.55, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = minha ? '#8e1510' : '#0f1115';
      g.beginPath(); g.ellipse(esp * 0.18, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
      // Face da borracha.
      const face = g.createLinearGradient(-rx, -ry, rx, ry);
      if (minha) { face.addColorStop(0, '#ff6a5c'); face.addColorStop(0.5, '#d42a20'); face.addColorStop(1, '#8a120d'); }
      else { face.addColorStop(0, '#4a505c'); face.addColorStop(0.5, '#23272f'); face.addColorStop(1, '#0d0f13'); }
      g.fillStyle = face;
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.clip();
      const passo = Math.max(3 * d, rb * 0.09);
      g.fillStyle = minha ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.05)';
      for (let y = -ry; y <= ry; y += passo) for (let x = -rx + (Math.abs(Math.round(y / passo)) % 2 ? passo / 2 : 0); x <= rx; x += passo) g.fillRect(x, y, Math.max(1, passo * 0.28), Math.max(1, passo * 0.28));
      g.translate(-rx * 0.35, -ry * 0.42); g.rotate(-0.6);
      const br = g.createRadialGradient(0, 0, 0, 0, 0, rx * 0.6);
      br.addColorStop(0, 'rgba(255,255,255,.32)'); br.addColorStop(1, 'rgba(255,255,255,0)');
      g.scale(1, 0.45); g.fillStyle = br; g.fillRect(-rx, -rx, rx * 2, rx * 2);
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = Math.max(1, rb * 0.025);
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      if (pulso) { g.fillStyle = 'rgba(255,255,255,' + (0.4 * pulso).toFixed(2) + ')'; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    // Bola: rastro, esfera com luz de cima e, quando espera a resposta do outro, um anel pulsando.
    function bola(cam, b, d) {
      if (s.desvio) { // correção da devolução prevista, em 0,22 s
        const k = 1 - (agora() - s.desvio.desde) / 0.22;
        if (k <= 0) s.desvio = null;
        else b = { x: b.x + s.desvio.x * k, y: b.y + s.desvio.y * k, z: b.z + s.desvio.z * k, e: b.e };
      }
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
