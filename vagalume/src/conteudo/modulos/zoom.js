// Vagalume — módulo "zoom": a roda do mouse sobre o quarto aproxima e afasta, e o zoom pode ser
// ajustado sozinho ao entrar em cada quarto. Usa o próprio botão de zoom do jogo, conferido ao vivo
// em 2026-11-13: `.nitro-room-tools .icon-zoom-less` (está perto; clicar afasta) alterna com
// `.icon-zoom-more` (está longe; clicar aproxima). O jogo só tem esses dois níveis.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo) return;
  const { nucleo, camada, jogo } = VL;

  function botao() { return document.querySelector('.nitro-room-tools .icon-zoom-less, .nitro-room-tools .icon-zoom-more'); }
  function estaPerto() { const b = botao(); return b ? b.classList.contains('icon-zoom-less') : null; }
  function ir(perto) {
    const b = botao();
    if (!b || estaPerto() === perto) return false;
    b.click();
    return true;
  }

  // Zoom de câmera: amplia o desenho do quarto (o canvas) por fora do jogo, aos poucos e na direção
  // do mouse. Os cliques continuam certos: o jogo mede o canvas pela posição dele na tela (conferido
  // ao vivo). Balões e menus do avatar só são deslocados para acompanhar o lugar ampliado, sem crescer.
  // A escala nunca fica abaixo de 1, para a imagem sempre cobrir a tela (sem bordas vazias).
  function criarCamera(ctx) {
    let s = 1;
    let t = { x: 0, y: 0 };
    let alvoS = 1;
    let alvoT = { x: 0, y: 0 };
    let quadro = 0;
    let ultimoCanvas = null;
    // Afastar além do normal, fluido (pedido do usuário em 2026-11-15): o "zoom longe" do jogo desenha
    // o quarto à metade, a partir do centro da tela. Na troca, a câmera entra 2× centrada no mesmo
    // instante (a imagem fica igual) e depois desce aos poucos até 1×. Ao aproximar, sobe até 2× e
    // volta ao zoom normal do jogo com a câmera em 1×. Enquanto "longe", a câmera fica entre 1× e 2×.
    let longe = false;

    function canvas() {
      const c = document.querySelector('.overflow-hidden canvas') || document.querySelector('canvas');
      if (ultimoCanvas && ultimoCanvas !== c) limparCanvas(ultimoCanvas);
      ultimoCanvas = c;
      return c;
    }
    function limparCanvas(c) { c.style.transform = ''; c.style.transformOrigin = ''; c.style.imageRendering = ''; }
    function origem(c) {
      const r = (c.parentElement || c).getBoundingClientRect();
      return { x: r.left, y: r.top, w: c.offsetWidth, h: c.offsetHeight };
    }
    function limitar(escala, tt, o) {
      return { x: Math.min(0, Math.max(o.w * (1 - escala), tt.x)), y: Math.min(0, Math.max(o.h * (1 - escala), tt.y)) };
    }
    // Âncora: balões e menus pelo pé, no meio; placares do quarto pelo canto de cima à esquerda.
    function deslocar(el, o) {
      if (s <= 1.001) { if (el.style.translate) el.style.translate = ''; return; }
      const pai = el.offsetParent ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
      const placar = el.classList.contains('nitro-widget-high-score');
      const ax = pai.left + el.offsetLeft + (placar ? 0 : el.offsetWidth / 2) - o.x;
      const ay = pai.top + el.offsetTop + (placar ? 0 : el.offsetHeight) - o.y;
      const valor = (t.x + (s - 1) * ax).toFixed(1) + 'px ' + (t.y + (s - 1) * ay).toFixed(1) + 'px';
      if (el.style.translate !== valor) el.style.translate = valor;
    }
    function aplicar() {
      const c = canvas();
      if (!c) return;
      const o = origem(c);
      if (s <= 1.001) limparCanvas(c);
      else {
        c.style.transformOrigin = '0 0';
        c.style.transform = 'translate(' + t.x.toFixed(1) + 'px, ' + t.y.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
        c.style.imageRendering = longe ? 'auto' : 'pixelated'; // na transição do zoom longe, suave
      }
      document.querySelectorAll('.nitro-chat-widget .bubble-container, .nitro-context-menu, .nitro-widget-high-score').forEach(function (el) { deslocar(el, o); });
    }
    // A cada quadro: chega perto do alvo (suave) e mantém balões e menus no lugar, que o jogo move.
    function passo() {
      quadro = 0;
      const k = 0.28;
      s += (alvoS - s) * k;
      t = { x: t.x + (alvoT.x - t.x) * k, y: t.y + (alvoT.y - t.y) * k };
      if (Math.abs(alvoS - s) < 0.002) { s = alvoS; t = alvoT; }
      aplicar();
      if (longe && alvoS >= 2 && s >= 1.995) { voltarDoLonge(); return; }
      if (s > 1.001 || alvoS > 1.001) quadro = requestAnimationFrame(passo);
    }
    function alvoLonge(escala, o) {
      const e = Math.min(2, Math.max(1, escala));
      return { s: e, t: { x: -(o.w / 2) * (e - 1), y: -(o.h / 2) * (e - 1) } };
    }
    // Sem piscada (vídeo do usuário em 2026-11-15): o jogo troca o zoom numa atualização do React e só
    // redesenha no quadro seguinte. A câmera muda no MESMO quadro em que o jogo redesenhou: a cada quadro,
    // depois do desenho do jogo, o Vagalume lê alguns pontos do canvas e compara com antes da troca.
    let trocando = false;
    function assinatura(c) {
      try {
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return null;
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const px = new Uint8Array(4);
        const saida = [];
        for (let i = 0; i < 48; i++) {
          gl.readPixels(Math.floor(((i % 8) + 0.5) * w / 8), Math.floor((Math.floor(i / 8) + 0.5) * h / 6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          saida.push((px[0] << 16) | (px[1] << 8) | px[2]);
        }
        return saida;
      } catch (erro) { return null; }
    }
    // Troca sincronizada. O navegador, a cada quadro: roda os requestAnimationFrame (o jogo desenha
    // num deles), calcula o layout, chama os ResizeObserver e só então pinta. O Vagalume muda o tamanho
    // de uma "sonda" invisível a cada quadro e confere o canvas no ResizeObserver, depois do desenho do
    // jogo e antes da pintura: a câmera muda no mesmo quadro em que o jogo redesenhou (medido ao vivo
    // em 2026-11-15: com requestAnimationFrame a câmera vinha um quadro depois, a "piscada").
    function trocaSincronizada(c, acao, aoMudar) {
      const sonda = document.createElement('div');
      sonda.style.cssText = 'position:fixed;left:-20px;top:-20px;width:1px;height:1px;pointer-events:none;visibility:hidden;';
      document.documentElement.appendChild(sonda);
      let antes = null;
      let fase = 0;
      let quadros = 0;
      function proximo() { requestAnimationFrame(function () { sonda.style.width = (sonda.style.width === '1px' ? '2px' : '1px'); }); }
      function terminar() { ro.disconnect(); sonda.remove(); aoMudar(); }
      const ro = new ResizeObserver(function () {
        if (fase === 0) {
          // Depois do desenho deste quadro: guarda como está e pede a troca ao jogo.
          antes = assinatura(c);
          fase = 1;
          if (!acao()) { ro.disconnect(); sonda.remove(); trocando = false; return; }
          proximo();
          return;
        }
        quadros++;
        const agora = assinatura(c);
        let diferentes = 0;
        if (antes && agora) for (let i = 0; i < antes.length; i++) if (antes[i] !== agora[i]) diferentes++;
        if ((!antes || !agora) ? quadros >= 2 : (diferentes >= antes.length * 0.45 || quadros > 20)) terminar();
        else proximo();
      });
      ro.observe(sonda);
    }
    function irParaLonge(o, fator) {
      if (trocando) return true;
      const c = canvas();
      if (!c || !botao()) return false;
      trocando = true;
      trocaSincronizada(c, function () { return ir(false); }, function () {
        longe = true;
        s = 2;
        t = { x: -o.w / 2, y: -o.h / 2 };
        aplicar();
        // Vai direto até o zoom longe completo (1×): no meio do caminho o desenho do jogo, feito com as
        // imagens pequenas do zoom longe, fica ampliado e sem qualidade (vídeo do usuário em 2026-11-15).
        const a = alvoLonge(1, o);
        alvoS = a.s;
        alvoT = a.t;
        trocando = false;
        animar();
      });
      return true;
    }
    function voltarDoLonge() {
      if (trocando) return;
      const c = canvas();
      const terminar = function () {
        longe = false;
        s = 1; t = { x: 0, y: 0 }; alvoS = 1; alvoT = { x: 0, y: 0 };
        aplicar();
        trocando = false;
      };
      trocando = true;
      if (!c) { ir(true); terminar(); return; }
      trocaSincronizada(c, function () { ir(true); return true; }, terminar);
    }
    function animar() { if (!quadro) quadro = requestAnimationFrame(passo); }
    // centrar: leva o ponto para o meio da tela (usado pelo /achar); sem ele, o ponto fica parado sob o mouse.
    function para(escala, ponto, centrar) {
      const c = canvas();
      if (!c) return false;
      const o = origem(c);
      const max = Math.max(1.5, Number(ctx.secao().maximo) || 4);
      const nova = Math.min(max, Math.max(1, escala));
      const q = ponto ? { x: ponto.x - o.x, y: ponto.y - o.y } : { x: o.w / 2, y: o.h / 2 };
      const p = { x: (q.x - alvoT.x) / alvoS, y: (q.y - alvoT.y) / alvoS };
      const destino = centrar ? { x: o.w / 2, y: o.h / 2 } : q;
      alvoT = nova <= 1.001 ? { x: 0, y: 0 } : limitar(nova, { x: destino.x - nova * p.x, y: destino.y - nova * p.y }, o);
      alvoS = nova;
      animar();
      return true;
    }
    function rolar(ev) {
      const porGiro = Math.max(0.05, Math.min(0.5, (Number(ctx.secao().passo) || 15) / 100));
      const giros = Math.max(-3, Math.min(3, ev.deltaY / 100));
      const fator = Math.pow(1 + porGiro, -giros);
      if (trocando) return;
      const c = canvas();
      if (!c) return;
      const o = origem(c);
      if (longe) {
        // Longe: afastar não faz mais nada; aproximar anima direto até 2× e o passo() volta ao zoom normal.
        if (fator < 1) return;
        const a = alvoLonge(2, o);
        alvoS = a.s;
        alvoT = a.t;
        animar();
        return;
      }
      if (fator < 1 && alvoS <= 1.001 && s <= 1.01 && ctx.secao().afastarAlem && estaPerto() === true) {
        if (irParaLonge(o, fator)) return;
      }
      para(alvoS * fator, { x: ev.clientX, y: ev.clientY });
    }
    // O jogo calcula o piso pelo clientX/clientY do mouse, sem saber que o canvas foi ampliado (vídeo do
    // usuário em 2026-11-15: com zoom, o clique ia para outro piso). Os eventos de mouse sobre o canvas
    // ampliado são segurados e mandados de novo com a posição de volta na escala 1.
    const EVENTOS_MOUSE = ['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'pointermove'];
    const reenviados = new WeakSet();
    function corrigir(ev) {
      if (reenviados.has(ev) || s <= 1.001) return;
      const c = ultimoCanvas;
      if (!c || ev.target !== c) return;
      const o = origem(c);
      const x = o.x + (ev.clientX - o.x - t.x) / s;
      const y = o.y + (ev.clientY - o.y - t.y) / s;
      ev.stopImmediatePropagation();
      // Só o menu do botão direito tem o efeito padrão cancelado. Cancelar o pointerdown impedia o
      // mousedown que o jogo usa para arrastar o quarto (pedido do usuário em 2026-11-15).
      if (ev.type === 'contextmenu') ev.preventDefault();
      const Classe = ev instanceof PointerEvent ? PointerEvent : MouseEvent;
      const novo = new Classe(ev.type, {
        bubbles: ev.bubbles, cancelable: ev.cancelable, composed: true, view: window, detail: ev.detail,
        screenX: ev.screenX, screenY: ev.screenY, clientX: x, clientY: y,
        ctrlKey: ev.ctrlKey, shiftKey: ev.shiftKey, altKey: ev.altKey, metaKey: ev.metaKey,
        button: ev.button, buttons: ev.buttons, relatedTarget: ev.relatedTarget,
        pointerId: ev.pointerId, pointerType: ev.pointerType, isPrimary: ev.isPrimary,
      });
      reenviados.add(novo);
      c.dispatchEvent(novo);
    }
    for (const tipo of EVENTOS_MOUSE) ctx.escutar(window, tipo, corrigir, true);

    function normal(semAnimacao) {
      if (longe) { voltarDoLonge(); return; }
      alvoS = 1;
      alvoT = { x: 0, y: 0 };
      if (semAnimacao) { s = 1; t = { x: 0, y: 0 }; aplicar(); } else animar();
    }
    ctx.escutar(window, 'resize', function () {
      const c = canvas();
      if (c) alvoT = limitar(alvoS, alvoT, origem(c));
      animar();
    });
    ctx.aoParar(function () {
      cancelAnimationFrame(quadro);
      if (ultimoCanvas) limparCanvas(ultimoCanvas);
      document.querySelectorAll('.nitro-chat-widget .bubble-container, .nitro-context-menu, .nitro-widget-high-score').forEach(function (el) { el.style.translate = ''; });
    });
    return { rolar, para, normal, escala: function () { return alvoS; } };
  }

  nucleo.definirModulo({
    id: 'zoom',
    iniciar(ctx) {
      let ultimo = 0;
      const camera = criarCamera(ctx);
      // Para outros módulos (o /achar aproxima a câmera de uma pessoa e volta).
      VL.zoomCamera = camera;
      ctx.aoParar(function () { if (VL.zoomCamera === camera) VL.zoomCamera = null; });
      ctx.escutar(window, 'wheel', function (ev) {
        if (!ctx.secao().roda || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) return;
        const alvo = ev.target;
        // Só sobre o desenho do quarto, nunca sobre janelas, barra ou a camada do Vagalume.
        if (!alvo || alvo.tagName !== 'CANVAS' || camada.contem(ev)) return;
        if (typeof alvo.closest === 'function' && alvo.closest('.nitro-card, .nitro-toolbar')) return;
        if (ctx.secao().modo !== 'jogo') {
          // Afastar além do normal: no tamanho 1, girar para afastar usa o "zoom longe" do jogo; girar
          // para aproximar com o jogo longe volta primeiro ao zoom normal do jogo.
          camera.rolar(ev);
          return;
        }
        const agora = Date.now();
        if (agora - ultimo < 300) return;
        if (ir(ev.deltaY < 0)) ultimo = agora;
      }, { capture: true, passive: true });

      // Zoom ao entrar no quarto: precisa da conexão para saber quando um quarto novo abriu.
      if (VL.conexao && VL.codigos) {
        ctx.aoParar(VL.conexao.ouvir('entrada', VL.codigos.ENTRADA.QUARTO_PRONTO, function () {
          camera.normal(true);
          const quer = ctx.secao().aoEntrar;
          if (quer !== 'perto' && quer !== 'longe') return;
          // O botão aparece quando o quarto termina de carregar.
          let tentativas = 0;
          const relogio = setInterval(function () {
            tentativas++;
            if (botao() || tentativas > 20) {
              clearInterval(relogio);
              ir(quer === 'perto');
            }
          }, 250);
        }));
      }

      ctx.comando({
        nome: 'zoom',
        uso: 'zoom [perto | longe | normal | 1 a 8]',
        descricao: 'Perto e longe usam o botão do jogo; um número amplia o quarto como câmera (ex.: zoom 2); normal volta ao tamanho original.',
        executar(pedido) {
          const arg = String(pedido.args[0] || '').toLowerCase();
          if (arg === 'normal') { camera.normal(); return; }
          const n = Number(arg.replace(',', '.').replace(/x$/, ''));
          if (arg && Number.isFinite(n)) {
            if (!camera.para(n)) camada.aviso('Abra um quarto primeiro.', { tipo: 'erro' });
            return;
          }
          const atual = estaPerto();
          if (atual === null) { camada.aviso('Abra um quarto primeiro.', { tipo: 'erro' }); return; }
          ir(arg === 'perto' ? true : arg === 'longe' ? false : !atual);
        },
      });
    },
  });

  VL.zoomQuarto = { estaPerto, ir };
  void jogo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
