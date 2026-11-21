// Vagalume — módulo "contador": mostra no canto da tela quantos quadros por segundo o hotel desenha
// e o ping (tempo de ida e volta até o servidor, medido pela Conexão do jogo). Cada um tem a sua chave.
// Com o limitador de quadros instalado, mostra o que o jogo realmente recebeu (o limitador conta e
// escreve em <html data-vl-fps-medido>). Sem ele, conta os quadros da tela, que é o ritmo do jogo.
// Visual (2026-11-14, pedido do usuário): pílula no tema do Vagalume, com um velocímetro no FPS (o
// ponteiro acompanha o número) e um sinal de wi-fi no ping (as barras acesas e a cor seguem a latência).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada) return;
  const { nucleo, camada } = VL;
  const SVG = 'http://www.w3.org/2000/svg';

  // Desenho com createElementNS: nada de HTML montado a partir de texto.
  function svg(filhos) {
    const raizSvg = document.createElementNS(SVG, 'svg');
    raizSvg.setAttribute('viewBox', '0 0 24 24');
    raizSvg.setAttribute('aria-hidden', 'true');
    raizSvg.setAttribute('class', 'vl-cont-icone');
    for (const [tag, atributos] of filhos) {
      const no = document.createElementNS(SVG, tag);
      for (const k of Object.keys(atributos)) no.setAttribute(k, atributos[k]);
      raizSvg.appendChild(no);
    }
    return raizSvg;
  }
  function iconeVelocimetro() {
    const icone = svg([
      ['path', { d: 'M4.2 17.5a8.6 8.6 0 1 1 15.6 0', class: 'arco' }],
      ['path', { d: 'M6.3 11.2l1.1.7M12 6.6v1.3M17.7 11.2l-1.1.7', class: 'marca' }],
      ['line', { x1: '12', y1: '16', x2: '12', y2: '9.6', class: 'ponteiro' }],
      ['circle', { cx: '12', cy: '16', r: '1.7', class: 'centro' }],
    ]);
    return icone;
  }
  function iconeWifi() {
    return svg([
      ['path', { d: 'M2.6 9.4a13.6 13.6 0 0 1 18.8 0', class: 'barra b3' }],
      ['path', { d: 'M5.9 12.9a8.9 8.9 0 0 1 12.2 0', class: 'barra b2' }],
      ['path', { d: 'M9.2 16.3a4.1 4.1 0 0 1 5.6 0', class: 'barra b1' }],
      ['circle', { cx: '12', cy: '19.4', r: '1.5', class: 'ponto' }],
    ]);
  }
  function qualidadeFps(v) { return v >= 50 ? 'bom' : v >= 25 ? 'medio' : 'ruim'; }
  function qualidadePing(ms) { return ms == null ? 'sem' : ms < 250 ? 'bom' : ms < 450 ? 'medio' : 'ruim'; }

  nucleo.definirModulo({
    id: 'contador',
    iniciar(ctx) {
      const html = document.documentElement;
      const el = camada.el;

      const fpsValor = el('b', { texto: '…' });
      const fpsLimite = el('span', { class: 'vl-cont-extra' });
      const velocimetro = iconeVelocimetro();
      const itemFps = el('span', { class: 'vl-cont-item', title: 'Quadros por segundo' }, [velocimetro, fpsValor, el('span', { class: 'vl-cont-unidade', texto: 'FPS' }), fpsLimite]);
      const pingValor = el('b', { texto: '…' });
      const pingUnidade = el('span', { class: 'vl-cont-unidade', texto: 'ms' });
      const itemPing = el('span', { class: 'vl-cont-item', title: 'Ping: ida e volta até o servidor (medindo…)' }, [iconeWifi(), pingValor, pingUnidade]);
      const divisor = el('span', { class: 'vl-cont-divisor' });
      const caixa = el('div', { class: 'vl-contador', 'aria-hidden': 'true' }, [itemFps, divisor, itemPing]);
      camada.area().appendChild(caixa);
      // O canto de cima à direita cobria a carteira do Habblet: o padrão passou para cima, à esquerda.
      function posicionar() { caixa.className = 'vl-contador ' + (ctx.secao().canto || 'sup-esq'); }
      posicionar();
      ctx.aoConfig(function (secao) { if (secao === 'contador') posicionar(); });
      html.setAttribute('data-vl-contador', ''); // pede ao limitador que publique a contagem

      let quadros = 0;
      let pedido = 0;
      function contar() {
        quadros += 1;
        pedido = requestAnimationFrame(contar);
      }
      pedido = requestAnimationFrame(contar);

      function mostrarFps(valor, limite) {
        fpsValor.textContent = String(valor);
        fpsLimite.textContent = limite ? '/ ' + limite : '';
        itemFps.dataset.q = qualidadeFps(valor);
        // ponteiro de -110° (0 FPS) a +110° (60 FPS ou mais, ou o limite)
        const teto = Math.max(30, Number(limite) || 60);
        const angulo = -110 + 220 * Math.min(1, valor / teto);
        const ponteiro = velocimetro.querySelector('.ponteiro');
        if (ponteiro) ponteiro.setAttribute('transform', 'rotate(' + angulo.toFixed(1) + ' 12 16)');
      }
      function mostrarPing(ms, texto) {
        pingValor.textContent = texto != null ? texto : (ms == null ? '—' : String(ms));
        pingUnidade.hidden = texto != null;
        itemPing.dataset.q = qualidadePing(ms);
      }

      // Ping: pedido pela Conexão do jogo (VL.latencia) a cada "intervaloPing" segundos.
      let ultimoPing = 0;
      let medindo = false;
      function desenhar() {
        const s = ctx.secao();
        itemFps.hidden = !s.mostrarFps;
        itemPing.hidden = !s.mostrarPing;
        divisor.hidden = !(s.mostrarFps && s.mostrarPing);
        caixa.hidden = !s.mostrarFps && !s.mostrarPing;
      }
      function talvezMedir() {
        const s = ctx.secao();
        if (!s.mostrarPing || medindo) return;
        if (!VL.latencia) { mostrarPing(null, 'ligue a Conexão'); return; }
        if (Date.now() - ultimoPing < (s.intervaloPing || 10) * 1000) return;
        ultimoPing = Date.now();
        medindo = true;
        VL.latencia.medir().then(function (ms) {
          medindo = false;
          mostrarPing(ms);
          const u = VL.latencia && VL.latencia.ultima;
          itemPing.title = u
            ? 'Ping: ' + u.mediana + ' ms (mediana de ' + u.amostras + ' medidas seguidas) · mínimo ' + u.minimo + ' ms · máximo ' + u.maximo + ' ms · variação ' + (u.maximo - u.minimo) + ' ms'
            : 'Ping: o servidor não respondeu';
        }, function () { medindo = false; });
      }
      ctx.aoConfig(function (secao) { if (secao === 'contador') { ultimoPing = 0; desenhar(); } });

      const relogio = setInterval(function () {
        // Preferência: quadros que o jogo desenhou (ponte do jogo fluido); depois, o limitador.
        const jogoFps = html.getAttribute('data-vl-fps-jogo');
        const medido = jogoFps != null && jogoFps !== '' ? jogoFps : html.getAttribute('data-vl-fps-medido');
        const valor = medido != null && medido !== '' ? Number(medido) : quadros;
        quadros = 0;
        mostrarFps(valor, html.getAttribute('data-vl-fps'));
        talvezMedir();
        desenhar();
      }, 1000);
      desenhar();

      return function () {
        cancelAnimationFrame(pedido);
        clearInterval(relogio);
        caixa.remove();
        html.removeAttribute('data-vl-contador');
      };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
