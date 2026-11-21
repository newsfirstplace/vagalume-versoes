// Vagalume — módulo "agrupar": quando a mesma pessoa repete a mesma fala em pouco tempo (respeitos,
// recados de wired, falas coladas de novo), a repetição some e a primeira ganha um "×2", "×3"…
// Vale só na tela do usuário. Ao desligar, tudo volta como estava.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.agrupar) return;
  const { nucleo, camada, jogo } = VL;
  const REPETIDA = 'data-vl-repetida';
  const VEZES = 'data-vl-vezes';
  const CSS = '[' + REPETIDA + '] { display: none !important; }\n' +
    '[' + VEZES + '] .message::after, [' + VEZES + '].message::after { content: " ×" attr(' + VEZES + '); font-weight: bold; opacity: .75; }';

  nucleo.definirModulo({
    id: 'agrupar',
    // Sem aoConfig: o núcleo reinicia o módulo quando as opções dele mudam.
    iniciar(ctx) {
      const agrupador = VL.agrupar.criarAgrupador(ctx.secao().janela * 1000);
      const removerEstilo = camada.estiloPagina('agrupar', CSS);

      ctx.aoParar(jogo.observarFalas(function (fala) {
        if (!fala.el) return;
        const r = agrupador.registrar(fala.autor, fala.texto, fala.quando, fala.el);
        if (!r.repetida) return;
        if (!r.dono.isConnected) { agrupador.esquecer(r.dono); agrupador.registrar(fala.autor, fala.texto, fala.quando, fala.el); return; }
        fala.el.setAttribute(REPETIDA, '');
        // O número vai no elemento da mensagem quando ele existe, para o "×N" ficar no fim do texto.
        const alvo = r.dono.querySelector ? (r.dono.querySelector(jogo.seletor('mensagem')) || r.dono) : r.dono;
        alvo.setAttribute(VEZES, String(r.vezes));
      }));

      ctx.aoParar(function () {
        removerEstilo();
        document.querySelectorAll('[' + REPETIDA + ']').forEach((no) => no.removeAttribute(REPETIDA));
        document.querySelectorAll('[' + VEZES + ']').forEach((no) => no.removeAttribute(VEZES));
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
