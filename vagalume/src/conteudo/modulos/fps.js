// Vagalume — módulo "fps": informa o limite de quadros ao script que roda no mundo da página
// (src/principal/limite-fps.js). A conversa entre os dois é só por atributos em <html>.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada) return;
  const { nucleo, camada } = VL;
  let avisouRecarga = false;

  nucleo.definirModulo({
    id: 'fps',
    iniciar(ctx) {
      const html = document.documentElement;

      function aplicar() {
        html.setAttribute('data-vl-fps', String(ctx.secao().limite));
      }

      aplicar();
      ctx.aoParar(function () { html.removeAttribute('data-vl-fps'); });
      ctx.aoConfig(function (secao) { if (secao === 'fps') aplicar(); });

      // O limitador é instalado quando a página carrega; se ainda não está lá, só vale na próxima carga.
      if (!html.hasAttribute('data-vl-fps-ativo') && !avisouRecarga) {
        avisouRecarga = true;
        camada.aviso('O limite de quadros vale depois de recarregar o hotel.');
      }

      ctx.comando({
        nome: 'fps',
        uso: 'fps [quadros]',
        descricao: 'Mostra ou muda o limite de quadros por segundo.',
        executar(pedido) {
          const bruto = pedido.args[0];
          if (bruto == null || bruto === '') {
            camada.aviso('Limite atual: ' + ctx.secao().limite + ' quadros por segundo.');
            return undefined;
          }
          const numero = Number(String(bruto).replace(',', '.'));
          if (!Number.isFinite(numero)) {
            camada.aviso('Informe um número de quadros. Exemplo: fps 30', { tipo: 'erro' });
            return undefined;
          }
          return ctx.alterar('fps', { limite: numero }).then(function (salvo) {
            camada.aviso('Limite ajustado para ' + salvo.limite + ' quadros por segundo.', { tipo: 'ok' });
          });
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
