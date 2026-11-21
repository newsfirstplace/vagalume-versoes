// Vagalume — módulo "estilo": aplica à tela do hotel o CSS escrito pelo usuário na página de opções.
// O texto passa de novo pela limpeza (sem @import, sem url() remota) antes de entrar na página.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.texto) return;
  const { nucleo, camada, texto } = VL;

  nucleo.definirModulo({
    id: 'estilo',
    // Sem aoConfig: o núcleo reinicia o módulo quando o CSS muda.
    iniciar(ctx) {
      const css = texto.limparCss(ctx.secao().css);
      if (!css.trim()) return undefined;
      return camada.estiloPagina('estilo', css);
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
