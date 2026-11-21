// Vagalume — módulo "notificacoes": guarda os avisos que o jogo mostra no canto da tela (moedas
// recebidas, conquistas, convites…), para rever depois com o comando `notificacoes`.
// Só na memória da aba: some ao recarregar. Classe do aviso conferida ao vivo em 2026-11-13:
// `.nitro-notification-bubble`; os avisos de `.Toastify` também entram.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada) return;
  const { nucleo, camada } = VL;
  const SELETOR = '.nitro-notification-bubble, .Toastify__toast';
  const LIMITE = 100;

  nucleo.definirModulo({
    id: 'notificacoes',
    iniciar(ctx) {
      const lista = []; // { quando, texto }
      const vistos = new WeakSet();

      function guardar(el) {
        if (vistos.has(el) || camada.contem({ target: el })) return;
        vistos.add(el);
        const texto = String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        if (!texto) return;
        const ultimo = lista[lista.length - 1];
        if (ultimo && ultimo.texto === texto && Date.now() - ultimo.quando < 1500) return; // o mesmo aviso desenhado de novo
        lista.push({ quando: Date.now(), texto });
        if (lista.length > LIMITE) lista.shift();
      }

      // Esconder alguns avisos do canto (continuam no histórico). Conferido ao vivo em 2026-11-14:
      // o aviso de compra é `.nitro-notification-bubble.default-bubble` com "Você comprou …".
      const OCULTO = 'data-vl-aviso-oculto';
      const removerEstilo = camada.estiloPagina('notificacoes', '[' + OCULTO + '] { display: none !important; }');
      ctx.aoParar(function () { removerEstilo(); document.querySelectorAll('[' + OCULTO + ']').forEach((n) => n.removeAttribute(OCULTO)); });
      function talvezEsconder(el) {
        const s = ctx.secao();
        const texto = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        const compra = /^voc[eê] comprou\b/i.test(texto);
        const conquista = /\bconquista\b/i.test(texto) && !/r[aá]dio/i.test(texto);
        if ((s.ocultarCompras && compra) || (s.ocultarConquistas && conquista)) el.setAttribute(OCULTO, '');
      }
      function tratar(el) { guardar(el); talvezEsconder(el); }

      function procurar(no) {
        if (!no || no.nodeType !== 1) return;
        if (no.matches(SELETOR)) tratar(no);
        no.querySelectorAll(SELETOR).forEach(tratar);
      }

      const observador = new MutationObserver(function (mudancas) {
        for (const m of mudancas) m.addedNodes.forEach(procurar);
      });
      observador.observe(document.body, { childList: true, subtree: true });
      document.querySelectorAll(SELETOR).forEach(tratar);
      ctx.aoParar(function () { observador.disconnect(); });
      ctx.aoConfig(function (secao) {
        if (secao !== 'notificacoes') return;
        document.querySelectorAll('[' + OCULTO + ']').forEach((n) => n.removeAttribute(OCULTO));
        document.querySelectorAll(SELETOR).forEach(talvezEsconder);
      });

      ctx.comando({
        nome: 'notificacoes',
        apelidos: ['notificações', 'avisos'],
        uso: 'notificacoes [limpar]',
        descricao: 'Mostra os avisos do jogo desde que o hotel abriu (só na memória).',
        executar(pedido) {
          if (String(pedido.args[0] || '').toLowerCase() === 'limpar') { lista.length = 0; camada.aviso('Histórico de avisos limpo.'); return; }
          if (!lista.length) { camada.aviso('Nenhum aviso do jogo desde que o hotel abriu.'); return; }
          const hora = (q) => { const d = new Date(q); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
          const el = camada.el;
          camada.dialogo({
            titulo: 'Avisos do jogo',
            texto: lista.length + (lista.length === 1 ? ' aviso' : ' avisos') + ' desde que o hotel abriu, do mais recente ao mais antigo.',
            conteudo: el('div', { class: 'vl-avisos-lista' }, lista.slice().reverse().map(function (n) {
              return el('div', { class: 'vl-aviso-item' }, [el('span', { class: 'vl-aviso-hora', texto: hora(n.quando) }), el('span', { class: 'vl-aviso-texto', texto: n.texto })]);
            })),
          });
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
