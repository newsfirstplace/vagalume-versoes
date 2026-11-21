// Vagalume — módulo "fluido": tira a trava de 60 quadros por segundo do jogo (a ponte do mundo da
// página, src/principal/fluido.js, faz o trabalho). A conversa é só pelo atributo <html data-vl-fluido>.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo) return;
  VL.nucleo.definirModulo({
    id: 'fluido',
    iniciar(ctx) {
      const html = document.documentElement;
      html.setAttribute('data-vl-fluido', '');
      ctx.aoParar(function () { html.removeAttribute('data-vl-fluido'); });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
